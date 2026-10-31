# Mis subrayados — página de consulta

Página estática para buscar y citar tus subrayados (Kindle y libros físicos).
No usa servidor, ni internet, ni librerías externas: cero pedidos de red.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página. Es lo que abrís. |
| `styles.css` | Estilos (claro y oscuro). |
| `app.js` | La lógica: búsqueda, filtros, copiar, marcas y repaso. |
| `data.js` | Los datos: libros, citas, temas y notas. Es lo único que cambia cuando se actualiza la colección. |
| `manifest.webmanifest`, `sw.js`, `icon*.{svg,png}` | Para instalarla como app en el celular y que funcione sin conexión. |
| `README.md` | Este archivo. |

## Dónde está

Sitio: **https://tinchoaten.github.io/mis-subrayados/**
Repo (público): https://github.com/tinchoaten/mis-subrayados

También se puede abrir en la compu con doble clic en `index.html` (sin conexión).

## Instalarla en el celular

Abrí el sitio en Chrome (Android) y elegí *Instalar app* / *Agregar a la pantalla de inicio*. En iPhone, desde Safari: *Compartir → Agregar a inicio*. Después de la primera visita funciona sin conexión.

## Qué es público

Al estar en un repo y un sitio públicos, **cualquiera con el link ve las citas y tus notas propias (`✎ Mi nota`)**. Muchas citas son de libros con derechos de autor, así que puede haber un reclamo de GitHub o de los titulares. Si pasara, el repo se puede volver privado desde *Settings → Danger zone*, aunque eso no borra copias que ya existan. La etiqueta `noindex` pide a los buscadores que no indexen la página, pero no es una protección de acceso.

Las **marcas de cada persona** (favoritas, etiquetas de uso y temas corregidos) **no son públicas**: se guardan en su propio navegador.

## Actualizar el sitio

Cambiá los archivos y subilos al repo (`git add`, `git commit`, `git push`). GitHub Pages republica solo, en uno o dos minutos. Si la página no cambia, recargá dos veces: la versión sin conexión se actualiza en segundo plano.

## Tus marcas (favoritas, usos y temas editados)

Las favoritas ★, las etiquetas de uso y los temas que corrijas **se guardan en el navegador**, no en el repo.
Si cambiás de dispositivo o borrás los datos del navegador, se pierden.
Para respaldarlas: *Mis datos → Exportar* y guardá `subrayados-mis-datos.json` (podés ponerlo en el repo privado). Para recuperarlas: *Mis datos → Importar* (se suman a lo que ya tengas, no lo reemplazan).

## Cómo actualizar la colección

Pasame el archivo nuevo de subrayados (My Clippings o el Word de recortes) y regenero `data.js`. Reemplazá ese archivo en el repo y listo: no hay que tocar `index.html`.
Los códigos de las citas (por ejemplo `PC-12`) se mantienen y coinciden con el documento Word.

## Cómo se usa

- **Buscar**: ignora tildes y mayúsculas y pide todas las palabras. Los filtros (libro, tema, autor, uso, categoría, favoritas) están detrás del botón *Filtros* y se ven como chips que se quitan con un clic.
- **Copiar**: tres formatos a elegir (cita con fuente, Markdown, solo texto). Se recuerda el elegido. Si el recorte empieza o termina a mitad de frase, se agrega […].
- **Dirección (URL)**: la búsqueda y los filtros quedan en la dirección. Podés marcarla como favorita y el botón *atrás* funciona.
- **Orden**: por defecto como en el libro; también por fecha de lectura (más recientes primero) o por título.
- **Enlace a una cita**: en *Más → Copiar enlace a esta cita*.
- **Favoritas**: *Copiar todas* o *Descargar* (`.md` o `.txt`, según el formato elegido).
- **Repaso**: una cita al azar, con filtro por tema o favoritas y la opción de adivinar el libro.

## Atajos

- `/` : ir al buscador.
- `Esc` : limpiar la búsqueda (o cerrar paneles).
- `j` / `k` : siguiente / anterior cita.
- `c` : copiar la cita marcada.
- `f` : favorita.
