"use strict";

/* Métricas (T9). Render con clases rm-* del design system. */
let _metricsSeq = 0;

function _mxDur(sec) { return sec == null || !(sec > 0) ? "—" : fmtDur(sec); }

function _mxKpiVal(sec) {
  // 10h 40m → 10<small>h</small> 40<small>m</small> (el texto sigue leyéndose igual)
  const t = _mxDur(sec);
  return t === "—" ? t : esc(t).replace(/(\d+)([dhms])/g, "$1<small>$2</small>");
}

function _mxPerson(name) {
  if (!name || name === "—") return `<span class="rm-who rm-faint">${Ramas.avatar(null, { size: "sm" })}Sin asignar</span>`;
  let p = Ramas.PEOPLE[name];
  // Nombre desconocido = agente (misma regla que adapter.js/syncTemplates).
  if (!p) p = { id: name, name, emoji: "🤖", agent: true };
  return `<span class="rm-who">${Ramas.avatar(p, { size: "sm" })}<span class="${p.agent ? "rm-who__name--agent" : ""}">${esc(p.name)}</span>${p.agent ? `<span class="rm-metrics__bot">BOT</span>` : ""}</span>`;
}

function _mxProgress(done, total) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return `<div class="rm-progress" role="img" aria-label="${done} de ${total} ramas hechas"><div class="rm-progress__track">${
    total && done ? `<span class="rm-progress__seg rm-progress__seg--done" style="width:${(100 * done / total).toFixed(1)}%"></span>` : ""}</div>
    <div class="rm-progress__meta"><span>${total ? pct + "%" : "sin ramas"}</span><span>${done}/${total}</span></div></div>`;
}

// Barra proporcional al máximo (texto con el valor siempre al lado: no depende solo del color).
function _mxBar(sec, max, color) {
  const w = max > 0 && sec > 0 ? Math.max(2, Math.round((100 * sec) / max)) : 0;
  return `<div class="rm-bar" style="--_c:var(${color})" aria-hidden="true"><i style="width:${w}%"></i></div>`;
}
const _MX_STATUS_COLOR = { done: "--color-status-done", review: "--color-status-review", blocked: "--color-status-blocked" };

function _mxRowAttrs(id) { return `class="rm-metrics__row" data-id="${+id}" tabindex="0"`; }
function _mxLink(id) { return `<a class="rm-metrics__link" href="#/p/${encodeURIComponent(S.project.slug)}/metrics/n/${+id}">`; }

function _mxSkeleton() {
  const kp = Array.from({ length: 6 }, () => `<div class="rm-kpi is-loading"><span class="rm-skel rm-metrics__sk-label"></span><span class="rm-skel rm-metrics__sk-value"></span></div>`).join("");
  const rows = Array.from({ length: 4 }, () => `<span class="rm-skel rm-metrics__sk-row"></span>`).join("");
  return `<div class="rm-metrics" aria-busy="true" aria-label="Cargando métricas"><div class="rm-metrics__kpis">${kp}</div>
    <section class="rm-metrics__box">${rows}</section><section class="rm-metrics__box">${rows}</section></div>`;
}

function _mxHtml(m) {
  const t = m.totals;
  const kpi = (label, val, color, sub) => `<div class="rm-kpi" style="--_c:var(${color})"><span class="rm-label">${label}</span><span class="rm-kpi__value metric-xl">${val}</span><span class="rm-kpi__delta">${sub}</span></div>`;
  const kpis = [
    kpi("Tareas hechas", `${t.done}<small>/${t.nodes}</small>`, "--color-status-done", "de todos los nodos"),
    kpi("En curso", `${t.doing}`, "--color-status-doing", "haciendo ahora"),
    kpi("Tiempo trabajado", _mxKpiVal(t.work_seconds), "--color-accent", "mientras estaban en Haciendo"),
    kpi("Promedio por tarea", _mxKpiVal(t.avg_task_seconds), "--color-status-review", "sobre tareas hechas"),
    kpi("Preguntas abiertas", `${t.open_questions}`, "--color-status-doing", t.open_questions ? "esperan respuesta" : "nada pendiente"),
    kpi("Bloqueadas", `${t.blocked}`, "--color-status-blocked", t.blocked ? "necesitan ayuda" : "nada trabado"),
  ].join("");
  const empty = (cols, msg) => `<tr><td colspan="${cols}" class="rm-table__empty">${msg}</td></tr>`;
  const roots = m.roots.map((r) => `<tr ${_mxRowAttrs(r.id)}>
      <td>${_mxLink(r.id)}<span class="rm-id">R-${+r.id}</span>&nbsp; ${r.kind === "idea" ? "◉ " : ""}${esc(r.title)}</a></td>
      <td>${Ramas.pill(r.status)}</td>
      <td class="num">${r.branches}</td>
      <td>${_mxProgress(r.done, r.branches)}</td>
      <td class="num">${_mxDur(r.work_seconds)}</td>
      <td class="num">${r.open_questions || "—"}</td>
      <td class="num">${r.lead_seconds != null ? _mxDur(r.lead_seconds) : "—"}</td></tr>`).join("") || empty(7, "Sin ideas todavía");
  const maxP = Math.max(0, ...m.people.map((p) => p.work_seconds || 0));
  const maxS = Math.max(0, ...m.slowest.map((x) => x.work_seconds || 0));
  const isAgent = (n) => !!(Ramas.PEOPLE[n] ? Ramas.PEOPLE[n].agent : n && n !== "—");
  const people = m.people.map((p) => `<tr>
      <td>${_mxPerson(p.name)}</td><td class="num">${p.done}</td><td class="num">${p.assigned_open}</td>
      <td class="rm-metrics__time"><span class="rm-metrics__t">${_mxDur(p.work_seconds)}</span>${_mxBar(p.work_seconds, maxP, isAgent(p.name) ? "--color-agent" : "--color-human")}</td><td class="num">${p.logs}</td><td class="num">${p.created}</td></tr>`).join("") || empty(6, "Sin actividad todavía");
  const slow = m.slowest.map((x) => `<tr ${_mxRowAttrs(x.id)}>
      <td>${_mxLink(x.id)}<span class="rm-id">R-${+x.id}</span>&nbsp; ${esc(x.title)}</a></td><td>${Ramas.pill(x.status)}</td>
      <td>${x.assignee ? _mxPerson(x.assignee) : ""}</td><td class="rm-metrics__time"><span class="rm-metrics__t">${_mxDur(x.work_seconds)}</span>${_mxBar(x.work_seconds, maxS, _MX_STATUS_COLOR[x.status] || "--color-status-doing")}</td></tr>`).join("")
    || empty(4, "El tiempo se mide mientras una tarea está en “Haciendo”.");
  return `<div class="rm-metrics">
    <div class="rm-metrics__head"><span class="rm-label">// ${esc(S.project.name)}</span><h1>Métricas</h1></div>
    <div class="rm-metrics__kpis">${kpis}</div>
    <div class="rm-metrics__two">
    <section class="rm-metrics__box"><h2>Ideas y sus ramas</h2><div class="rm-metrics__scroll"><table class="rm-table">
      <thead><tr><th>Idea</th><th>Estado</th><th class="num">Ramas</th><th>Avance</th><th class="num">Tiempo</th><th class="num">❓</th><th class="num">Lead time</th></tr></thead>
      <tbody>${roots}</tbody></table></div></section>
    <section class="rm-metrics__box"><h2>Quién hizo qué</h2><div class="rm-metrics__scroll"><table class="rm-table">
      <thead><tr><th>Persona / agente</th><th class="num">Cerradas</th><th class="num">Abiertas asignadas</th><th class="num">Tiempo en tareas asignadas</th><th class="num">Entradas de bitácora</th><th class="num">Creadas</th></tr></thead>
      <tbody>${people}</tbody></table></div></section></div>
    <section class="rm-metrics__box"><h2>Lo que más tiempo llevó</h2><div class="rm-metrics__scroll"><table class="rm-table">
      <thead><tr><th>Nodo</th><th>Estado</th><th>Responsable</th><th class="num">Tiempo</th></tr></thead>
      <tbody>${slow}</tbody></table></div></section></div>`;
}

async function renderMetrics(main, retry = false) {
  const slug = S.project.slug;
  const seq = ++_metricsSeq;
  const stale = () => seq !== _metricsSeq || S.view !== "metrics" || S.project?.slug !== slug || !main.isConnected;
  main.innerHTML = _mxSkeleton();
  let m;
  try {
    m = await api(`/api/projects/${encodeURIComponent(slug)}/metrics`);
  } catch (e) {
    if (stale()) return;
    main.innerHTML = `<div class="rm-metrics"><div class="rm-card is-error rm-metrics__state" role="alert">
      <div class="rm-card__error"><span aria-hidden="true">⚠</span> No pudimos cargar las métricas: ${esc(e.message)}</div>
      <button class="rm-btn" id="mxRetry">Reintentar</button></div></div>`;
    main.querySelector("#mxRetry").onclick = () => renderMetrics(main, true);
    return;
  }
  if (stale()) return;
  if (!Object.keys(Ramas.PEOPLE).length) syncTemplates();
  if (!m.totals.nodes) {
    main.innerHTML = `<div class="rm-metrics"><div class="rm-card is-empty rm-metrics__state"><div aria-hidden="true">◉</div>
      <p>Todavía no hay datos. Creá una idea y empezá a mover tareas.</p></div></div>`;
    return;
  }
  main.innerHTML = _mxHtml(m);
  const open = (tr) => go({ node: +tr.dataset.id });
  main.querySelectorAll(".rm-metrics__link").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go({ node: +a.closest("tr").dataset.id }); }));
  main.querySelectorAll("tr.rm-metrics__row").forEach((tr) => {
    tr.onclick = () => open(tr);
    tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(tr); } };
  });
}
