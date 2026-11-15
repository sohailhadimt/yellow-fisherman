// Cloudflare Worker + D1 leads API for The Yellow Fisherman site. Not deployed yet.
// Secrets: OWNER_PASSCODE (dashboard sign-in). Optional ALERT_WEBHOOK (POSTed JSON per new lead,
// e.g. an ntfy.sh topic or a Twilio/SMS relay) for a phone alert on every order.
const cors = (origin) => ({ 'access-control-allow-origin': origin || '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' });
const json = (d, s = 200, o) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', ...cors(o) } });
const clip = (v, n = 300) => String(v ?? '').slice(0, n);
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = env.ALLOWED_ORIGIN || '*';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const authed = () => (req.headers.get('authorization') || '') === 'Bearer ' + env.OWNER_PASSCODE;
    if (url.pathname === '/leads' && req.method === 'POST') {
      const b = await req.json().catch(() => null);
      if (!b || !b.name || !b.phone) return json({ error: 'name and phone required' }, 400, origin);
      const id = 'L' + Date.now().toString(36) + crypto.randomUUID().slice(0, 4);
      const row = [id, new Date().toISOString(), 'New', clip(b.name, 80), clip(b.phone, 30), clip(b.method, 20), clip(b.postcode, 12), clip(b.when, 40), clip(b.notes), JSON.stringify((b.items || []).slice(0, 40).map(x => clip(x, 120))), Number(b.total) || 0, clip(b.source, 40)];
      await env.DB.prepare('INSERT INTO leads (id,created_at,status,name,phone,method,postcode,slot,notes,items,total,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(...row).run();
      if (env.ALERT_WEBHOOK) ctx.waitUntil(fetch(env.ALERT_WEBHOOK, { method: 'POST', body: `New ${row[5]} order £${row[10].toFixed(2)} from ${row[3]} ${row[4]} (${row[7]})` }));
      return json({ ok: true, id }, 201, origin);
    }
    if (url.pathname === '/leads' && req.method === 'GET') {
      if (!authed()) return json({ error: 'unauthorised' }, 401, origin);
      const { results } = await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 500').all();
      return json({ leads: results.map(r => ({ id: r.id, createdAt: r.created_at, status: r.status, name: r.name, phone: r.phone, method: r.method, postcode: r.postcode, when: r.slot, notes: r.notes, items: JSON.parse(r.items || '[]'), total: r.total, source: r.source })) }, 200, origin);
    }
    const m = url.pathname.match(/^\/leads\/([\w-]+)$/);
    if (m && req.method === 'PATCH') {
      if (!authed()) return json({ error: 'unauthorised' }, 401, origin);
      const b = await req.json().catch(() => ({}));
      await env.DB.prepare('UPDATE leads SET status=? WHERE id=?').bind(clip(b.status, 20), m[1]).run();
      return json({ ok: true }, 200, origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },
};
