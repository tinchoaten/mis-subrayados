/*
 * Worker de sincronización de "Mis subrayados" (Cloudflare Workers + KV).
 *
 * Guarda, por cada clave de sincronización, un mapa de entradas { clave: { v: valor, t: marca de tiempo } }.
 * Al recibir entradas, se queda con la más nueva de cada clave (gana la última escritura).
 * La clave de sincronización nunca se guarda: solo se acepta si su huella SHA-256 está en ALLOWED_HASHES.
 *
 * GET  /sync  -> { entries, now }
 * POST /sync  { entries } -> { entries, now, changed }
 */
var MAX = 2000000;
var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, CORS) });
}
async function sha256(s) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    var url = new URL(req.url);
    if (url.pathname !== '/sync') return json({ error: 'not found' }, 404);
    var key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (key.length < 24) return json({ error: 'unauthorized' }, 401);
    var hash = await sha256(key);
    var allowed = (env.ALLOWED_HASHES || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (allowed.indexOf(hash) < 0) return json({ error: 'unauthorized' }, 401);

    var kvKey = 'd:' + hash;
    var data = (await env.KV.get(kvKey, 'json')) || { entries: {} };
    if (req.method === 'GET') return json({ entries: data.entries, now: Date.now() });
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    var text = await req.text();
    if (text.length > MAX) return json({ error: 'too large' }, 413);
    var body; try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    var inc = (body && body.entries) || {}, changed = false;
    Object.keys(inc).forEach(function (k) {
      var e = inc[k];
      if (!e || typeof e.t !== 'number' || k.length > 200) return;
      var cur = data.entries[k];
      if (!cur || e.t > cur.t) { data.entries[k] = { v: e.v, t: e.t }; changed = true; }
    });
    if (changed) await env.KV.put(kvKey, JSON.stringify(data));
    return json({ entries: data.entries, now: Date.now(), changed: changed });
  }
};
