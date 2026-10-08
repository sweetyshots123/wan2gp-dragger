# Changelog

All notable changes to Dragger. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-08
### Added
- **English and Spanish.** Every user-facing text now comes from an i18n table with `en` and `es`: drop overlay (*Drop to add to: …* / *Soltar para añadir a: …*), gallery names, confirmations, errors, the paste chooser, the undo message (*Image removed · Undo* / *Imagen quitada · Deshacer*), the X tooltip and aria-label, the settings tab (labels, help texts, choices, save messages) and the error messages the server returns to the page (the page sends its language with every request).
- **New setting `language`** (*Language / Idioma*): `auto` (default), `en`, `es`. *Auto* = Spanish when `navigator.language` starts with `es`, English otherwise. Switching applies live, with no restart or reload.
- The settings tab follows the language too: it is built in Python in the saved language (*Auto* → English), then relabelled through a hidden Gradio event as soon as the page loads (with the browser language) and whenever the language changes. Its title stays *Dragger*.
- Pasted images are named `clipboard-YYYYMMDD-HHMMSS.png` in English and `portapapeles-YYYYMMDD-HHMMSS.png` in Spanish; other fallback file names (`image`, `web-image`) follow the language as well.

### Changed
- Choice values stay stable internal keys (`end` / `start` / `after_selected`, `hover` / `always`, `small` / `medium` / `large`, `auto` / `en` / `es`); only their labels are translated. Old `settings.json` files without `language` keep working and get `auto`.

### Fixed
- A page loaded after the settings were changed got the settings WanGP had started with (the ones injected into the script). The page now reads `settings.json` when it loads, so other browser tabs pick up saved settings on reload, as documented.

## [1.0.1] - 2026-10-08
### Changed
- **Bigger remove X, placed outside the thumbnail**: the X is now a round button straddling the thumbnail's top-right corner, mostly outside the picture (Magnific style), so it no longer covers the image. Dark semi-opaque background, thick white glyph, light border and shadow; turns red and grows slightly on hover. Its click area extends outwards, away from the picture, so a click on the picture still selects the thumbnail.
- **New setting `x_size`** (*Tamaño de la X*: small / medium / large, default medium). Medium is 18 px on the thumbnail strip and 24 px in the grid view (small 15/20, large 22/28).
- Minimal, scoped layout tweaks so the X is never clipped, only on galleries handled by Dragger: thumbnails no longer clip their overflow, the strip gets a little padding and a larger gap (so an X never overlaps the next thumbnail) and keeps scrolling horizontally, the grid gets top/right padding and a larger gap.

### Fixed
- Removing a non-selected image with the X right after the gallery was (re)filled (e.g. *Clear* and drop) could move the selection to the first image, and in the grid view open the preview. Gradio's Gallery resets its selection on the first change after it is mounted; Dragger now re-sends the intended selection in a second step and returns to the grid view when the X was used there.

## [1.0.0] - 2026-10-08
### Added
- **Drag & drop** images onto WanGP's *Images as starting points* (`image_start`), *End Image(s)* (`image_end`) and *Reference Images* (`image_refs`) galleries, in the generator form and in the queue *Edit* tab, **also when they already contain images**. New images are appended (setting `position`: `end` (default), `start` or `after_selected` = what the Add button does), in drop order, multiple files at once; existing images are never replaced. Accepts files, `text/html` `<img>` sources, `text/uri-list`, image URLs in `text/plain` and `data:` / `blob:` URLs. Web images the browser can't read (CORS) are downloaded by the server (`remote_download`, http/https, 64 MB max, must decode as an image; link-local always refused, loopback only for a browser on the same machine). Dropping a thumbnail back on its own gallery is ignored.
- **Paste (Ctrl+V)**: clipboard image blobs (screenshots, *Copy image*), copied image files and image links. Target: the gallery under the pointer, else the last clicked one, else the only visible one (or the only one on screen), else a chooser message with one button per visible gallery. Never intercepts paste in text inputs, textareas or contenteditable elements.
- **Feedback**: dashed outline on every visible gallery while dragging, highlighted target with *Soltar para añadir a: …*; confirmation (*Añadidas N imágenes a Referencias (total M)*) and error messages (unsupported format, not an image, download failed with HTTP code, page link instead of an image, …). Partial batches add the valid images and list the failures.
- **Per-thumbnail remove X** on the preview strip and the grid view (on hover by default, `remove_x_mode: always` to always show it). Removes only that image through WanGP's own `_on_remove` (same state updates as the Remove button). Keeps the selected image selected when another one is removed, never selects or previews the clicked thumbnail, and keeps the grid view in grid mode. **Undo** for 5 s (*Imagen quitada · Deshacer*) restores the image at the same position.
- **Server-side handling through WanGP's own handlers**: images are uploaded with Gradio's upload endpoint and added by `AdvancedMediaGallery._on_add` on the real gallery value and `gr.State` via a normal Gradio event, so the form, the label, Remove/Left/Right/Clear and generation stay consistent. Uploaded paths are accepted only from Gradio's upload folder.
- **Format handling**: PNG/JPEG/WebP/BMP/GIF/TIFF kept as they are; AVIF/ICO/others converted to PNG; HEIC/HEIF converted when `pillow-heif` is installed (clear error otherwise); wrong or missing extensions fixed; optional auto-downscale (`downscale`, `max_side`). Pasted images are named `portapapeles-YYYYMMDD-HHMMSS.png`.
- **Dragger settings tab**: drag on/off, paste on/off, server download, active galleries, position, downscale + max side, remove X on/off + mode, undo, confirmation messages + duration. Saved to `settings.json` (not shipped, git-ignored; defaults are merged in `plugin.py`) and applied live.
