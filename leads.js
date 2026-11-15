import { API_BASE } from './config.js';
const KEY = 'yf_leads_demo';
export const isDemo = () => !API_BASE;
export async function sendLead(lead) {
  lead.id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  lead.createdAt = new Date().toISOString();
  lead.status = 'New';
  if (API_BASE) {
    const r = await fetch(API_BASE + '/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) });
    if (!r.ok) throw new Error('Could not send');
    return r.json();
  }
  const all = JSON.parse(localStorage.getItem(KEY) || '[]');
  all.unshift(lead); localStorage.setItem(KEY, JSON.stringify(all));
  return { ok: true, id: lead.id, demo: true };
}
export async function listLeads(token) {
  if (API_BASE) {
    const r = await fetch(API_BASE + '/leads', { headers: { authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(r.status === 401 ? 'Wrong passcode' : 'Could not load');
    return (await r.json()).leads;
  }
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}
export async function updateLead(token, id, patch) {
  if (API_BASE) {
    await fetch(API_BASE + '/leads/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(patch) });
    return;
  }
  const all = JSON.parse(localStorage.getItem(KEY) || '[]');
  const l = all.find(x => x.id === id); if (l) Object.assign(l, patch);
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function clearDemo() { localStorage.removeItem(KEY); }
