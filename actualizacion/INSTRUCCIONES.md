# Instrucciones del proyecto: actualizar "Mis subrayados"

Pegá este texto como instrucciones del proyecto (o dejalo como `CLAUDE.md` de la carpeta). Pensado para Claude Code o Cowork con acceso a la carpeta `Mis Subrayados`. En un chat sin acceso a archivos no se puede escribir `data.js`.

## Objetivo

Juan lee en Kindle y va subrayando. Cada tanto te pasa su `My Clippings.txt` **completo**: trae todo lo ya trabajado, incluso lo que se borró en su momento, más lo nuevo. Tu trabajo es incorporar **solo las citas nuevas** a `data.js` y dejar el sitio actualizado, sin duplicar nada y sin resucitar lo que Juan descartó.

Hablale en español rioplatense (voseo). Sé breve: resumí qué agregaste, no cuentes el proceso.

## Qué hay en la carpeta

| Archivo | Para qué |
|---|---|
| `data.js` | Los datos que muestra el sitio. Es lo que se actualiza. |
| `actualizacion/nuevas.js` | Script que detecta las entradas nuevas del `My Clippings.txt`. No modifica `data.js`. |
| `actualizacion/registro.json` | Memoria de todo lo que ya se vio (conservado, fusionado o borrado). Evita que reaparezca lo descartado. |
| `actualizacion/alias.json` | Cuando un título de Kindle no coincide con un libro: `{"título tal cual en Kindle": "CODIGO"}`. |
| `actualizacion/nuevas.json` | Salida temporal del script. No se publica. |
| `index.html`, `app.js`, `styles.css`, `sw.js`, etc. | El sitio. Solo se toca `sw.js` (ver el paso 8). |

## Cómo se detecta lo nuevo (y por qué no alcanza solo con la fecha)

- Cada entrada del Clippings tiene una **huella**: título + fecha y hora + tipo + posición. Es nueva si su huella **no está en `registro.json`**. Esa es la regla de verdad.
- La **fecha** es una alerta, no el filtro: si aparece algo nuevo con fecha anterior a la última registrada, el script lo lista en `revisarFechaAnterior`. Pasa cuando el Kindle sincroniza tarde o se corrigió la hora. Revisalo con Juan antes de decidir.
- Solo filtrar por fecha fallaría en dos casos: citas de un mismo día en que ya se importó, y citas viejas que Juan borró a propósito. Por eso existe el registro.
- Kindle guarda un subrayado **cada vez que se amplía**, así que una misma frase aparece varias veces (por ejemplo `5847-5852` y `5847-5855`). El script las fusiona en una sola, la más larga, si se superponen y pasaron menos de 15 minutos.
- Los libros físicos y los documentos (`c: "doc"`) **no vienen del Clippings**: llegan por otro lado y no llevan `s` ni `d`. Si Juan trae citas de esos, se cargan aparte, a pedido.

## Flujo (seguilo en este orden)

1. **Pedí el archivo** si Juan no lo pasó. Ruta habitual: `C:\Users\tinch\Downloads\My Clippings.txt`.
2. **Detectá lo nuevo:** `node actualizacion/nuevas.js "<ruta>"`. Lee el resumen y el `nuevas.json`.
3. **Contale a Juan el panorama antes de tocar nada:** cuántas citas nuevas, en qué libros, cuáles son libros nuevos, y si hay avisos (`revisarFechaAnterior`, `posibleRepetida`, notas sueltas). Si hay algo dudoso, preguntá **una sola vez**, todo junto.
4. **Libros existentes** (`libroExistente` con código): agregá las citas al final del libro (sus posiciones son posteriores). El número siguiente es `ultimoNumero + 1`. **Nunca reutilices un número ya usado**, aunque esa cita se haya borrado: los códigos coinciden con el documento Word de Juan.
5. **Libros nuevos** (`libroExistente: null`):
   - Confirmá con Juan el título limpio, el autor, el código (2 a 4 letras en mayúscula, único entre `books[].i`) y la categoría (`nf` o `fic`).
   - Los títulos que vienen como nombre de archivo (por ejemplo `Olivia-Fox-Cabane-The-Charisma-Myth_-How-Anyone...`) hay que limpiarlos.
   - Si el libro ya existe con otro título de Kindle, agregalo a `alias.json` en vez de crear un duplicado.
6. **Armá cada cita** con el formato de abajo, asigná temas y revisá la fusión y las `posibleRepetida`.
7. **Escribí `data.js`** (ver "Cómo escribirlo") y **validá**.
8. **Subí la versión del caché** en `sw.js` (`subrayados-v1` → `v2`, y así sucesivamente) para que el celular con la app instalada se actualice.
9. **Registrá todo lo visto:** `node actualizacion/nuevas.js "<ruta>" --registrar`. Esto marca como visto **todo** el archivo, incluso lo que descartaste. Es lo que evita que vuelva a aparecer.
10. **Mostrale a Juan el resumen** y **pedí su OK** antes de publicar. Si dice que sí: commit local y `git push` (el sitio se republica solo en 1 o 2 minutos). Sin OK, no subas nada: el repo es público.

## Formato de `data.js`

```
window.SUBRAYADOS={"themes":{...},"books":[{ i, t, a, c, l, n, p, m, q:[ {i, x, s, g, d, n, h, u} ] }]};
```

Una sola línea, `window.SUBRAYADOS=` al inicio y `;` al final. No cambies `themes`.

**Libro:** `i` código · `t` título · `a` autor (`"—"` si no hay; coautores separados por " y " o por coma) · `c` `"nf"` o `"fic"` · `l` idioma (`"es"`, `"pt"`, etc.) · `n` cantidad de citas (**debe ser igual a `q.length`**) · `p` período de lectura (`"jul 2026"` o `"sep 2023 – oct 2023"`, con el en dash; se recalcula con las fechas del libro) · `m` tema principal (una clave de `themes`).

**Cita:** `i` `CODIGO-NN` (dos dígitos, o más si hace falta) · `x` texto · `s` posición Kindle (`"389–391"` con en dash `–`, o `"331"`) · `g` página (solo si el Clippings la trae) · `d` fecha (`"8 dic 2023"`: día, mes de 3 letras en minúscula, año) · `n` lista de notas propias (solo si hay) · `h` lista de temas · `u` marca de recorte (solo si corresponde).

**Orden:** las citas de un libro van por posición creciente. Las nuevas van al final porque son posteriores. Si Juan subrayó algo más atrás en un libro, insertalo en su lugar de lectura, pero con el **número siguiente** (los códigos no se renumeran).

**Texto (`x`):** el que trae Kindle, sin comillas de más y con espacios normalizados. No lo resumas, no lo corrijas ni lo traduzcas.

**Notas:** una nota de Kindle va en `n` de la cita que tiene la misma posición (el script ya las asocia). Las que no se pueden asociar vienen en `notasSueltas`: preguntale a Juan.

**Temas (`h` y `m`):** 1 o 2 claves por cita (casi todas llevan 1). Elegí según el contenido y consistente con lo ya cargado.

| Clave | Tema |
|---|---|
| `ia` | Inteligencia artificial y tecnología |
| `est` | Estado, política y poder |
| `dec` | Decisiones, sesgos y pensamiento |
| `sis` | Sistemas y complejidad |
| `lid` | Liderazgo y estrategia |
| `eco` | Innovación, economía y dinero |
| `cre` | Creatividad, aprendizaje y mentalidad |
| `pro` | Profesiones y trabajo |
| `rel` | Relaciones y comunicación |
| `his` | Historia, cultura y sociedad |
| `hab` | Hábitos y desarrollo personal |
| `fic` | Ficción y literatura (solo libros de ficción, y todas sus citas) |

`m` del libro es el tema que más se repite en sus citas. En un libro ya existente no lo cambies salvo que Juan lo pida.

**Recorte (`u`):** `"inicio"` si la cita empieza a mitad de frase (minúscula inicial o continúa algo anterior), `"fin"` si termina sin cierre, `"ambos"` si las dos cosas. Es una sugerencia tuya: ante la duda, no la pongas. Sirve para que el sitio agregue […] al copiar.

## Cómo escribirlo

Hacé siempre una **copia de seguridad** antes (`data.js` → `actualizacion/respaldo-AAAA-MM-DD.js`, que no se sube) y modificá los datos desde un script de Node, no a mano:

```js
global.window = {}; require('./data.js');
const D = window.SUBRAYADOS;
// ... push de libros y citas ...
D.books.forEach(b => { b.n = b.q.length; });
require('fs').writeFileSync('data.js', 'window.SUBRAYADOS=' + JSON.stringify(D) + ';\n', 'utf8');
```

## Validación (obligatoria antes de dar por terminado)

Verificá y reportá cada punto:
- `node --check data.js` sin errores.
- Ningún código de cita ni de libro repetido.
- `n === q.length` en todos los libros.
- Todas las claves de `h` y `m` existen en `themes`.
- Ninguna cita con `x` vacío; `s`, `g` y `d` con el formato indicado.
- La cantidad de citas anteriores se conserva: el total nuevo es el anterior más lo agregado, ni una menos.
- Abrí el sitio (servidor local o `file://`) y comprobá que carga, que el total del buscador coincide y que una cita nueva aparece al buscarla.

## Reglas que no se rompen

- **Solo agregás.** No borres, edites ni renumeres citas existentes, salvo que Juan lo pida explícitamente.
- **No reincorporés lo que Juan borró:** si algo ya está en el registro, no vuelve, aunque esté en el archivo.
- **No inventes** ni completes texto, autores, páginas o fechas. Si falta, dejalo vacío o preguntá.
- **Antes de publicar, pedí OK.** El repo y el sitio son públicos.
- Las marcas personales de Juan (favoritas, etiquetas de uso) viven en su navegador, no en `data.js`. No las toques.

## Modelo y cuota

Sonnet alcanza para todo el flujo. Si hay muchas citas (más de 150) o muchos libros nuevos, trabajalo por libro para no sobrecargar el contexto.

## Al terminar, informá en pocas líneas

Cuántas citas nuevas se agregaron, a qué libros, qué libros son nuevos, qué descartaste o fusionaste, qué validaciones pasaron y cuáles no, y si quedó algo pendiente de publicar.
