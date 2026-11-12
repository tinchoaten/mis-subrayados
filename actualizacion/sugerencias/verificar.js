#!/usr/bin/env node
/*
 * Verifica cada frase candidata contra una página de Wikiquote que la atribuye y la cita.
 *
 *   node actualizacion/sugerencias/verificar.js [candidatos.json]  > verificadas.json
 *
 * Para cada candidato baja el texto de la página, busca la línea que contiene el fragmento `frag`
 * y devuelve esa línea tal cual (sin marcas de wiki). Si el fragmento no está, el candidato se descarta.
 * Solo lee páginas públicas; no escribe nada fuera del archivo de salida que vos redirigís.
 */
'use strict';
var fs = require('fs'), path = require('path');
var file = process.argv[2] || path.join(__dirname, 'candidatos.json');
var cands = JSON.parse(fs.readFileSync(file, 'utf8'));
var UA = 'mis-subrayados-sugerencias/1.0 (uso personal)';

function limpiar(s) {
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/<ref[^>]*>.*?<\/ref>/g, '').replace(/<[^>]+>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
var cache = {};
function pagina(c) {
  var host = c.lang === 'es' ? 'es' : 'en', key = host + ':' + c.page;
  if (cache[key]) return cache[key];
  var url = 'https://' + host + '.wikiquote.org/w/index.php?title=' + encodeURIComponent(c.page) + '&action=raw';
  return (cache[key] = fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }));
}
var out = [], falta = [];
(async function () {
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i], txt = await pagina(c), host = c.lang === 'es' ? 'es' : 'en';
    var lineas = txt.split('\n'), hit = null, f = fold(c.frag);
    for (var j = 0; j < lineas.length && !hit; j++) {
      var l = limpiar(lineas[j]);
      if (l.length > 20 && fold(l).indexOf(f) > -1) hit = l.replace(/^[*#:;\s]+/, '');
    }
    if (hit) out.push(Object.assign({}, c, { original: hit, url: 'https://' + host + '.wikiquote.org/wiki/' + encodeURIComponent(c.page).replace(/%2F/g, '/') }));
    else falta.push(c.id);
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  console.error('Verificadas: ' + out.length + ' de ' + cands.length + (falta.length ? ' · sin verificar: ' + falta.join(', ') : ''));
})();
