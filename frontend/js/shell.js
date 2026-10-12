"use strict";

/* ------------------------------------------------------------ mobile (mismo corte que extra-mobile.css) */
const MOBILE_MQ = window.matchMedia("(max-width: 720px)");
// cruzar el corte (rotar / redimensionar) re-renderiza la vista activa; shell.js se evalúa una sola vez, así que el listener se registra una sola vez
MOBILE_MQ.addEventListener("change", () => {
  $("#drawer").classList.toggle("is-sheet", MOBILE_MQ.matches);
  FLOW.view = null; // el encuadre del grafo depende de la orientación
  if (S.project) renderMain();
});

/* ------------------------------------------------------------ chrome */
const TAB_LABELS = [["board", "Tablero"], ["flow", "Flujo"], ["metrics", "Métricas"]];

/* Foco: renderChrome reconstruye #topbar/#filters; se recuerda el control activo y se vuelve a enfocar. */
function focusKey() {
  const a = document.activeElement;
  if (!a || !a.closest || !a.closest("#topbar, #filters")) return null;
  if (a.id) return "#" + CSS.escape(a.id);
  for (const k of ["level", "who", "hide", "q", "view"]) {
    if (a.dataset && a.dataset[k] != null) return `[data-${k}="${CSS.escape(a.dataset[k])}"]`;
  }
  return null;
}
function renderChrome() {
  const key = focusKey();
  buildChrome();
  if (key) document.querySelector(`#topbar ${key}, #filters ${key}`)?.focus();
}
/* Mobile: los filtros viven detrás de un botón "Filtros" (junto a las pestañas); abierto/cerrado se guarda en #filters.is-open */
function buildChrome() {
  const filtersOn = S.filter.level !== "all" || S.filter.who !== "all" || S.filter.hideDone;
  const filtersOpen = $("#filters").classList.contains("is-open");
  const projects = S.projects.map((p) => `<option value="${esc(p.slug)}" ${S.project?.id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")
    + `<option value="__new">＋ Nuevo proyecto…</option>`;
  const meName = S.me?.name || "?";
  // TODO backend: estado de conexión real de agentes
  $("#topbar").innerHTML = `<header class="rm-topbar">
    <a class="rm-brand" href="#/" aria-label="Ramas, inicio"><img class="rm-logo" src="/static/img/tsc-logo.png" alt=""><span class="rm-brand__t">Ramas</span><span class="rm-org">TSC</span></a>
    <label class="rm-project"><span class="rm-project__dot"></span><select class="rm-project__sel" id="projectSelect" aria-label="Proyecto">${projects}</select><span class="rm-faint" aria-hidden="true">▾</span></label>
    <nav class="rm-tabs" id="tabs" aria-label="Vista">${TAB_LABELS.map(([v, l]) =>
      `<button class="rm-tab ${S.view === v ? "is-on" : ""}" data-view="${v}" ${S.view === v ? 'aria-current="page"' : ""}>${l}</button>`).join("")}
      ${S.project && S.view !== "metrics" ? `<button type="button" class="rm-btn rm-btn--secondary rm-filters-btn${filtersOn ? " is-active" : ""}" id="filtersBtn" aria-expanded="${filtersOpen}" aria-controls="filters">Filtros${filtersOn ? ` <span class="rm-filters-btn__dot" aria-label="con filtros activos">●</span>` : ""}</button>` : ""}</nav>
    <span class="rm-topbar__spacer"></span>
    <button class="rm-btn rm-btn--secondary rm-agents-btn" id="agentsBtn" title="Conectar Claude / Codex" aria-label="Agentes: conectar Claude / Codex"><span class="rm-livedot" aria-hidden="true"></span><span class="rm-btn__t">Agentes </span><span class="rm-avatar-stack">${Ramas.avatar("claude", { size: "xs" })}${Ramas.avatar("codex", { size: "xs" })}</span></button>
    <button class="rm-btn rm-btn--secondary" id="newIdeaBtn" aria-label="Nueva idea">＋ Idea</button>
    <button class="rm-btn rm-btn--record" id="audioIdeaBtn" title="Grabar una idea por audio">🎙 Idea por audio</button>
    <button class="rm-avatar rm-me" id="meBtn" title="Sos ${esc(meName)} — tocá para cambiar" aria-label="Sos ${esc(meName)}, tocá para cambiar">${esc(S.me?.avatar || "🐥")}</button>
  </header>
  <button class="rm-btn rm-btn--record rm-fab" id="recFab" type="button" aria-label="Grabar una idea por audio"><span aria-hidden="true">🎙</span></button>`;
  const f = S.filter;
  const people = [...new Set([...S.users.map((u) => u.name), ...S.nodes.map((n) => n.assignee).filter(Boolean)])];
  const chip = (on, attrs, inner) => `<button class="rm-chip ${on ? "is-on" : ""}" aria-pressed="${on}" ${attrs}>${inner}</button>`;
  $("#filters").innerHTML = !S.project || S.view === "metrics" ? "" : `
    <div class="rm-filters__group" role="group" aria-label="Persona"><span class="rm-label" aria-hidden="true">Persona</span>
    ${chip(f.who === "all", `data-who="all"`, "Todos")}
    ${people.map((n) => chip(f.who === n, `data-who="${esc(n)}"`, `${Ramas.avatar(personOf(n), { size: "xs" })} ${esc(n)}${personOf(n)?.agent ? `<span class="rm-chip__bot" aria-hidden="true">BOT</span>` : ""}`)).join("")}</div>
    <span class="rm-filters__sep" aria-hidden="true"></span>
    <div class="rm-filters__group" role="group" aria-label="Tipo"><span class="rm-label" aria-hidden="true">Tipo</span>
    ${[["all", "Todo"], ["idea", "Ideas"], ["task", "Tareas"]].map(([v, l]) => chip(f.level === v, `data-level="${v}"`, l)).join("")}
    ${chip(!!f.questions, `data-q="1"`, "Con preguntas ❓")}</div>
    <span class="rm-filters__sep" aria-hidden="true"></span>
    ${chip(f.hideDone, `data-hide="1"`, "Ocultar hechas")}`;
}
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.level) S.filter.level = b.dataset.level;
  if (b.dataset.who) S.filter.who = b.dataset.who;
  if (b.dataset.hide) S.filter.hideDone = !S.filter.hideDone;
  if (b.dataset.q) S.filter.questions = !S.filter.questions;
  renderChrome(); renderMain();
});
$("#topbar").addEventListener("change", (e) => {
  if (e.target.id !== "projectSelect") return;
  if (e.target.value === "__new") { e.target.value = S.project?.slug || ""; return newProject(); }
  S.filter.who = "all";
  go({ slug: e.target.value, node: null });
});
$("#topbar").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.view) { if (S.project) go({ view: b.dataset.view }); }
  else if (b.id === "meBtn") askWho();
  else if (b.id === "newIdeaBtn") S.project ? newIdea() : newProject();
  else if (b.id === "audioIdeaBtn" || b.id === "recFab") S.project ? audioIdea() : newProject();
  else if (b.id === "agentsBtn") showAgents();
  else if (b.id === "filtersBtn") { const open = $("#filters").classList.toggle("is-open"); b.setAttribute("aria-expanded", String(open)); }
});

/* ------------------------------------------------------------ toasts (.rm-toast, Toast.html) */
// Asignación (no declaración) para sobrescribir el toast mínimo de core.js sin duplicar la definición top-level.
const MS_PER_S = 1000;
function parseCssTime(v) {
  const m = /^\s*(-?\d*\.?\d+)(ms|s)\s*$/.exec(String(v || ""));
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2] === "s" ? MS_PER_S : 1);
}
// Resuelve --rm-toast-life (calc de tokens) a ms usando un probe con animation-delay; 0 si no se puede.
function toastLife(el) {
  try {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;animation-delay:var(--rm-toast-life)";
    el.appendChild(probe);
    const v = getComputedStyle(probe).animationDelay;
    probe.remove();
    const first = String(v || "").split(",")[0];
    return Math.max(0, parseCssTime(first));
  } catch { return 0; }
}
window.toast = function toast(msg, err = false) {
  const t = document.createElement("div");
  t.className = "rm-toast" + (err ? " rm-toast--error" : " rm-toast--success");
  t.setAttribute("role", err ? "alert" : "status");
  t.innerHTML = `<span class="rm-toast__icon" aria-hidden="true">${err ? "!" : "✓"}</span><div><div class="rm-toast__title">${esc(msg)}</div></div><button class="rm-iconbtn" aria-label="Cerrar">×</button>`;
  t.querySelector("button").onclick = () => t.remove();
  $("#toasts").appendChild(t);
  // Vida del toast = --rm-toast-life (extra-shell.css, derivada de --dur-slow). Nunca lanza; si no se puede leer, se cierra al terminar la animación.
  const life = toastLife(t);
  if (life > 0) setTimeout(() => t.remove(), life);
  else t.addEventListener("animationend", () => t.remove());
};

function visible(nodes) {
  const f = S.filter;
  return nodes.filter((n) => (f.level === "all" || n.kind === f.level)
    && (f.who === "all" || n.assignee === f.who || (!n.assignee && n.created_by === f.who))
    && !(f.hideDone && n.status === "done")
    && !(f.questions && !(n.open_questions > 0)));
}
function rootOf(n) {
  let cur = n, guard = 0;
  while (cur?.parent_id && guard++ < 50) cur = S.nodes.find((x) => x.id === cur.parent_id) || null;
  return cur && cur.id !== n.id ? cur : null;
}

/* ------------------------------------------------------------ vistas */
function renderMain() {
  const main = $("#main");
  if (S.view !== "flow") FLOW.ro?.disconnect(); // el observer de alturas del árbol solo vive en Flujo
  if (!S.projects.length) {
    main.innerHTML = `<div class="rm-empty"><div class="rm-empty__icon" aria-hidden="true">◉</div><h2 class="rm-empty__title">Todavía no hay proyectos</h2>
      <p>Cada proyecto tiene su propio tablero.</p><button class="rm-btn rm-btn--primary" id="firstProj">Crear el primero</button></div>`;
    $("#firstProj").onclick = newProject;
    return;
  }
  if (!S.project) return;
  if (S.view === "board") renderBoard(main);
  else if (S.view === "flow") renderFlow(main);
  else renderMetrics(main);
}

