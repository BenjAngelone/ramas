"use strict";

/* Adapter: nodo de la API -> nodo de plantilla (Ramas.NODES / Ramas.PEOPLE).
   No escapa: Ramas.card/Ramas.esc escapan al renderizar. */
const PRIO_KEY = { 0: "urgent", 1: "high", 2: "medium", 3: "low" };
const AGENT_NAMES = ["claude", "codex"];

function toTplNode(n) {
  const counts = {};
  if (n.audio_count > 0) counts.audio = n.audio_count;
  if (n.image_count > 0) counts.img = n.image_count;
  if (n.link_count > 0) counts.link = n.link_count;
  if (n.open_questions > 0) counts.q = n.open_questions;
  if (n.work_seconds_total > 0) counts.time = fmtDur(n.work_seconds_total);
  const t = {
    id: "R-" + n.id,
    parent: n.parent_id == null ? null : "R-" + n.parent_id,
    kind: n.kind,
    title: n.title,
    status: n.status,
    prio: PRIO_KEY[n.priority] || "medium",
    owner: n.assignee || null,
    counts,
    _id: n.id,
    _parent: n.parent_id == null ? null : n.parent_id,
  };
  if (n.audio_count > 0) t.origin = { name: "audio", dur: "—" };
  return t;
}

function syncTemplates() {
  Ramas.NODES.splice(0, Ramas.NODES.length, ...S.nodes.map(toTplNode));
  for (const k of Object.keys(Ramas.PEOPLE)) delete Ramas.PEOPLE[k];
  const users = new Set();
  for (const u of S.users) { Ramas.PEOPLE[u.name] = { id: u.name, name: u.name, emoji: S.meta?.avatars?.includes(u.avatar) ? u.avatar : "🐥" }; users.add(u.name); }
  const agents = new Set(AGENT_NAMES);
  for (const n of S.nodes) for (const w of [n.assignee, n.created_by]) if (w && !users.has(w)) agents.add(w);
  for (const a of agents) if (!users.has(a)) Ramas.PEOPLE[a] = { id: a, name: a, emoji: "🤖", agent: true };
}
