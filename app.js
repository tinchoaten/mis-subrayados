(function () {
'use strict';

var DB = window.SUBRAYADOS, THEMES = DB.themes, TK = Object.keys(THEMES);
var CAT = { nf: 'No ficción', fic: 'Ficción', doc: 'Documentos' };
var CATORDER = ['nf', 'fic', 'doc'];
var BATCH = 30;
var NOSPLIT = ['José Ortega y Gasset'];   // nombres propios que llevan " y "

function $(s) { return document.querySelector(s); }
function nf(n) { return n.toLocaleString('es-AR'); }
function plural(n, one, many) { return nf(n) + ' ' + (n === 1 ? one : many); }

/* ---------- almacenamiento (claves compatibles con el prototipo) ---------- */
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('subr_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('subr_' + k, JSON.stringify(v)); } catch (e) {} }
};
var FAV = new Set(LS.get('fav', []));
var USO = LS.get('uso', {});
var USOLIST = LS.get('usolist', ['columna', 'clase', 'artículo', 'charla']);
var TEMAS = LS.get('temas', {});
var FMT = LS.get('fmt', 'ref');
var UITHEME = LS.get('uitema', 'auto');
var OCULTAS = LS.get('ocultas', []);     // ids de citas borradas en este navegador (se pueden restaurar)
var HIDDEN = {};
function saveOcultas() { LS.set('ocultas', OCULTAS); }
var MIAS = LS.get('mias', []);           // citas cargadas a mano desde el celu (pendientes de pasar a data.js)
var LASTBOOK = LS.get('lastbook', { t: '', a: '' });
function saveMias() { LS.set('mias', MIAS); }

/* sincronización: cada marca lleva su hora de última modificación (TS) y gana la más nueva */
var SYNC_URL = LS.get('syncurl', 'https://subrayados-sync.juanmartinatencio.workers.dev/sync');   // 'syncurl' solo se usa para pruebas
var SYNC = { key: LS.get('synckey', ''), busy: false, dirty: false, last: LS.get('lastsync', 0), err: '' };
var TS = LS.get('ts', {});
var syncT;
function saveTS() { LS.set('ts', TS); }
function touch(key) { TS[key] = Date.now(); saveTS(); scheduleSync(); }
function scheduleSync() { if (!SYNC.key) return; clearTimeout(syncT); syncT = setTimeout(doSync, 2500); }
function saveMarks() { LS.set('fav', Array.from(FAV)); LS.set('uso', USO); LS.set('usolist', USOLIST); LS.set('temas', TEMAS); }

/* ---------- datos derivados ---------- */
function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function splitAuthors(a) {
  if (!a || a === '—') return [];
  var keep = [];
  NOSPLIT.forEach(function (n, i) { if (a.indexOf(n) > -1) { a = a.replace(n, '\u0001' + i + '\u0001'); } });
  return a.split(/\s+y\s+|\s*,\s*|\s*;\s*/).map(function (x) {
    return x.replace(/\u0001(\d+)\u0001/g, function (m, i) { return NOSPLIT[+i]; }).trim();
  }).filter(Boolean);
}

var MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
function dateKey(d) {
  var m = /(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})/i.exec(d || '');
  return m ? (+m[3]) * 10000 + (MESES[fold(m[2]).slice(0, 3)] || 0) * 100 + (+m[1]) : 0;
}
var ALL = [], BYID = {}, BOOKS = {}, AUTHORS = {}, ORD = 0;
DB.books.forEach(function (b) {
  BOOKS[b.i] = b;
  b.au = b.c === 'doc' ? [] : splitAuthors(b.a);
  b.au.forEach(function (n) { (AUTHORS[n] = AUTHORS[n] || { n: 0, books: 0 }); AUTHORS[n].n += b.q.length; AUTHORS[n].books++; });
  b.q.forEach(function (q) {
    q.b = b;
    q.dk = dateKey(q.d);
    q.fx = fold(q.x + ' ' + (q.n || []).join(' ') + ' ' + b.t + ' ' + b.a + ' ' + q.i);
    q.ord = ORD++;
    ALL.push(q); BYID[q.i] = q;
  });
});
var AUTHNAMES = [];
function refreshAuthors() { AUTHNAMES = Object.keys(AUTHORS).filter(function (k) { return AUTHORS[k].n > 0; }).sort(function (a, b) { return a.localeCompare(b, 'es'); }); }
refreshAuthors();
var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fold2(s) { return fold(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
ALL.forEach(function (q) { q.f2 = fold2(q.x); });

/* citas propias: libro, indexado y baja */
function matchBook(t) {
  var n = fold(t.trim()); if (!n) return null;
  return DB.books.filter(function (b) { return fold(b.t) === n; })[0] || null;
}
function miaBook(m) {
  var b = m.bc && BOOKS[m.bc];
  if (b) return b;
  var key = 'X-' + fold(m.t || 'sin titulo').replace(/ /g, '-').slice(0, 40);
  b = BOOKS[key];
  if (!b) {
    b = { i: key, t: m.t || 'Sin título', a: m.a || '\u2014', c: 'nf', l: 'es', n: 0, p: '', m: '', q: [], virtual: true };
    b.au = splitAuthors(b.a);
    b.au.forEach(function (n) { (AUTHORS[n] = AUTHORS[n] || { n: 0, books: 0 }).books++; });
    DB.books.push(b); BOOKS[key] = b;
  }
  return b;
}
function indexMia(m) {
  var b = miaBook(m);
  var q = { i: m.id, x: m.x, g: m.g || '', n: m.n && m.n.length ? m.n : undefined, d: m.d, h: [], mia: true, b: b };
  q.dk = dateKey(q.d); q.f2 = fold2(q.x);
  q.fx = fold(q.x + ' ' + (q.n || []).join(' ') + ' ' + b.t + ' ' + b.a + ' ' + q.i);
  q.ord = ORD++;
  ALL.push(q); BYID[q.i] = q;
  b.au.forEach(function (n) { AUTHORS[n].n++; });
  return q;
}
function findDup(text) {
  var k = fold2(text).slice(0, 60); if (k.length < 20) return null;
  var full = fold2(text);
  for (var i = 0; i < ALL.length; i++) {
    var q = ALL[i]; if (q.mia) continue;
    if (q.f2.indexOf(k) > -1 || (q.f2.length >= 20 && full.indexOf(q.f2.slice(0, 60)) > -1)) return q;
  }
  return null;
}
function migrateMarks(from, to) {
  touch('fav:' + from); touch('fav:' + to); touch('uso:' + from); touch('uso:' + to); touch('temas:' + from); touch('temas:' + to);
  if (FAV.has(from)) { FAV.delete(from); FAV.add(to); }
  if (USO[from]) { var u = (USO[to] || []).concat(USO[from]); USO[to] = u.filter(function (x, k) { return u.indexOf(x) === k; }); delete USO[from]; }
  if (TEMAS[from]) { if (!TEMAS[to]) TEMAS[to] = TEMAS[from]; delete TEMAS[from]; }
}
function removeMia(id, keepMarks) {
  MIAS = MIAS.filter(function (m) { return m.id !== id; });
  var q = BYID[id];
  if (q) {
    ALL.splice(ALL.indexOf(q), 1); delete BYID[id];
    q.b.au.forEach(function (n) { if (AUTHORS[n]) AUTHORS[n].n--; });
    if (q.b.virtual && !ALL.some(function (x) { return x.b === q.b; })) {
      DB.books.splice(DB.books.indexOf(q.b), 1); delete BOOKS[q.b.i];
      q.b.au.forEach(function (n) { if (AUTHORS[n] && --AUTHORS[n].books <= 0 && AUTHORS[n].n <= 0) delete AUTHORS[n]; });
    }
  }
  if (!keepMarks) { FAV.delete(id); delete USO[id]; delete TEMAS[id]; saveMarks(); }
  saveMias(); refreshAuthors();
}
/* las que ya pasaron a data.js se ocultan solas y heredan favoritas, usos y temas */
(function () {
  var kept = [], changed = false;
  MIAS.forEach(function (m) {
    var d = findDup(m.x);
    if (d) { migrateMarks(m.id, d.i); touch('mia:' + m.id); changed = true; } else kept.push(m);
  });
  MIAS = kept;
  if (changed) { saveMias(); saveMarks(); }
  MIAS.forEach(indexMia); refreshAuthors();
})();

/* borrar: se oculta en este navegador y se puede restaurar */
function hideQuote(q) {
  var i = ALL.indexOf(q); if (i < 0) return;
  ALL.splice(i, 1);
  q.b.au.forEach(function (n) { if (AUTHORS[n]) AUTHORS[n].n--; });
  q.del = true; HIDDEN[q.i] = q;
  if (OCULTAS.indexOf(q.i) < 0) { OCULTAS.push(q.i); saveOcultas(); }
  refreshAuthors();
}
function restoreQuote(q) {
  delete HIDDEN[q.i]; q.del = false;
  ALL.push(q); ALL.sort(function (a, b) { return a.ord - b.ord; });
  q.b.au.forEach(function (n) { if (AUTHORS[n]) AUTHORS[n].n++; });
  OCULTAS = OCULTAS.filter(function (x) { return x !== q.i; }); saveOcultas();
  refreshAuthors();
}
(function () {
  var keep = [];
  OCULTAS.slice().forEach(function (id) { var q = BYID[id]; if (q && !q.mia) { hideQuote(q); keep.push(id); } });
  if (keep.length !== OCULTAS.length) { OCULTAS = keep; saveOcultas(); }
})();
function themesOf(q) { return TEMAS[q.i] || q.h || []; }
function usoOf(q) { return USO[q.i] || []; }

/* ---------- estado en la URL ---------- */
var VIEWS = ['buscar', 'libros', 'temas', 'autores', 'favoritas', 'repaso', 'agregar'];
var KEYS = ['q', 'libro', 'tema', 'autor', 'uso', 'cat', 'fav', 'cita', 'mias', 'borradas', 'ord', 'adivinar', 'c'];
var S = { v: 'buscar', p: {} };
var positions = {}, curHash = null;

function parseHash(h) {
  h = (h || '').replace(/^#\/?/, '');
  var i = h.indexOf('?'), v = i < 0 ? h : h.slice(0, i), qs = i < 0 ? '' : h.slice(i + 1);
  if (VIEWS.indexOf(v) < 0) v = 'buscar';
  var p = {}, sp = new URLSearchParams(qs);
  KEYS.forEach(function (k) { var x = sp.get(k); if (x) p[k] = x; });
  return { v: v, p: p };
}
function buildHash(v, p) {
  var sp = new URLSearchParams();
  KEYS.forEach(function (k) { if (p[k]) sp.set(k, p[k]); });
  var qs = sp.toString();
  return '#/' + v + (qs ? '?' + qs : '');
}
function navigate(hash, replace) {
  if (hash === location.hash) { route(false); return; }
  positions[curHash] = { y: window.scrollY, n: L.shown };
  try { history[replace ? 'replaceState' : 'pushState'](null, '', hash); } catch (e) { location.hash = hash; return; }
  route(false);
}
function go(v, p, replace) { navigate(buildHash(v, p), replace); }
function withP(change) { var p = Object.assign({}, S.p); Object.keys(change).forEach(function (k) { if (change[k]) p[k] = change[k]; else delete p[k]; }); return p; }
function listView(v) { return v === 'buscar' || v === 'favoritas' ? v : 'buscar'; }

/* ---------- búsqueda ---------- */
function termsOf(q) {
  return fold(q || '').split(/\s+/).map(function (t) { return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); }).filter(Boolean);
}
function applyFilters(p, useQ, forceFav) {
  var terms = useQ ? termsOf(p.q) : [];
  var fav = forceFav || p.fav;
  return (p.borradas ? Object.keys(HIDDEN).map(function (k) { return HIDDEN[k]; }) : ALL).filter(function (q) {
    if (p.cita && q.i !== p.cita) return false;
    if (p.mias && !q.mia) return false;
    if (p.libro && q.b.i !== p.libro) return false;
    if (p.cat && q.b.c !== p.cat) return false;
    if (p.tema && themesOf(q).indexOf(p.tema) < 0) return false;
    if (p.autor && q.b.au.indexOf(p.autor) < 0) return false;
    if (p.uso && usoOf(q).indexOf(p.uso) < 0) return false;
    if (fav && !FAV.has(q.i)) return false;
    for (var i = 0; i < terms.length; i++) if (q.fx.indexOf(terms[i]) < 0) return false;
    return true;
  });
}
function sortItems(items, ord) {
  var a = items.slice();
  if (ord === 'fecha') a.sort(function (x, y) { return (y.dk - x.dk) || (ALL.indexOf(x) - ALL.indexOf(y)); });
  else if (ord === 'titulo') a.sort(function (x, y) { return x.b.t.localeCompare(y.b.t, 'es') || (ALL.indexOf(x) - ALL.indexOf(y)); });
  return a;
}
function highlight(text, terms) {
  if (!terms.length) return esc(text);
  var f = '', map = [], i, c, g, j;
  for (i = 0; i < text.length; i++) {
    c = text.charAt(i);
    g = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (j = 0; j < g.length; j++) { f += g.charAt(j); map.push(i); }
  }
  var rng = [];
  terms.forEach(function (t) {
    var k = 0;
    while ((k = f.indexOf(t, k)) > -1) { rng.push([map[k], map[k + t.length - 1] + 1]); k += t.length; }
  });
  if (!rng.length) return esc(text);
  rng.sort(function (a, b) { return a[0] - b[0]; });
  var out = '', pos = 0;
  rng.forEach(function (r) {
    if (r[1] <= pos) return;
    var s = Math.max(r[0], pos);
    out += esc(text.slice(pos, s)) + '<mark>' + esc(text.slice(s, r[1])) + '</mark>';
    pos = r[1];
  });
  return out + esc(text.slice(pos));
}

/* ---------- copiar ---------- */
function bareText(q, raw) {
  var u = q.u, t = raw === undefined ? q.x : raw;
  if (u === 'inicio' || u === 'ambos') t = '[…] ' + t;
  if (u === 'fin' || u === 'ambos') t = t + ' […]';
  return t;
}
function where(q) { return q.s ? 'pos. ' + q.s : (q.g ? 'p. ' + q.g : ''); }
function formatQuote(q, fmt) {
  var t = bareText(q), b = q.b, au = (b.a && b.a !== '—') ? b.a : '', w = where(q);
  if (fmt === 'txt') return t;
  if (fmt === 'md') {
    var src = [au, '*' + b.t + '*', w].filter(Boolean).join(', ');
    return '> ' + t.replace(/\n+/g, '\n> ') + '\n>\n> — ' + src;
  }
  var inner = bareText(q, q.x.replace(/^[“"]\s*/, '').replace(/[,;.]?\s*[”"][,;.]?$/, ''));
  return '“' + inner + '” (' + [au, b.t, w].filter(Boolean).join(', ') + ')';
}
function copyText(txt, done) {
  function legacy() {
    var a = document.createElement('textarea');
    a.value = txt; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.appendChild(a); a.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    a.remove(); done(ok);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { done(true); }, legacy);
  else legacy();
}
var toastT;
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 1600);
}

/* ---------- tarjeta de cita ---------- */
function metaHTML(q) {
  var parts = q.mia ? ['<span>Agregada desde el celu · pendiente de pasar al archivo</span>'] : [];
  parts = parts.concat(themesOf(q).map(function (k) { return '<a href="#/buscar?tema=' + k + '">' + esc(THEMES[k]) + '</a>'; }));
  usoOf(q).forEach(function (u) { parts.push('<a href="#/buscar?uso=' + encodeURIComponent(u) + '">Uso: ' + esc(u) + '</a>'); });
  return parts.join('');
}
function cardHTML(q, terms, opt) {
  opt = opt || {};
  var b = q.b, au = (b.a && b.a !== '—') ? b.a : '';
  var lead = (q.u === 'inicio' || q.u === 'ambos') ? '<span class="ell">[…]</span> ' : '';
  var tail = (q.u === 'fin' || q.u === 'ambos') ? ' <span class="ell">[…]</span>' : '';
  var h = '<article class="q" id="c-' + esc(q.i) + '" data-i="' + esc(q.i) + '" tabindex="-1" aria-label="Cita ' + esc(q.i) + '">';
  h += '<blockquote><p>' + lead + highlight(q.x, terms) + tail + '</p></blockquote>';
  if (opt.hide) {
    h += '<p class="src hidden-src"><button class="btn" data-act="reveal">¿De qué libro es? Mostrar</button></p>';
  } else {
    var src = '<a href="#/buscar?libro=' + encodeURIComponent(b.i) + '">' + esc(b.t) + '</a>';
    if (au) src += ' · <a href="#/buscar?autor=' + encodeURIComponent(b.au[0] && b.au.length === 1 ? b.au[0] : au) + '">' + esc(au) + '</a>';
    var extra = [where(q), q.d].filter(Boolean).join(' · ');
    if (extra) src += ' · ' + esc(extra);
    h += '<p class="src">' + src + '</p>';
  }
  (q.n || []).forEach(function (n) { h += '<p class="note"><b>✎ Mi nota</b> ' + highlight(n, terms) + '</p>'; });
  if (!opt.hide) h += '<p class="meta">' + metaHTML(q) + '</p>';
  var fav = FAV.has(q.i);
  h += '<div class="acts">' +
    '<button class="btn fav" data-act="fav" aria-pressed="' + fav + '" aria-label="Favorita" title="Favorita (f)">' + (fav ? '★' : '☆') + '</button>' +
    '<button class="btn copy" data-act="copy" title="Copiar cita (c)">Copiar</button>' +
    '<button class="btn" data-act="more" aria-expanded="false" title="Etiqueta de uso y temas">Más</button>' +
    '</div></article>';
  return h;
}
function optHTML(kind, val, checked, label) {
  return '<label class="opt"><input type="checkbox" data-k="' + kind + '" value="' + esc(val) + '"' + (checked ? ' checked' : '') + '> ' + esc(label || val) + '</label>';
}
function morePanel(q) {
  var u = usoOf(q), th = themesOf(q);
  if (q.del) return '<div class="more"><p>Esta cita está borrada en este navegador.</p><p class="row"><button class="btn pri" data-act="restore">Restaurar</button></p></div>';
  return '<div class="more">' +
    '<h3>Para qué la usás</h3><div class="opts">' + USOLIST.map(function (x) { return optHTML('uso', x, u.indexOf(x) > -1); }).join('') + '</div>' +
    '<form class="newuso"><input placeholder="Nueva etiqueta…" aria-label="Nueva etiqueta de uso" maxlength="30"><button class="btn">Agregar</button></form>' +
    '<h3>Temas</h3><div class="opts">' + TK.map(function (k) { return optHTML('tema', k, th.indexOf(k) > -1, THEMES[k]); }).join('') + '</div>' +
    '<p class="row"><button class="btn" data-act="link">Copiar enlace a esta cita</button></p>' +
    '<p class="row">' + (q.mia ? '<a class="btn" href="#/agregar?c=' + encodeURIComponent(q.i) + '">Editar</a>' : '') + '<button class="btn" data-act="delmia">Borrar esta cita</button></p>' +
    '<p><button class="btn" data-act="resettemas"' + (TEMAS[q.i] ? '' : ' disabled') + '>Volver a los temas originales</button></p></div>';
}

/* ---------- lista con carga por tandas ---------- */
var L = { items: [], shown: 0, terms: [] }, io = null;
var view = $('#view');

function renderMore(all) {
  var list = $('#list'); if (!list) return;
  var end = all ? L.items.length : Math.min(L.items.length, L.shown + BATCH), html = '';
  for (var i = L.shown; i < end; i++) html += cardHTML(L.items[i], L.terms);
  list.insertAdjacentHTML('beforeend', html);
  L.shown = end;
  var btn = $('#moreBtn');
  if (btn) { if (L.shown >= L.items.length) { btn.remove(); if (io) io.disconnect(); } else btn.textContent = 'Mostrar más (' + nf(L.items.length - L.shown) + ' restantes)'; }
}
function showList(items, terms, head) {
  L = { items: items, shown: 0, terms: terms };
  if (io) io.disconnect();
  if (!items.length) { view.innerHTML = (head || '') + emptyHTML(); return; }
  view.innerHTML = (head || '') + '<div id="list"></div>' + (items.length > BATCH ? '<button class="btn more-btn" id="moreBtn" data-act="moremore"></button>' : '');
  renderMore();
  var btn = $('#moreBtn');
  if (btn && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) renderMore(); }, { rootMargin: '900px' });
    io.observe(btn);
  }
}
function hasFilters() { return KEYS.some(function (k) { return k !== 'c' && k !== 'adivinar' && k !== 'ord' && S.p[k]; }); }
function emptyHTML() {
  return '<div class="empty"><p>No hay resultados: probá con menos palabras o quitá algún filtro.</p>' +
    (hasFilters() ? '<button class="btn pri" data-act="clear">Limpiar filtros</button>' : '') + '</div>';
}

/* ---------- vistas ---------- */
function setCount(t) { $('#count').textContent = t; }

function viewBuscar() {
  var items = sortItems(applyFilters(S.p, true), S.p.ord);
  var n = items.length;
  setCount(S.p.borradas ? plural(n, 'cita borrada', 'citas borradas') : hasFilters() ? plural(n, 'resultado', 'resultados') + ' de ' + nf(ALL.length) : plural(n, 'cita', 'citas'));
  showList(items, termsOf(S.p.q));
}
function viewFavoritas() {
  var items = sortItems(applyFilters(S.p, true, true), S.p.ord);
  setCount(plural(items.length, 'favorita', 'favoritas'));
  var head = items.length ? '<p class="row" style="margin:0 0 4px"><button class="btn" data-act="copyall">Copiar todas (' + nf(items.length) + ')</button><button class="btn" data-act="dlfav">Descargar</button></p>' : '';
  if (!items.length && !hasFilters()) {
    L = { items: [], shown: 0, terms: [] };
    view.innerHTML = '<div class="empty"><p>Todavía no marcaste favoritas. Tocá ☆ en cualquier cita.</p><a class="btn pri" href="#/buscar" style="display:inline-flex;align-items:center;text-decoration:none">Ir a buscar</a></div>';
    return;
  }
  showList(items, termsOf(S.p.q), head);
}
function groupBooks(f) {
  var out = '', cb = {};
  ALL.forEach(function (q) { cb[q.b.i] = (cb[q.b.i] || 0) + 1; });
  CATORDER.forEach(function (c) {
    var bs = DB.books.filter(function (b) { return b.c === c && cb[b.i] && (!f || fold(b.t + ' ' + b.a).indexOf(f) > -1); })
      .sort(function (a, b) { return a.t.localeCompare(b.t, 'es'); });
    if (!bs.length) return;
    out += '<h2 class="grp">' + CAT[c] + ' · ' + bs.length + '</h2><ul class="list">' + bs.map(function (b) {
      return '<li><a href="#/buscar?libro=' + encodeURIComponent(b.i) + '"><span><span class="t">' + esc(b.t) + '</span>' +
        (b.c !== 'doc' && b.a !== '—' ? '<span class="a">' + esc(b.a) + '</span>' : '') + '</span><span class="s">' + plural(cb[b.i] || 0, 'cita', 'citas') + '</span></a></li>';
    }).join('') + '</ul>';
  });
  return out || '<div class="empty"><p>Ningún libro coincide.</p></div>';
}
function viewLibros() {
  setCount(plural(new Set(ALL.map(function (q) { return q.b.i; })).size, 'libro', 'libros') + ' · ' + plural(ALL.length, 'cita', 'citas'));
  view.innerHTML = '<input class="filter-in" id="fl" type="search" placeholder="Filtrar libros por título o autor…" aria-label="Filtrar libros"><div id="fl-out">' + groupBooks('') + '</div>';
  $('#fl').addEventListener('input', function (e) { $('#fl-out').innerHTML = groupBooks(fold(e.target.value.trim())); });
}
function viewTemas() {
  var cnt = {}; ALL.forEach(function (q) { themesOf(q).forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
  setCount(plural(TK.length, 'tema', 'temas'));
  view.innerHTML = '<ul class="list">' + TK.map(function (k) {
    return '<li><a href="#/buscar?tema=' + k + '"><span class="t">' + esc(THEMES[k]) + '</span><span class="s">' + plural(cnt[k] || 0, 'cita', 'citas') + '</span></a></li>';
  }).join('') + '</ul>';
}
function listAuthors(f) {
  var names = AUTHNAMES.filter(function (a) { return !f || fold(a).indexOf(f) > -1; });
  if (!names.length) return '<div class="empty"><p>Ningún autor coincide.</p></div>';
  return '<ul class="list">' + names.map(function (a) {
    return '<li><a href="#/buscar?autor=' + encodeURIComponent(a) + '"><span class="t">' + esc(a) + '</span><span class="s">' + plural(AUTHORS[a].n, 'cita', 'citas') + '</span></a></li>';
  }).join('') + '</ul>';
}
function viewAutores() {
  setCount(plural(AUTHNAMES.length, 'autor', 'autores'));
  view.innerHTML = '<input class="filter-in" id="fa" type="search" placeholder="Filtrar autores…" aria-label="Filtrar autores"><div id="fa-out">' + listAuthors('') + '</div>';
  $('#fa').addEventListener('input', function (e) { $('#fa-out').innerHTML = listAuthors(fold(e.target.value.trim())); });
}

function syncBookField() {
  var t = $('#aT'), a = $('#aA'), info = $('#aBookInfo'); if (!t) return;
  var b = matchBook(t.value);
  if (b && !b.virtual) { a.value = (b.a && b.a !== '\u2014') ? b.a : ''; a.readOnly = true; info.textContent = 'Libro de tu colección (' + b.i + ').'; }
  else {
    a.readOnly = false; if (b && !a.value) a.value = b.a === '\u2014' ? '' : b.a;
    info.textContent = t.value.trim() ? 'Libro nuevo: se crea cuando pases tus citas al archivo.' : '';
  }
}
function viewAgregar() {
  setCount('');
  var m = S.p.c ? MIAS.filter(function (x) { return x.id === S.p.c; })[0] : null;
  var bk = m ? (m.bc && BOOKS[m.bc] ? BOOKS[m.bc] : { t: m.t, a: m.a }) : LASTBOOK;
  var bt = bk.t || '', ba = (bk.a && bk.a !== '\u2014') ? bk.a : '';
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var hint = ios ? 'En iPhone: tocá el campo y elegí <b>Escanear texto</b> (ícono de cámara con renglones) para pasar la página del libro a texto.'
    : 'Escribila, pegala, o en el celu usá el teclado para escanear texto con la cámara.';
  view.innerHTML = '<form class="add" id="addForm" novalidate data-edit="' + (m ? esc(m.id) : '') + '">' +
    '<h2 class="grp">' + (m ? 'Editar cita' : 'Agregar una cita') + '</h2>' +
    '<div class="lblrow"><label for="aX">Cita</label><button type="button" class="btn" data-act="paste">Pegar</button></div>' +
    '<textarea id="aX" rows="6" lang="es">' + esc(m ? m.x : '') + '</textarea>' +
    '<p class="hint">' + hint + '</p>' +
    '<label for="aT">Libro</label><input id="aT" list="booksList" value="' + esc(bt) + '" autocomplete="off" placeholder="Elegí uno de tu lista o escribí uno nuevo">' +
    '<datalist id="booksList">' + DB.books.map(function (b) { return '<option value="' + esc(b.t) + '">'; }).join('') + '</datalist>' +
    '<p class="hint" id="aBookInfo"></p>' +
    '<label for="aA">Autor</label><input id="aA" value="' + esc(ba) + '" autocomplete="off" placeholder="Nombre y apellido">' +
    '<label for="aG">Página (opcional)</label><input id="aG" inputmode="numeric" autocomplete="off" value="' + esc(m && m.g ? m.g : '') + '">' +
    '<label for="aN">Mi nota (opcional)</label><textarea id="aN" rows="2" lang="es">' + esc(m && m.n ? m.n.join('\n') : '') + '</textarea>' +
    '<p class="err" id="aErr" role="alert"></p>' +
    '<div class="row"><button class="btn pri" type="submit">' + (m ? 'Guardar cambios' : 'Guardar') + '</button>' +
    (m ? '' : '<button class="btn" type="button" data-act="saveagain">Guardar y agregar otra</button>') +
    '<a class="btn" href="#/buscar">Cancelar</a></div></form>';
  syncBookField();
  if (!m) $('#aX').focus();
}
function saveForm(again) {
  var f = $('#addForm'), editId = f.dataset.edit, err = $('#aErr');
  var x = $('#aX').value.replace(/\s+/g, ' ').trim(), t = $('#aT').value.trim(), a = $('#aA').value.trim(),
      g = $('#aG').value.trim(), note = $('#aN').value.trim();
  if (x.length < 3) { err.textContent = 'Escribí o pegá la cita.'; $('#aX').focus(); return; }
  if (!t) { err.textContent = 'Indicá de qué libro es.'; $('#aT').focus(); return; }
  var dup = findDup(x);
  if (dup) { err.innerHTML = 'Esa cita ya está en tus subrayados: <a href="#/buscar?cita=' + encodeURIComponent(dup.i) + '">' + esc(dup.i) + '</a>.'; return; }
  var b = matchBook(t), now = new Date();
  var rec = { id: editId || 'M-' + Date.now().toString(36), x: x, t: b ? b.t : t, a: b && !b.virtual ? (b.a === '\u2014' ? '' : b.a) : a,
              g: g, n: note ? [note] : [], d: now.getDate() + ' ' + MES3[now.getMonth()] + ' ' + now.getFullYear(), iso: now.toISOString() };
  if (b && !b.virtual) rec.bc = b.i;
  if (editId) {
    var old = MIAS.filter(function (z) { return z.id === editId; })[0];
    if (old) { rec.d = old.d; rec.iso = old.iso; }
    removeMia(editId, true);
  }
  MIAS.push(rec); saveMias(); touch('mia:' + rec.id); indexMia(rec); refreshAuthors(); fillFilters(); updateDataStats();
  LASTBOOK = { t: rec.t, a: rec.a }; LS.set('lastbook', LASTBOOK);
  if (again) {
    $('#aX').value = ''; $('#aG').value = ''; $('#aN').value = ''; err.textContent = '';
    toast('Guardada. Cargá otra'); $('#aX').focus(); syncBookField();
  } else { toast('Cita guardada'); go('buscar', { cita: rec.id }); }
}

var revPool = [];
function viewRepaso() {
  revPool = applyFilters(S.p, false);
  var guess = !!S.p.adivinar;
  setCount(plural(revPool.length, 'cita', 'citas') + ' para repasar');
  var tools = '<div class="rev"><div class="tools">' +
    '<label>Tema <select id="rTema"><option value="">Todos</option>' + TK.map(function (k) { return '<option value="' + k + '"' + (S.p.tema === k ? ' selected' : '') + '>' + esc(THEMES[k]) + '</option>'; }).join('') + '</select></label>' +
    '<label class="opt"><input type="checkbox" id="rFav"' + (S.p.fav ? ' checked' : '') + '> Solo favoritas</label>' +
    '<label class="opt"><input type="checkbox" id="rGuess"' + (guess ? ' checked' : '') + '> Adivinar el libro</label></div>';
  if (!revPool.length) { L = { items: [], shown: 0, terms: [] }; view.innerHTML = tools + emptyHTML() + '</div>'; return; }
  var q = BYID[S.p.c];
  if (!q || revPool.indexOf(q) < 0) { q = revPool[Math.floor(Math.random() * revPool.length)]; S.p.c = q.i; history.replaceState(null, '', buildHash('repaso', S.p)); curHash = location.hash; }
  L = { items: [q], shown: 1, terms: [] };
  view.innerHTML = tools + '<div id="list">' + cardHTML(q, [], { hide: guess && !revealed[q.i] }) + '</div>' +
    '<div class="row"><button class="btn pri" data-act="next">Otra cita</button></div></div>';
}
var revealed = {};
function nextRev() {
  if (!revPool.length) return;
  var q, tries = 0;
  do { q = revPool[Math.floor(Math.random() * revPool.length)]; } while (revPool.length > 1 && q.i === S.p.c && ++tries < 20);
  S.p.c = q.i; delete revealed[q.i];
  navigate(buildHash('repaso', S.p), true);
}

/* ---------- controles ---------- */
var FILTERUI = { libro: '#fLibro', tema: '#fTema', autor: '#fAutor', uso: '#fUso', cat: '#fCat' };
function fillFilters() {
  var cnt = {}; ALL.forEach(function (q) { themesOf(q).forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
  var ucnt = {}; Object.keys(USO).forEach(function (i) { USO[i].forEach(function (u) { ucnt[u] = (ucnt[u] || 0) + 1; }); });
  var lib = '<option value="">Todos</option>';
  CATORDER.forEach(function (c) {
    lib += '<optgroup label="' + CAT[c] + '">' + DB.books.filter(function (b) { return b.c === c; })
      .sort(function (a, b) { return a.t.localeCompare(b.t, 'es'); })
      .map(function (b) { return '<option value="' + esc(b.i) + '">' + esc(b.t) + '</option>'; }).join('') + '</optgroup>';
  });
  $('#fLibro').innerHTML = lib;
  $('#fTema').innerHTML = '<option value="">Todos</option>' + TK.map(function (k) { return '<option value="' + k + '">' + esc(THEMES[k]) + ' (' + (cnt[k] || 0) + ')</option>'; }).join('');
  $('#fAutor').innerHTML = '<option value="">Todos</option>' + AUTHNAMES.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
  $('#fUso').innerHTML = '<option value="">Todos</option>' + USOLIST.map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + ' (' + (ucnt[u] || 0) + ')</option>'; }).join('');
}
function syncControls() {
  Object.keys(FILTERUI).forEach(function (k) { $(FILTERUI[k]).value = S.p[k] || ''; });
  $('#fFav').checked = !!S.p.fav;
  $('#fMias').checked = !!S.p.mias;
  var qi = $('#q'); if (!typing) qi.value = S.p.q || '';
  Array.prototype.forEach.call(document.querySelectorAll('#tabs a'), function (a) {
    if (a.dataset.v === S.v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#fFmt').value = FMT;
  $('#fOrd').value = S.p.ord || '';
  var chips = '';
  function chip(k, label) { chips += '<button class="chip" data-clear="' + k + '" aria-label="Quitar filtro: ' + esc(label) + '"><span>' + esc(label) + '</span><i aria-hidden="true">×</i></button>'; }
  if (['buscar', 'favoritas', 'repaso'].indexOf(S.v) > -1) {
    if (S.p.cita) chip('cita', 'Una cita: ' + S.p.cita);
    if (S.p.mias) chip('mias', 'Agregadas por mí');
    if (S.p.borradas) chip('borradas', 'Citas borradas');
    if (S.p.libro && BOOKS[S.p.libro]) chip('libro', BOOKS[S.p.libro].t);
    if (S.p.tema && THEMES[S.p.tema]) chip('tema', THEMES[S.p.tema]);
    if (S.p.autor) chip('autor', S.p.autor);
    if (S.p.uso) chip('uso', 'Uso: ' + S.p.uso);
    if (S.p.cat && CAT[S.p.cat]) chip('cat', CAT[S.p.cat]);
    if (S.p.fav && S.v !== 'favoritas') chip('fav', 'Solo favoritas');
  }
  $('#chips').innerHTML = chips;
  var n = ['libro', 'tema', 'autor', 'uso', 'cat', 'fav', 'cita', 'mias'].filter(function (k) { return S.p[k]; }).length;
  $('#btnFilters').textContent = n ? 'Filtros (' + n + ')' : 'Filtros';
}
function updateDataStats() {
  $('#dataStats').textContent = 'Favoritas: ' + FAV.size + ' · citas con etiqueta de uso: ' + Object.keys(USO).length + ' · citas con temas corregidos: ' + Object.keys(TEMAS).length + ' · citas agregadas desde el celu: ' + MIAS.length;
  var nb = OCULTAS.length;
  $('#dataDel').innerHTML = nb ? 'Citas borradas en este navegador: ' + nb + ' · <a href="#/buscar?borradas=1">Ver y restaurar</a>' : '';
  renderSync();
}
function applyUITheme() {
  var r = document.documentElement;
  if (UITHEME === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', UITHEME);
  $('#btnTheme').textContent = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' }[UITHEME];
}

/* ---------- ruteo ---------- */
var popping = false;
function route(fromPop) {
  var h = location.hash || '#/buscar';
  var r = parseHash(h);
  S = r;
  var firstRender = curHash === null;
  curHash = location.hash;
  syncControls();
  $('#chips').style.display = ['buscar', 'favoritas', 'repaso'].indexOf(S.v) > -1 ? '' : 'none';
  $('#ordWrap').style.display = (S.v === 'buscar' || S.v === 'favoritas') ? '' : 'none';
  $('#fmtWrap').style.visibility = ['libros', 'temas', 'autores', 'agregar'].indexOf(S.v) > -1 ? 'hidden' : '';
  ({ buscar: viewBuscar, libros: viewLibros, temas: viewTemas, autores: viewAutores, favoritas: viewFavoritas, repaso: viewRepaso, agregar: viewAgregar })[S.v]();
  var pos = fromPop && positions[location.hash];
  if (pos) { while (L.shown < pos.n && L.shown < L.items.length) renderMore(); window.scrollTo(0, pos.y); }
  else if (!firstRender && !typing) { window.scrollTo(0, 0); }
  document.title = (S.v === 'buscar' ? '' : { libros: 'Libros', temas: 'Temas', autores: 'Autores', favoritas: 'Favoritas', repaso: 'Repaso', agregar: 'Agregar' }[S.v] + ' · ') + 'Mis subrayados';
}
var typing = false;
window.addEventListener('popstate', function () { route(true); });
window.addEventListener('hashchange', function () { if (location.hash !== curHash) route(true); });

/* ---------- acciones ---------- */
function cardOf(el) { var c = el.closest('.q'); return c ? { el: c, q: BYID[c.dataset.i] } : null; }
function doFav(c) {
  var q = c.q, b = c.el.querySelector('.fav');
  if (FAV.has(q.i)) FAV.delete(q.i); else FAV.add(q.i);
  saveMarks(); touch('fav:' + q.i);
  var on = FAV.has(q.i);
  b.setAttribute('aria-pressed', on); b.textContent = on ? '★' : '☆';
  toast(on ? 'Marcada como favorita' : 'Quitada de favoritas');
  updateDataStats();
}
function doCopy(c) {
  var b = c.el.querySelector('.copy');
  copyText(formatQuote(c.q, FMT), function (ok) {
    toast(ok ? 'Copiado' : 'No se pudo copiar');
    if (ok && b) { b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = 'Copiar'; }, 1400); }
  });
}
function doMore(c) {
  var b = c.el.querySelector('[data-act="more"]'), open = b.getAttribute('aria-expanded') === 'true';
  var m = c.el.querySelector('.more');
  if (open) { if (m) m.remove(); b.setAttribute('aria-expanded', 'false'); b.textContent = 'Más'; return; }
  c.el.insertAdjacentHTML('beforeend', morePanel(c.q));
  b.setAttribute('aria-expanded', 'true'); b.textContent = 'Menos';
}
function refreshMeta(c) { var m = c.el.querySelector('.meta'); if (m) m.innerHTML = metaHTML(c.q); }
function setUso(q, name, on) {
  var a = usoOf(q).filter(function (x) { return x !== name; });
  if (on) a.push(name);
  if (a.length) USO[q.i] = a; else delete USO[q.i];
}
function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) > -1; }); }

view.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]'); if (!t) return;
  var act = t.dataset.act, c = cardOf(t);
  if (act === 'fav' && c) doFav(c);
  else if (act === 'copy' && c) doCopy(c);
  else if (act === 'more' && c) doMore(c);
  else if (act === 'reveal' && c) { revealed[c.q.i] = true; c.el.outerHTML = cardHTML(c.q, [], {}); }
  else if (act === 'resettemas' && c) {
    delete TEMAS[c.q.i]; saveMarks(); touch('temas:' + c.q.i);
    var th = themesOf(c.q);
    Array.prototype.forEach.call(c.el.querySelectorAll('input[data-k="tema"]'), function (i) { i.checked = th.indexOf(i.value) > -1; });
    t.disabled = true; refreshMeta(c); fillFilters(); syncControls(); updateDataStats();
  }
  else if (act === 'link' && c) {
    var url = location.href.split('#')[0] + buildHash('buscar', { cita: c.q.i });
    copyText(url, function (ok) { toast(ok ? 'Enlace copiado' : 'No se pudo copiar'); });
  }
  else if (act === 'dlfav') {
    var md = FMT === 'md', body = L.items.map(function (q) { return formatQuote(q, FMT); }).join('\n\n');
    var blob = new Blob([body + '\n'], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mis-favoritas.' + (md ? 'md' : 'txt');
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Archivo descargado');
  }
  else if (act === 'paste') {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Pegá con el dedo en el campo'); }
    else navigator.clipboard.readText().then(function (txt) {
      var ta = $('#aX'); if (txt) { ta.value = ta.value ? ta.value + ' ' + txt : txt; ta.focus(); toast('Pegado'); } else toast('El portapapeles está vacío');
    }, function () { toast('No se pudo leer: pegá con el dedo en el campo'); });
  }
  else if (act === 'saveagain') saveForm(true);
  else if (act === 'delmia' && c) {
    if (t.dataset.sure) {
      var qq = c.q; if (qq.mia) removeMia(qq.i); else hideQuote(qq); fillFilters(); updateDataStats();
      if (qq.mia) { touch('mia:' + qq.i); touch('fav:' + qq.i); touch('uso:' + qq.i); touch('temas:' + qq.i); } else touch('oculta:' + qq.i);
      var ix = L.items.indexOf(qq); if (ix > -1) { L.items.splice(ix, 1); L.shown = Math.max(0, L.shown - 1); }
      c.el.remove(); toast(qq.mia ? 'Cita borrada' : 'Cita borrada. Podés restaurarla desde Mis datos');
    } else {
      t.dataset.sure = '1'; t.textContent = 'Tocá otra vez para borrar';
      setTimeout(function () { if (t.isConnected) { delete t.dataset.sure; t.textContent = 'Borrar esta cita'; } }, 4000);
    }
  }
  else if (act === 'restore' && c) {
    var rq = c.q; restoreQuote(rq); touch('oculta:' + rq.i); fillFilters(); updateDataStats();
    var rx = L.items.indexOf(rq); if (rx > -1) { L.items.splice(rx, 1); L.shown = Math.max(0, L.shown - 1); }
    c.el.remove(); toast('Cita restaurada');
  }
  else if (act === 'moremore') renderMore();
  else if (act === 'next') nextRev();
  else if (act === 'clear') go(S.v === 'favoritas' ? 'favoritas' : S.v === 'repaso' ? 'repaso' : 'buscar', {});
  else if (act === 'copyall') {
    var all = L.items;
    copyText(all.map(function (q) { return formatQuote(q, FMT); }).join('\n\n'), function (ok) { toast(ok ? plural(all.length, 'cita copiada', 'citas copiadas') : 'No se pudo copiar'); });
  }
});
view.addEventListener('change', function (e) {
  var t = e.target, c = cardOf(t);
  if (t.id === 'rTema') return go('repaso', withP({ tema: t.value, c: '' }));
  if (t.id === 'rFav') return go('repaso', withP({ fav: t.checked ? '1' : '', c: '' }));
  if (t.id === 'rGuess') return go('repaso', withP({ adivinar: t.checked ? '1' : '' }), true);
  if (!c || !t.dataset.k) return;
  if (t.dataset.k === 'uso') setUso(c.q, t.value, t.checked);
  else {
    var sel = Array.prototype.filter.call(c.el.querySelectorAll('input[data-k="tema"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    if (sameSet(sel, c.q.h || [])) delete TEMAS[c.q.i]; else TEMAS[c.q.i] = sel;
    var rb = c.el.querySelector('[data-act="resettemas"]'); if (rb) rb.disabled = !TEMAS[c.q.i];
  }
  touch((t.dataset.k === 'uso' ? 'uso:' : 'temas:') + c.q.i);
  saveMarks(); refreshMeta(c); fillFilters(); syncControls(); updateDataStats();
});
view.addEventListener('input', function (e) { if (e.target.id === 'aT') syncBookField(); });
view.addEventListener('change', function (e) { if (e.target.id === 'aT') syncBookField(); });
view.addEventListener('submit', function (e) {
  if (e.target.id === 'addForm') { e.preventDefault(); saveForm(false); return; }
  if (!e.target.classList.contains('newuso')) return;
  e.preventDefault();
  var c = cardOf(e.target), inp = e.target.querySelector('input'), name = inp.value.trim();
  if (!name || !c) return;
  if (USOLIST.indexOf(name) < 0) USOLIST.push(name);
  setUso(c.q, name, true); saveMarks(); touch('uso:' + c.q.i); touch('usolist'); fillFilters(); syncControls(); refreshMeta(c);
  var panel = c.el.querySelector('.more'); if (panel) panel.remove();
  c.el.insertAdjacentHTML('beforeend', morePanel(c.q));
  toast('Etiqueta agregada');
});

document.addEventListener('click', function (e) {
  var a = e.target.closest('a[href^="#/"]');
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
    e.preventDefault(); navigate(a.getAttribute('href'), false);
    if (a.closest('.panel')) { P_F.panel.hidden = P_D.panel.hidden = true; P_F.btn.setAttribute('aria-expanded', 'false'); P_D.btn.setAttribute('aria-expanded', 'false'); }
    if (S.v !== 'agregar') $('#main').focus({ preventScroll: true });
    return;
  }
  var ch = e.target.closest('[data-clear]');
  if (ch) { var k = ch.dataset.clear, p = withP({}); delete p[k]; go(S.v, p); }
});

/* búsqueda */
var qTimer;
$('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); $('#q').blur(); });
$('#q').addEventListener('input', function (e) {
  var val = e.target.value;
  clearTimeout(qTimer);
  qTimer = setTimeout(function () {
    var v = listView(S.v), replace = S.v === v;
    var p = withP({ q: val.trim() ? val : '', c: '' });
    typing = true; go(v, p, replace); typing = false;
    window.scrollTo(0, 0);
  }, 130);
});
function filterChange(k, val) { go(listView(S.v) === S.v || S.v === 'repaso' ? S.v : 'buscar', withP((function (o) { o[k] = val; o.c = ''; return o; })({}))); }
Object.keys(FILTERUI).forEach(function (k) { $(FILTERUI[k]).addEventListener('change', function (e) { filterChange(k, e.target.value); }); });
$('#fMias').addEventListener('change', function (e) { filterChange('mias', e.target.checked ? '1' : ''); });
$('#fFav').addEventListener('change', function (e) { filterChange('fav', e.target.checked ? '1' : ''); });
$('#btnClear').addEventListener('click', function () { go(S.v === 'favoritas' || S.v === 'repaso' ? S.v : 'buscar', {}); });
$('#fOrd').addEventListener('change', function (e) { go(S.v, withP({ ord: e.target.value }), true); });
$('#fFmt').addEventListener('change', function (e) { FMT = e.target.value; LS.set('fmt', FMT); });

function toggle(btn, panel, other) {
  var open = panel.hidden;
  panel.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (open && other) { other.panel.hidden = true; other.btn.setAttribute('aria-expanded', 'false'); }
}
var P_F = { btn: $('#btnFilters'), panel: $('#filters') }, P_D = { btn: $('#btnData'), panel: $('#dataPanel') };
P_F.btn.addEventListener('click', function () { toggle(P_F.btn, P_F.panel, P_D); });
P_D.btn.addEventListener('click', function () { updateDataStats(); toggle(P_D.btn, P_D.panel, P_F); });
function closePanels() {
  P_F.panel.hidden = P_D.panel.hidden = true;
  P_F.btn.setAttribute('aria-expanded', 'false'); P_D.btn.setAttribute('aria-expanded', 'false');
}
/* los paneles flotan sobre las citas y se cierran al tocar afuera */
document.addEventListener('pointerdown', function (e) {
  if (P_F.panel.hidden && P_D.panel.hidden) return;
  if (e.target.closest('.panel') || e.target.closest('#btnFilters') || e.target.closest('#btnData')) return;
  closePanels();
});
$('#btnFiltersDone').addEventListener('click', closePanels);
$('#btnTheme').addEventListener('click', function () {
  UITHEME = { auto: 'light', light: 'dark', dark: 'auto' }[UITHEME]; LS.set('uitema', UITHEME); applyUITheme();
});

/* exportar / importar */
$('#btnExport').addEventListener('click', function () {
  var data = { version: 1, fav: Array.from(FAV), uso: USO, usolist: USOLIST, temas: TEMAS, mias: MIAS, ocultas: OCULTAS };
  var json = JSON.stringify(data, null, 1);
  function download() {
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'subrayados-mis-datos.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Archivo exportado');
  }
  /* en el celu: menú de compartir (Archivos, WhatsApp, mail), que anda mejor que la descarga dentro de la app instalada */
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  try {
    var file = new File([json], 'subrayados-mis-datos.json', { type: 'application/json' });
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Mis subrayados: mis datos' }).then(function () { toast('Listo'); },
        function (err) { if (err && err.name !== 'AbortError') download(); });
      return;
    }
  } catch (e) {}
  download();
});
$('#btnImport').addEventListener('click', function () { $('#fileImport').click(); });
$('#fileImport').addEventListener('change', function (e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (!d || typeof d !== 'object') throw 0;
      (d.fav || []).forEach(function (i) { FAV.add(i); });
      Object.keys(d.uso || {}).forEach(function (i) { var m = (USO[i] || []).concat(d.uso[i]); USO[i] = m.filter(function (x, k) { return m.indexOf(x) === k; }); });
      (d.usolist || []).forEach(function (u) { if (USOLIST.indexOf(u) < 0) USOLIST.push(u); });
      Object.keys(d.temas || {}).forEach(function (i) { TEMAS[i] = d.temas[i]; });
      (d.mias || []).forEach(function (m) {
        if (!m || !m.id || !m.x || BYID[m.id] || findDup(m.x)) return;
        MIAS.push(m); indexMia(m);
      });
      (d.ocultas || []).forEach(function (id) { var q = BYID[id]; if (q && !q.mia && !q.del) hideQuote(q); });
      saveMias(); refreshAuthors();
      touchAll(); saveMarks(); fillFilters(); route(false); updateDataStats();
      toast('Importado: se sumó a lo que ya tenías');
    } catch (x) { toast('El archivo no es válido'); }
    e.target.value = '';
  };
  r.readAsText(f);
});

/* teclado */
function curCard() {
  var el = document.activeElement && document.activeElement.closest && document.activeElement.closest('.q');
  return el || document.querySelector('.q.cur');
}
function moveCard(dir) {
  var cards = Array.prototype.slice.call(view.querySelectorAll('.q')); if (!cards.length) return;
  var cur = document.querySelector('.q.cur'), i = cards.indexOf(cur);
  if (cur) cur.classList.remove('cur');
  i = i < 0 ? (dir > 0 ? 0 : cards.length - 1) : Math.max(0, Math.min(cards.length - 1, i + dir));
  if (dir > 0 && i >= cards.length - 3) renderMore();
  var n = cards[i]; n.classList.add('cur'); n.focus({ preventScroll: true });
  n.scrollIntoView({ block: 'center', behavior: 'auto' });
}
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var t = e.target, tag = t.tagName, typingIn = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  if (e.key === 'Escape') {
    if (t.id === 'q') {
      if (t.value) { t.value = ''; clearTimeout(qTimer); go(listView(S.v), withP({ q: '' }), true); } else t.blur();
    } else if (!P_F.panel.hidden || !P_D.panel.hidden) {
      P_F.panel.hidden = P_D.panel.hidden = true; P_F.btn.setAttribute('aria-expanded', 'false'); P_D.btn.setAttribute('aria-expanded', 'false');
    } else if (S.p.q) { go(listView(S.v), withP({ q: '' }), true); }
    return;
  }
  if (typingIn) return;
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  else if (e.key === 'j') moveCard(1);
  else if (e.key === 'k') moveCard(-1);
  else if (e.key === 'c' || e.key === 'f') {
    var el = curCard(); if (!el) return;
    var c = { el: el, q: BYID[el.dataset.i] };
    if (e.key === 'c') doCopy(c); else doFav(c);
  }
});

/* ---------- sincronización entre dispositivos ---------- */
function localEntry(k) {
  var i = k.indexOf(':'), kind = i < 0 ? k : k.slice(0, i), id = k.slice(i + 1);
  if (kind === 'fav') return FAV.has(id);
  if (kind === 'uso') return USO[id] || [];
  if (kind === 'temas') return TEMAS[id] || null;
  if (kind === 'usolist') return USOLIST;
  if (kind === 'mia') return MIAS.filter(function (m) { return m.id === id; })[0] || null;
  if (kind === 'oculta') return OCULTAS.indexOf(id) > -1;
  return null;
}
function localEntries() {
  var o = {};
  Object.keys(TS).forEach(function (k) { o[k] = { v: localEntry(k), t: TS[k] }; });
  return o;
}
function allMarkKeys() {
  var ks = ['usolist'];
  FAV.forEach(function (id) { ks.push('fav:' + id); });
  Object.keys(USO).forEach(function (id) { ks.push('uso:' + id); });
  Object.keys(TEMAS).forEach(function (id) { ks.push('temas:' + id); });
  MIAS.forEach(function (m) { ks.push('mia:' + m.id); });
  OCULTAS.forEach(function (id) { ks.push('oculta:' + id); });
  return ks;
}
function touchAll() { var t = Date.now(); allMarkKeys().forEach(function (k) { TS[k] = t; }); saveTS(); scheduleSync(); }
function applyRemote(entries) {
  var changed = false;
  Object.keys(entries).forEach(function (k) {
    var e = entries[k];
    if (!e || typeof e.t !== 'number' || e.t <= (TS[k] || 0)) return;
    TS[k] = e.t; changed = true;
    var i = k.indexOf(':'), kind = i < 0 ? k : k.slice(0, i), id = k.slice(i + 1), v = e.v;
    if (kind === 'fav') { if (v) FAV.add(id); else FAV.delete(id); }
    else if (kind === 'uso') { if (v && v.length) USO[id] = v; else delete USO[id]; }
    else if (kind === 'temas') { if (v) TEMAS[id] = v; else delete TEMAS[id]; }
    else if (kind === 'usolist') { if (v && v.length) USOLIST = v; }
    else if (kind === 'oculta') {
      var q = BYID[id];
      if (q && !q.mia) { if (v && !q.del) hideQuote(q); else if (!v && q.del) restoreQuote(q); }
    }
    else if (kind === 'mia') {
      var cur = BYID[id], mine = MIAS.filter(function (m) { return m.id === id; })[0];
      if (!v) { if (cur && cur.mia) removeMia(id, true); }
      else if (!mine || JSON.stringify(mine) !== JSON.stringify(v)) {
        if (mine) removeMia(id, true);
        var dup = findDup(v.x);
        if (dup) { migrateMarks(id, dup.i); touch('mia:' + id); } else { MIAS.push(v); indexMia(v); }
      }
    }
  });
  if (changed) { saveTS(); saveMarks(); saveMias(); refreshAuthors(); }
  return changed;
}
function ago(ms) {
  var s = Math.round((Date.now() - ms) / 1000);
  return s < 60 ? 'hace un momento' : s < 3600 ? 'hace ' + Math.round(s / 60) + ' min' : s < 86400 ? 'hace ' + Math.round(s / 3600) + ' h' : 'hace ' + Math.round(s / 86400) + ' días';
}
function renderSync() {
  var box = $('#syncBox'); if (!box) return;
  if (!SYNC.key) {
    box.innerHTML = '<h3>Sincronización</h3><p class="muted">Pegá tu clave para que favoritas, citas agregadas y borradas se compartan entre tus dispositivos.</p>' +
      '<div class="row"><input id="syKey" type="password" autocomplete="off" placeholder="Clave de sincronización" aria-label="Clave de sincronización"><button class="btn pri" data-sy="conectar">Conectar</button></div>' +
      (SYNC.err ? '<p class="err">' + esc(SYNC.err) + '</p>' : '');
  } else {
    box.innerHTML = '<h3>Sincronización</h3><p id="syMsg">' + (SYNC.busy ? 'Sincronizando…' : SYNC.err ? esc(SYNC.err) : 'Conectada · ' + (SYNC.last ? 'última vez ' + ago(SYNC.last) : 'todavía sin sincronizar')) + '</p>' +
      '<div class="row"><button class="btn" data-sy="ahora">Sincronizar ahora</button><button class="btn" data-sy="salir">Desconectar</button></div>';
  }
}
function syncFetch(entries) {
  return fetch(SYNC_URL, { method: 'POST', headers: { 'authorization': 'Bearer ' + SYNC.key, 'content-type': 'application/json' }, body: JSON.stringify({ entries: entries }) })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
}
function syncError(e) { return e && e.message === '401' ? 'La clave no es válida' : 'No se pudo sincronizar (sin conexión o el servicio no responde)'; }
function refreshAfterSync() {
  fillFilters(); updateDataStats(); syncControls();
  var a = document.activeElement, busy = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (S.v === 'agregar' || busy) return;
  positions[location.hash] = { y: window.scrollY, n: L.shown }; route(true);
}
function doSync(manual) {
  if (!SYNC.key) return;
  if (SYNC.busy) { SYNC.dirty = true; return; }
  if (navigator.onLine === false) { SYNC.err = 'Sin conexión'; renderSync(); return; }
  SYNC.busy = true; SYNC.err = ''; renderSync();
  syncFetch(localEntries()).then(function (d) {
    var ch = applyRemote(d.entries || {});
    SYNC.last = Date.now(); LS.set('lastsync', SYNC.last);
    if (ch) refreshAfterSync();
    if (manual === true) toast(ch ? 'Sincronizado: había cambios nuevos' : 'Todo al día');
  }).catch(function (e) {
    SYNC.err = syncError(e); if (manual === true) toast(SYNC.err);
  }).then(function () {
    SYNC.busy = false; renderSync();
    if (SYNC.dirty) { SYNC.dirty = false; scheduleSync(); }
  });
}
function connectSync(key) {
  SYNC.key = key; LS.set('synckey', key); SYNC.busy = true; SYNC.err = ''; renderSync();
  syncFetch({}).then(function (d) {
    var remote = d.entries || {}, t = Date.now();
    allMarkKeys().forEach(function (k) { if (!(k in remote) && !(k in TS)) TS[k] = t; });
    saveTS();
    var ch = applyRemote(remote);
    SYNC.last = Date.now(); LS.set('lastsync', SYNC.last); SYNC.busy = false;
    if (ch) refreshAfterSync();
    toast('Sincronización conectada'); renderSync(); doSync();
  }).catch(function (e) {
    SYNC.busy = false; SYNC.key = ''; LS.set('synckey', ''); SYNC.err = e && e.message === '401' ? 'La clave no es válida' : 'No se pudo conectar'; toast(SYNC.err); renderSync();
  });
}
$('#syncBox').addEventListener('click', function (e) {
  var b = e.target.closest('[data-sy]'); if (!b) return;
  if (b.dataset.sy === 'conectar') { var v = ($('#syKey').value || '').trim(); if (v.length >= 24) connectSync(v); else toast('Pegá la clave completa'); }
  else if (b.dataset.sy === 'ahora') doSync(true);
  else if (b.dataset.sy === 'salir') { SYNC.key = ''; LS.set('synckey', ''); renderSync(); toast('Sincronización desconectada'); }
});
document.addEventListener('visibilitychange', function () { if (!document.hidden) doSync(); });
window.addEventListener('online', function () { doSync(); });

/* ---------- arranque ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
applyUITheme();
fillFilters();
updateDataStats();
history.scrollRestoration = 'manual';
(function () {   // enlace de conexión: #/conectar?k=CLAVE
  var m = /^#\/conectar\?k=([\w-]{24,})/.exec(location.hash);
  if (m) { history.replaceState(null, '', location.href.split('#')[0] + '#/buscar'); setTimeout(function () { connectSync(m[1]); }, 300); }
})();
route(false);
renderSync();
if (SYNC.key) setTimeout(doSync, 600);

})();
