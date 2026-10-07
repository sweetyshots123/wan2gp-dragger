"""Dragger - drag & drop and paste images into WanGP's image galleries.

Targets the three image galleries of the generator form (and of the queue "Edit"
tab): "Images as starting points" (image_start), "End Image(s)" (image_end) and
"Reference Images" (image_refs). Each is a WanGP AdvancedMediaGallery: a gr.Gallery
plus a gr.State dict {"items", "selected", "single", ...}.

How it works
  * The browser part (``dragger.js``, injected with the official ``add_custom_js``
    API) intercepts drops / pastes over these galleries, uploads the images with
    Gradio's own upload endpoint and asks the server, through a hidden bridge (one
    textbox + one button per gallery, built in the "Dragger" tab), to add them.
  * The server handler receives the gallery value and its gr.State and runs
    WanGP's own AdvancedMediaGallery handlers (``_on_add`` for adding, exactly what
    the "Add" button runs; ``_on_remove`` for the per-thumbnail X, exactly what the
    "Remove" button runs), then returns the gallery update + state through the
    normal Gradio event. No DOM-only changes, no core file is modified.
  * Images in formats WanGP's galleries don't accept (AVIF, HEIC, ICO, ...) or
    without a proper extension are converted to PNG; optional auto-downscale.
"""
import copy
import ipaddress
import json
import math
import os
import re
import socket
import threading
import time
import traceback
import urllib.parse
import urllib.request
import uuid

import gradio as gr

from shared.utils.plugins import WAN2GPPlugin

PLUGIN_VERSION = "1.0.0"
_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_PATH = os.path.join(_PLUGIN_DIR, "settings.json")

TARGETS = (("image_start", "Imagen de inicio"), ("image_end", "Imagen final"), ("image_refs", "Referencias"))
TAB_IDS = ("generate", "edit")
POSITION_CHOICES = [("Al final", "end"), ("Al principio", "start"), ("Después de la seleccionada (como «Add»)", "after_selected")]
X_MODE_CHOICES = [("Al pasar el ratón", "hover"), ("Siempre visible", "always")]

DEFAULT_SETTINGS = {
    "drag_enabled": True,        # drop images (files, browser images, URLs) on the galleries
    "paste_enabled": True,       # Ctrl+V pastes clipboard images into the gallery under the pointer / last clicked
    "targets": {"image_start": True, "image_end": True, "image_refs": True},
    "position": "end",           # "end" | "start" | "after_selected" (= what WanGP's Add button does)
    "downscale": False,          # shrink images whose longest side is above max_side
    "max_side": 2048,            # px (64..16384)
    "toasts": True,              # confirmation messages ("Añadidas N imágenes a ...")
    "toast_ms": 3500,            # ms (1000..30000)
    "remote_download": True,     # download images from web URLs on the server when the browser can't (CORS)
    "remove_x": True,            # small round X on every thumbnail to remove only that image
    "remove_x_mode": "hover",    # "hover" | "always"
    "undo": True,                # "Imagen quitada · Deshacer" for 5 s after an X removal
}
_CHOICES = {"position": ("end", "start", "after_selected"), "remove_x_mode": ("hover", "always")}
_RANGES = {"max_side": (64, 16384), "toast_ms": (1000, 30000)}

# Formats that WanGP's image galleries and generators read as they are.
_KEEP_FORMATS = {"PNG": ".png", "JPEG": ".jpg", "MPO": ".jpg", "BMP": ".bmp", "GIF": ".gif", "WEBP": ".webp", "TIFF": ".tif"}
_GALLERY_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff", ".jfif", ".pjpeg"}
_EXT_OK_FOR = {"PNG": {".png"}, "JPEG": {".jpg", ".jpeg", ".jfif", ".pjpeg"}, "MPO": {".jpg", ".jpeg"}, "BMP": {".bmp"},
               "GIF": {".gif"}, "WEBP": {".webp"}, "TIFF": {".tif", ".tiff"}}
MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024
UNDO_TTL_S = 15 * 60

try:  # optional HEIC/HEIF support
    import pillow_heif  # type: ignore
    pillow_heif.register_heif_opener()
    HEIF_SUPPORT = True
except Exception:
    HEIF_SUPPORT = False


def _coerce(key, default, value):
    if isinstance(default, bool):
        return value if isinstance(value, bool) else default
    if key in _CHOICES:
        value = str(value).strip().lower()
        return value if value in _CHOICES[key] else default
    if isinstance(default, int):
        ok = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        if not ok:
            return default
        lo, hi = _RANGES.get(key, (1, 10**9))
        return int(max(lo, min(hi, round(value))))
    return default


def load_settings(path=None):
    settings = copy.deepcopy(DEFAULT_SETTINGS)
    try:
        with open(path or SETTINGS_PATH, "r", encoding="utf-8") as reader:
            user = json.load(reader)
    except FileNotFoundError:
        return settings
    except Exception as e:  # never break WanGP start-up because of a bad settings file
        print(f"[Dragger] Ignoring invalid settings.json: {e}")
        return settings
    if not isinstance(user, dict):
        return settings
    for key, default in DEFAULT_SETTINGS.items():
        if key not in user:
            continue
        if key == "targets":
            if isinstance(user[key], dict):
                for name, _label in TARGETS:
                    if isinstance(user[key].get(name), bool):
                        settings[key][name] = user[key][name]
        else:
            settings[key] = _coerce(key, default, user[key])
    return settings


def save_settings(settings, path=None):
    path = path or SETTINGS_PATH
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as writer:
        json.dump(settings, writer, indent=2, ensure_ascii=False)
        writer.write("\n")
    os.replace(tmp, path)


def build_js(settings=None):
    settings = settings or load_settings()
    with open(os.path.join(_PLUGIN_DIR, "dragger.js"), "r", encoding="utf-8") as reader:
        script = reader.read()
    return script.replace("__DRAGGER_SETTINGS__", json.dumps(settings)).replace("__DRAGGER_VERSION__", PLUGIN_VERSION)


def _upload_folder():
    try:
        from gradio import utils as gr_utils
        return os.path.realpath(gr_utils.get_upload_folder())  # WanGP patches this to honour GRADIO_TEMP_DIR
    except Exception:
        import tempfile
        return os.path.realpath(os.environ.get("GRADIO_TEMP_DIR") or os.path.join(tempfile.gettempdir(), "gradio"))


def _inside(path, root):
    try:
        path, root = os.path.realpath(path), os.path.realpath(root)
        return os.path.commonpath([path, root]) == root
    except Exception:
        return False


def _safe_stem(name, fallback="imagen"):
    stem = os.path.splitext(os.path.basename(str(name or "")))[0]
    stem = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", stem).strip(" ._")
    return (stem or fallback)[:80]


def _path_from_file_url(url):
    """'http://host/<root>/gradio_api/file=/tmp/gradio/x/a.png' -> absolute path (None if not a Gradio file URL)."""
    if not isinstance(url, str) or "file=" not in url:
        return None
    path = urllib.parse.unquote(url.split("file=", 1)[1].split("?", 1)[0].split("#", 1)[0])
    return os.path.abspath(os.path.normpath(path)) if path else None


def _is_local_request(request):
    try:
        host = request.client.host
        return ipaddress.ip_address(host.split("%")[0]).is_loopback
    except Exception:
        return False


class DraggerError(Exception):
    pass


class DraggerPlugin(WAN2GPPlugin):
    def __init__(self):
        super().__init__()
        self.name = "Dragger"
        self.version = PLUGIN_VERSION
        self.description = "Drag & drop and paste images into WanGP's start / end / reference image galleries (append), per-thumbnail remove X."
        self.targets = {}      # "generate:image_start" -> {"tab", "name", "label", "gallery", "state"}
        self._amg = None
        self._undo = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------ plugin API
    def setup_ui(self):
        for name, _label in TARGETS:
            self.request_component(name)
            self.request_component(f"{name}_extra")
        self.request_component("tab_id")
        self.add_custom_js(build_js())
        self.add_tab(tab_id="dragger", label="Dragger", component_constructor=self.create_ui)

    def post_ui_setup(self, components):
        """Called once per generator form ('generate', then the queue 'edit' tab)."""
        tab = components.get("tab_id")
        tab = tab if tab in TAB_IDS else ("generate" if not any(k.startswith("generate:") for k in self.targets) else "edit")
        for name, label in TARGETS:
            gallery, extra = components.get(name), components.get(f"{name}_extra")
            # extra = [row, upload_btn, btn_left, btn_right, btn_clear, gallery, state] (see wgp.get_image_gallery)
            if gallery is None or not isinstance(extra, (list, tuple)) or len(extra) < 2:
                print(f"[Dragger] {tab}:{name} not found, skipped")
                continue
            state = extra[-1]
            if extra[-2] is not gallery or not isinstance(state, gr.State):
                print(f"[Dragger] {tab}:{name} has an unexpected layout, skipped")
                continue
            self.targets[f"{tab}:{name}"] = {"tab": tab, "name": name, "label": label, "gallery": gallery, "state": state}
        return {}

    def amg(self):
        if self._amg is None:
            from shared.gradio.gallery import AdvancedMediaGallery
            # Unmounted helper: only its (stateless) handlers are used, on the real gallery value + gr.State.
            self._amg = AdvancedMediaGallery(media_mode="image")
        return self._amg

    # ---------------------------------------------------------------- UI tab
    def create_ui(self):
        current = lambda key: (lambda: load_settings()[key])
        gr.HTML("<style>.dragger-hidden{display:none !important;}</style>")
        gr.Markdown(f"## Dragger {PLUGIN_VERSION}\nArrastra o pega (Ctrl+V) imágenes en las galerías de imagen de inicio, imagen final y referencias, "
                    "aunque ya tengan imágenes: se **añaden** a las que hay. La X de cada miniatura quita solo esa imagen. "
                    "Los cambios se guardan en `settings.json` de la carpeta del plugin y se aplican al momento.")
        with gr.Group():
            gr.Markdown("### Entrada")
            with gr.Row():
                drag_enabled = gr.Checkbox(label="Arrastrar y soltar imágenes", value=current("drag_enabled"), elem_id="dragger_drag_enabled",
                                           info="Archivos del Explorador, imágenes arrastradas desde una web o enlaces a imágenes.")
                paste_enabled = gr.Checkbox(label="Pegar con Ctrl+V", value=current("paste_enabled"), elem_id="dragger_paste_enabled",
                                            info="Va a la galería bajo el ratón o la última en la que hiciste clic; si solo hay una visible, a esa. "
                                                 "En los cuadros de texto Ctrl+V pega texto como siempre.")
                remote = gr.Checkbox(label="Descargar en el servidor las imágenes web que el navegador no deja leer", value=current("remote_download"),
                                     elem_id="dragger_remote_download")
            with gr.Row():
                t_start = gr.Checkbox(label="Imagen de inicio", value=lambda: load_settings()["targets"]["image_start"], elem_id="dragger_t_image_start")
                t_end = gr.Checkbox(label="Imagen final", value=lambda: load_settings()["targets"]["image_end"], elem_id="dragger_t_image_end")
                t_refs = gr.Checkbox(label="Referencias", value=lambda: load_settings()["targets"]["image_refs"], elem_id="dragger_t_image_refs")
            with gr.Row():
                position = gr.Dropdown(label="Dónde se añaden las imágenes nuevas", choices=POSITION_CHOICES, value=current("position"),
                                       elem_id="dragger_position")
                downscale = gr.Checkbox(label="Reducir las imágenes grandes", value=current("downscale"), elem_id="dragger_downscale")
                max_side = gr.Number(label="Lado mayor máximo (px)", value=current("max_side"), precision=0, minimum=64, maximum=16384,
                                     elem_id="dragger_max_side")
        with gr.Group():
            gr.Markdown("### Quitar imágenes")
            with gr.Row():
                remove_x = gr.Checkbox(label="X para quitar cada imagen", value=current("remove_x"), elem_id="dragger_remove_x")
                remove_x_mode = gr.Dropdown(label="Mostrar la X", choices=X_MODE_CHOICES, value=current("remove_x_mode"), elem_id="dragger_remove_x_mode")
                undo = gr.Checkbox(label="Ofrecer «Deshacer» durante 5 s", value=current("undo"), elem_id="dragger_undo")
        with gr.Group():
            gr.Markdown("### Avisos")
            with gr.Row():
                toasts = gr.Checkbox(label="Mensajes de confirmación", value=current("toasts"), elem_id="dragger_toasts",
                                     info="Los errores se muestran siempre.")
                toast_s = gr.Number(label="Duración (segundos)", value=lambda: load_settings()["toast_ms"] / 1000, minimum=1, maximum=30, step=0.5,
                                    elem_id="dragger_toast_s")
        save_btn = gr.Button("Guardar ajustes", variant="primary", elem_id="dragger_save_settings")
        status = gr.Markdown("", elem_id="dragger_status")

        with gr.Group(elem_classes="dragger-hidden"):
            settings_json = gr.Textbox(value=lambda: json.dumps(load_settings()), elem_id="dragger_settings_json", show_label=False)
            gr.Textbox(value=json.dumps(self.targets_for_js()), elem_id="dragger_targets", show_label=False)
            bridge_req = gr.Textbox(value="", elem_id="dragger_bridge_req", show_label=False)
            bridge_resp = gr.Textbox(value="", elem_id="dragger_bridge_resp", show_label=False)
            for key, target in self.targets.items():
                btn = gr.Button("bridge", elem_id=self.bridge_elem_id(key))
                btn.click(fn=self._bridge_fn(key), inputs=[bridge_req, target["gallery"], target["state"]],
                          outputs=[bridge_resp, target["gallery"], target["state"]], show_progress="hidden", trigger_mode="multiple",
                          queue=True).then(fn=None, inputs=[bridge_resp], outputs=None, show_progress="hidden",
                                           js="(r) => { if (window.dragger) window.dragger.bridgeResponse(r); }")

        inputs = [drag_enabled, paste_enabled, remote, t_start, t_end, t_refs, position, downscale, max_side, remove_x, remove_x_mode, undo, toasts, toast_s]
        save_btn.click(fn=self._save_from_ui, inputs=inputs, outputs=[status, settings_json], show_progress="hidden").then(
            fn=None, inputs=[settings_json], outputs=None, js="(s) => { if (window.dragger) window.dragger.applySettings(s); }")

    @staticmethod
    def bridge_elem_id(key):
        return "dragger_bridge_" + key.replace(":", "_")

    def targets_for_js(self):
        return [{"key": key, "tab": t["tab"], "name": t["name"], "label": t["label"], "gallery_id": t["gallery"]._id,
                 "button": self.bridge_elem_id(key)} for key, t in self.targets.items()]

    def _save_from_ui(self, drag_enabled, paste_enabled, remote, t_start, t_end, t_refs, position, downscale, max_side,
                      remove_x, remove_x_mode, undo, toasts, toast_s):
        settings = self.apply_ui_values(drag_enabled, paste_enabled, remote, t_start, t_end, t_refs, position, downscale, max_side,
                                        remove_x, remove_x_mode, undo, toasts, toast_s)
        try:
            save_settings(settings)
        except Exception as e:
            return f"❌ No se pudo guardar `settings.json`: {e}", gr.skip()
        return f"✅ Ajustes guardados y aplicados ({time.strftime('%H:%M:%S')}).", json.dumps(settings)

    @staticmethod
    def apply_ui_values(drag_enabled=True, paste_enabled=True, remote=True, t_start=True, t_end=True, t_refs=True, position="end",
                        downscale=False, max_side=2048, remove_x=True, remove_x_mode="hover", undo=True, toasts=True, toast_s=3.5):
        settings = copy.deepcopy(DEFAULT_SETTINGS)
        settings.update({"drag_enabled": bool(drag_enabled), "paste_enabled": bool(paste_enabled), "remote_download": bool(remote),
                         "targets": {"image_start": bool(t_start), "image_end": bool(t_end), "image_refs": bool(t_refs)},
                         "position": _coerce("position", "end", position), "downscale": bool(downscale),
                         "max_side": _coerce("max_side", 2048, max_side), "remove_x": bool(remove_x),
                         "remove_x_mode": _coerce("remove_x_mode", "hover", remove_x_mode), "undo": bool(undo), "toasts": bool(toasts),
                         "toast_ms": _coerce("toast_ms", 3500, (toast_s or 0) * 1000 if isinstance(toast_s, (int, float)) else None)})
        return settings

    # ------------------------------------------------------------ JS bridge
    def _bridge_fn(self, key):
        def fn(raw, gallery, state, request: gr.Request = None):
            return self.bridge(key, raw, gallery, state, local_client=_is_local_request(request))
        fn.__name__ = f"dragger_{key.replace(':', '_')}"
        return fn

    def bridge(self, key, raw, gallery, state, local_client=False):
        """Returns (response json, gallery update, state). Gallery/state are skipped when nothing changed."""
        try:
            req = json.loads(raw or "{}")
        except Exception:
            return json.dumps({"ok": False, "error": "petición no válida"}), gr.skip(), gr.skip()
        out_gallery, out_state = gr.skip(), gr.skip()
        try:
            if req.get("target") not in (None, key):
                raise DraggerError("petición para otra galería")
            action = req.get("action")
            if action == "add":
                out, out_gallery, out_state = self.add_images(key, req, gallery, state, local_client=local_client)
            elif action == "remove":
                out, out_gallery, out_state = self.remove_image(key, req, gallery, state)
            elif action == "undo":
                out, out_gallery, out_state = self.undo_remove(key, req, gallery, state)
            elif action == "inspect":   # read-only: what the form holds (diagnostics, tests)
                out = self.inspect(gallery, state)
            else:
                out = {"ok": False, "error": "acción desconocida"}
        except DraggerError as e:
            out = {"ok": False, "error": str(e)}
        except Exception as e:
            traceback.print_exc()
            out = {"ok": False, "error": str(e) or e.__class__.__name__}
        out["id"] = req.get("id")
        out["target"] = key
        return json.dumps(out), out_gallery, out_state

    @staticmethod
    def inspect(gallery, state):
        from shared.gradio.gallery import get_gradio_file_path, get_list, get_state
        st = get_state(state)
        names = lambda items: [os.path.basename(get_gradio_file_path(it) or "") for it in items]
        return {"ok": True, "gallery": names(get_list(gallery)), "state_items": names(get_list(st.get("items"))),
                "gallery_paths": [get_gradio_file_path(it) for it in get_list(gallery)], "selected": st.get("selected"), "single": bool(st.get("single", False)), "last_action": st.get("last_action")}

    # ------------------------------------------------------------ add
    def add_images(self, key, req, gallery, state, local_client=False):
        from shared.gradio.gallery import get_list, get_state
        settings = load_settings()
        opts = {"downscale": bool(req.get("downscale", settings["downscale"])),
                "max_side": _coerce("max_side", settings["max_side"], req.get("max_side", settings["max_side"]))}
        paths, errors = [], []
        for entry in req.get("items") or []:
            label = str(entry.get("name") or entry.get("url") or "imagen")[:120]
            try:
                if entry.get("kind") == "path":
                    src = self.check_upload_path(entry.get("path"))
                    paths.append(self.prepare_image(src, entry.get("name") or os.path.basename(src), opts))
                elif entry.get("kind") == "url":
                    if not settings["remote_download"]:
                        raise DraggerError("descarga en el servidor desactivada en ajustes")
                    src, name = self.download(entry.get("url"), local_client=local_client)
                    paths.append(self.prepare_image(src, name, opts))
                else:
                    raise DraggerError("entrada no válida")
            except DraggerError as e:
                errors.append(f"{label}: {e}")
            except Exception as e:
                traceback.print_exc()
                errors.append(f"{label}: {e}")
        st = get_state(state)
        cur = get_list(gallery)
        if not paths:
            return {"ok": False, "added": 0, "total": len(cur), "errors": errors, "error": errors[0] if errors else "no hay imágenes"}, gr.skip(), gr.skip()
        position = req.get("position", settings["position"])
        position = position if position in _CHOICES["position"] else settings["position"]
        single = bool(st.get("single", False))
        if not single:
            # WanGP's Add (_on_add) inserts right after st["selected"]: point it where the user wants.
            if position == "end":
                st["selected"] = len(cur) - 1 if cur else 0
            elif position == "start":
                st["selected"] = -1
            elif st.get("selected") is not None and not (0 <= st["selected"] < len(cur)):
                st["selected"] = None
        gallery_update, st = self.amg()._on_add(paths, st, gallery)
        return {"ok": True, "added": 1 if single else len(paths), "requested": len(paths), "total": len(st["items"]), "single": single,
                "errors": errors}, gallery_update, st

    def check_upload_path(self, path):
        if not isinstance(path, str) or not path:
            raise DraggerError("archivo no recibido")
        if not _inside(path, _upload_folder()) or not os.path.isfile(path):
            raise DraggerError("archivo subido no válido")
        return os.path.realpath(path)

    def prepare_image(self, src, name, opts):
        """Returns a path WanGP accepts (the uploaded file itself when nothing needs to change)."""
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = max(Image.MAX_IMAGE_PIXELS or 0, 300_000_000)
        try:
            with Image.open(src) as probe:
                fmt = (probe.format or "").upper()
                size = probe.size
                probe.verify()
        except Exception:
            ext = os.path.splitext(str(name))[1].lower()
            if ext in (".heic", ".heif") and not HEIF_SUPPORT:
                raise DraggerError("HEIC no compatible (instala pillow-heif en WanGP o conviértela a JPG/PNG)")
            if ext == ".svg":
                raise DraggerError("SVG no compatible (no es una imagen de píxeles)")
            raise DraggerError("no es una imagen o el formato no es compatible")
        ext = os.path.splitext(src)[1].lower()
        keep = fmt in _KEEP_FORMATS
        too_big = opts.get("downscale") and max(size) > opts.get("max_side", 2048)
        if keep and not too_big and ext in _EXT_OK_FOR.get(fmt, ()):
            return src  # identical to what the Add button would add
        stem = _safe_stem(name)
        out_dir = os.path.join(_upload_folder(), "dragger", uuid.uuid4().hex)
        os.makedirs(out_dir, exist_ok=True)
        if keep and not too_big:  # right format, wrong / missing extension: same bytes, proper name
            dst = os.path.join(out_dir, stem + _KEEP_FORMATS[fmt])
            with open(src, "rb") as reader, open(dst, "wb") as writer:
                writer.write(reader.read())
            return dst
        with Image.open(src) as img:
            img.load()
            img = ImageOps.exif_transpose(img)
            if too_big:
                img.thumbnail((opts["max_side"], opts["max_side"]), Image.LANCZOS)
            if fmt in ("JPEG", "MPO") and too_big:
                dst = os.path.join(out_dir, stem + ".jpg")
                img.convert("RGB").save(dst, "JPEG", quality=95)
            else:
                if img.mode not in ("RGB", "RGBA", "L", "LA", "P", "I;16", "I"):
                    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                dst = os.path.join(out_dir, stem + ".png")
                img.save(dst, "PNG")
        return dst

    # ------------------------------------------------------------ download
    @staticmethod
    def _check_host(host, local_client=False):
        """Link-local (cloud metadata), multicast and reserved addresses are always refused. Loopback
        (e.g. ComfyUI on this PC) is allowed only when the browser itself runs on this machine, so a
        remote user of a --listen WanGP can't reach the server's local services through it."""
        try:
            infos = socket.getaddrinfo(host, None)
        except Exception:
            raise DraggerError("no se encuentra el servidor")
        for info in infos:
            ip = ipaddress.ip_address(info[4][0].split("%")[0])
            if ip.is_link_local or ip.is_multicast or ip.is_unspecified or ip.is_reserved or (ip.is_loopback and not local_client):
                raise DraggerError("dirección no permitida")

    def download(self, url, local_client=False):
        if not isinstance(url, str) or not re.match(r"^https?://", url, re.I):
            raise DraggerError("solo se pueden descargar enlaces http(s)")
        parsed = urllib.parse.urlparse(url)
        self._check_host(parsed.hostname or "", local_client)
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
                   "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "Referer": f"{parsed.scheme}://{parsed.netloc}/"}
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as resp:
                final = urllib.parse.urlparse(resp.geturl())
                if final.hostname and final.hostname != parsed.hostname:
                    self._check_host(final.hostname, local_client)
                data = resp.read(MAX_DOWNLOAD_BYTES + 1)
                ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                disp = resp.headers.get("Content-Disposition") or ""
        except DraggerError:
            raise
        except Exception as e:
            raise DraggerError(f"descarga fallida ({getattr(e, 'code', None) or getattr(e, 'reason', None) or e})")
        if len(data) > MAX_DOWNLOAD_BYTES:
            raise DraggerError("la imagen pesa más de 64 MB")
        if ctype.startswith("text/"):
            raise DraggerError("el enlace no es una imagen")
        match = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", disp)
        name = urllib.parse.unquote(match.group(1)) if match else urllib.parse.unquote(os.path.basename(parsed.path)) or "imagen"
        out_dir = os.path.join(_upload_folder(), "dragger", uuid.uuid4().hex)
        os.makedirs(out_dir, exist_ok=True)
        dst = os.path.join(out_dir, _safe_stem(name) + ".download")
        with open(dst, "wb") as writer:
            writer.write(data)
        return dst, name

    # ------------------------------------------------------------ remove / undo
    def _purge_undo(self):
        now = time.time()
        for token in [t for t, u in self._undo.items() if now - u["time"] > UNDO_TTL_S]:
            self._undo.pop(token, None)

    def remove_image(self, key, req, gallery, state):
        from shared.gradio.gallery import get_gradio_file_path, get_list, get_state
        st = get_state(state)
        cur = get_list(gallery)
        try:
            index = int(req.get("index"))
        except Exception:
            raise DraggerError("índice no válido")
        src = _path_from_file_url(req.get("src"))
        paths = [get_gradio_file_path(it) for it in cur]
        if src:
            if not (0 <= index < len(cur) and paths[index] == src):
                matches = [i for i, p in enumerate(paths) if p == src]
                if not matches:
                    raise DraggerError("la galería ha cambiado, vuelve a intentarlo")
                index = min(matches, key=lambda i: abs(i - index))
        if not (0 <= index < len(cur)):
            raise DraggerError("la imagen ya no está en la galería")
        prev_sel = st.get("selected")
        removed = cur[index]
        # Same handler as WanGP's Remove button, applied to the clicked thumbnail.
        st["selected"] = index
        gallery_update, st = self.amg()._on_remove(st, gallery)
        if st["items"] and isinstance(prev_sel, int) and 0 <= prev_sel < len(cur) and prev_sel != index:
            # The X was on another thumbnail: keep the image that was selected selected.
            new_sel = prev_sel - 1 if prev_sel > index else prev_sel
            st["selected"] = new_sel
            gallery_update = self.amg()._gallery_update(st, value=st["items"], selected_index=new_sel)
        if req.get("grid") and st["items"]:
            # X clicked in the grid view (no preview open): keep the grid, like the gallery's own metadata sync would.
            st["selected"] = None
            gallery_update = self.amg()._gallery_update(st, value=st["items"], selected_index=None)
        token = uuid.uuid4().hex
        with self._lock:
            self._purge_undo()
            self._undo[token] = {"key": key, "item": removed, "index": index, "was_selected": prev_sel == index, "time": time.time()}
        return {"ok": True, "token": token, "index": index, "total": len(st["items"]),
                "name": os.path.basename(get_gradio_file_path(removed) or "")}, gallery_update, st

    def undo_remove(self, key, req, gallery, state):
        from shared.gradio.gallery import get_gradio_file_path, get_list, get_state, record_last_action
        with self._lock:
            undo = self._undo.get(req.get("token"))
            if not undo or undo["key"] != key:
                raise DraggerError("ya no se puede deshacer")
            self._undo.pop(req.get("token"), None)
        path = get_gradio_file_path(undo["item"])
        if path and not os.path.isfile(path):
            raise DraggerError("el archivo ya no existe")
        st = get_state(state)
        cur = get_list(gallery)
        if st.get("single", False):
            items, sel = [undo["item"]], 0
        else:
            index = max(0, min(undo["index"], len(cur)))
            items = cur[:index] + [undo["item"]] + cur[index:]
            old = st.get("selected")
            if undo["was_selected"] or not isinstance(old, int) or not (0 <= old < len(cur)):
                sel = index
            else:
                sel = old + 1 if old >= index else old
        st["items"], st["selected"] = items, sel
        record_last_action(st, "add")
        return {"ok": True, "index": items.index(undo["item"]), "total": len(items)}, self.amg()._gallery_update(st, value=items, selected_index=sel), st
