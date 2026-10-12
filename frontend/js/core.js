/* Ramas — frontend sin build. */
"use strict";

const STATUS_LABEL = { inbox: "Inbox", todo: "Por hacer", doing: "Haciendo", review: "Revisión", done: "Hecho", blocked: "Bloqueado" };
const PRIO_LABEL = { 0: "Urgente", 1: "Alta", 2: "Media", 3: "Baja" };
const LOG_LABEL = { summary: "Resumen", decision: "Decisión", question: "Pregunta", blocker: "Bloqueo", note: "Nota", commit: "Commit" };

const S = {
  key: lsGet("ramas.key") || "",
  me: JSON.parse(lsGet("ramas.me") || "null"),
  meta: null, users: [], projects: [], project: null, nodes: [],
  view: "board", openId: null, filter: { who: "all", level: "all", hideDone: false },
  collapsed: new Set(JSON.parse(lsGet("ramas.collapsed") || "[]")),
  selectedId: null,
};

/* ------------------------------------------------------------ utils */
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* sin storage */ } }
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return sec ? `${sec}s` : "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function ago(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
function fmtSize(b) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
function avatarOf(name) {
  if (!name) return "·";
  const u = S.users.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (u) return S.meta?.avatars?.includes(u.avatar) ? u.avatar : "🐥";  // el backend acepta cualquier string: solo se pinta un avatar del catálogo
  return "🤖";
}
function fileUrl(att, dl = false) {
  return `${att.download_path}?k=${encodeURIComponent(S.key)}${dl ? "&dl=1" : ""}`;
}

async function api(path, opts = {}) {
  const headers = { "X-Ramas-Key": S.key };
  if (S.me) headers["X-Ramas-User"] = encodeURIComponent(S.me.name);
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  const r = await fetch(path, { method: opts.method || "GET", headers, body });
  if (r.status === 401) { askKey(); throw new Error("Clave inválida"); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.detail || `Error ${r.status}`), { status: r.status });
  return data;
}
async function run(fn) { try { return await fn(); } catch (e) { toast(e.message, true); } }

/* ------------------------------------------------------------ routing: #/p/<slug>/<view>[/n/<id>] */
function readHash() {
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/(board|flow|tree|metrics))?(?:\/n\/(\d+))?/);
  return m ? { slug: decodeURIComponent(m[1]), view: m[2] === "tree" ? "flow" : (m[2] || "board"), node: m[3] ? +m[3] : null } : null;
}
function go({ slug = S.project?.slug, view = S.view, node = S.openId } = {}) {
  if (view === "tree") view = "flow";
  const h = `#/p/${encodeURIComponent(slug)}/${view}` + (node ? `/n/${node}` : "");
  if (location.hash !== h) location.hash = h; else route();
}
window.addEventListener("hashchange", route);

let _lastRoute = null;
async function route() {
  const h = readHash();
  if (!S.projects.length) return renderMain();
  if (!h) return go({ slug: (lsGet("ramas.project") && S.projects.find((p) => p.slug === lsGet("ramas.project"))?.slug) || S.projects[0].slug, view: "board", node: null });
  const p = S.projects.find((x) => x.slug === h.slug);
  if (!p) return go({ slug: S.projects[0].slug, view: "board", node: null });
  const changed = S.project?.id !== p.id;
  S.project = p; S.view = h.view; lsSet("ramas.project", p.slug);
  if (changed) { await loadNodes(); syncTemplates(); }
  // Si solo cambió el nodo abierto (mismo proyecto y vista que el render anterior) no se re-renderiza: solo el drawer.
  const same = _lastRoute && _lastRoute.id === p.id && _lastRoute.view === h.view;
  _lastRoute = { id: p.id, view: h.view };
  if (!same) { renderChrome(); renderMain(); }
  if (h.node) openNode(h.node); else closeDrawer(false);
}

/* ------------------------------------------------------------ carga */
async function boot() {
  const ping = await fetch("/api/ping").then((r) => r.json()).catch(() => ({ auth: true }));
  if (ping.auth && !S.key) return askKey();
  try {
    [S.meta, S.users, S.projects] = await Promise.all([api("/api/meta"), api("/api/users"), api("/api/projects")]);
  } catch { return; }
  if (!S.me || !S.users.find((u) => u.name === S.me.name)) return askWho();
  renderChrome();
  if (!S.projects.length) return renderMain();
  await route();
}
function select(id) {
  S.selectedId = id ?? null;
  document.dispatchEvent(new CustomEvent("ramas:select", { detail: S.selectedId }));
}
async function loadNodes() { S.nodes = await api(`/api/projects/${S.project.slug}/nodes`); }
async function refresh() {
  if (!S.project) return;
  await loadNodes();
  syncTemplates();
  renderMain();
}
