// Dragger __DRAGGER_VERSION__ - drag & drop / paste images into WanGP's image galleries.
// Injected by the Dragger plugin through WanGP's add_custom_js API (runs inside WanGP's main JS function).
(() => {
    if (window.dragger && window.dragger.version) return;
    const VERSION = "__DRAGGER_VERSION__";
    let cfg = __DRAGGER_SETTINGS__;
    const log = (...a) => console.log("[Dragger]", ...a);
    const IMG_NAME = /\.(png|jpe?g|jfif|pjpeg|bmp|gif|webp|tiff?|avif|heic|heif|ico|apng)$/i;
    // ------------------------------------------------------------------ i18n
    // Every text shown in the page, in English and Spanish. Setting "language": "auto" (default) = Spanish when
    // navigator.language starts with "es", English otherwise; "en" / "es" force it. Applied live.
    const I18N = {
        en: {
            g_image_start: "Start image", g_image_end: "End image", g_image_refs: "Reference images",
            drop_to: "Drop to add to: {g}",
            remove_title: "Remove this image",
            added_one: "Added 1 image to {g} (total {total})", added_many: "Added {n} images to {g} (total {total})",
            single_set: "Image set in {g} (this gallery holds only one)",
            not_added_one: "1 image not added:", not_added_many: "{n} images not added:",
            add_failed: "Could not add to {g}:", add_error: "Error adding to {g}: {e}",
            nothing_added: "Nothing added to {g}:", no_images_for: "No images to add to {g}",
            adding_one: "Adding 1 image to {g}\u2026", adding_many: "Adding {n} images to {g}\u2026",
            unsupported_file: "{name}: unsupported format ({type})", unknown_type: "unknown", file: "file",
            no_image_found: "No image found for {g}",
            paste_where_one: "Where should I paste the image?", paste_where_many: "Where should I paste the {n} images?", close: "Close",
            removed: "Image removed from {g}", undo: "Undo", restored: "Image restored in {g} (total {total})",
            undo_failed: "Could not undo: {e}", removed_left: "Image removed from {g} ({total} left)",
            remove_failed: "Could not remove the image: {e}",
            not_ready: "the plugin is not ready (reload the page)", no_response: "no response from the server",
            upload_failed_http: "upload failed (HTTP {status})", upload_failed: "upload failed", not_image: "not an image",
            no_images: "no images", unknown_gallery: "unknown gallery",
            paste_prefix: "clipboard", web_image: "web-image", image: "image",
            moved: "Moved to position {pos} of {total} in {g}", move_failed: "Could not move the image: {e}",
            move_here: "Move to position {pos}",
            sel_one: "{n} selected", sel_many: "{n} selected", sel_remove: "Remove selected", sel_keep: "Keep only these",
            sel_remove_title: "Remove the selected images (Delete)", sel_keep_title: "Remove all the other images and keep only the selected ones",
            sel_clear: "Clear the selection (Esc)", sel_failed: "Could not remove the selected images: {e}",
            sel_nothing: "Nothing to remove: every image is selected",
            sel_removed_one: "Removed 1 image from {g} ({total} left)", sel_removed_many: "Removed {n} images from {g} ({total} left)",
            sel_restored: "Images restored in {g} (total {total})",
            move_group_here: "Move {n} to position {pos}", moved_group: "Moved {n} images to position {pos} in {g}",
        },
        es: {
            g_image_start: "Imagen de inicio", g_image_end: "Imagen final", g_image_refs: "Referencias",
            drop_to: "Soltar para añadir a: {g}",
            remove_title: "Quitar esta imagen",
            added_one: "Añadida 1 imagen a {g} (total {total})", added_many: "Añadidas {n} imágenes a {g} (total {total})",
            single_set: "Imagen puesta en {g} (esta galería solo admite una)",
            not_added_one: "1 imagen no añadida:", not_added_many: "{n} imágenes no añadidas:",
            add_failed: "No se ha podido añadir a {g}:", add_error: "Error al añadir a {g}: {e}",
            nothing_added: "No se ha añadido nada a {g}:", no_images_for: "No hay imágenes que añadir a {g}",
            adding_one: "Añadiendo 1 imagen a {g}\u2026", adding_many: "Añadiendo {n} imágenes a {g}\u2026",
            unsupported_file: "{name}: formato no compatible ({type})", unknown_type: "desconocido", file: "archivo",
            no_image_found: "No se ha encontrado ninguna imagen para {g}",
            paste_where_one: "¿Dónde pego la imagen?", paste_where_many: "¿Dónde pego las {n} imágenes?", close: "Cerrar",
            removed: "Imagen quitada de {g}", undo: "Deshacer", restored: "Imagen restaurada en {g} (total {total})",
            undo_failed: "No se ha podido deshacer: {e}", removed_left: "Imagen quitada de {g} (quedan {total})",
            remove_failed: "No se ha podido quitar la imagen: {e}",
            not_ready: "el plugin no está listo (recarga la página)", no_response: "sin respuesta del servidor",
            upload_failed_http: "subida fallida (HTTP {status})", upload_failed: "subida fallida", not_image: "no es una imagen",
            no_images: "no hay imágenes", unknown_gallery: "galería desconocida",
            paste_prefix: "portapapeles", web_image: "imagen-web", image: "imagen",
            moved: "Movida a la posición {pos} de {total} en {g}", move_failed: "No se ha podido mover la imagen: {e}",
            move_here: "Mover a la posición {pos}",
            sel_one: "{n} seleccionada", sel_many: "{n} seleccionadas", sel_remove: "Quitar seleccionadas", sel_keep: "Quedarme solo con estas",
            sel_remove_title: "Quitar las imágenes seleccionadas (Supr)", sel_keep_title: "Quitar todas las demás imágenes y quedarse solo con las seleccionadas",
            sel_clear: "Quitar la selección (Esc)", sel_failed: "No se han podido quitar las imágenes seleccionadas: {e}",
            sel_nothing: "Nada que quitar: están todas seleccionadas",
            sel_removed_one: "Quitada 1 imagen de {g} (quedan {total})", sel_removed_many: "Quitadas {n} imágenes de {g} (quedan {total})",
            sel_restored: "Imágenes restauradas en {g} (total {total})",
            move_group_here: "Mover {n} a la posición {pos}", moved_group: "Movidas {n} imágenes a la posición {pos} en {g}",
        },
    };
    const browserLang = () => String(navigator.language || (navigator.languages && navigator.languages[0]) || "");
    const lang = () => (cfg.language === "en" || cfg.language === "es") ? cfg.language
        : (browserLang().toLowerCase().startsWith("es") ? "es" : "en");
    function t(key, params = {}) {
        const table = I18N[lang()] || I18N.en;
        const text = key in table ? table[key] : (I18N.en[key] ?? key);
        return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    }
    const gname = target => t("g_" + target.name);

    const MIME_EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/bmp": ".bmp",
        "image/avif": ".avif", "image/tiff": ".tif", "image/heic": ".heic", "image/heif": ".heif", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico" };

    // ------------------------------------------------------------------ styles
    const style = document.createElement("style");
    style.id = "dragger-style";
    style.textContent = `
.dragger-zone { position: fixed; z-index: 10040; pointer-events: none; border-radius: 10px; box-sizing: border-box;
  border: 2px dashed rgba(96, 165, 250, .55); background: rgba(59, 130, 246, .05); transition: background .12s, border-color .12s; }
.dragger-zone.active { border: 3px solid #3b82f6; background: rgba(59, 130, 246, .16); box-shadow: 0 0 0 4px rgba(59, 130, 246, .25); }
.dragger-zone .dragger-zone-label { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: 90%;
  padding: 10px 16px; border-radius: 10px; background: rgba(17, 24, 39, .92); color: #fff; font: 600 15px/1.3 system-ui, sans-serif;
  text-align: center; box-shadow: 0 4px 18px rgba(0,0,0,.35); display: none; }
.dragger-zone.active .dragger-zone-label { display: block; }
.dragger-toasts { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10060; display: flex; flex-direction: column;
  align-items: center; gap: 8px; pointer-events: none; max-width: min(92vw, 640px); }
.dragger-toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px;
  font: 500 14px/1.35 system-ui, sans-serif; color: #fff; background: #15803d; box-shadow: 0 6px 22px rgba(0,0,0,.35);
  opacity: 1; transition: opacity .3s; white-space: pre-line; }
.dragger-toast[data-kind="error"] { background: #b91c1c; }
.dragger-toast[data-kind="info"] { background: #1f2937; border: 1px solid #374151; }
.dragger-toast.hiding { opacity: 0; }
.dragger-toast button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,.18);
  font-weight: 700; white-space: nowrap; }
.dragger-toast button:hover { background: rgba(255,255,255,.3); }
.dragger-toast .dragger-close { background: transparent; padding: 2px 6px; opacity: .8; }
/* Remove X: a round button straddling the thumbnail's top-right corner, mostly outside the picture.
   Only galleries enhanced by Dragger (.amg-image-gallery.dragger-enh) get the few layout tweaks that keep it unclipped. */
.amg-image-gallery.dragger-enh { --dragger-x: 18px; --dragger-x-lg: 24px; }
.amg-image-gallery.dragger-enh.dragger-x-small { --dragger-x: 15px; --dragger-x-lg: 20px; }
.amg-image-gallery.dragger-enh.dragger-x-large { --dragger-x: 22px; --dragger-x-lg: 28px; }
.amg-image-gallery.dragger-enh button.thumbnail-item { overflow: visible; }
.amg-image-gallery.dragger-enh button.thumbnail-item > img, .amg-image-gallery.dragger-enh button.thumbnail-item > video { border-radius: calc(var(--button-small-radius) - 1px); }
.amg-image-gallery.dragger-enh .thumbnails { align-items: flex-end; justify-content: safe center; gap: max(var(--spacing-lg), calc(var(--dragger-x) * 0.6 + 2px));
  padding: 0 calc(var(--dragger-x) * 0.6 + 2px) 4px 4px; box-sizing: border-box; }
.amg-image-gallery.dragger-enh .grid-container { gap: max(var(--spacing-lg), calc(var(--dragger-x-lg) * 0.6 + 2px)); padding-right: calc(var(--dragger-x-lg) * 0.6 + 2px); }
.amg-image-gallery.dragger-enh .grid-container { padding-top: calc(var(--dragger-x-lg) * 0.6 + 2px); }
.amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x { position: absolute; z-index: 7; box-sizing: border-box; display: flex; align-items: center;
  justify-content: center; width: var(--dragger-x); height: var(--dragger-x); top: calc(var(--dragger-x) * -0.55); right: calc(var(--dragger-x) * -0.55);
  border-radius: 50%; background: rgba(17, 17, 22, .82); color: #fff; border: 1.5px solid rgba(255, 255, 255, .9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, .55), 0 0 0 1px rgba(0, 0, 0, .25); cursor: pointer; opacity: 0; transform: scale(.8);
  transition: opacity .12s, transform .12s, background .12s; }
.amg-image-gallery.dragger-enh button.thumbnail-lg > .dragger-x { width: var(--dragger-x-lg); height: var(--dragger-x-lg);
  top: calc(var(--dragger-x-lg) * -0.55); right: calc(var(--dragger-x-lg) * -0.55); }
/* larger hit area, extended outwards (top / right) much more than towards the picture */
.amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x::before { content: ""; position: absolute; top: -5px; right: -5px; bottom: -2px; left: -2px; border-radius: 50%; }
.amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x svg { position: static; transform: none; width: 52%; height: 52%; opacity: 1; display: block; }
.amg-image-gallery.dragger-enh button.thumbnail-item:hover > .dragger-x, .amg-image-gallery.dragger-enh button.thumbnail-item:focus-visible > .dragger-x,
.amg-image-gallery.dragger-enh.dragger-x-always button.thumbnail-item > .dragger-x { opacity: 1; transform: none; }
.amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x:hover { background: #e11d48; border-color: #fff; transform: scale(1.12); }
.amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x.busy { opacity: .4 !important; pointer-events: none; }
@media (hover: none) { .amg-image-gallery.dragger-enh button.thumbnail-item > .dragger-x { opacity: 1; transform: none; } }
/* drag to reorder: the insertion bar (fixed, above everything), its position badge and the dimmed dragged thumbnail.
   Bright accent + dark halo: readable on the dark theme as well as on the light one. */
.dragger-insert { position: fixed; z-index: 10050; pointer-events: none; width: 4px; border-radius: 3px; background: #60a5fa;
  box-shadow: 0 0 0 1.5px rgba(10, 14, 24, .85), 0 0 10px 2px rgba(96, 165, 250, .75); transform: translateX(-50%); display: none; }
.dragger-insert::before, .dragger-insert::after { content: ""; position: absolute; left: 50%; width: 10px; height: 10px; border-radius: 50%;
  background: #60a5fa; transform: translateX(-50%); box-shadow: 0 0 0 1.5px rgba(10, 14, 24, .85); }
.dragger-insert::before { top: -6px; } .dragger-insert::after { bottom: -6px; }
.dragger-insert > span { position: absolute; bottom: calc(100% + 9px); left: 50%; transform: translateX(-50%); white-space: nowrap;
  padding: 3px 8px; border-radius: 6px; background: rgba(17, 24, 39, .95); color: #fff; border: 1px solid #60a5fa;
  font: 600 12px/1.3 system-ui, sans-serif; box-shadow: 0 3px 12px rgba(0,0,0,.45); }
.dragger-insert.on { display: block; }
button.thumbnail-item.dragger-dragging { opacity: .35; outline: 2px dashed #60a5fa; outline-offset: 1px; }
/* multi-select: sky-blue ring + tint + check badge (top-left, the X stays top-right); readable on dark and light themes */
.amg-image-gallery button.thumbnail-item.dragger-msel { outline: 3px solid #38bdf8; outline-offset: 2px; box-shadow: 0 0 0 5px rgba(8, 12, 22, .75), 0 0 14px 4px rgba(56, 189, 248, .55); }
.amg-image-gallery button.thumbnail-item.dragger-msel::before { content: ""; position: absolute; inset: 0; z-index: 5; pointer-events: none; border-radius: inherit; background: rgba(56, 189, 248, .22); }
.amg-image-gallery button.thumbnail-item.dragger-msel::after { content: "\\2713"; position: absolute; z-index: 6; pointer-events: none; top: -7px; left: -7px; width: 18px; height: 18px;
  border-radius: 50%; background: #0ea5e9; color: #fff; border: 1.5px solid #fff; font: 700 11px/15px system-ui, sans-serif; text-align: center; box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .6); }
.amg-image-gallery button.thumbnail-item.dragger-msel.dragger-dragging { opacity: .45; }
.dragger-msel-bar { position: fixed; z-index: 10055; display: none; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; border-radius: 10px;
  background: rgba(15, 23, 42, .96); color: #e2e8f0; border: 1px solid #38bdf8; box-shadow: 0 6px 22px rgba(0, 0, 0, .5); font: 600 13px/1.3 system-ui, sans-serif; white-space: nowrap; }
.dragger-msel-bar.on { display: flex; }
.dragger-msel-bar.busy { opacity: .6; pointer-events: none; }
.dragger-msel-bar .dragger-msel-count { color: #7dd3fc; margin-right: 4px; }
.dragger-msel-bar button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: rgba(255, 255, 255, .12); color: #fff; font-weight: 700; }
.dragger-msel-bar button:hover, .dragger-msel-bar button:focus-visible { background: rgba(56, 189, 248, .35); }
.dragger-msel-bar button[data-act="remove"]:hover { background: #e11d48; }
.dragger-msel-bar button.dragger-close { background: transparent; padding: 2px 6px; opacity: .8; }
.dragger-band { position: fixed; z-index: 10045; pointer-events: none; border: 1.5px solid #38bdf8; background: rgba(56, 189, 248, .16); border-radius: 3px; }
html.dragger-banding, html.dragger-banding * { user-select: none !important; cursor: crosshair !important; }
`;
    document.head.appendChild(style);
    const X_SVG = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"/></svg>';

    // ------------------------------------------------------------------ targets
    let targets = [];
    function loadTargets() {
        if (targets.length) return targets;
        const box = document.querySelector("#dragger_targets textarea, #dragger_targets input");
        if (!box || !box.value) return targets;
        try { targets = JSON.parse(box.value) || []; } catch (e) { targets = []; }
        if (targets.length) log(`v${VERSION}: ${targets.length} galleries`, targets.map(t => t.key).join(", "));
        return targets;
    }
    const block = t => document.getElementById("component-" + t.gallery_id);
    const enabled = t => !cfg.targets || cfg.targets[t.name] !== false;
    function displayed(el) {
        if (!el || !el.isConnected) return false;
        const r = el.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
    }
    function inViewport(el) {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    }
    function zoneOf(el) {
        if (!el || !el.closest) return null;
        const amg = el.closest(".adv-media-gallery");
        const gal = el.closest(".amg-image-gallery") || (amg && amg.querySelector(".amg-image-gallery"));
        if (!gal || !gal.id) return null;
        const t = loadTargets().find(x => "component-" + x.gallery_id === gal.id);
        return t && enabled(t) ? t : null;
    }
    const visibleTargets = () => loadTargets().filter(t => enabled(t) && displayed(block(t)));

    // ------------------------------------------------------------------ toasts
    let toastBox = null;
    function toast(message, kind = "ok", opts = {}) {
        if (kind !== "error" && !opts.force && !cfg.toasts) return null;
        if (!toastBox || !toastBox.isConnected) {
            toastBox = document.createElement("div");
            toastBox.className = "dragger-toasts";
            document.body.appendChild(toastBox);
        }
        const el = document.createElement("div");
        el.className = "dragger-toast";
        el.dataset.kind = kind;
        el.setAttribute("role", kind === "error" ? "alert" : "status");
        const text = document.createElement("span");
        text.textContent = message;
        el.appendChild(text);
        let timer = null;
        const close = () => { clearTimeout(timer); el.classList.add("hiding"); setTimeout(() => el.remove(), 320); };
        for (const action of opts.actions || []) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = action.label;
            if (action.className) b.className = action.className;
            if (action.title) { b.title = action.title; b.setAttribute("aria-label", action.title); }
            b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); close(); action.fn && action.fn(); });
            el.appendChild(b);
        }
        toastBox.appendChild(el);
        while (toastBox.children.length > 5) toastBox.firstChild.remove();
        const ms = opts.ms || (kind === "error" ? Math.max(cfg.toast_ms || 3500, 6000) : (cfg.toast_ms || 3500));
        timer = setTimeout(close, ms);
        el.close = close;
        return el;
    }

    // ------------------------------------------------------------------ bridge (JS <-> Python)
    let seq = 0, chain = Promise.resolve();
    const pending = new Map();
    function setBox(selector, value) {
        const box = document.querySelector(selector);
        if (!box) return false;
        const proto = box.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(box, value);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }
    function bridge(target, payload) {
        const run = () => new Promise(resolve => {
            const id = ++seq;
            const button = document.getElementById(target.button);
            if (!button || !setBox("#dragger_bridge_req textarea, #dragger_bridge_req input", JSON.stringify({ ...payload, id, target: target.key, lang: lang() }))) {
                resolve({ ok: false, error: t("not_ready") });
                return;
            }
            const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: t("no_response") }); }, 180000);
            pending.set(id, { resolve, timer });
            setTimeout(() => button.click(), 30);
        });
        const p = chain.then(run, run);
        chain = p.catch(() => {});
        return p;
    }
    function bridgeResponse(raw) {
        let r;
        try { r = JSON.parse(raw || "{}"); } catch (e) { return; }
        const p = pending.get(r.id);
        if (!p) return;
        pending.delete(r.id);
        clearTimeout(p.timer);
        p.resolve(r);
    }

    // ------------------------------------------------------------------ extracting images
    function isImageFile(f) {
        if (f.type && f.type.startsWith("image/")) return true;
        if (IMG_NAME.test(f.name || "")) return true;
        return !f.type || f.type === "application/octet-stream";
    }
    function urlsFromHtml(html) {
        if (!html) return [];
        try {
            const doc = new DOMParser().parseFromString(html, "text/html");
            return [...doc.querySelectorAll("img[src]")].map(img => img.getAttribute("src")).filter(Boolean);
        } catch (e) { return []; }
    }
    function cleanUrl(u) {
        u = String(u || "").trim();
        if (!u) return null;
        if (/^(data:image\/|blob:)/i.test(u)) return u;
        try {
            const url = new URL(u, location.href);
            return /^https?:$/.test(url.protocol) ? url.href : null;
        } catch (e) { return null; }
    }
    // Must run synchronously inside the drop / paste event (DataTransfer is emptied afterwards).
    function extract(dt) {
        const out = { files: [], urls: [], rejected: [] };
        if (!dt) return out;
        let files = [...(dt.files || [])];
        if (!files.length && dt.items) files = [...dt.items].filter(i => i.kind === "file").map(i => i.getAsFile()).filter(Boolean);
        for (const f of files) (isImageFile(f) ? out.files : out.rejected).push(f);
        if (files.length) return out;  // a dragged web image often comes as file + html + url of the same image
        let urls = urlsFromHtml(dt.getData && dt.getData("text/html"));
        if (!urls.length) urls = (dt.getData && dt.getData("text/uri-list") || "").split(/\r?\n/).filter(l => l && !l.startsWith("#"));
        if (!urls.length) {
            const text = (dt.getData && dt.getData("text/plain") || "").trim();
            if (/^(https?:\/\/|data:image\/)\S+$/i.test(text)) urls = [text];
        }
        out.urls = [...new Set(urls.map(cleanUrl).filter(Boolean))];
        return out;
    }
    const hasPayload = x => x.files.length + x.urls.length + x.rejected.length > 0;

    function stamp() {
        const d = new Date(), p = n => String(n).padStart(2, "0");
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
    function nameFor(url, blob) {
        let name = "";
        if (/^https?:/i.test(url)) {
            try { name = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch (e) { name = ""; }
            if (name.includes("file=")) name = name.split(/[\\/]/).pop();
        }
        name = name.replace(/[\\/:*?"<>|]+/g, "_").slice(-100) || t("web_image");
        const ext = MIME_EXT[(blob && blob.type) || ""];
        if (ext && !IMG_NAME.test(name)) name += ext;
        return name;
    }
    async function fetchBlob(url) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
            const same = /^(data:|blob:)/i.test(url) || new URL(url, location.href).origin === location.origin;
            const res = await window.fetch(url, { mode: same ? "same-origin" : "cors", credentials: same ? "same-origin" : "omit", signal: ctrl.signal });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const blob = await res.blob();
            if (blob.type && !blob.type.startsWith("image/") && blob.type !== "application/octet-stream") throw new Error(t("not_image"));
            return blob;
        } finally { clearTimeout(timer); }
    }
    function apiBase() {
        const c = window.gradio_config || {};
        const root = (c.root || location.origin + location.pathname).replace(/\/$/, "");
        return root + (c.api_prefix || "/gradio_api");
    }
    async function upload(entries) {
        const form = new FormData();
        for (const e of entries) form.append("files", e.blob, e.name);
        const id = Math.random().toString(36).slice(2);
        const res = await window.fetch(`${apiBase()}/upload?upload_id=${id}`, { method: "POST", body: form, credentials: "same-origin" });
        if (!res.ok) throw new Error(t("upload_failed_http", { status: res.status }));
        const paths = await res.json();
        if (!Array.isArray(paths) || paths.length !== entries.length) throw new Error(t("upload_failed"));
        return paths;
    }

    // ------------------------------------------------------------------ adding
    async function addTo(target, x, source) {
        const g = gname(target);
        const errors = x.rejected.map(f => t("unsupported_file", { name: f.name || t("file"), type: f.type || t("unknown_type") }));
        const entries = [];   // ordered: {blob, name} or {url}
        let n = 0;
        for (const f of x.files) {
            n++;
            let name = f.name || "";
            if (source === "paste" && (!name || /^image\.\w+$/i.test(name))) name = `${t("paste_prefix")}-${stamp()}${x.files.length > 1 ? "-" + n : ""}${MIME_EXT[f.type] || ".png"}`;
            entries.push({ blob: f, name: name || `${t("image")}-${n}${MIME_EXT[f.type] || ""}` });
        }
        const total = x.files.length + x.urls.length;
        if (!total) {
            toast(errors.length ? t("nothing_added", { g }) + "\n" + errors.slice(0, 3).join("\n") : t("no_images_for", { g }), "error");
            return { ok: false };
        }
        const busy = setTimeout(() => toast(t(total === 1 ? "adding_one" : "adding_many", { n: total, g }), "info", { ms: 2500 }), 700);
        try {
            for (const url of x.urls) {
                try {
                    const blob = await fetchBlob(url);
                    entries.push({ blob, name: nameFor(url, blob) });
                } catch (e) {
                    if (/^https?:/i.test(url)) entries.push({ url });     // CORS / blocked: let the server download it
                    else errors.push(`${url.slice(0, 60)}: ${e.message || e}`);
                }
            }
            const blobs = entries.filter(e => e.blob);
            if (blobs.length) {
                const paths = await upload(blobs);
                blobs.forEach((e, i) => { e.path = paths[i]; });
            }
            const items = entries.map(e => e.blob ? { kind: "path", path: e.path, name: e.name } : { kind: "url", url: e.url });
            if (!items.length) throw new Error(errors[0] || t("no_images"));
            const r = await bridge(target, { action: "add", items, position: cfg.position, downscale: cfg.downscale, max_side: cfg.max_side });
            clearTimeout(busy);
            const allErrors = errors.concat(r.errors || []);
            if (r.ok) {
                const msg = r.single ? t("single_set", { g }) : t(r.added === 1 ? "added_one" : "added_many", { n: r.added, g, total: r.total });
                toast(msg, "ok");
                if (allErrors.length) toast(t(allErrors.length === 1 ? "not_added_one" : "not_added_many", { n: allErrors.length }) + "\n" + allErrors.slice(0, 3).join("\n"), "error");
            } else {
                toast(t("add_failed", { g }) + "\n" + (allErrors.length ? allErrors.slice(0, 3).join("\n") : r.error), "error");
            }
            return r;
        } catch (e) {
            clearTimeout(busy);
            toast(t("add_error", { g, e: e.message || e }), "error");
            return { ok: false, error: String(e.message || e) };
        }
    }

    // ------------------------------------------------------------------ drag & drop
    let overlays = new Map(), dragTs = 0, dragWatch = null, dragSource = null, hoverKey = null;
    const isFileDrag = dt => !!dt && [...(dt.types || [])].some(t => t === "Files" || t === "text/uri-list" || t === "text/html");
    function renderOverlays(activeKey, skipKey) {
        const vis = visibleTargets().filter(tg => tg.key !== skipKey);
        const keep = new Set();
        for (const tg of vis) {
            const el = block(tg);
            if (!inViewport(el)) continue;
            keep.add(tg.key);
            let ov = overlays.get(tg.key);
            if (!ov) {
                ov = document.createElement("div");
                ov.className = "dragger-zone";
                ov.dataset.target = tg.key;
                const label = document.createElement("div");
                label.className = "dragger-zone-label";
                ov.appendChild(label);
                document.body.appendChild(ov);
                overlays.set(tg.key, ov);
            }
            const text = t("drop_to", { g: gname(tg) });
            if (ov.firstChild.textContent !== text) ov.firstChild.textContent = text;
            const r = el.getBoundingClientRect();
            Object.assign(ov.style, { left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
            ov.classList.toggle("active", tg.key === activeKey);
        }
        for (const [key, ov] of overlays) if (!keep.has(key)) { ov.remove(); overlays.delete(key); }
    }
    function clearOverlays() {
        for (const ov of overlays.values()) ov.remove();
        overlays.clear();
        clearInterval(dragWatch);
        dragWatch = null;
    }
    function onDragOver(e) {
        if (!cfg.drag_enabled || !isFileDrag(e.dataTransfer)) return;
        dragTs = Date.now();
        if (!dragWatch) dragWatch = setInterval(() => { if (Date.now() - dragTs > 250) clearOverlays(); }, 100);
        const t = zoneOf(e.target);
        if (t && dragSource && dragSource.key === t.key) { renderOverlays(null); return; }
        renderOverlays(t ? t.key : null);
        if (!t) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        e.dataTransfer.dropEffect = "copy";
    }
    function onDrop(e) {
        if (!cfg.drag_enabled) return;
        const tg = zoneOf(e.target);
        clearOverlays();
        if (!tg || !isFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (dragSource && dragSource.key === tg.key) return;   // a thumbnail dropped back on its own gallery
        const x = extract(e.dataTransfer);
        if (!hasPayload(x)) { toast(t("no_image_found", { g: gname(tg) }), "error"); return; }
        addTo(tg, x, "drop");
    }
    // ------------------------------------------------------------------ drag a thumbnail to reorder its gallery
    // The thumbnails are natively draggable (their <img>); the drag only starts once the mouse has moved, so a plain
    // click still selects. Dropped on its own gallery = move (the server runs WanGP's Left/Right handler step by step,
    // see plugin.py move_image); dropped on another gallery = copy (the existing add); files from outside: unchanged.
    let reorder = null, insertBar = null;
    const reorderOn = () => cfg.reorder !== false;
    function thumbList(container) { return [...container.querySelectorAll(":scope > button.thumbnail-item")]; }
    function reorderStart(e) {
        reorder = null;
        if (!reorderOn()) return;
        const btn = e.target && e.target.closest && e.target.closest("button.thumbnail-item");
        const tg = btn && zoneOf(btn);
        if (!tg || !btn.parentElement) return;
        const list = thumbList(btn.parentElement);
        if (list.length < 2) return;
        const img = btn.querySelector("img");
        reorder = { tg, btn, container: btn.parentElement, block: btn.closest(".amg-image-gallery"), index: list.indexOf(btn),
            src: img ? img.getAttribute("src") || img.src : "", grid: btn.classList.contains("thumbnail-lg"), slot: null, group: null };
        if (mselOn() && msel && msel.tg.key === tg.key && mselCount() > 1 && mselIndices().includes(reorder.index)) {
            const idx = mselIndices();    // the whole selection moves (keeping its order)
            reorder.group = { indices: idx, srcs: idx.map(i => srcOf(list[i])), btns: idx.map(i => list[i]) };
            reorder.group.btns.forEach(b => b.classList.add("dragger-dragging"));
        }
        try { e.dataTransfer.effectAllowed = "copyMove"; } catch (err) { /* read-only in some browsers */ }
        btn.classList.add("dragger-dragging");
    }
    // group move: position (0-based) where the first selected image lands for insertion slot `slot`
    const groupAt = (group, slot) => { let at = 0; for (let i = 0; i < slot; i++) if (!group.includes(i)) at++; return at; };
    const groupNoop = (group, slot, n) => { const at = groupAt(group, slot); return group.every((g, k) => g === at + k); };
    function hideInsert() { if (insertBar) insertBar.classList.remove("on"); if (reorder) reorder.slot = null; }
    function reorderEnd() {
        if (reorder && reorder.btn) reorder.btn.classList.remove("dragger-dragging");
        if (reorder && reorder.group) reorder.group.btns.forEach(b => b.classList.remove("dragger-dragging"));
        reorder = null;
        hideInsert();
    }
    // Insertion slot 0..n (before thumbnail i / after the last one) under the pointer, from the thumbnails' boxes:
    // the closest one (rows weigh more than columns, for the grid), left or right half.
    function slotAt(list, x, y) {
        const c = reorder && reorder.container.getBoundingClientRect(), m = 28;   // only over the thumbnails (not the big preview)
        if (c && (y < c.top - m || y > c.bottom + m || x < c.left - m || x > c.right + m)) return null;
        let best = -1, bestD = Infinity;
        list.forEach((b, i) => {
            const r = b.getBoundingClientRect();
            const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
            const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
            const d = dy * 4 + dx;
            if (d < bestD) { bestD = d; best = i; }
        });
        if (best < 0) return null;
        const r = list[best].getBoundingClientRect();
        return x < r.left + r.width / 2 ? best : best + 1;
    }
    function showInsert(list, slot) {
        if (!insertBar || !insertBar.isConnected) {
            insertBar = document.createElement("div");
            insertBar.className = "dragger-insert";
            insertBar.appendChild(document.createElement("span"));
            document.body.appendChild(insertBar);
        }
        const prev = slot > 0 ? list[slot - 1].getBoundingClientRect() : null;
        const next = slot < list.length ? list[slot].getBoundingClientRect() : null;
        let x, ref;
        if (prev && next && Math.abs(prev.top - next.top) < 4) { x = (prev.right + next.left) / 2; ref = next; }
        else if (next) { x = next.left - 4; ref = next; }
        else { x = prev.right + 4; ref = prev; }
        const from = reorder.index, to = slot > from ? slot - 1 : slot;
        Object.assign(insertBar.style, { left: x + "px", top: ref.top - 4 + "px", height: ref.height + 8 + "px" });
        const text = reorder.group ? t("move_group_here", { n: reorder.group.indices.length, pos: groupAt(reorder.group.indices, slot) + 1 })
            : t("move_here", { pos: to + 1 });
        if (insertBar.firstChild.textContent !== text) insertBar.firstChild.textContent = text;
        insertBar.classList.add("on");
    }
    function autoScroll(container, x, y) {
        const strip = !reorder.grid;
        const el = strip ? container : (container.closest(".grid-wrap") || container.parentElement);
        if (!el) return;
        const r = el.getBoundingClientRect(), edge = 36, step = 14;
        if (strip && el.scrollWidth > el.clientWidth) {
            if (x < r.left + edge) el.scrollLeft -= step; else if (x > r.right - edge) el.scrollLeft += step;
        } else if (!strip && el.scrollHeight > el.clientHeight) {
            if (y < r.top + edge) el.scrollTop -= step; else if (y > r.bottom - edge) el.scrollTop += step;
        }
    }
    // dragover inside the dragged thumbnail's own gallery; true = handled (the file-drop zones then stay inactive)
    function reorderOver(e) {
        if (!reorder || !reorderOn()) return false;
        const tg = zoneOf(e.target);
        if (!tg || tg.key !== reorder.tg.key || !reorder.container.isConnected) { hideInsert(); return false; }
        e.preventDefault();
        e.stopImmediatePropagation();
        const list = thumbList(reorder.container);
        reorder.index = Math.max(0, list.indexOf(reorder.btn));
        autoScroll(reorder.container, e.clientX, e.clientY);
        const slot = slotAt(list, e.clientX, e.clientY);
        const noop = slot === null || (reorder.group ? groupNoop(reorder.group.indices, slot, list.length)
            : (slot === reorder.index || slot === reorder.index + 1));
        try { e.dataTransfer.dropEffect = noop ? "none" : "move"; } catch (err) { /* ignore */ }
        if (noop) { hideInsert(); return true; }
        reorder.slot = slot;
        showInsert(list, slot);
        return true;
    }
    async function moveThumb(tg, payload, blk) {
        const r = await bridge(tg, { action: "move", ...payload });
        if (!r.ok) { toast(t("move_failed", { e: r.error }), "error"); return r; }
        if (r.moved) {
            if (payload.grid && blk) keepGrid(blk);
            toast(t("moved", { g: gname(tg), pos: r.to + 1, total: r.total }), "ok");
        }
        return r;
    }
    function reorderDrop(e) {
        if (!reorder || !reorderOn()) return false;
        const tg = zoneOf(e.target);
        if (!tg || tg.key !== reorder.tg.key) return false;
        e.preventDefault();
        e.stopImmediatePropagation();
        clearOverlays();
        const list = thumbList(reorder.container);
        const from = Math.max(0, list.indexOf(reorder.btn));
        const slot = slotAt(list, e.clientX, e.clientY);
        const r = reorder;
        reorderEnd();
        if (slot === null) return true;
        if (r.group) {
            if (!groupNoop(r.group.indices, slot, list.length)) moveGroup(r.tg, { indices: r.group.indices, srcs: r.group.srcs, slot, grid: r.grid }, r.block);
            return true;
        }
        const to = slot > from ? slot - 1 : slot;
        if (to !== from) moveThumb(r.tg, { index: from, to, src: r.src, grid: r.grid }, r.block);
        return true;
    }
    window.addEventListener("dragstart", e => { dragSource = zoneOf(e.target); reorderStart(e); }, true);
    window.addEventListener("dragend", () => { dragSource = null; clearOverlays(); reorderEnd(); }, true);
    const onOver = e => {
        if (reorderOver(e)) {   // keep showing the other galleries (a drop there copies the image)
            if (cfg.drag_enabled) { dragTs = Date.now(); if (!dragWatch) dragWatch = setInterval(() => { if (Date.now() - dragTs > 250) clearOverlays(); }, 100); renderOverlays(null, reorder && reorder.tg.key); }
            return;
        }
        onDragOver(e);
    };
    window.addEventListener("dragenter", onOver, true);
    window.addEventListener("dragover", onOver, true);
    window.addEventListener("drop", e => { if (!reorderDrop(e)) onDrop(e); }, true);

    // ------------------------------------------------------------------ paste
    let lastClickedKey = null;
    window.addEventListener("pointerover", e => { const t = zoneOf(e.target); hoverKey = t ? t.key : null; }, { capture: true, passive: true });
    document.documentElement.addEventListener("pointerleave", () => { hoverKey = null; }, { passive: true });
    window.addEventListener("pointerdown", e => {
        if (e.target.closest && e.target.closest(".dragger-toast")) return;
        const t = zoneOf(e.target);
        lastClickedKey = t ? t.key : null;
    }, { capture: true, passive: true });
    function isEditable(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.isContentEditable) return true;
        if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
        if (el.tagName === "INPUT") return !/^(checkbox|radio|button|submit|reset|range|color|file|image|hidden)$/i.test(el.type || "");
        return false;
    }
    function pasteTarget() {
        const vis = visibleTargets();
        const byKey = k => vis.find(t => t.key === k);
        const focused = zoneOf(document.activeElement);
        const t = byKey(hoverKey) || byKey(lastClickedKey) || (focused && byKey(focused.key));
        if (t) return { target: t };
        if (vis.length === 1) return { target: vis[0] };
        const onScreen = vis.filter(x => inViewport(block(x)));
        if (onScreen.length === 1) return { target: onScreen[0] };
        return { choices: vis };
    }
    function onPaste(e) {
        if (!cfg.paste_enabled || e.defaultPrevented) return;
        if (isEditable(e.target) || isEditable(document.activeElement)) return;   // prompts & text boxes keep their normal paste
        if (!loadTargets().length) return;
        const x = extract(e.clipboardData);
        if (!x.files.length && !x.urls.length) return;
        const where = pasteTarget();
        if (!where.target && !(where.choices && where.choices.length)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (where.target) { addTo(where.target, x, "paste"); return; }
        const n = x.files.length + x.urls.length;
        toast(t(n === 1 ? "paste_where_one" : "paste_where_many", { n }), "info", {
            force: true, ms: 10000,
            actions: where.choices.map(tg => ({ label: gname(tg), fn: () => addTo(tg, x, "paste") }))
                .concat([{ label: "✕", title: t("close"), className: "dragger-close", fn: null }]),
        });
    }
    window.addEventListener("paste", onPaste, true);

    // ------------------------------------------------------------------ per-thumbnail remove X
    let decorateFrame = 0;
    function scheduleDecorate() { if (!decorateFrame) decorateFrame = requestAnimationFrame(decorate); }
    function decorate() {
        decorateFrame = 0;
        const title = t("remove_title");
        for (const tg of loadTargets()) {
            const el = block(tg);
            if (!el) continue;
            const on = cfg.remove_x && enabled(tg);
            const size = ["small", "large"].includes(cfg.x_size) ? cfg.x_size : "medium";
            el.classList.toggle("dragger-enh", !!on);
            el.classList.toggle("dragger-x-always", on && cfg.remove_x_mode === "always");
            el.classList.toggle("dragger-x-small", on && size === "small");
            el.classList.toggle("dragger-x-large", on && size === "large");
            for (const btn of el.querySelectorAll("button.thumbnail-item")) {
                const x = btn.querySelector(":scope > .dragger-x");
                if (!on) { if (x) x.remove(); continue; }
                if (x) { if (x.title !== title) { x.title = title; x.setAttribute("aria-label", title); } continue; }
                const span = document.createElement("span");
                span.className = "dragger-x";
                span.setAttribute("role", "button");
                span.setAttribute("aria-label", title);
                span.title = title;
                span.innerHTML = X_SVG;
                btn.appendChild(span);
            }
        }
        paintSel();
    }
    function thumbIndex(btn) {
        const list = [...btn.parentElement.querySelectorAll(":scope > button.thumbnail-item")];
        return list.indexOf(btn);
    }
    // Gradio's Gallery opens the preview on the first value change after it is (re)mounted, whatever the server
    // asks for. When the X was used in the grid view, go back to the grid through the gallery's own Escape key
    // handler (not its Close button: WanGP turns that one into "Remove selected").
    function keepGrid(block) {
        const t0 = Date.now();
        const tick = () => {
            const preview = block.querySelector(".gallery-container > .preview");
            if (preview) { preview.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true })); return; }
            if (Date.now() - t0 < 600) setTimeout(tick, 50);
        };
        tick();
    }

    async function removeThumb(x) {
        const btn = x.closest("button.thumbnail-item");
        const tg = zoneOf(btn);
        if (!btn || !tg) return;
        const g = gname(tg);
        const img = btn.querySelector("img");
        const index = thumbIndex(btn);
        const grid = btn.classList.contains("thumbnail-lg");
        const block = btn.closest(".amg-image-gallery");
        x.classList.add("busy");
        const r = await bridge(tg, { action: "remove", index, src: img ? img.getAttribute("src") || img.src : "", grid });
        x.classList.remove("busy");
        if (!r.ok) { toast(t("remove_failed", { e: r.error }), "error"); return r; }
        if (grid && block && r.total > 0) keepGrid(block);
        if (cfg.undo) {
            toast(t("removed", { g }), "ok", { force: true, ms: 5000, actions: [{ label: t("undo"), fn: async () => {
                const u = await bridge(tg, { action: "undo", token: r.token });
                if (u.ok) toast(t("restored", { g, total: u.total }), "ok");
                else toast(t("undo_failed", { e: u.error }), "error");
            } }] });
        } else {
            toast(t("removed_left", { g, total: r.total }), "ok");
        }
        return r;
    }
    const X_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick", "auxclick", "touchstart"];
    for (const type of X_EVENTS) {
        window.addEventListener(type, e => {
            const x = e.target && e.target.closest && e.target.closest(".dragger-x");
            if (!x) return;
            if (type !== "touchstart") e.preventDefault();
            e.stopImmediatePropagation();
            if (type === "click" && e.button === 0) removeThumb(x);
        }, { capture: true, passive: false });
    }
    function observe() {
        const root = document.querySelector("gradio-app") || document.body;
        new MutationObserver(scheduleDecorate).observe(root, { childList: true, subtree: true });
        scheduleDecorate();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe); else observe();

    // ------------------------------------------------------------------ multi-select (1.3.0)
    // Only in Dragger's own input galleries (zoneOf: start / end / reference images), never in the output gallery or
    // other plugins' browsers. Ctrl(Cmd)+click toggles a thumbnail, Shift+click selects a range, dragging on an empty
    // area of the gallery draws a selection box. "Remove selected" / "Keep only selected" / Delete run WanGP's own
    // Remove handler on the server (plugin.py remove_many), with Undo. Esc or a click on an empty area clears it.
    const mselOn = () => cfg.multiselect !== false;
    let msel = null;          // { tg, items: [{i, src}], anchor }
    let mselBar = null, mselFrame = 0, band = null;
    const srcOf = btn => { const img = btn && btn.querySelector("img, video"); return img ? img.getAttribute("src") || img.src || "" : ""; };
    function galleryList(tg) {
        const el = block(tg);
        const first = el && el.querySelector("button.thumbnail-item");
        return first && first.parentElement ? thumbList(first.parentElement) : [];
    }
    const mselCount = () => (msel ? msel.items.length : 0);
    const mselIndices = () => (msel ? msel.items.map(x => x.i).sort((a, b) => a - b) : []);
    function mselSet(tg, indices, anchor) {
        const list = galleryList(tg);
        const uniq = [...new Set(indices)].filter(i => i >= 0 && i < list.length).sort((a, b) => a - b);
        msel = uniq.length ? { tg, items: uniq.map(i => ({ i, src: srcOf(list[i]) })), anchor: anchor ?? (msel && msel.tg.key === tg.key ? msel.anchor : uniq[0]) } : null;
        paintSel();
    }
    function mselClear() { if (!msel) return false; msel = null; paintSel(); return true; }
    // after any change of the gallery (X, WanGP's own buttons, a move, a drop): follow the selected images by file
    function reconcileSel() {
        if (!msel) return;
        const list = galleryList(msel.tg);
        if (!list.length) { msel = null; return; }
        const srcs = list.map(srcOf), used = new Set(), next = [];
        for (const it of msel.items) {
            let i = it.i < srcs.length && srcs[it.i] === it.src && !used.has(it.i) ? it.i : -1;
            if (i < 0) {
                let best = Infinity;
                srcs.forEach((s, k) => { if (s === it.src && !used.has(k) && Math.abs(k - it.i) < best) { best = Math.abs(k - it.i); i = k; } });
            }
            if (i >= 0) { used.add(i); next.push({ i, src: it.src }); }
        }
        next.sort((a, b) => a.i - b.i);
        msel = next.length ? { ...msel, items: next } : null;
    }
    function paintSel() {
        reconcileSel();
        const on = new Set(msel ? msel.items.map(x => x.i) : []);
        for (const tg of loadTargets()) {
            const el = block(tg);
            if (!el) continue;
            const mine = msel && msel.tg.key === tg.key;
            el.classList.toggle("dragger-msel-active", !!mine);
            galleryList(tg).forEach((b, i) => {
                const sel = !!mine && on.has(i);
                if (b.classList.contains("dragger-msel") !== sel) b.classList.toggle("dragger-msel", sel);
            });
            for (const b of el.querySelectorAll("button.thumbnail-item.dragger-msel")) if (!mine || !galleryList(tg).includes(b)) b.classList.remove("dragger-msel");
        }
        renderBar();
    }
    function renderBar() {
        if (!msel) { if (mselBar) mselBar.classList.remove("on"); cancelAnimationFrame(mselFrame); mselFrame = 0; return; }
        if (!mselBar || !mselBar.isConnected) {
            mselBar = document.createElement("div");
            mselBar.className = "dragger-msel-bar";
            mselBar.setAttribute("role", "toolbar");
            mselBar.innerHTML = '<span class="dragger-msel-count"></span><button type="button" data-act="remove"></button><button type="button" data-act="keep"></button><button type="button" data-act="clear" class="dragger-close">✕</button>';
            for (const type of ["pointerdown", "mousedown", "click"]) mselBar.addEventListener(type, e => {
                e.stopPropagation();
                const b = e.target.closest && e.target.closest("button[data-act]");
                if (type !== "click" || !b) return;
                e.preventDefault();
                if (b.dataset.act === "clear") mselClear(); else removeSelected(b.dataset.act === "keep");
            });
            document.body.appendChild(mselBar);
        }
        const n = mselCount();
        const set = (sel, text, title) => { const el = mselBar.querySelector(sel); if (el.textContent !== text) el.textContent = text; if (title !== undefined) { el.title = title; el.setAttribute("aria-label", title); } };
        set(".dragger-msel-count", t(n === 1 ? "sel_one" : "sel_many", { n }));
        set('[data-act="remove"]', t("sel_remove"), t("sel_remove_title"));
        set('[data-act="keep"]', t("sel_keep"), t("sel_keep_title"));
        mselBar.querySelector('[data-act="clear"]').title = t("sel_clear");
        mselBar.querySelector('[data-act="clear"]').setAttribute("aria-label", t("sel_clear"));
        mselBar.classList.add("on");
        if (!mselFrame) mselFrame = requestAnimationFrame(placeBar);
    }
    function placeBar() {
        mselFrame = 0;
        if (!msel || !mselBar) return;
        const list = galleryList(msel.tg), el = block(msel.tg);
        if (!list.length || !displayed(el)) { mselBar.style.visibility = "hidden"; mselFrame = requestAnimationFrame(placeBar); return; }
        const strip = list[0].parentElement.getBoundingClientRect(), g = el.getBoundingClientRect();
        const left = Math.max(g.left, strip.left), right = Math.min(g.right, strip.right);
        const bw = mselBar.offsetWidth, bh = mselBar.offsetHeight;
        let top = strip.top - bh - 10;
        if (top < g.top + 2) top = Math.min(strip.bottom + 8, innerHeight - bh - 4);
        const x = Math.min(Math.max(4, (left + right) / 2 - bw / 2), innerWidth - bw - 4);
        Object.assign(mselBar.style, { left: x + "px", top: Math.max(4, top) + "px", visibility: "visible" });
        mselFrame = requestAnimationFrame(placeBar);
    }
    async function removeSelected(keep) {
        if (!msel) return null;
        const tg = msel.tg, g = gname(tg), list = galleryList(tg);
        const indices = mselIndices(), srcs = indices.map(i => srcOf(list[i]));
        const grid = !!(list[0] && list[0].classList.contains("thumbnail-lg"));
        const blk = block(tg);
        if (mselBar) mselBar.classList.add("busy");
        const r = await bridge(tg, { action: "remove_many", indices, srcs, keep: !!keep, grid });
        if (mselBar) mselBar.classList.remove("busy");
        if (!r.ok) { toast(t("sel_failed", { e: r.error }), "error"); return r; }
        mselClear();
        if (!r.removed) { toast(t("sel_nothing"), "info"); return r; }
        if (grid && blk && r.total > 0) keepGrid(blk);
        const msg = t(r.removed === 1 ? "sel_removed_one" : "sel_removed_many", { n: r.removed, g, total: r.total });
        if (cfg.undo !== false && r.token) {
            toast(msg, "ok", { force: true, ms: 8000, actions: [{ label: t("undo"), fn: async () => {
                const u = await bridge(tg, { action: "undo_many", token: r.token, grid });
                if (u.ok) { if (grid && blk) keepGrid(blk); toast(t("sel_restored", { n: u.restored, g, total: u.total }), "ok"); }
                else toast(t("undo_failed", { e: u.error }), "error");
            } }] });
        } else toast(msg, "ok");
        return r;
    }
    const thumbOf = el => el && el.closest && el.closest("button.thumbnail-item");
    function gradioSelected(list) { const i = list.findIndex(b => b.classList.contains("selected")); return i; }
    // clicks on thumbnails (capture, before Gradio's own handler)
    window.addEventListener("click", e => {
        if (e.button !== 0 || !mselOn()) return;
        if (e.target.closest && e.target.closest(".dragger-x, .dragger-msel-bar, .dragger-toast")) return;
        const btn = thumbOf(e.target), tg = btn && zoneOf(btn);
        if (!tg) return;
        const list = thumbList(btn.parentElement), i = list.indexOf(btn);
        if (i < 0) return;
        const same = msel && msel.tg.key === tg.key;
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const cur = same ? mselIndices() : [];
            if (e.shiftKey) {
                let a = same && msel.anchor != null ? msel.anchor : gradioSelected(list);
                if (a < 0 || a >= list.length) a = i;
                const range = []; for (let k = Math.min(a, i); k <= Math.max(a, i); k++) range.push(k);
                mselSet(tg, (e.ctrlKey || e.metaKey) ? cur.concat(range) : range, a);
            } else {
                mselSet(tg, cur.includes(i) ? cur.filter(k => k !== i) : cur.concat([i]), i);
            }
            return;
        }
        if (msel) mselClear();   // a plain click: normal select / preview, the multi-selection goes away
    }, true);
    // Ctrl / Shift + mousedown on a thumbnail must not move the focus ring or start a text selection
    window.addEventListener("mousedown", e => {
        if (!mselOn() || e.button !== 0 || !(e.ctrlKey || e.metaKey || e.shiftKey)) return;
        const btn = thumbOf(e.target);
        if (btn && zoneOf(btn) && !(e.target.closest && e.target.closest(".dragger-x"))) e.preventDefault();
    }, true);
    // selection box from an empty area of an input gallery
    const NOT_EMPTY = "button, a, input, textarea, select, label, img, video, canvas, [role=button], [contenteditable], .dragger-x, .dragger-msel-bar, .dragger-toast, .icon-button, .icon-buttons";
    function bandStart(e) {
        if (!mselOn() || e.button !== 0 || !e.isPrimary) return;
        if (e.target.closest && e.target.closest(".dragger-msel-bar, .dragger-toast")) return;
        const tg = zoneOf(e.target);
        if (!tg) { if (msel) mselClear(); return; }        // a click outside the input galleries
        if (e.target.closest(NOT_EMPTY)) return;           // thumbnails (click / reorder), buttons, the big preview
        const el = block(tg);
        if (!el || !el.contains(e.target)) return;
        const list = galleryList(tg);
        if (!list.length) return;
        band = { tg, x0: e.clientX, y0: e.clientY, add: e.ctrlKey || e.metaKey, base: msel && msel.tg.key === tg.key ? mselIndices() : [], moved: false, box: null, id: e.pointerId };
    }
    function bandMove(e) {
        if (!band || e.pointerId !== band.id) return;
        const dx = e.clientX - band.x0, dy = e.clientY - band.y0;
        if (!band.moved && Math.hypot(dx, dy) < 5) return;
        if (!band.moved) {
            band.moved = true;
            band.box = document.createElement("div");
            band.box.className = "dragger-band";
            document.body.appendChild(band.box);
            document.documentElement.classList.add("dragger-banding");
        }
        e.preventDefault();
        const g = block(band.tg).getBoundingClientRect();
        const x1 = Math.max(g.left, Math.min(band.x0, e.clientX)), x2 = Math.min(g.right, Math.max(band.x0, e.clientX));
        const y1 = Math.max(g.top, Math.min(band.y0, e.clientY)), y2 = Math.min(g.bottom, Math.max(band.y0, e.clientY));
        Object.assign(band.box.style, { left: x1 + "px", top: y1 + "px", width: Math.max(0, x2 - x1) + "px", height: Math.max(0, y2 - y1) + "px" });
        const hit = [];
        galleryList(band.tg).forEach((b, i) => {
            const r = b.getBoundingClientRect();
            if (r.width && r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2) hit.push(i);
        });
        mselSet(band.tg, band.add ? band.base.filter(i => !hit.includes(i)).concat(hit) : hit, hit.length ? hit[0] : undefined);
        if (!msel || msel.tg.key !== band.tg.key) { msel = null; paintSel(); }
        const sel = window.getSelection && window.getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges();
    }
    function bandEnd(e) {
        if (!band || (e && e.pointerId !== band.id)) return;
        const b = band; band = null;
        document.documentElement.classList.remove("dragger-banding");
        if (b.box) { b.box.remove(); suppressClick = Date.now(); }
        else if (msel && !b.add) mselClear();               // a click on an empty area of the gallery
    }
    let suppressClick = 0;
    window.addEventListener("pointerdown", bandStart, { capture: true, passive: true });
    window.addEventListener("pointermove", bandMove, { capture: true, passive: false });
    window.addEventListener("pointerup", bandEnd, true);
    window.addEventListener("pointercancel", bandEnd, true);
    window.addEventListener("click", e => { if (suppressClick && Date.now() - suppressClick < 400) { suppressClick = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    window.addEventListener("selectstart", e => { if (band && band.moved) e.preventDefault(); }, true);
    // keys: Esc clears, Delete (Supr) removes the selection
    window.addEventListener("keydown", e => {
        if (!msel || !mselOn()) return;
        if (e.key === "Escape") {
            if (band) return;
            mselClear(); e.preventDefault(); e.stopImmediatePropagation(); return;
        }
        if (e.key !== "Delete" || e.ctrlKey || e.altKey || e.metaKey) return;
        const ae = document.activeElement;
        if (isEditable(ae) || isEditable(e.target)) return;
        const el = block(msel.tg);
        const here = (ae && el && el.contains(ae)) || lastClickedKey === msel.tg.key || hoverKey === msel.tg.key;
        if (!here) return;
        e.preventDefault(); e.stopImmediatePropagation();
        removeSelected(false);
    }, true);
    // a group move answered by the server: the moved images stay selected at their new places (followed by file)
    function mselAfterMove(tg, group, r) {
        if (!r.indices || r.indices.length !== group.srcs.length) return;
        msel = { tg, items: r.indices.map((i, k) => ({ i, src: group.srcs[k] })).sort((a, b) => a.i - b.i), anchor: r.indices[0] };
        paintSel();
    }
    async function moveGroup(tg, payload, blk) {
        const r = await bridge(tg, { action: "move_group", ...payload });
        if (!r.ok) { toast(t("move_failed", { e: r.error }), "error"); return r; }
        if (r.moved) {
            if (payload.grid && blk) keepGrid(blk);
            mselAfterMove(tg, payload, r);
            toast(t("moved_group", { n: r.indices.length, pos: r.indices[0] + 1, g: gname(tg) }), "ok");
        }
        return r;
    }

    // ------------------------------------------------------------------ settings
    let tabLang = null, localizeWatch = null, tabRequest = null, serverSettingsLoaded = false;
    // Ask the server to relabel the settings tab (built once in Python). The event's js step sends navigator.language
    // and tabRequest: null on the first call (page load: the server answers with settings.json as it is now and picks
    // the language from it), afterwards the language the page switched to. Until the answer arrives
    // (applySettings(..., true)) the click is retried, in case the Gradio app wasn't listening yet.
    function localizeTab(force) {
        const want = lang();
        if (!force && tabLang === want) return true;
        const button = document.getElementById("dragger_localize");
        if (!button) return false;
        tabLang = want;
        tabRequest = serverSettingsLoaded ? want : null;
        clearTimeout(localizeWatch);
        let tries = 0;
        const click = () => {
            button.click();
            if (++tries < 8) localizeWatch = setTimeout(click, 1500);
        };
        localizeWatch = setTimeout(click, 30);
        return true;
    }
    // source: true = the answer of the "localize" event. The first one carries settings.json as it is now (the script
    // was injected with the settings WanGP started with) and is applied; later ones only confirm the relabelling.
    // "saved" = the settings tab's Save (which already relabelled the tab). Anything else: apply, relabel if needed.
    function applySettings(json, source) {
        let next;
        try { next = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return; }
        if (!next || typeof next !== "object") return;
        const fromServer = source === true;
        if (fromServer) {
            clearTimeout(localizeWatch);
            if (serverSettingsLoaded) return;
            serverSettingsLoaded = true;
        }
        cfg = next;
        if (!mselOn()) mselClear();
        scheduleDecorate();
        for (const ov of overlays.values()) ov.remove();
        overlays.clear();
        if (fromServer || source === "saved") tabLang = lang(); else localizeTab(false);
        log("settings applied, language:", lang());
    }
    (function initTab(tries) {   // once the Gradio app (and its hidden bridge) is in the page
        if (localizeTab(true) || tries > 600) return;
        setTimeout(() => initTab(tries + 1), 100);
    })(0);

    window.dragger = { version: VERSION, get settings() { return cfg; }, applySettings, bridgeResponse, loadTargets,
        visibleTargets, zoneOf, extract, addTo, removeThumb, moveThumb, pasteTarget,
        get selection() { return msel ? { key: msel.tg.key, indices: mselIndices(), anchor: msel.anchor } : null; },
        select: (key, indices) => { const tg = loadTargets().find(x => x.key === key); if (tg) mselSet(tg, indices); return !!tg; },
        clearSelection: mselClear, removeSelected, moveGroup, toast, decorate, _bridge: bridge, lang, t, I18N, localizeTab,
        get tabRequest() { return tabRequest; },
        inspect: key => { const tg = loadTargets().find(x => x.key === key); return tg ? bridge(tg, { action: "inspect" }) : Promise.resolve({ ok: false, error: t("unknown_gallery") }); } };
    log(`v${VERSION} loaded`);
})();
