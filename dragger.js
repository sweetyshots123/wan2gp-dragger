// Dragger __DRAGGER_VERSION__ - drag & drop / paste images into WanGP's image galleries.
// Injected by the Dragger plugin through WanGP's add_custom_js API (runs inside WanGP's main JS function).
(() => {
    if (window.dragger && window.dragger.version) return;
    const VERSION = "__DRAGGER_VERSION__";
    let cfg = __DRAGGER_SETTINGS__;
    const log = (...a) => console.log("[Dragger]", ...a);
    const IMG_NAME = /\.(png|jpe?g|jfif|pjpeg|bmp|gif|webp|tiff?|avif|heic|heif|ico|apng)$/i;
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
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

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
            if (!button || !setBox("#dragger_bridge_req textarea, #dragger_bridge_req input", JSON.stringify({ ...payload, id, target: target.key }))) {
                resolve({ ok: false, error: "el plugin no está listo (recarga la página)" });
                return;
            }
            const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: "sin respuesta del servidor" }); }, 180000);
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
        name = name.replace(/[\\/:*?"<>|]+/g, "_").slice(-100) || "imagen-web";
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
            if (blob.type && !blob.type.startsWith("image/") && blob.type !== "application/octet-stream") throw new Error("no es una imagen");
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
        if (!res.ok) throw new Error(`subida fallida (HTTP ${res.status})`);
        const paths = await res.json();
        if (!Array.isArray(paths) || paths.length !== entries.length) throw new Error("subida fallida");
        return paths;
    }

    // ------------------------------------------------------------------ adding
    async function addTo(target, x, source) {
        const errors = x.rejected.map(f => `${f.name || "archivo"}: formato no compatible (${f.type || "desconocido"})`);
        const entries = [];   // ordered: {blob, name} or {url}
        let n = 0;
        for (const f of x.files) {
            n++;
            let name = f.name || "";
            if (source === "paste" && (!name || /^image\.\w+$/i.test(name))) name = `portapapeles-${stamp()}${x.files.length > 1 ? "-" + n : ""}${MIME_EXT[f.type] || ".png"}`;
            entries.push({ blob: f, name: name || `imagen-${n}${MIME_EXT[f.type] || ""}` });
        }
        const total = x.files.length + x.urls.length;
        if (!total) {
            toast(errors.length ? `No se ha añadido nada a ${target.label}:\n` + errors.slice(0, 3).join("\n") : `No hay imágenes que añadir a ${target.label}`, "error");
            return { ok: false };
        }
        const busy = setTimeout(() => toast(`Añadiendo ${plural(total, "imagen", "imágenes")} a ${target.label}…`, "info", { ms: 2500 }), 700);
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
            if (!items.length) throw new Error(errors[0] || "no hay imágenes");
            const r = await bridge(target, { action: "add", items, position: cfg.position, downscale: cfg.downscale, max_side: cfg.max_side });
            clearTimeout(busy);
            const allErrors = errors.concat(r.errors || []);
            if (r.ok) {
                const msg = r.single ? `Imagen puesta en ${target.label} (esta galería solo admite una)`
                    : `${r.added === 1 ? "Añadida 1 imagen" : `Añadidas ${r.added} imágenes`} a ${target.label} (total ${r.total})`;
                toast(msg, "ok");
                if (allErrors.length) toast(`${plural(allErrors.length, "imagen no añadida", "imágenes no añadidas")}:\n` + allErrors.slice(0, 3).join("\n"), "error");
            } else {
                toast(`No se ha podido añadir a ${target.label}:\n` + (allErrors.length ? allErrors.slice(0, 3).join("\n") : r.error), "error");
            }
            return r;
        } catch (e) {
            clearTimeout(busy);
            toast(`Error al añadir a ${target.label}: ${e.message || e}`, "error");
            return { ok: false, error: String(e.message || e) };
        }
    }

    // ------------------------------------------------------------------ drag & drop
    let overlays = new Map(), dragTs = 0, dragWatch = null, dragSource = null, hoverKey = null;
    const isFileDrag = dt => !!dt && [...(dt.types || [])].some(t => t === "Files" || t === "text/uri-list" || t === "text/html");
    function renderOverlays(activeKey) {
        const vis = visibleTargets();
        const keep = new Set();
        for (const t of vis) {
            const el = block(t);
            if (!inViewport(el)) continue;
            keep.add(t.key);
            let ov = overlays.get(t.key);
            if (!ov) {
                ov = document.createElement("div");
                ov.className = "dragger-zone";
                ov.dataset.target = t.key;
                const label = document.createElement("div");
                label.className = "dragger-zone-label";
                label.textContent = `Soltar para añadir a: ${t.label}`;
                ov.appendChild(label);
                document.body.appendChild(ov);
                overlays.set(t.key, ov);
            }
            const r = el.getBoundingClientRect();
            Object.assign(ov.style, { left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
            ov.classList.toggle("active", t.key === activeKey);
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
        const t = zoneOf(e.target);
        clearOverlays();
        if (!t || !isFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (dragSource && dragSource.key === t.key) return;   // a thumbnail dropped back on its own gallery
        const x = extract(e.dataTransfer);
        if (!hasPayload(x)) { toast(`No se ha encontrado ninguna imagen para ${t.label}`, "error"); return; }
        addTo(t, x, "drop");
    }
    window.addEventListener("dragstart", e => { dragSource = zoneOf(e.target); }, true);
    window.addEventListener("dragend", () => { dragSource = null; clearOverlays(); }, true);
    window.addEventListener("dragenter", onDragOver, true);
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);

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
        toast(`¿Dónde pego ${n === 1 ? "la imagen" : `las ${n} imágenes`}?`, "info", {
            force: true, ms: 10000,
            actions: where.choices.map(t => ({ label: t.label, fn: () => addTo(t, x, "paste") }))
                .concat([{ label: "✕", className: "dragger-close", fn: null }]),
        });
    }
    window.addEventListener("paste", onPaste, true);

    // ------------------------------------------------------------------ per-thumbnail remove X
    let decorateFrame = 0;
    function scheduleDecorate() { if (!decorateFrame) decorateFrame = requestAnimationFrame(decorate); }
    function decorate() {
        decorateFrame = 0;
        for (const t of loadTargets()) {
            const el = block(t);
            if (!el) continue;
            const on = cfg.remove_x && enabled(t);
            const size = ["small", "large"].includes(cfg.x_size) ? cfg.x_size : "medium";
            el.classList.toggle("dragger-enh", !!on);
            el.classList.toggle("dragger-x-always", on && cfg.remove_x_mode === "always");
            el.classList.toggle("dragger-x-small", on && size === "small");
            el.classList.toggle("dragger-x-large", on && size === "large");
            for (const btn of el.querySelectorAll("button.thumbnail-item")) {
                const x = btn.querySelector(":scope > .dragger-x");
                if (!on) { if (x) x.remove(); continue; }
                if (x) continue;
                const span = document.createElement("span");
                span.className = "dragger-x";
                span.setAttribute("role", "button");
                span.setAttribute("aria-label", "Quitar esta imagen");
                span.title = "Quitar esta imagen";
                span.innerHTML = X_SVG;
                btn.appendChild(span);
            }
        }
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
        const t = zoneOf(btn);
        if (!btn || !t) return;
        const img = btn.querySelector("img");
        const index = thumbIndex(btn);
        const grid = btn.classList.contains("thumbnail-lg");
        const block = btn.closest(".amg-image-gallery");
        x.classList.add("busy");
        const r = await bridge(t, { action: "remove", index, src: img ? img.getAttribute("src") || img.src : "", grid });
        x.classList.remove("busy");
        if (!r.ok) { toast(`No se ha podido quitar la imagen: ${r.error}`, "error"); return r; }
        if (grid && block && r.total > 0) keepGrid(block);
        if (cfg.undo) {
            toast(`Imagen quitada de ${t.label}`, "ok", { force: true, ms: 5000, actions: [{ label: "Deshacer", fn: async () => {
                const u = await bridge(t, { action: "undo", token: r.token });
                if (u.ok) toast(`Imagen restaurada en ${t.label} (total ${u.total})`, "ok");
                else toast(`No se ha podido deshacer: ${u.error}`, "error");
            } }] });
        } else {
            toast(`Imagen quitada de ${t.label} (quedan ${r.total})`, "ok");
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

    // ------------------------------------------------------------------ settings
    function applySettings(json) {
        try { cfg = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return; }
        scheduleDecorate();
        log("settings applied");
    }

    window.dragger = { version: VERSION, get settings() { return cfg; }, applySettings, bridgeResponse, loadTargets,
        visibleTargets, zoneOf, extract, addTo, removeThumb, pasteTarget, toast, decorate, _bridge: bridge,
        inspect: key => { const t = loadTargets().find(x => x.key === key); return t ? bridge(t, { action: "inspect" }) : Promise.resolve({ ok: false, error: "galería desconocida" }); } };
    log(`v${VERSION} loaded`);
})();
