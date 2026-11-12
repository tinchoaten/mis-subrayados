#!/usr/bin/env node
/*
 * Publica un lote de frases sugeridas en la nube privada de Juan (Worker de sincronización).
 *
 *   node actualizacion/sugerencias/publicar.js actualizacion/sugerencias/lote-1.json
 *
 * El lote reemplaza al anterior en la nube. Las respuestas de Juan (guardada, no me interesa, etc.)
 * se conservan por id de frase. La clave sale de SYNC_KEY o de sync-clave.txt (segunda línea); nunca se imprime.
 */
'use strict';
var fs = require('fs'), path = require('path');
var URL_SYNC = 'https://subrayados-sync.juanmartinatencio.workers.dev/sync';
var file = process.argv[2];
if (!file) { console.error('Uso: node actualizacion/sugerencias/publicar.js <lote.json>'); process.exit(1); }
var lote = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!lote.lote || !Array.isArray(lote.items) || !lote.items.length) { console.error('El lote no tiene el formato esperado ({ lote, items:[...] }).'); process.exit(1); }
lote.items.forEach(function (it) { if (!it.id || !it.x || !it.a || !it.u) { console.error('Falta id, texto, autor o fuente en: ' + JSON.stringify(it).slice(0, 80)); process.exit(1); } });

var key = process.env.SYNC_KEY, f = path.join(__dirname, '..', '..', 'sync-clave.txt');
if (!key && fs.existsSync(f)) key = (fs.readFileSync(f, 'utf8').split(/\r?\n/)[1] || '').trim();
if (!key) { console.error('Falta la clave: definí SYNC_KEY o creá sync-clave.txt.'); process.exit(1); }

fetch(URL_SYNC, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ entries: { sug: { v: lote, t: Date.now() } } }) })
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function (d) { console.log('Lote ' + lote.lote + ' publicado: ' + lote.items.length + ' frases. ' + (d.changed ? 'Guardado.' : 'Sin cambios.')); })
  .catch(function (e) { console.error('No se pudo publicar: ' + e.message); process.exit(1); });
