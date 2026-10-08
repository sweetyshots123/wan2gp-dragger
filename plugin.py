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
  * Bilingual (English / Spanish): every user-facing text comes from the TEXT table
    below (settings tab, server messages) or from the I18N table in dragger.js
    (messages in the page). Setting "language": auto (browser language), en, es.
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

PLUGIN_VERSION = "1.1.0"
_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_PATH = os.path.join(_PLUGIN_DIR, "settings.json")

TARGETS = ("image_start", "image_end", "image_refs")
TAB_IDS = ("generate", "edit")
LANGS = ("en", "es")

# ---------------------------------------------------------------------------- i18n
# Every user-facing text of the Python side (settings tab + messages returned to the page), in English and Spanish.
# Choice values (end/start/after_selected, hover/always, small/medium/large, auto/en/es) are stable internal keys:
# only their display labels are translated, so existing settings.json files keep working.
TEXT = {
    "en": {
        # gallery names
        "g_image_start": "Start image", "g_image_end": "End image", "g_image_refs": "Reference images",
        # settings tab
        "intro": "Drag & drop or paste (Ctrl+V) images into the start image, end image and reference image galleries, even when they "
                 "already contain images: they are **added** to the ones already there. The X on each thumbnail removes just that image. "
                 "Changes are saved in `settings.json` in the plugin folder and applied immediately.",
        "language": "Language / Idioma",
        "language_info": "Auto = the browser language (Spanish if it is Spanish, English otherwise). Applies immediately to Dragger's messages and to this tab.",
        "lang_auto": "Auto (browser language)",
        "sec_input": "### Input", "sec_remove": "### Removing images", "sec_messages": "### Messages",
        "drag_enabled": "Drag & drop images",
        "drag_info": "Files from the file explorer, images dragged from a web page or image links.",
        "paste_enabled": "Paste with Ctrl+V",
        "paste_info": "Goes to the gallery under the mouse pointer or the last one you clicked; if only one is visible, to that one. "
                      "In text boxes Ctrl+V pastes text as usual.",
        "remote": "Download on the server the web images the browser can't read",
        "position": "Where new images are added",
        "pos_end": "At the end", "pos_start": "At the beginning", "pos_after_selected": "After the selected one (like \u201cAdd\u201d)",
        "downscale": "Downscale large images", "max_side": "Maximum longest side (px)",
        "remove_x": "X to remove each image", "remove_x_mode": "Show the X",
        "mode_hover": "On hover", "mode_always": "Always visible",
        "x_size": "X size", "x_size_info": "Sits on the top-right corner, mostly outside the thumbnail.",
        "size_small": "Small", "size_medium": "Medium", "size_large": "Large",
        "undo": "Offer \u201cUndo\u201d for 5 s",
        "toasts": "Confirmation messages", "toasts_info": "Errors are always shown.", "toast_s": "Duration (seconds)",
        "save": "Save settings",
        "saved": "\u2705 Settings saved and applied ({time}).",
        "save_failed": "\u274c Could not save `settings.json`: {error}",
        # messages returned to the page
        "bad_request": "invalid request", "wrong_target": "request for another gallery", "unknown_action": "unknown action",
        "remote_disabled": "server download is disabled in the settings", "bad_entry": "invalid entry", "no_images": "no images",
        "no_file": "file not received", "bad_upload": "invalid uploaded file",
        "heic": "HEIC not supported (install pillow-heif in WanGP or convert it to JPG/PNG)",
        "svg": "SVG not supported (not a pixel image)", "not_image": "not an image or unsupported format",
        "host_unknown": "server not found", "host_refused": "address not allowed",
        "http_only": "only http(s) links can be downloaded", "download_failed": "download failed ({reason})",
        "too_big": "the image is larger than 64 MB", "not_image_link": "the link is not an image",
        "bad_index": "invalid index", "gallery_changed": "the gallery has changed, try again",
        "gone": "the image is no longer in the gallery", "undo_expired": "can't undo any more", "file_gone": "the file no longer exists",
        "name_image": "image",
    },
    "es": {
        "g_image_start": "Imagen de inicio", "g_image_end": "Imagen final", "g_image_refs": "Referencias",
        "intro": "Arrastra o pega (Ctrl+V) imágenes en las galerías de imagen de inicio, imagen final y referencias, aunque ya tengan "
                 "imágenes: se **añaden** a las que hay. La X de cada miniatura quita solo esa imagen. "
                 "Los cambios se guardan en `settings.json` de la carpeta del plugin y se aplican al momento.",
        "language": "Language / Idioma",
        "language_info": "Auto = el idioma del navegador (español si está en español; si no, inglés). Se aplica al momento a los mensajes de Dragger y a esta pestaña.",
        "lang_auto": "Auto (idioma del navegador)",
        "sec_input": "### Entrada", "sec_remove": "### Quitar imágenes", "sec_messages": "### Avisos",
        "drag_enabled": "Arrastrar y soltar imágenes",
        "drag_info": "Archivos del Explorador, imágenes arrastradas desde una web o enlaces a imágenes.",
        "paste_enabled": "Pegar con Ctrl+V",
        "paste_info": "Va a la galería bajo el ratón o la última en la que hiciste clic; si solo hay una visible, a esa. "
                      "En los cuadros de texto Ctrl+V pega texto como siempre.",
        "remote": "Descargar en el servidor las imágenes web que el navegador no deja leer",
        "position": "Dónde se añaden las imágenes nuevas",
        "pos_end": "Al final", "pos_start": "Al principio", "pos_after_selected": "Después de la seleccionada (como «Add»)",
        "downscale": "Reducir las imágenes grandes", "max_side": "Lado mayor máximo (px)",
        "remove_x": "X para quitar cada imagen", "remove_x_mode": "Mostrar la X",
        "mode_hover": "Al pasar el ratón", "mode_always": "Siempre visible",
        "x_size": "Tamaño de la X", "x_size_info": "Va en la esquina superior derecha, casi toda por fuera de la miniatura.",
        "size_small": "Pequeña", "size_medium": "Mediana", "size_large": "Grande",
        "undo": "Ofrecer «Deshacer» durante 5 s",
        "toasts": "Mensajes de confirmación", "toasts_info": "Los errores se muestran siempre.", "toast_s": "Duración (segundos)",
        "save": "Guardar ajustes",
        "saved": "\u2705 Ajustes guardados y aplicados ({time}).",
        "save_failed": "\u274c No se pudo guardar `settings.json`: {error}",
        "bad_request": "petición no válida", "wrong_target": "petición para otra galería", "unknown_action": "acción desconocida",
        "remote_disabled": "descarga en el servidor desactivada en ajustes", "bad_entry": "entrada no válida", "no_images": "no hay imágenes",
        "no_file": "archivo no recibido", "bad_upload": "archivo subido no válido",
        "heic": "HEIC no compatible (instala pillow-heif en WanGP o conviértela a JPG/PNG)",
        "svg": "SVG no compatible (no es una imagen de píxeles)", "not_image": "no es una imagen o el formato no es compatible",
        "host_unknown": "no se encuentra el servidor", "host_refused": "dirección no permitida",
        "http_only": "solo se pueden descargar enlaces http(s)", "download_failed": "descarga fallida ({reason})",
        "too_big": "la imagen pesa más de 64 MB", "not_image_link": "el enlace no es una imagen",
        "bad_index": "índice no válido", "gallery_changed": "la galería ha cambiado, vuelve a intentarlo",
        "gone": "la imagen ya no está en la galería", "undo_expired": "ya no se puede deshacer", "file_gone": "el archivo ya no existe",
        "name_image": "imagen",
    },
}


def resolve_lang(setting, browser_lang=None):
    """'en' / 'es' are forced; anything else (auto) = Spanish if the browser language starts with 'es', else English."""
    if setting in LANGS:
        return setting
    return "es" if str(browser_lang or "").strip().lower().startswith("es") else "en"


def tr(lang, key, **params):
    text = TEXT.get(lang if lang in LANGS else "en", TEXT["en"]).get(key)
    if text is None:
        text = TEXT["en"].get(key, key)
    return text.format(**params) if params else text


def position_choices(lang):
    return [(tr(lang, "pos_" + v), v) for v in ("end", "start", "after_selected")]


def x_mode_choices(lang):
    return [(tr(lang, "mode_" + v), v) for v in ("hover", "always")]


def x_size_choices(lang):
    return [(tr(lang, "size_" + v), v) for v in ("small", "medium", "large")]


def language_choices(lang):
    return [(tr(lang, "lang_auto"), "auto"), ("English", "en"), ("Español", "es")]

DEFAULT_SETTINGS = {
    "drag_enabled": True,        # drop images (files, browser images, URLs) on the galleries
    "paste_enabled": True,       # Ctrl+V pastes clipboard images into the gallery under the pointer / last clicked
    "targets": {"image_start": True, "image_end": True, "image_refs": True},
    "position": "end",           # "end" | "start" | "after_selected" (= what WanGP's Add button does)
    "downscale": False,          # shrink images whose longest side is above max_side
    "max_side": 2048,            # px (64..16384)
    "language": "auto",          # "auto" (browser language: Spanish if it starts with "es", else English) | "en" | "es"
    "toasts": True,              # confirmation messages ("Added N images to ...")
    "toast_ms": 3500,            # ms (1000..30000)
    "remote_download": True,     # download images from web URLs on the server when the browser can't (CORS)
    "remove_x": True,            # small round X on every thumbnail to remove only that image
    "remove_x_mode": "hover",    # "hover" | "always"
    "x_size": "medium",          # "small" | "medium" | "large" (round X straddling the thumbnail's top-right corner)
    "undo": True,                # "Image removed · Undo" for 5 s after an X removal
}
_CHOICES = {"position": ("end", "start", "after_selected"), "remove_x_mode": ("hover", "always"), "x_size": ("small", "medium", "large"),
            "language": ("auto",) + LANGS}
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
                for name in TARGETS:
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


def _safe_stem(name, fallback="image"):
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
    """A user-facing error: a TEXT key + parameters, rendered in the page's language when it is sent back."""
    def __init__(self, key, **params):
        super().__init__(key)
        self.key, self.params = key, params

    def message(self, lang):
        return tr(lang, self.key, **self.params)


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
        for name in TARGETS:
            self.request_component(name)
            self.request_component(f"{name}_extra")
        self.request_component("tab_id")
        self.add_custom_js(build_js())
        self.add_tab(tab_id="dragger", label="Dragger", component_constructor=self.create_ui)

    def post_ui_setup(self, components):
        """Called once per generator form ('generate', then the queue 'edit' tab)."""
        tab = components.get("tab_id")
        tab = tab if tab in TAB_IDS else ("generate" if not any(k.startswith("generate:") for k in self.targets) else "edit")
        for name in TARGETS:
            gallery, extra = components.get(name), components.get(f"{name}_extra")
            # extra = [row, upload_btn, btn_left, btn_right, btn_clear, gallery, state] (see wgp.get_image_gallery)
            if gallery is None or not isinstance(extra, (list, tuple)) or len(extra) < 2:
                print(f"[Dragger] {tab}:{name} not found, skipped")
                continue
            state = extra[-1]
            if extra[-2] is not gallery or not isinstance(state, gr.State):
                print(f"[Dragger] {tab}:{name} has an unexpected layout, skipped")
                continue
            self.targets[f"{tab}:{name}"] = {"tab": tab, "name": name, "gallery": gallery, "state": state}
        return {}

    def amg(self):
        if self._amg is None:
            from shared.gradio.gallery import AdvancedMediaGallery
            # Unmounted helper: only its (stateless) handlers are used, on the real gallery value + gr.State.
            self._amg = AdvancedMediaGallery(media_mode="image")
        return self._amg

    # ---------------------------------------------------------------- UI tab
    # The tab is built once, in the saved language ("auto" -> English). In the page, dragger.js then asks the server
    # (hidden "localize" button + the browser language) to relabel it in the resolved language, and saving a new
    # language relabels it in the same event: the tab always matches the language of Dragger's messages.
    TAB_KEYS = ("intro", "language", "sec_input", "drag_enabled", "paste_enabled", "remote", "t_image_start", "t_image_end", "t_image_refs",
                "position", "downscale", "max_side", "sec_remove", "remove_x", "remove_x_mode", "x_size", "undo", "sec_messages",
                "toasts", "toast_s", "save")

    @staticmethod
    def tab_texts(lang):
        """gr.update kwargs for every translatable component of the settings tab (keys of TAB_KEYS)."""
        t = lambda key: tr(lang, key)
        return {
            "intro": {"value": f"## Dragger {PLUGIN_VERSION}\n" + t("intro")},
            "language": {"label": t("language"), "info": t("language_info"), "choices": language_choices(lang)},
            "sec_input": {"value": t("sec_input")}, "sec_remove": {"value": t("sec_remove")}, "sec_messages": {"value": t("sec_messages")},
            "drag_enabled": {"label": t("drag_enabled"), "info": t("drag_info")},
            "paste_enabled": {"label": t("paste_enabled"), "info": t("paste_info")},
            "remote": {"label": t("remote")},
            "t_image_start": {"label": t("g_image_start")}, "t_image_end": {"label": t("g_image_end")}, "t_image_refs": {"label": t("g_image_refs")},
            "position": {"label": t("position"), "choices": position_choices(lang)},
            "downscale": {"label": t("downscale")}, "max_side": {"label": t("max_side")},
            "remove_x": {"label": t("remove_x")}, "remove_x_mode": {"label": t("remove_x_mode"), "choices": x_mode_choices(lang)},
            "x_size": {"label": t("x_size"), "info": t("x_size_info"), "choices": x_size_choices(lang)},
            "undo": {"label": t("undo")},
            "toasts": {"label": t("toasts"), "info": t("toasts_info")}, "toast_s": {"label": t("toast_s")},
            "save": {"value": t("save")},
        }

    def tab_updates(self, lang):
        texts = self.tab_texts(lang)
        return [gr.update(**texts[key]) for key in self.TAB_KEYS]

    def create_ui(self):
        current = lambda key: (lambda: load_settings()[key])
        lang = resolve_lang(load_settings()["language"])
        tx = self.tab_texts(lang)
        ui = {}
        gr.HTML("<style>.dragger-hidden{display:none !important;}</style>")
        ui["intro"] = gr.Markdown(tx["intro"]["value"], elem_id="dragger_intro")
        with gr.Row():
            ui["language"] = gr.Dropdown(value=current("language"), elem_id="dragger_language", **tx["language"])
        with gr.Group():
            ui["sec_input"] = gr.Markdown(tx["sec_input"]["value"])
            with gr.Row():
                ui["drag_enabled"] = gr.Checkbox(value=current("drag_enabled"), elem_id="dragger_drag_enabled", **tx["drag_enabled"])
                ui["paste_enabled"] = gr.Checkbox(value=current("paste_enabled"), elem_id="dragger_paste_enabled", **tx["paste_enabled"])
                ui["remote"] = gr.Checkbox(value=current("remote_download"), elem_id="dragger_remote_download", **tx["remote"])
            with gr.Row():
                for name in TARGETS:
                    ui["t_" + name] = gr.Checkbox(value=(lambda n=name: load_settings()["targets"][n]), elem_id="dragger_t_" + name, **tx["t_" + name])
            with gr.Row():
                ui["position"] = gr.Dropdown(value=current("position"), elem_id="dragger_position", **tx["position"])
                ui["downscale"] = gr.Checkbox(value=current("downscale"), elem_id="dragger_downscale", **tx["downscale"])
                ui["max_side"] = gr.Number(value=current("max_side"), precision=0, minimum=64, maximum=16384, elem_id="dragger_max_side", **tx["max_side"])
        with gr.Group():
            ui["sec_remove"] = gr.Markdown(tx["sec_remove"]["value"])
            with gr.Row():
                ui["remove_x"] = gr.Checkbox(value=current("remove_x"), elem_id="dragger_remove_x", **tx["remove_x"])
                ui["remove_x_mode"] = gr.Dropdown(value=current("remove_x_mode"), elem_id="dragger_remove_x_mode", **tx["remove_x_mode"])
                ui["x_size"] = gr.Dropdown(value=current("x_size"), elem_id="dragger_x_size", **tx["x_size"])
                ui["undo"] = gr.Checkbox(value=current("undo"), elem_id="dragger_undo", **tx["undo"])
        with gr.Group():
            ui["sec_messages"] = gr.Markdown(tx["sec_messages"]["value"])
            with gr.Row():
                ui["toasts"] = gr.Checkbox(value=current("toasts"), elem_id="dragger_toasts", **tx["toasts"])
                ui["toast_s"] = gr.Number(value=lambda: load_settings()["toast_ms"] / 1000, minimum=1, maximum=30, step=0.5, elem_id="dragger_toast_s",
                                          **tx["toast_s"])
        ui["save"] = gr.Button(tx["save"]["value"], variant="primary", elem_id="dragger_save_settings")
        status = gr.Markdown("", elem_id="dragger_status")
        tab_outputs = [ui[key] for key in self.TAB_KEYS]

        with gr.Group(elem_classes="dragger-hidden"):
            settings_json = gr.Textbox(value=lambda: json.dumps(load_settings()), elem_id="dragger_settings_json", show_label=False)
            gr.Textbox(value=json.dumps(self.targets_for_js()), elem_id="dragger_targets", show_label=False)
            bridge_req = gr.Textbox(value="", elem_id="dragger_bridge_req", show_label=False)
            bridge_resp = gr.Textbox(value="", elem_id="dragger_bridge_resp", show_label=False)
            browser_lang = gr.Textbox(value="", elem_id="dragger_browser_lang", show_label=False)   # receives navigator.language (event js)
            localize_btn = gr.Button("localize", elem_id="dragger_localize")
            for key, target in self.targets.items():
                btn = gr.Button("bridge", elem_id=self.bridge_elem_id(key))
                btn.click(fn=self._bridge_fn(key), inputs=[bridge_req, target["gallery"], target["state"]],
                          outputs=[bridge_resp, target["gallery"], target["state"]], show_progress="hidden", trigger_mode="multiple",
                          queue=True).then(fn=self._resync_selection, inputs=[bridge_resp, target["state"]], outputs=[target["gallery"], target["state"]],
                                           show_progress="hidden", queue=True).then(fn=None, inputs=[bridge_resp], outputs=None, show_progress="hidden",
                                           js="(r) => { if (window.dragger) window.dragger.bridgeResponse(r); }")
        # At page load dragger.js clicks this to get settings.json as it is now + the tab relabelled for the browser language;
        # on a later language switch it asks for a given language. The event's own js step fills the input (no typing in the
        # textbox): {"browser": navigator.language, "lang": null at page load, else "en" / "es"}.
        localize_btn.click(fn=self._localize, inputs=[browser_lang], outputs=[settings_json] + tab_outputs, show_progress="hidden", queue=False,
                           js="(x) => JSON.stringify({ browser: navigator.language || '', lang: (window.dragger && window.dragger.tabRequest) || null })").then(
            fn=None, inputs=[settings_json], outputs=None, js="(s) => { if (window.dragger) window.dragger.applySettings(s, true); }")

        inputs = [ui[k] for k in ("drag_enabled", "paste_enabled", "remote", "t_image_start", "t_image_end", "t_image_refs", "position", "downscale",
                                  "max_side", "remove_x", "remove_x_mode", "undo", "toasts", "toast_s", "x_size", "language")] + [browser_lang]
        ui["save"].click(fn=self._save_from_ui, inputs=inputs, outputs=[status, settings_json] + tab_outputs, show_progress="hidden",
                         js="(...a) => { a[a.length - 1] = navigator.language || ''; return a; }").then(
            fn=None, inputs=[settings_json], outputs=None, js="(s) => { if (window.dragger) window.dragger.applySettings(s, 'saved'); }")

    @staticmethod
    def bridge_elem_id(key):
        return "dragger_bridge_" + key.replace(":", "_")

    def targets_for_js(self):
        return [{"key": key, "tab": t["tab"], "name": t["name"], "gallery_id": t["gallery"]._id,
                 "button": self.bridge_elem_id(key)} for key, t in self.targets.items()]

    def _localize(self, raw):
        """raw = {"browser": navigator.language, "lang": "en" | "es" | null} (a bare browser language is accepted too)."""
        try:
            req = json.loads(raw) if str(raw or "").lstrip().startswith("{") else {"browser": raw}
        except Exception:
            req = {}
        settings = load_settings()
        lang = req.get("lang") if req.get("lang") in LANGS else resolve_lang(settings["language"], req.get("browser"))
        return (json.dumps(settings), *self.tab_updates(lang))

    def _save_from_ui(self, drag_enabled, paste_enabled, remote, t_start, t_end, t_refs, position, downscale, max_side,
                      remove_x, remove_x_mode, undo, toasts, toast_s, x_size="medium", language="auto", browser_lang=""):
        settings = self.apply_ui_values(drag_enabled, paste_enabled, remote, t_start, t_end, t_refs, position, downscale, max_side,
                                        remove_x, remove_x_mode, undo, toasts, toast_s, x_size, language)
        lang = resolve_lang(settings["language"], browser_lang)
        try:
            save_settings(settings)
        except Exception as e:
            return (tr(lang, "save_failed", error=e), gr.skip(), *self.tab_updates(lang))
        return (tr(lang, "saved", time=time.strftime("%H:%M:%S")), json.dumps(settings), *self.tab_updates(lang))

    @staticmethod
    def apply_ui_values(drag_enabled=True, paste_enabled=True, remote=True, t_start=True, t_end=True, t_refs=True, position="end",
                        downscale=False, max_side=2048, remove_x=True, remove_x_mode="hover", undo=True, toasts=True, toast_s=3.5,
                        x_size="medium", language="auto"):
        settings = copy.deepcopy(DEFAULT_SETTINGS)
        settings.update({"drag_enabled": bool(drag_enabled), "paste_enabled": bool(paste_enabled), "remote_download": bool(remote),
                         "targets": {"image_start": bool(t_start), "image_end": bool(t_end), "image_refs": bool(t_refs)},
                         "position": _coerce("position", "end", position), "downscale": bool(downscale),
                         "max_side": _coerce("max_side", 2048, max_side), "remove_x": bool(remove_x),
                         "remove_x_mode": _coerce("remove_x_mode", "hover", remove_x_mode), "x_size": _coerce("x_size", "medium", x_size),
                         "language": _coerce("language", "auto", language), "undo": bool(undo), "toasts": bool(toasts),
                         "toast_ms": _coerce("toast_ms", 3500, (toast_s or 0) * 1000 if isinstance(toast_s, (int, float)) else None)})
        return settings

    # ------------------------------------------------------------ JS bridge
    def _bridge_fn(self, key):
        def fn(raw, gallery, state, request: gr.Request = None):
            return self.bridge(key, raw, gallery, state, local_client=_is_local_request(request))
        fn.__name__ = f"dragger_{key.replace(':', '_')}"
        return fn

    def bridge(self, key, raw, gallery, state, local_client=False):
        """Returns (response json, gallery update, state). Gallery/state are skipped when nothing changed.
        Messages are rendered in req["lang"] (the language dragger.js resolved for the page)."""
        try:
            req = json.loads(raw or "{}")
            if not isinstance(req, dict):
                raise ValueError
        except Exception:
            return json.dumps({"ok": False, "error": tr("en", "bad_request")}), gr.skip(), gr.skip()
        lang = req.get("lang") if req.get("lang") in LANGS else resolve_lang(load_settings()["language"])
        out_gallery, out_state = gr.skip(), gr.skip()
        try:
            if req.get("target") not in (None, key):
                raise DraggerError("wrong_target")
            action = req.get("action")
            if action == "add":
                out, out_gallery, out_state = self.add_images(key, req, gallery, state, local_client=local_client, lang=lang)
            elif action == "remove":
                out, out_gallery, out_state = self.remove_image(key, req, gallery, state)
            elif action == "undo":
                out, out_gallery, out_state = self.undo_remove(key, req, gallery, state)
            elif action == "inspect":   # read-only: what the form holds (diagnostics, tests)
                out = self.inspect(gallery, state)
            else:
                out = {"ok": False, "error": tr(lang, "unknown_action")}
        except DraggerError as e:
            out = {"ok": False, "error": e.message(lang), "code": e.key}
        except Exception as e:
            traceback.print_exc()
            out = {"ok": False, "error": str(e) or e.__class__.__name__}
        out["id"] = req.get("id")
        out["target"] = key
        if out.get("ok") and isinstance(out_state, dict) and "items" in out_state:
            out["resync"] = {"selected": out_state.get("selected"), "count": len(out_state.get("items") or [])}
        return json.dumps(out), out_gallery, out_state

    @staticmethod
    def _resync_selection(raw, state):
        """Second step after a change: re-send the selection on its own.
        Gradio's Gallery resets its selection to 0 (and opens the preview) on the first value change after it is
        (re)mounted, and the gallery's own metadata sync may then copy that 0 into the state. Re-sending the selection
        the action decided (from the response, not from the possibly re-synced state) fixes both; it is a no-op when
        the browser already shows it."""
        from shared.gradio.gallery import get_list, get_state
        try:
            want = json.loads(raw or "{}").get("resync")
        except Exception:
            want = None
        st = get_state(state)
        if not isinstance(want, dict) or len(get_list(st.get("items"))) != want.get("count"):
            return gr.skip(), gr.skip()      # nothing to do, or the gallery changed in between: leave it alone
        sel = want.get("selected")
        st["selected"] = sel
        return gr.update(selected_index=sel), st

    @staticmethod
    def inspect(gallery, state):
        from shared.gradio.gallery import get_gradio_file_path, get_list, get_state
        st = get_state(state)
        names = lambda items: [os.path.basename(get_gradio_file_path(it) or "") for it in items]
        return {"ok": True, "gallery": names(get_list(gallery)), "state_items": names(get_list(st.get("items"))),
                "gallery_paths": [get_gradio_file_path(it) for it in get_list(gallery)], "selected": st.get("selected"), "single": bool(st.get("single", False)), "last_action": st.get("last_action")}

    # ------------------------------------------------------------ add
    def add_images(self, key, req, gallery, state, local_client=False, lang="en"):
        from shared.gradio.gallery import get_list, get_state
        settings = load_settings()
        opts = {"downscale": bool(req.get("downscale", settings["downscale"])),
                "max_side": _coerce("max_side", settings["max_side"], req.get("max_side", settings["max_side"]))}
        paths, errors = [], []
        for entry in req.get("items") or []:
            entry = entry if isinstance(entry, dict) else {}
            label = str(entry.get("name") or entry.get("url") or tr(lang, "name_image"))[:120]
            opts["fallback_name"] = tr(lang, "name_image")
            try:
                if entry.get("kind") == "path":
                    src = self.check_upload_path(entry.get("path"))
                    paths.append(self.prepare_image(src, entry.get("name") or os.path.basename(src), opts))
                elif entry.get("kind") == "url":
                    if not settings["remote_download"]:
                        raise DraggerError("remote_disabled")
                    src, name = self.download(entry.get("url"), local_client=local_client, fallback_name=opts["fallback_name"])
                    paths.append(self.prepare_image(src, name, opts))
                else:
                    raise DraggerError("bad_entry")
            except DraggerError as e:
                errors.append(f"{label}: {e.message(lang)}")
            except Exception as e:
                traceback.print_exc()
                errors.append(f"{label}: {e}")
        st = get_state(state)
        cur = get_list(gallery)
        if not paths:
            return {"ok": False, "added": 0, "total": len(cur), "errors": errors, "error": errors[0] if errors else tr(lang, "no_images")}, gr.skip(), gr.skip()
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
            raise DraggerError("no_file")
        if not _inside(path, _upload_folder()) or not os.path.isfile(path):
            raise DraggerError("bad_upload")
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
                raise DraggerError("heic")
            if ext == ".svg":
                raise DraggerError("svg")
            raise DraggerError("not_image")
        ext = os.path.splitext(src)[1].lower()
        keep = fmt in _KEEP_FORMATS
        too_big = opts.get("downscale") and max(size) > opts.get("max_side", 2048)
        if keep and not too_big and ext in _EXT_OK_FOR.get(fmt, ()):
            return src  # identical to what the Add button would add
        stem = _safe_stem(name, opts.get("fallback_name") or "image")
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
            raise DraggerError("host_unknown")
        for info in infos:
            ip = ipaddress.ip_address(info[4][0].split("%")[0])
            if ip.is_link_local or ip.is_multicast or ip.is_unspecified or ip.is_reserved or (ip.is_loopback and not local_client):
                raise DraggerError("host_refused")

    def download(self, url, local_client=False, fallback_name="image"):
        if not isinstance(url, str) or not re.match(r"^https?://", url, re.I):
            raise DraggerError("http_only")
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
            raise DraggerError("download_failed", reason=getattr(e, "code", None) or getattr(e, "reason", None) or e)
        if len(data) > MAX_DOWNLOAD_BYTES:
            raise DraggerError("too_big")
        if ctype.startswith("text/"):
            raise DraggerError("not_image_link")
        match = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", disp)
        name = urllib.parse.unquote(match.group(1)) if match else urllib.parse.unquote(os.path.basename(parsed.path)) or fallback_name
        out_dir = os.path.join(_upload_folder(), "dragger", uuid.uuid4().hex)
        os.makedirs(out_dir, exist_ok=True)
        dst = os.path.join(out_dir, _safe_stem(name, fallback_name) + ".download")
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
            raise DraggerError("bad_index")
        src = _path_from_file_url(req.get("src"))
        paths = [get_gradio_file_path(it) for it in cur]
        if src:
            if not (0 <= index < len(cur) and paths[index] == src):
                matches = [i for i, p in enumerate(paths) if p == src]
                if not matches:
                    raise DraggerError("gallery_changed")
                index = min(matches, key=lambda i: abs(i - index))
        if not (0 <= index < len(cur)):
            raise DraggerError("gone")
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
                raise DraggerError("undo_expired")
            self._undo.pop(req.get("token"), None)
        path = get_gradio_file_path(undo["item"])
        if path and not os.path.isfile(path):
            raise DraggerError("file_gone")
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
