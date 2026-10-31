#!/usr/bin/env node
/*
 * Lee desde la nube lo que Juan cargó o borró en sus dispositivos y lo imprime como JSON
 * (mismo formato que "Mis datos -> Exportar": mias, ocultas, fav, uso, temas).
 *
 *   node actualizacion/leer-nube.js > nube.json
 *
 * La clave se toma de la variable SYNC_KEY o del archivo sync-clave.txt (segunda línea), que no se sube al repo.
 * Solo lee: no cambia nada en la nube.
 */
'use strict';
var fs = require('fs'), path = require('path');
var URL_SYNC = 'https://subrayados-sync.juanmartinatencio.workers.dev/sync';
var key = process.env.SYNC_KEY;
var f = path.join(__dirname, '..', 'sync-clave.txt');
if (!key && fs.existsSync(f)) key = (fs.readFileSync(f, 'utf8').split(/\r?\n/)[1] || '').trim();
if (!key) { console.error('Falta la clave: definí SYNC_KEY o creá sync-clave.txt (la clave va en la segunda línea).'); process.exit(1); }

fetch(URL_SYNC, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: '{"entries":{}}' })
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function (d) {
    var out = { mias: [], ocultas: [], fav: [], uso: {}, temas: {} };
    Object.keys(d.entries).forEach(function (k) {
      var e = d.entries[k], i = k.indexOf(':'), kind = i < 0 ? k : k.slice(0, i), id = k.slice(i + 1);
      if (kind === 'mia' && e.v) out.mias.push(e.v);
      else if (kind === 'oculta' && e.v) out.ocultas.push(id);
      else if (kind === 'fav' && e.v) out.fav.push(id);
      else if (kind === 'uso' && e.v && e.v.length) out.uso[id] = e.v;
      else if (kind === 'temas' && e.v) out.temas[id] = e.v;
    });
    process.stdout.write(JSON.stringify(out, null, 1) + '\n');
    console.error('Nube: ' + out.mias.length + ' citas agregadas, ' + out.ocultas.length + ' borradas, ' + out.fav.length + ' favoritas.');
  })
  .catch(function (e) { console.error('No se pudo leer la nube: ' + e.message); process.exit(1); });
