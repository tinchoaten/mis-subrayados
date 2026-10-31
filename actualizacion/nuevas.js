#!/usr/bin/env node
/*
 * Detecta las citas NUEVAS de un "My Clippings.txt" de Kindle.
 *
 *   node actualizacion/nuevas.js "<My Clippings.txt>"              -> escribe actualizacion/nuevas.json y muestra un resumen
 *   node actualizacion/nuevas.js "<My Clippings.txt>" --registrar  -> marca TODO lo que hay en el archivo como ya visto
 *
 * Cómo decide qué es nuevo: cada entrada tiene una huella (título + fecha y hora + tipo + posición).
 * Es nueva si su huella no está en registro.json. La fecha sirve como alerta, no como filtro:
 * una entrada anterior a la última fecha registrada que no esté en el registro se lista aparte, en "revisar".
 * Solo lee archivos; data.js no se toca desde acá.
 */
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var DIR = __dirname, ROOT = path.join(DIR, '..');
var REG = path.join(DIR, 'registro.json'), OUT = path.join(DIR, 'nuevas.json');
var args = process.argv.slice(2), file = args.filter(function (a) { return a[0] !== '-'; })[0];
if (!file) { console.error('Uso: node actualizacion/nuevas.js "<ruta a My Clippings.txt>" [--registrar]'); process.exit(1); }

var MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function pad(n) { return (n < 10 ? '0' : '') + n; }

function parse(raw) {
  raw = raw.replace(/^﻿/, '').replace(/\r/g, '');
  return raw.split('==========').map(function (e) { return e.replace(/^\n+|\n+$/g, ''); }).filter(Boolean).map(function (e) {
    var l = e.split('\n'), head = l[0].replace(/^﻿/, '').trim(), meta = (l[1] || '').trim(), text = l.slice(2).join('\n').trim();
    var t = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(head), title = t ? t[1] : head, author = t ? t[2] : '';
    var tipo = (/^- (?:La |Tu |El |Mi |Un |Una )?(subrayado|resaltado|nota|marcador)/i.exec(meta) || [])[1];
    tipo = tipo ? tipo.toLowerCase() : '?';
    if (tipo === 'resaltado') tipo = 'subrayado';
    var pg = /p[aá]gina (\d+)/i.exec(meta), ps = /posici[oó]n (\d+)(?:-(\d+))?/i.exec(meta);
    var f = /(\d{1,2}) de (\w+) de (\d{4}) (\d{1,2}):(\d\d)(?::(\d\d))?/.exec(meta), iso = '';
    if (f) iso = f[3] + '-' + pad(MES[f[2].toLowerCase()] || 0) + '-' + pad(+f[1]) + 'T' + pad(+f[4]) + ':' + f[5] + ':' + (f[6] || '00');
    var posIni = ps ? +ps[1] : null, posFin = ps ? +(ps[2] || ps[1]) : null;
    var huella = crypto.createHash('sha1').update([title, iso, tipo, posIni, posFin].join('|')).digest('hex').slice(0, 12);
    return { huella: huella, title: title.trim(), author: author.trim(), tipo: tipo, pag: pg ? pg[1] : '', posIni: posIni, posFin: posFin, iso: iso, text: text };
  });
}
function posTxt(e) { return e.posIni == null ? '' : (e.posFin !== e.posIni ? e.posIni + '–' + e.posFin : String(e.posIni)); }
function fechaCorta(iso) { return iso ? (+iso.slice(8, 10)) + ' ' + MES3[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4) : ''; }
function autorLindo(a) {  // "Susskind, Richard; Susskind, Daniel" -> "Richard Susskind y Daniel Susskind"
  if (!a) return '';
  var p = a.split(';').map(function (x) { var m = /^\s*([^,]+),\s*(.+)$/.exec(x); return m ? m[2].trim() + ' ' + m[1].trim() : x.trim(); }).filter(Boolean);
  return p.length > 1 ? p.slice(0, -1).join(', ') + ' y ' + p[p.length - 1] : p[0] || '';
}

var entradas = parse(fs.readFileSync(file, 'utf8'));
var reg = fs.existsSync(REG) ? JSON.parse(fs.readFileSync(REG, 'utf8')) : { creado: '', ultimaFecha: '', vistos: {} };

if (args.indexOf('--registrar') > -1) {
  var antes = Object.keys(reg.vistos).length;
  entradas.forEach(function (e) { if (!reg.vistos[e.huella]) reg.vistos[e.huella] = e.title + ' | ' + e.iso + ' | ' + e.tipo; if (e.iso > reg.ultimaFecha) reg.ultimaFecha = e.iso; });
  if (!reg.creado) reg.creado = new Date().toISOString().slice(0, 10);
  reg.actualizado = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(REG, JSON.stringify(reg, null, 1));
  console.log('Registro actualizado: ' + antes + ' -> ' + Object.keys(reg.vistos).length + ' entradas. Última fecha: ' + reg.ultimaFecha);
  process.exit(0);
}

/* datos actuales, para mapear libros y detectar repetidas */
global.window = {}; require(path.join(ROOT, 'data.js'));
var DB = window.SUBRAYADOS, LIBROS = DB.books;
var ALIAS = fs.existsSync(path.join(DIR, 'alias.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'alias.json'), 'utf8')) : {};
function libroDe(title) {
  var n = fold(title);
  if (ALIAS[title]) return LIBROS.filter(function (b) { return b.i === ALIAS[title]; })[0] || null;
  return LIBROS.filter(function (b) { var t = fold(b.t); return t === n || (t.length >= 8 && n.indexOf(t) > -1) || (n.length >= 8 && t.indexOf(n) === 0); })[0] || null;
}
var existentes = [];
LIBROS.forEach(function (b) { b.q.forEach(function (q) { existentes.push({ i: q.i, f: fold(q.x) }); }); });
function repetida(texto) {
  var k = fold(texto); if (k.length < 25) return '';
  var ini = k.slice(0, 60);
  for (var i = 0; i < existentes.length; i++) {
    var f = existentes[i].f;
    if (f.indexOf(ini) > -1 || (f.length > 25 && k.indexOf(f.slice(0, 60)) > -1)) return existentes[i].i;
  }
  return '';
}

var sinMarcadores = entradas.filter(function (e) { return e.tipo === 'subrayado' || e.tipo === 'nota'; });
var nuevas = sinMarcadores.filter(function (e) { return !reg.vistos[e.huella]; });
var revisar = nuevas.filter(function (e) { return reg.ultimaFecha && e.iso && e.iso < reg.ultimaFecha; });

/* los subrayados que se fueron ampliando en el momento quedan como uno solo (el más largo) */
var porLibro = {}; nuevas.forEach(function (e) { (porLibro[e.title] = porLibro[e.title] || []).push(e); });
var libros = Object.keys(porLibro).map(function (title) {
  var es = porLibro[title].sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
  var notas = es.filter(function (e) { return e.tipo === 'nota'; }), subs = es.filter(function (e) { return e.tipo === 'subrayado'; }), kept = [], descartadas = 0;
  subs.forEach(function (e) {
    var ult = kept[kept.length - 1];
    var solapa = ult && e.posIni != null && ult.posIni != null && e.posIni <= ult.posFin && e.posFin >= ult.posIni;
    var cerca = ult && (new Date(e.iso) - new Date(ult.iso)) <= 15 * 60 * 1000;
    if (solapa && cerca) {
      descartadas++;
      if (e.text.length >= ult.text.length) { e.fusion = (ult.fusion || [ult.huella]).concat(e.huella); kept[kept.length - 1] = e; }
      else ult.fusion = (ult.fusion || [ult.huella]).concat(e.huella);
    } else kept.push(e);
  });
  var sueltas = [];
  notas.forEach(function (n) {
    var dueno = kept.filter(function (k) { return n.posIni != null && n.posIni >= k.posIni && n.posIni <= k.posFin; })[0];
    if (dueno) (dueno.notas = dueno.notas || []).push(n.text); else sueltas.push({ pos: posTxt(n), fecha: fechaCorta(n.iso), texto: n.text });
  });
  var b = libroDe(title), fechas = kept.map(function (k) { return k.iso; }).filter(Boolean).sort();
  return {
    libroExistente: b ? { codigo: b.i, titulo: b.t, citasActuales: b.q.length, ultimoNumero: Math.max.apply(null, b.q.map(function (q) { return +q.i.split('-').pop(); })) } : null,
    tituloKindle: title, autorSugerido: autorLindo(es[0].author), autorKindle: es[0].author,
    periodoNuevo: fechas.length ? fechaCorta(fechas[0]) + (fechaCorta(fechas[fechas.length - 1]) !== fechaCorta(fechas[0]) ? ' – ' + fechaCorta(fechas[fechas.length - 1]) : '') : '',
    fusionadas: descartadas,
    citas: kept.map(function (k) {
      return { huella: k.huella, fusion: k.fusion || undefined, s: posTxt(k), g: k.pag, d: fechaCorta(k.iso), x: k.text, notas: k.notas || undefined, posibleRepetida: repetida(k.text) || undefined };
    }),
    notasSueltas: sueltas.length ? sueltas : undefined
  };
}).sort(function (a, b) { return a.tituloKindle.localeCompare(b.tituloKindle, 'es'); });

fs.writeFileSync(OUT, JSON.stringify({
  archivo: path.basename(file), generado: new Date().toISOString(), ultimaFechaRegistrada: reg.ultimaFecha,
  entradasEnArchivo: entradas.length, entradasNuevas: nuevas.length,
  revisarFechaAnterior: revisar.map(function (e) { return { title: e.title, fecha: e.iso, texto: e.text.slice(0, 80) }; }),
  libros: libros
}, null, 1));

console.log('Archivo: ' + entradas.length + ' entradas (' + sinMarcadores.length + ' subrayados/notas; el resto son marcadores).');
console.log('Ya registradas: ' + (sinMarcadores.length - nuevas.length) + ' · Nuevas: ' + nuevas.length + ' · Última fecha registrada: ' + (reg.ultimaFecha || '(sin registro)'));
if (revisar.length) console.log('AVISO: ' + revisar.length + ' nuevas tienen fecha ANTERIOR a la última registrada: revisalas (ver "revisarFechaAnterior").');
libros.forEach(function (l) {
  console.log('  - ' + l.tituloKindle + ' -> ' + (l.libroExistente ? l.libroExistente.codigo + ' (existente)' : 'LIBRO NUEVO') + ': ' + l.citas.length + ' citas' + (l.fusionadas ? ' (' + l.fusionadas + ' fusionadas)' : ''));
});
console.log('Detalle en ' + path.relative(process.cwd(), OUT));
