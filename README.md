# Mis subrayados — página de consulta

Página estática para buscar y citar tus subrayados (Kindle y libros físicos).
No usa servidor, ni internet, ni librerías externas: cero pedidos de red.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página. Es lo que abrís. |
| `styles.css` | Estilos (claro y oscuro). |
| `app.js` | La lógica: búsqueda, filtros, copiar, marcas y repaso. |
| `prototipo.html` | Primera versión funcional, solo como referencia de funciones. |
| `PROMPT.md` | Instrucciones para que Claude Code arme la página. |
| `data.js` | Los datos: libros, citas, temas y notas. Es lo único que cambia cuando se actualiza la colección. |
| `README.md` | Este archivo. |

## Cómo abrirla en tu compu

1. Dejá `index.html`, `styles.css`, `app.js` y `data.js` en la misma carpeta.
2. Hacé doble clic en `index.html`. Funciona sin conexión.

## Antes de publicarla: leé esto

**Un repositorio privado NO hace privada a una página de GitHub Pages.**
La documentación de GitHub dice que Pages se puede usar desde repos privados con los planes Pro, Team o Enterprise, pero el sitio publicado queda accesible para cualquiera en internet. Solo se puede restringir el acceso al sitio con GitHub Enterprise Cloud. Es decir: repo privado más Pages activado igual publica tus citas en una URL pública, aunque nadie la conozca.

Esta colección tiene unas 1.600 citas textuales de unos 150 libros, y varios pueden estar protegidos por derechos de autor. Como querés que sea solo para vos, la recomendación es:

- **Subí los archivos a un repo privado, pero NO actives Pages.** Sirve como respaldo y control de versiones.
- **Para consultarla**, abrí `index.html` desde una copia descargada o clonada del repo (en la compu o en el celu).
- Si más adelante querés acceder desde cualquier lado, hace falta un hosting con control de acceso. Una pantalla de contraseña hecha en JavaScript no protege nada, porque los datos viajan al navegador.

La página lleva `noindex` para que los buscadores no la indexen, pero eso no es una protección de acceso.

## Cómo subirla al repo (sin activar Pages)

Desde la web de GitHub: abrí tu repo privado → *Add file → Upload files* → arrastrá `index.html`, `styles.css`, `app.js`, `data.js` y `README.md` → *Commit changes*.

Desde la terminal:

```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git
cd TU_REPO
# copiá index.html, styles.css, app.js, data.js y README.md acá
git add .
git commit -m "Subrayados: versión inicial"
git push
```

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
- **Repaso**: una cita al azar, con filtro por tema o favoritas y la opción de adivinar el libro.

## Atajos

- `/` : ir al buscador.
- `Esc` : limpiar la búsqueda (o cerrar paneles).
- `j` / `k` : siguiente / anterior cita.
- `c` : copiar la cita marcada.
- `f` : favorita.
