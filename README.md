# Dragger — drag & drop and paste images into Wan2GP

*[Español](README.es.md)* · MIT License · v1.1.0

**Dragger** is a plugin for [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) that makes it easy to put images into the generator's image galleries:

- **Images as starting points for new Videos** (*Start with Image*)
- **End Image(s)**
- **Reference Images**

Out of the box, these galleries only accept a drop while they are empty, and pasting from the clipboard is awkward. Once a gallery holds images you can't drop or paste new ones at all. With Dragger you can **drop or paste (Ctrl+V) images at any time, and they are added to the images already there**. A round **X** on the corner of every thumbnail removes just that image.

It is a regular WanGP plugin. It doesn't modify any core WanGP file, so it survives WanGP updates.

> Dragger speaks **English and Spanish**. By default it follows the browser language (Spanish if it is Spanish, English otherwise); you can force either one in the settings (*Language / Idioma*). See [Language](#language).

## Features

**Drag & drop**
- Drop **one or many files** from Windows Explorer / Finder, **images dragged from a web page**, **image links** (`text/uri-list`), `<img>` elements (`text/html`) and `data:` URLs.
- Works on **empty and non-empty galleries**. New images are **appended** without replacing or clearing anything, and the order you dropped them in is kept. The *Where to add* setting can put them at the start or right after the selected image instead (which is what WanGP's own **Add** button does).
- If the browser isn't allowed to read a web image (CORS), the **WanGP server downloads it** (http/https only, 64 MB max, the result must be a real image).
- You can also drag an image from one WanGP gallery to another, e.g. a start image into Reference Images.
- **Visual feedback**: while you drag, the visible galleries get a dashed outline. The one under the pointer is highlighted with the label *Drop to add to: Start image / End image / Reference images*.

**Paste (Ctrl+V)**
- Pastes **screenshots** (Win+Shift+S, Print Screen), images copied in the browser (*Copy image*), **copied image files** and copied image links.
- Which gallery gets the paste: the gallery **under the mouse pointer**, then the gallery you **last clicked in**. If only one target gallery is visible, it goes there. Otherwise a small message asks *Where should I paste the image?*, with one button per gallery.
- **Doesn't hijack text paste**: in the prompt box and every other text field, Ctrl+V pastes text as usual.

**Messages**
- *Added 3 images to Reference images (total 7)* after each add.
- Red error messages: unsupported format, file that isn't an image, failed download (with the HTTP code), link to a web page instead of an image, and so on. When some images of a batch fail, the valid ones are still added and the failures are listed.

**Remove a single image (X)**
- A round **X** straddling the top-right corner of every thumbnail, mostly outside the picture so it doesn't cover it, in the thumbnail strip under the preview and in the grid view. Dark background, white glyph, red on hover. By default it shows on hover; it can also be always visible, and it comes in three sizes.
- Clicking the picture itself (anywhere away from the X) still selects the thumbnail as usual.
- A click on the X removes **only that image**. The rest keep their order, and the X click doesn't select the thumbnail or open the preview. The image that was selected stays selected; when you remove the selected image itself, the selection moves exactly as with WanGP's **Remove** button.
- ***Image removed · Undo***: for 5 s, **Undo** puts the image back at the same position.

**Formats**
- PNG, JPEG, WebP, BMP, GIF and TIFF are added as they are. That's the same file the **Add** button would add.
- **AVIF**, **ICO** and other formats Pillow can read are converted to **PNG**. **HEIC/HEIF** is converted if `pillow-heif` is installed in WanGP's Python; otherwise you get a clear error message.
- A file with a wrong or missing extension (e.g. a clipboard image) is renamed with the right one.
- Optional **auto-downscale** of images whose longest side is above a limit (off by default). Pasted images are named `clipboard-YYYYMMDD-HHMMSS.png` (`portapapeles-…` when Dragger is in Spanish).

## How it works (state stays consistent)

WanGP's start, end and reference galleries are `AdvancedMediaGallery` components, made of a `gr.Gallery` plus a `gr.State` dict (`items`, `selected`, `single`, …). The **Add** button runs `AdvancedMediaGallery._on_add(files, state, gallery)`, and **Remove** runs `_on_remove(state, gallery)`.

1. The browser script (`dragger.js`, injected with the official `add_custom_js` API) intercepts the drop or paste over a target gallery. It reads the files or URLs and uploads the images with **Gradio's own upload endpoint** (the same one the Add button uses).
2. Through a hidden bridge (a textbox plus one button per gallery, built in the *Dragger* tab), it fires a normal Gradio event whose inputs are the request, **that gallery and its `gr.State`**.
3. The server handler validates and converts the images, then calls **WanGP's own `_on_add`**. For the X it calls **`_on_remove`** on the clicked thumbnail. It returns the gallery update and the state through that event, so the form, the gallery label (`(WxH)`), **Remove / Left / Right / Clear** and the generation all see exactly what the Add/Remove buttons would have produced. Nothing is faked in the DOM.

The plugin finds the components with the plugin API (`request_component("image_start" / "image_end" / "image_refs" and their "*_extra")`). It works both in the generator form and in the queue's **Edit** tab.

## Settings (Dragger tab)

| Option | Meaning | Default |
|---|---|---|
| Language / Idioma | *Auto (browser language)*, *English* or *Español* | Auto |
| Drag & drop images | drag & drop on | on |
| Paste with Ctrl+V | paste on | on |
| Download on the server the web images the browser can't read | server download fallback for CORS-blocked web images | on |
| Start image / End image / Reference images | which galleries are active | all |
| Where new images are added | *At the end*, *At the beginning*, *After the selected one* (like **Add**) | at the end |
| Downscale large images + Maximum longest side (px) | auto-downscale and its limit | off, 2048 |
| X to remove each image | per-thumbnail remove X | on |
| Show the X | *On hover* or *Always visible* | on hover |
| X size | *Small* / *Medium* / *Large* (strip 15 / 18 / 22 px, grid 20 / 24 / 28 px) | medium |
| Offer “Undo” for 5 s | undo after an X removal | on |
| Confirmation messages + Duration (seconds) | confirmation messages and their duration (errors are always shown) | on, 3.5 s |

Settings are saved in `settings.json` in the plugin folder and apply immediately in that browser tab. Other open tabs pick them up when reloaded. No restart is needed. The keys stored in `settings.json` (`end` / `start` / `after_selected`, `hover` / `always`, `small` / `medium` / `large`, `auto` / `en` / `es`) don't depend on the language, so a `settings.json` from an older version keeps working (it gets `language: auto`).

## Language

Every text Dragger shows exists in English and Spanish: drop labels, confirmations, error messages (including the ones the server sends back, e.g. a failed download), the paste chooser, the X tooltip, the undo message, the settings tab, and the name given to pasted images.

- **Auto** (default): Spanish if the browser language (`navigator.language`) starts with `es`, English otherwise.
- **English** / **Español**: always that language, whatever the browser.

Changing the language and clicking **Save settings** switches everything at once, with no restart and no reload: messages, tooltips and the settings tab itself.

How the settings tab follows the language: WanGP builds the tab once, in Python, when it starts, so at that point it uses the saved language (*Auto* → English). As soon as the page loads, Dragger's script sends the browser language to the server through a hidden Gradio event, and the server relabels the tab (labels, help texts, choices, buttons) with normal Gradio updates. Saving a new language relabels it in the same event. The tab always matches the language of Dragger's messages. The tab title stays *Dragger*.

## Install

**A. From WanGP's Plugins tab**
1. In WanGP open **Plugins** → **Install from URL**.
2. Paste `https://github.com/sweetyshots123/wan2gp-dragger` and click **Download and Install from URL**.
3. Enable **Dragger** in the plugin list, click **Restart** (or close and reopen WanGP), then reload the browser page.

**B. With git**
```bash
cd Wan2GP/plugins
git clone https://github.com/sweetyshots123/wan2gp-dragger.git
```
Then enable **Dragger** in the Plugins tab and restart WanGP.

**C. From the zip**
Extract `wan2gp-dragger.zip` into `Wan2GP/plugins/`, so that you get `Wan2GP/plugins/wan2gp-dragger/plugin.py`. Then enable it in the Plugins tab and restart WanGP.

Keep the folder name `wan2gp-dragger`. Wan2GP's `.gitignore` ignores `plugins/wan2gp-*`, so updating Wan2GP with `git pull` never touches the plugin. The repository doesn't ship a `settings.json`, so updates never overwrite your settings.

Optional, for HEIC photos: `pip install pillow-heif` in WanGP's Python environment.

## Uninstall

Plugins tab → **Uninstall** next to Dragger (or disable it and delete `Wan2GP/plugins/wan2gp-dragger`), then restart WanGP.

## Compatibility

Tested with Wan2GP v17.17 (Gradio 5.29) in Chrome, against the real WanGP interface (LTX-2 model, *Start with Image* + *End Image(s)* + *Inject Frames* reference images). Other Chromium browsers (Edge) behave the same.

## Limitations

- **Single-image galleries** (models that accept only one reference image, where WanGP's button reads **Set**): a drop or paste replaces the image, like **Set**, and the message says so.
- Some sites refuse downloads that aren't made by a browser, or need you to be logged in. In that case save the image and drop the file, or use *Copy image* and paste.
- A pasted link only works if it points directly to an image. A link to a web page gives an error.
- When the browser runs on another machine (WanGP started with `--listen`), the server won't download from `localhost` addresses. Link-local addresses (`169.254.x.x`) are always refused.
- Animated GIF/WebP files are added as they are; WanGP uses their first frame.
- SVG (vector) images aren't supported.
- Images that Dragger converts are stored in Gradio's temporary upload folder, like every upload.

## Troubleshooting

- **Nothing happens on drop or paste:** enable the plugin in the Plugins tab, restart WanGP and reload the page. The browser console (F12) should show `[Dragger] v1.1.0: 6 galleries …`.
- **Paste goes to the wrong gallery:** hover over the gallery you want (or click in it) before pressing Ctrl+V.
- **Ctrl+V in a text box pastes text:** that's intended. Click outside the text box first.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 sweetyshots123
