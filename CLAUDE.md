# Mis subrayados

Sitio estático (HTML, CSS y JS planos, sin build ni dependencias) para consultar y citar los subrayados de lectura de Juan. Publicado con GitHub Pages: https://tinchoaten.github.io/mis-subrayados/

Hablale en español rioplatense (voseo). Sé breve.

## Antes de empezar, en cualquier PC

1. Corré `git pull`. Juan trabaja desde dos PCs y el repo es el punto de encuentro: sin esto, `registro.json` y `data.js` pueden quedar desactualizados y se pisan los cambios.
2. Al terminar, commit y push (con el OK de Juan: el repo y el sitio son públicos).

## Sincronización (Cloudflare)

El sitio sincroniza las marcas de Juan con un Worker propio (`sync/worker.js`, en su cuenta de Cloudflare). La clave de sincronización vive en `sync-clave.txt` (ignorado por git). **Nunca la imprimas ni la subas.** Para leer lo pendiente: `node actualizacion/leer-nube.js`.

## Si Juan trae citas nuevas

Seguí al pie de la letra **`actualizacion/INSTRUCCIONES.md`**. Cubre dos entradas:
- `My Clippings.txt` del Kindle (se detectan solo las nuevas con `actualizacion/nuevas.js`).
- `subrayados-mis-datos.json` exportado desde el celu (citas cargadas a mano).

Los archivos de entrada suelen estar en Descargas y **no son parte del repo** (los `.txt` están ignorados a propósito). Se usan por ruta.

El flujo ya está definido: no hace falta un pre-brief largo. Hacé solo una pregunta puntual si algo se aparta del patrón, y recomendá modelo (Sonnet alcanza).

## Reglas

- `data.js` se modifica solo con el flujo de actualización, siempre con copia de seguridad y validación. Una sola línea: `window.SUBRAYADOS={...};`.
- Si cambia cualquier archivo del sitio (`index.html`, `app.js`, `styles.css`, `data.js`), subí la versión de caché en `sw.js` (`subrayados-vN`) para que la app instalada en el celu se actualice.
- No actives nada nuevo ni cambies la visibilidad del repo sin que Juan lo pida.
- El diseño es minimalista (un solo color de acento `#B5532F`, Georgia para las citas, sin librerías). Mantené ese criterio.
- Las marcas personales (favoritas, etiquetas, temas corregidos) viven en el navegador de Juan, no en `data.js`.
- Probá cualquier cambio de interfaz a 375 px y a escritorio, y por `file://` además de servidor local.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css`, `app.js` | El sitio |
| `data.js` | Libros, citas, temas y notas |
| `sw.js`, `manifest.webmanifest`, `icon*` | App instalable y uso sin conexión |
| `actualizacion/` | Instrucciones, script de detección y registro de lo ya visto |
| `README.md` | Explicación para quien use el sitio |
