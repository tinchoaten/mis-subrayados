# Instrucciones para Claude Code

Quiero que construyas una página web estática para consultar y citar mis subrayados de lectura (unas 1.600 citas de ~150 libros, en español). Lo más importante es la USABILIDAD. El diseño tiene que ser MINIMALISTA. Hablame y escribí la interfaz en español rioplatense (voseo).

## Qué hay en esta carpeta
- `data.js`: los datos (NO lo modifiques; si ves un problema en los datos, avisame).
- `prototipo.html`: una primera versión funcional, solo como referencia de funciones. Podés reutilizar lo que sirva, pero rehacé la interfaz con los principios de abajo.
- `README.md`: notas de publicación y privacidad.

## Datos (`window.SUBRAYADOS` en `data.js`)
```
{ themes: {clave: "Nombre del tema"},
  books: [ {
    i: código del libro, t: título, a: autor ("—" si no hay),
    c: "nf" (no ficción) | "fic" (ficción) | "doc" (documento),
    l: idioma, n: cantidad de citas, p: período de lectura (solo Kindle, puede estar vacío),
    m: clave del tema principal,
    q: [ { i: código de la cita (único, ej. "PC-12"), x: texto,
           s: posición Kindle (opcional), g: página (opcional), d: fecha (opcional),
           n: [notas propias], h: [claves de temas],
           u: "inicio" | "fin" | "ambos" (opcional: el recorte empieza y/o termina a mitad de frase) } ]
  } ] }
```

## Funciones (en este orden de prioridad)
1. **Buscador** siempre visible arriba. Ignora tildes y mayúsculas, exige todas las palabras, resalta coincidencias y muestra la cantidad de resultados.
2. **Filtros** por libro, tema, autor, uso y favoritas, más categoría (no ficción / ficción / documentos). Plegados detrás de un botón "Filtros"; los filtros activos se ven como chips que se quitan con un clic.
3. **Cada cita**: texto, libro y autor, posición/página/fecha si existen, temas, notas propias ("✎ Mi nota"). Acciones: ★ favorita, Copiar cita, + etiqueta de uso, corregir temas.
4. **Copiar cita en 3 formatos** (se recuerda el elegido): “texto” (Autor, Título, pos. N) | Markdown con `>` | solo texto. Si `u` tiene valor, agregar […] al inicio y/o al final al copiar. Mostrar confirmación breve ("Copiado").
5. **Vistas**: Buscar (principal), Libros (agrupados por categoría, con cantidad), Temas, Autores (a partir de `a`; separar coautores por " y " o ","; los "doc" no tienen autores), Favoritas (con "copiar todas") y Repaso (cita al azar con filtro por tema/favoritas y opción "adivinar el libro", con la fuente oculta hasta hacer clic).
6. **Marcas propias** (favoritas, etiquetas de uso: columna, clase, artículo, charla + nuevas, y temas editados por cita) guardadas en `localStorage` con prefijo `subr_` y compatibles con las claves del prototipo (`fav`, `uso`, `usolist`, `temas`, `fmt`). "Exportar/Importar" a un JSON. Avisar claramente que se guardan en el navegador.

## Principios de usabilidad (obligatorios)
- Llegar a cualquier cita en 2 clics o menos; la acción principal de cada pantalla es obvia.
- El estado vive en la URL (hash): búsqueda, filtros y vista se pueden marcar como favorito y el botón "atrás" funciona. Volver a una lista conserva la posición.
- Copiar y marcar favorita son de un solo clic y dan retroalimentación inmediata (sin modales).
- Estados vacíos útiles ("No hay resultados: probá con menos palabras" + botón "Limpiar filtros").
- Táctil: objetivos de al menos 44 px; mobile-first, probado en 375 px y en escritorio.
- Teclado: "/" va al buscador, Esc limpia, y navegación por tab con foco visible. Opcional: j/k para moverse entre citas, c copiar, f favorita.
- Accesibilidad: HTML semántico, contraste AA, `aria-live` para la cantidad de resultados, respeta `prefers-reduced-motion` y `prefers-color-scheme` (claro/oscuro, con opción manual).
- Rendimiento: carga fluida con 1.600 citas (render por tandas o virtualización), sin saltos de layout.
- Sin jerga: textos de interfaz cortos y claros.

## Diseño minimalista
- Una columna de lectura de ~700 px, mucho espacio en blanco, sin sombras, degradados ni librerías de íconos.
- Un solo color de acento (#B5532F) sobre blanco/gris cálido; tipografía serif del sistema (Georgia) para las citas y sans del sistema para la interfaz.
- Líneas finas en vez de cajas; mínimo "chrome". Todo lo secundario se muestra al pasar o tocar, no todo a la vez.

## Restricciones técnicas
- HTML/CSS/JS plano, sin build, sin frameworks, sin dependencias ni CDN, sin fuentes externas y sin analíticas: cero pedidos de red. Tiene que funcionar abriendo `index.html` con doble clic (`file://`), así que nada de ES modules ni `fetch` de archivos locales: usá `<script src="data.js">` y scripts clásicos.
- Archivos de salida: `index.html` (+ `styles.css` y `app.js` si ayuda a ordenar el código), `data.js` intacto, `README.md` actualizado.
- Incluí `<meta name="robots" content="noindex, nofollow">`.
- Este contenido es privado y tiene citas de libros con derechos de autor: NO actives GitHub Pages, NO hagas push ni publiques nada. Podés hacer commits locales.

## Cómo trabajar
1. Primero mostrame un plan breve (estructura de archivos y decisiones de UX) y esperá mi OK.
2. Implementá y probá: servidor local (`python3 -m http.server`) Y apertura directa por `file://`. Si tenés Playwright o un navegador automatizable, probá en 375 px y 1280 px y mirá capturas; si no, probá la lógica con jsdom y decime qué no pudiste verificar visualmente.
3. Verificá esta lista y decime cuál pasó y cuál no: búsqueda sin tildes; filtro por tema; filtro por libro; copiar en los 3 formatos; favorita que persiste al recargar; etiqueta de uso y filtro por uso; exportar e importar; vista Repaso; URL con hash que reconstruye la vista; modo oscuro; teclado; 375 px sin scroll horizontal.
4. Al final, hacé un commit con un mensaje claro y resumime lo hecho en 10 líneas, con lo que quedó sin verificar.
