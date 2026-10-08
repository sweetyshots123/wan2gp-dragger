# Dragger: arrastra y pega imágenes en Wan2GP

*[English](README.md)* · Licencia MIT · v1.0.1

**Dragger** es un plugin para [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) que facilita meter imágenes en las galerías de imagen del generador:

- **Images as starting points for new Videos** (*Start with Image*, imagen de inicio)
- **End Image(s)** (imagen final)
- **Reference Images** (referencias)

De serie, estas galerías solo aceptan que sueltes algo cuando están vacías, y pegar desde el portapapeles es complicado. En cuanto tienen imágenes ya no deja soltar ni pegar nuevas. Con Dragger puedes **soltar o pegar (Ctrl+V) imágenes siempre, y se añaden a las que ya hay**. Una **X** redonda en la esquina de cada miniatura quita solo esa imagen.

Es un plugin normal de WanGP: no modifica ningún archivo del núcleo y sobrevive a las actualizaciones de WanGP.

## Funciones

**Arrastrar y soltar**
- Suelta **uno o varios archivos** desde el Explorador de Windows, **imágenes arrastradas desde una web**, **enlaces a imágenes**, elementos `<img>` y URL `data:`.
- Funciona con **galerías vacías y con imágenes**. Las nuevas se **añaden** sin sustituir ni borrar nada, en el orden en que las soltaste. En ajustes puedes ponerlas al principio o justo después de la seleccionada (lo que hace el botón **Add** de WanGP).
- Si el navegador no puede leer una imagen web (CORS), la **descarga el servidor de WanGP** (solo http/https, máximo 64 MB, y tiene que ser una imagen de verdad).
- También puedes arrastrar una imagen de una galería de WanGP a otra, por ejemplo de la imagen de inicio a referencias.
- **Aviso visual**: mientras arrastras, las galerías visibles se marcan con un borde discontinuo, y la que está bajo el puntero se resalta con el texto *Soltar para añadir a: Imagen de inicio / Imagen final / Referencias*.

**Pegar (Ctrl+V)**
- Pega **capturas de pantalla** (Win+Mayús+S, Impr Pant), imágenes copiadas en el navegador (*Copiar imagen*), **archivos de imagen copiados** y enlaces a imágenes copiados.
- A qué galería va: primero la que está **bajo el ratón**; si no, la **última en la que hiciste clic**. Si solo se ve una galería, va a esa; si no, aparece *¿Dónde pego la imagen?* con un botón por galería.
- **No se queda con el pegado de texto**: en el cuadro del prompt y en cualquier cuadro de texto, Ctrl+V pega texto como siempre.

**Mensajes**
- *Añadidas 3 imágenes a Referencias (total 7)* tras cada añadido.
- Mensajes rojos de error: formato no compatible, archivo que no es una imagen, descarga fallida (con el código HTTP), enlace a una página en vez de a una imagen… Si en un lote fallan algunas, las válidas se añaden igualmente y se listan las que fallaron.

**Quitar una imagen (X)**
- Una **X** redonda montada sobre la esquina superior derecha de cada miniatura, casi toda por fuera para no tapar la imagen, tanto en la tira de miniaturas bajo la vista previa como en la vista de cuadrícula. Fondo oscuro, aspa blanca y rojo al pasar el ratón. Por defecto aparece al pasar el ratón; también puede estar siempre visible, y hay tres tamaños.
- Al pulsar la imagen en sí (en cualquier punto fuera de la X) la miniatura se selecciona como siempre.
- Al pulsarla se quita **solo esa imagen**. Las demás mantienen su orden, y el clic en la X no selecciona la miniatura ni abre la vista previa. La imagen que estaba seleccionada sigue seleccionada; si quitas la seleccionada, la selección se mueve igual que con el botón **Remove** de WanGP.
- ***Imagen quitada · Deshacer***: durante 5 s, **Deshacer** la vuelve a poner en la misma posición.

**Formatos**
- PNG, JPEG, WebP, BMP, GIF y TIFF se añaden tal cual: el mismo archivo que añadiría el botón **Add**.
- **AVIF**, **ICO** y otros formatos que lee Pillow se convierten a **PNG**. **HEIC/HEIF** se convierte si `pillow-heif` está instalado en el Python de WanGP; si no, sale un mensaje de error claro.
- A un archivo con la extensión equivocada o sin extensión (por ejemplo, una imagen del portapapeles) se le pone la correcta.
- **Reducción automática** opcional de las imágenes cuyo lado mayor pase de un límite (desactivada por defecto). Las imágenes pegadas se llaman `portapapeles-AAAAMMDD-HHMMSS.png`.

## Cómo funciona (el estado de WanGP queda coherente)

Las galerías de inicio, final y referencias de WanGP son componentes `AdvancedMediaGallery`, formados por un `gr.Gallery` y un `gr.State` (`items`, `selected`, `single`…). El botón **Add** ejecuta `AdvancedMediaGallery._on_add(files, state, gallery)` y **Remove** ejecuta `_on_remove(state, gallery)`.

1. El script del navegador (`dragger.js`, inyectado con la API oficial `add_custom_js`) intercepta lo que sueltas o pegas sobre una galería. Lee los archivos o URL y sube las imágenes con **el endpoint de subida de Gradio** (el mismo que usa el botón Add).
2. Con un puente oculto (un cuadro de texto y un botón por galería, en la pestaña *Dragger*), lanza un evento normal de Gradio cuyas entradas son la petición, **esa galería y su `gr.State`**.
3. El servidor valida y convierte las imágenes y llama al **`_on_add` del propio WanGP**; para la X llama a **`_on_remove`** sobre la miniatura pulsada. Devuelve la galería y el estado por ese mismo evento. Así el formulario, la etiqueta `(AnchoxAlto)`, **Remove / Left / Right / Clear** y la generación ven exactamente lo que habrían dejado los botones Add/Remove. No se simula nada en la página.

Encuentra los componentes con la API de plugins (`request_component`) y funciona en el formulario del generador y en la pestaña **Edit** de la cola.

## Ajustes (pestaña Dragger)

| Opción | Por defecto |
|---|---|
| Arrastrar y soltar imágenes | activado |
| Pegar con Ctrl+V | activado |
| Descargar en el servidor las imágenes web que el navegador no deja leer | activado |
| Galerías activas: Imagen de inicio / Imagen final / Referencias | todas |
| Dónde se añaden las imágenes nuevas: *Al final*, *Al principio*, *Después de la seleccionada (como «Add»)* | al final |
| Reducir las imágenes grandes + Lado mayor máximo (px) | desactivado, 2048 |
| X para quitar cada imagen | activado |
| Mostrar la X: *Al pasar el ratón* / *Siempre visible* | al pasar el ratón |
| Tamaño de la X: *Pequeña* / *Mediana* / *Grande* (tira 15 / 18 / 22 px, cuadrícula 20 / 24 / 28 px) | mediana |
| Ofrecer «Deshacer» durante 5 s | activado |
| Mensajes de confirmación + Duración (los errores se muestran siempre) | activado, 3,5 s |

Se guardan en `settings.json` en la carpeta del plugin y se aplican al momento en esa pestaña del navegador (en otras ya abiertas, al recargar). No hace falta reiniciar.

## Instalación

**A. Desde la pestaña Plugins de WanGP**
1. En WanGP abre **Plugins** → **Install from URL**.
2. Pega `https://github.com/sweetyshots123/wan2gp-dragger` y pulsa **Download and Install from URL**.
3. Activa **Dragger** en la lista, pulsa **Restart** (o cierra y abre WanGP) y recarga la página.

**B. Con git**
```bash
cd Wan2GP/plugins
git clone https://github.com/sweetyshots123/wan2gp-dragger.git
```
Después actívalo en la pestaña Plugins y reinicia WanGP.

**C. Desde el zip**
Descomprime `wan2gp-dragger.zip` dentro de `Wan2GP/plugins/`, de modo que quede `Wan2GP/plugins/wan2gp-dragger/plugin.py`. Actívalo en la pestaña Plugins y reinicia WanGP.

Mantén el nombre de carpeta `wan2gp-dragger`. El `.gitignore` de Wan2GP ignora `plugins/wan2gp-*`, así que actualizar Wan2GP con `git pull` no toca el plugin. El repositorio no incluye `settings.json`, así que las actualizaciones no pisan tus ajustes.

Opcional, para fotos HEIC: `pip install pillow-heif` en el entorno de Python de WanGP.

## Desinstalar

Pestaña Plugins → **Uninstall** junto a Dragger (o desactívalo y borra `Wan2GP/plugins/wan2gp-dragger`), y reinicia WanGP.

## Compatibilidad

Probado con Wan2GP v17.17 (Gradio 5.29) en Chrome, contra la interfaz real de WanGP (modelo LTX-2 con *Start with Image* + *End Image(s)* + referencias de *Inject Frames*). Otros navegadores Chromium (Edge) se comportan igual.

## Limitaciones

- **Galerías de una sola imagen** (modelos que solo admiten una referencia; el botón de WanGP pone **Set**): soltar o pegar sustituye la imagen, como **Set**, y el mensaje lo indica.
- Algunas webs rechazan descargas que no hace un navegador o piden iniciar sesión. En ese caso guarda la imagen y suelta el archivo, o usa *Copiar imagen* y pega.
- Un enlace pegado solo funciona si apunta directamente a una imagen; un enlace a una página da error.
- Si el navegador está en otro equipo (WanGP arrancado con `--listen`), el servidor no descarga de direcciones `localhost`. Las direcciones `169.254.x.x` se rechazan siempre.
- Los GIF/WebP animados se añaden tal cual; WanGP usa su primer fotograma.
- Las imágenes SVG (vectoriales) no son compatibles.
- Las imágenes que convierte Dragger se guardan en la carpeta temporal de subidas de Gradio, como cualquier subida.

## Problemas

- **No pasa nada al soltar o pegar:** activa el plugin en la pestaña Plugins, reinicia WanGP y recarga la página. La consola del navegador (F12) debe mostrar `[Dragger] v1.0.1: 6 galleries …`.
- **Pega en la galería equivocada:** pon el ratón encima de la galería que quieres (o haz clic en ella) antes de pulsar Ctrl+V.
- **Ctrl+V en un cuadro de texto pega texto:** es lo previsto. Haz clic fuera del cuadro primero.

## Cambios

Ver [CHANGELOG.md](CHANGELOG.md).

## Licencia

[MIT](LICENSE) © 2026 sweetyshots123
