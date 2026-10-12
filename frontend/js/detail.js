"use strict";

/* ------------------------------------------------------------ helpers de diálogo (sobre modal()/closeModal()) */
function dialogModal({ title, bodyHtml, okText, cancelText = "Cancelar", danger = false, focus = "field" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    let done = false;
    let hasField = false;
    const cancelValue = () => (hasField ? null : false);
    const mo = new MutationObserver(() => { if (!$("#modal").classList.contains("on")) finish(cancelValue(), true); });
    const finish = (v, external = false) => {
      if (done) return; done = true;
      mo.disconnect();
      if (!external) closeModal();
      if (prev && prev.isConnected && prev.focus) prev.focus();
      resolve(v);
    };
    modal(`<div class="rm-modal rm-dlg">
        <div class="rm-modal__head"><div><div class="rm-label rm-dlg__eyebrow">${danger ? "Confirmar" : "Ramas"}</div><h2 class="rm-modal__title" id="dlgTitle">${esc(title)}</h2></div>
          <button type="button" class="rm-iconbtn" id="dlgX" aria-label="Cerrar">×</button></div>
        <div class="rm-modal__body">${bodyHtml}</div>
        <div class="rm-modal__foot"><button type="button" class="rm-btn rm-btn--ghost" id="dlgCancel">${esc(cancelText)}</button>
          <button type="button" class="rm-btn ${danger ? "rm-btn--danger" : "rm-btn--primary"}" id="dlgOk">${esc(okText)}</button></div>
      </div>`, (m) => {
      const box = m.querySelector(".modal");
      box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "dlgTitle");
      const field = m.querySelector("#dlgField");
      hasField = !!field;
      mo.observe(m, { attributes: true, attributeFilter: ["class"] });
      const value = () => (field ? field.value : true);
      const cancel = () => finish(field ? null : false);
      m.onclick = (e) => { if (e.target === m) cancel(); };
      m.querySelector("#dlgX").onclick = cancel;
      m.querySelector("#dlgCancel").onclick = cancel;
      m.querySelector("#dlgOk").onclick = () => finish(value());
      box.onkeydown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); return; }
        if (e.key === "Enter" && field && ((field.tagName === "INPUT" && e.target === field) || (e.ctrlKey || e.metaKey))) { e.preventDefault(); finish(value()); return; }
        if (e.key === "Tab") {
          const f = [...box.querySelectorAll("button, input, textarea, select, [href]")].filter((x) => !x.disabled);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      const target = field || (focus === "cancel" ? m.querySelector("#dlgCancel") : m.querySelector("#dlgOk"));
      target.focus();
      if (field && field.select) field.select();
    });
  });
}
/* → Promise<boolean> */
function confirmModal(message, { danger = false, title = "¿Seguro?", okText } = {}) {
  return dialogModal({
    title, danger, okText: okText || (danger ? "Eliminar" : "Aceptar"), focus: danger ? "cancel" : "ok",
    bodyHtml: `<p class="rm-dlg__msg">${esc(message)}</p>`,
  });
}
/* → Promise<string|null> (null = canceló) */
function promptModal(title, { label = "", value = "", placeholder = "", okText = "Guardar", multiline = false } = {}) {
  const f = multiline
    ? `<textarea class="rm-textarea" id="dlgField" rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input class="rm-input" id="dlgField" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
  return dialogModal({
    title, okText,
    bodyHtml: `<label class="rm-field">${label ? `<span class="rm-field__label">${esc(label)}</span>` : ""}${f}</label>`,
  });
}

/* ------------------------------------------------------------ detalle */
let drawerOpener = null, drawerOpenerCard = null;
function syncTopbarH() {
  const t = $("#topbar");
  document.documentElement.style.setProperty("--rm-topbar-h", `${t ? Math.round(t.getBoundingClientRect().height) : 0}px`);
}
if (typeof ResizeObserver !== "undefined" && $("#topbar")) new ResizeObserver(syncTopbarH).observe($("#topbar"));
window.addEventListener("resize", syncTopbarH);
function closeMoreMenu(refocus = false) {
  const m = $("#moreMenu"), b = $("#moreBtn");
  if (!m || m.hidden) return false;
  m.hidden = true; b?.setAttribute("aria-expanded", "false");
  if (refocus) b?.focus({ preventScroll: true });
  return true;
}
document.addEventListener("click", (e) => { if (!e.target.closest?.(".rm-more")) closeMoreMenu(); });
function fitTitle() {
  const t = $("#dTitle");
  if (!t) return;
  t.style.removeProperty("--h");
  t.style.setProperty("--h", `${t.scrollHeight + t.offsetHeight - t.clientHeight}px`);
}
window.addEventListener("resize", fitTitle);
function setDrawerOn(on) {
  syncTopbarH();
  for (const sel of ["#drawer", "#scrim"]) { const el = $(sel); el.classList.toggle("on", on); el.classList.toggle("is-on", on); }
  $("#drawer").setAttribute("aria-hidden", on ? "false" : "true");
  if (on) $("#drawer").setAttribute("aria-modal", "true"); else $("#drawer").removeAttribute("aria-modal");
}
let lightboxClose = null;
const FOCUSABLE = "a[href], button, input, textarea, select, summary, [tabindex]:not([tabindex='-1'])";
function copyText(text, okMsg) {
  Promise.resolve().then(() => navigator.clipboard.writeText(text)).then(() => toast(okMsg), () => toast("No se pudo copiar", true));
}
function trapTab(e, root) {
  const f = [...root.querySelectorAll(FOCUSABLE)].filter((x) => !x.disabled && !x.hidden && x.offsetParent !== null);
  if (!f.length) { e.preventDefault(); root.focus(); return; }
  const first = f[0], last = f[f.length - 1], a = document.activeElement;
  if (!root.contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && (a === first || a === root)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}
async function openNode(id) {
  const n = await api(`/api/nodes/${id}`).catch(() => null);
  if (!n) { toast("Esa tarea ya no existe", true); return go({ node: null }); }
  const d = $("#drawer");
  const wasOn = d.classList.contains("is-on");
  if (!wasOn) { drawerOpener = document.activeElement; drawerOpenerCard = drawerOpener?.closest?.(".rm-card")?.dataset.id || null; }
  S.openId = id;
  renderDrawer(n);
  setDrawerOn(true);
  select(id);
  if (!wasOn) (d.querySelector("#closeD") || d).focus({ preventScroll: true });
}
function closeDrawer(nav = true) {
  const wasOn = $("#drawer").classList.contains("is-on");
  S.openId = null;
  setDrawerOn(false);
  // si el re-render (poll) reemplazó la tarjeta que abrió el panel, se busca la nueva por id
  const back = drawerOpener?.isConnected ? drawerOpener : (drawerOpenerCard && document.querySelector(`#main .rm-card[data-id="${CSS.escape(drawerOpenerCard)}"]`)) || null;
  if (wasOn && back?.focus) back.focus({ preventScroll: true });
  drawerOpener = null; drawerOpenerCard = null;
  if (nav && readHash()?.node) go({ node: null });
}
$("#scrim").onclick = () => closeDrawer();
document.addEventListener("keydown", (e) => {
  // con una grabación activa el panel flotante (#recorder) es el foco: ni Tab se le devuelve al panel ni Esc lo cierra
  if (e.defaultPrevented || recState) return;
  if (e.key === "Tab") {
    const lb = $(".rm-lightbox");
    if (lb) { trapTab(e, lb); return; }
    if ($("#modal").classList.contains("on")) return;
    if ($("#drawer").classList.contains("is-on")) trapTab(e, $("#drawer"));
    return;
  }
  if (e.key !== "Escape") return;
  if (lightboxClose) { e.preventDefault(); lightboxClose(); return; }
  if (closeMoreMenu(true)) { e.preventDefault(); return; }
  if ($("#modal").classList.contains("on")) return;
  if ($("#drawer").classList.contains("is-on") && !e.target.closest("input,textarea")) closeDrawer();
});

function userOptions(selected) {
  const names = [...new Set([...S.users.map((u) => u.name), "claude", "codex", selected].filter(Boolean))];
  return `<option value="">— sin asignar —</option>` + names.map((n) => `<option value="${esc(n)}" ${n === selected ? "selected" : ""}>${esc(avatarOf(n))} ${esc(n)}</option>`).join("");
}

function personOf(name) {
  if (!name) return null;
  const P = Ramas.PEOPLE;
  if (P[name]) return P[name];
  const k = Object.keys(P).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k ? P[k] : { id: name, name, emoji: "🤖", agent: true };
}
const avOf = (name, size = "xs") => Ramas.avatar(personOf(name), { size });
const nodeHref = (id) => `#/p/${encodeURIComponent(S.project?.slug || "")}/${S.view}/n/${id}`;
function safeUrl(u) { return /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "#"; }
function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }
function mmss(sec) {
  if (!isFinite(sec) || sec < 0) return "--:--";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function renderDrawer(n) {
  const d = $("#drawer");
  const focusedId = d.contains(document.activeElement) ? document.activeElement.id : "";
  const openQ = n.logs.filter((l) => l.kind === "question" && !l.resolved).length;
  const doneKids = n.children.filter((c) => c.status === "done").length;
  const cnt = {
    audio: n.attachments.filter((a) => a.kind === "audio").length,
    img: n.attachments.filter((a) => a.kind === "image").length,
    link: n.attachments.filter((a) => a.kind === "link").length,
    q: openQ,
    time: n.work_seconds_total ? fmtDur(n.work_seconds_total) : "",
  };
  d.className = "drawer rm-sidepanel" + (MOBILE_MQ.matches ? " is-sheet" : "") + (d.classList.contains("is-on") ? " on is-on" : "");
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-label", `Detalle de R-${n.id}`);
  d.tabIndex = -1;
  const crumbs = n.ancestors.map((a) =>
    `<a href="${nodeHref(a.id)}" data-go="${a.id}"><span class="rm-id">R-${a.id}</span><span class="rm-crumb__t">${esc(a.title)}</span></a><span class="rm-crumbs__sep" aria-hidden="true">›</span>`).join("");
  d.innerHTML = `
    <header class="rm-panel__head">
      <div class="rm-panel__bar">
        <nav class="rm-crumbs" aria-label="Ancestros">${crumbs}<span class="rm-id rm-crumb__cur" aria-current="page">R-${n.id}</span></nav>
        <span class="rm-sidepanel__acts">
          <button type="button" class="rm-btn rm-btn--ghost rm-btn--sm" id="copyLink" title="Copiar link">Copiar link</button>
          <button type="button" class="rm-iconbtn" id="flowBtn" title="Ver en flujo" aria-label="Ver en flujo">⌖</button>
          <span class="rm-more"><button type="button" class="rm-iconbtn" id="moreBtn" aria-label="Más acciones" aria-haspopup="menu" aria-expanded="false" aria-controls="moreMenu">⋯</button>
            <div class="rm-more__menu" id="moreMenu" role="menu" aria-label="Más acciones" hidden>
              <button type="button" class="rm-btn rm-btn--ghost rm-btn--sm rm-more__item" role="menuitem" id="copyRef" title="Copiar referencia para commits">Copiar referencia #R-${n.id}</button>
              <button type="button" class="rm-btn rm-btn--ghost rm-btn--sm rm-more__item rm-more__item--danger" role="menuitem" id="delMenu">Eliminar R-${n.id}</button>
            </div></span>
          <button type="button" class="rm-iconbtn" id="closeD" aria-label="Cerrar">×</button>
        </span>
      </div>
      <textarea class="rm-title-edit rm-detail-title" id="dTitle" rows="1" aria-label="Título" spellcheck="false">${esc(n.title)}</textarea>
      <div class="rm-detail-meta">
        ${Ramas.pill(n.status)}${Ramas.prio(PRIO_KEY[n.priority] || "medium")}
        ${n.created_by ? `<span class="rm-detail-by">Creada por ${avOf(n.created_by)} ${esc(n.created_by)} · ${esc(ago(n.created_at))}</span>` : ""}
      </div>
      ${Ramas.counts(cnt, n.children.length ? [doneKids, n.children.length] : null)}
    </header>
    <div class="rm-panel__body">
      <dl class="rm-props">
        <dt><label for="fStatus">Estado</label></dt><dd><select class="rm-select" id="fStatus">${S.meta.statuses.map((s) => `<option value="${s}" ${s === n.status ? "selected" : ""}>${esc(STATUS_LABEL[s])}</option>`).join("")}</select></dd>
        <dt><label for="fPrio">Prioridad</label></dt><dd><select class="rm-select" id="fPrio">${[0, 1, 2, 3].map((p) => `<option value="${p}" ${p === n.priority ? "selected" : ""}>${esc(PRIO_LABEL[p])}</option>`).join("")}</select></dd>
        <dt><label for="fWho">Responsable</label></dt><dd>${avOf(n.assignee)}<select class="rm-select" id="fWho">${userOptions(n.assignee)}</select></dd>
        <dt><label for="fKind">Tipo</label></dt><dd><select class="rm-select" id="fKind"><option value="idea" ${n.kind === "idea" ? "selected" : ""}>Idea</option><option value="task" ${n.kind === "task" ? "selected" : ""}>Tarea</option></select></dd>
      </dl>

      <section class="rm-section"><div class="rm-section__title"><label class="rm-label" for="fDesc">Descripción</label></div>
        <textarea class="rm-textarea" id="fDesc" rows="4" placeholder="Descripción, contexto, criterios de aceptación…">${esc(n.description)}</textarea></section>

      <section class="rm-section"><div class="rm-section__title"><span class="rm-label">Adjuntos · ${n.attachments.length}</span>
          <span class="rm-sidepanel__acts">
            <button type="button" class="rm-btn rm-btn--ghost rm-btn--sm" id="upBtn">＋ Archivo / imagen</button>
            <button type="button" class="rm-btn rm-btn--ghost rm-btn--sm" id="linkBtn">＋ Link</button>
            <button type="button" class="rm-btn rm-btn--record rm-btn--sm" id="recBtn">● Grabar</button>
            <input type="file" id="fileIn" multiple hidden>
          </span></div>
        <p class="rm-field__help">También podés pegar una imagen con Ctrl+V.</p>
        <div id="linkRow" class="rm-detail-add" hidden><input class="rm-input" id="linkUrl" placeholder="https://…" aria-label="URL"><input class="rm-input" id="linkTitle" placeholder="Título (opcional)" aria-label="Título del link"><button type="button" class="rm-btn rm-btn--secondary rm-btn--sm" id="linkSave">Agregar</button></div>
        <div id="atts" class="rm-atts">${n.attachments.map(attHtml).join("") || `<p class="rm-field__help">Sin adjuntos.</p>`}</div>
      </section>

      <section class="rm-section"><div class="rm-section__title"><span class="rm-label">Ramas · ${doneKids}/${n.children.length}</span>${n.children.length ? `<div class="rm-progress" role="img" aria-label="${doneKids} de ${n.children.length} ramas hechas"><div class="rm-progress__track">${doneKids ? `<span class="rm-progress__seg rm-progress__seg--done" style="--w:${(100 * doneKids / n.children.length).toFixed(1)}%"></span>` : ""}</div></div>` : ""}</div>
        ${n.children.length ? `<div class="rm-branches">${n.children.map((c) => `<a class="rm-branch" href="${nodeHref(c.id)}" data-go="${c.id}"><span class="rm-branch__line"></span><span class="rm-id">R-${c.id}</span><span class="rm-branch__t">${esc(c.title)}</span>${Ramas.pill(c.status)}${avOf(c.assignee)}</a>`).join("")}</div>` : ""}
        <div class="rm-detail-add"><span class="rm-inputwrap rm-detail-grow"><span class="rm-inputwrap__icon" aria-hidden="true">⑂</span><input class="rm-input" id="kidIn" placeholder="Agregá una rama y apretá Enter (pegá varias líneas para crear varias)" aria-label="Nueva rama"></span><button type="button" class="rm-btn rm-btn--secondary rm-btn--sm" id="kidAdd" aria-label="Agregar rama">＋</button></div>
      </section>

      <section class="rm-section"><div class="rm-section__title"><span class="rm-label">Bitácora · ${n.logs.length}</span>${openQ ? Ramas.counts({ q: openQ }) : ""}</div>
        <div class="rm-detail-add">
          <input class="rm-input rm-detail-grow" id="logIn" placeholder="Qué pasó, qué se decidió, qué falta…" aria-label="Nueva entrada de bitácora">
          <select class="rm-select rm-detail-kind" id="logKind" aria-label="Tipo de entrada">${S.meta.log_kinds.map((k) => `<option value="${k}" ${k === "note" ? "selected" : ""}>${esc(Ramas.LOG[k] || LOG_LABEL[k])}</option>`).join("")}</select>
          <button type="button" class="rm-btn rm-btn--secondary rm-btn--sm" id="logAdd">Agregar</button>
        </div>
        <div class="rm-log" id="logs">${n.logs.map(logHtml).join("") || `<p class="rm-field__help">Todavía nadie escribió nada. Los agentes van a ir completando acá.</p>`}</div>
      </section>

      <section class="rm-section">
        <details class="rm-detail-hist"><summary class="rm-label">Historial de estados · ${n.events.length}</summary><div class="rm-history">
          ${n.events.map((e) => `<div class="rm-history__row"><time>${esc(new Date(e.at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}</time><span class="rm-history__st">${e.from_status ? Ramas.pill(e.from_status) + `<span class="rm-faint" aria-hidden="true">→</span>` : `<span class="rm-faint">creada en</span>`}${Ramas.pill(e.to_status)}</span>${avOf(e.author)}</div>`).join("")}
        </div></details>
        <p><button type="button" class="rm-btn rm-btn--danger rm-btn--sm" id="delNode">Eliminar R-${n.id}${n.children.length ? " y sus ramas" : ""}</button></p>
      </section>
    </div>`;
  wireDrawer(n);
  fitTitle();
  if (document.fonts?.ready) document.fonts.ready.then(fitTitle);
  if (focusedId) { const f = document.getElementById(focusedId); if (f && d.contains(f)) f.focus({ preventScroll: true }); }
}

function attHtml(a) {
  const who = a.created_by ? `${esc(a.created_by)} · ` : "";
  const meta = `${who}${esc(ago(a.created_at))}${a.size ? " · " + esc(fmtSize(a.size)) : ""}`;
  const del = `<button type="button" class="rm-iconbtn" data-del-att="${a.id}" title="Eliminar adjunto" aria-label="Eliminar adjunto">×</button>`;
  if (a.kind === "link") {
    const url = safeUrl(a.url);
    return `<div class="rm-att rm-att--link"><a class="rm-link" href="${esc(url)}" target="_blank" rel="noopener"><span class="rm-link__fav" aria-hidden="true">↗</span><span class="rm-link__t">${esc(a.title || a.url)}</span><span class="rm-link__host">${esc(hostOf(a.url))}</span></a>${del}</div>`;
  }
  const dl = `<a class="rm-iconbtn" href="${esc(fileUrl(a, true))}" title="Descargar" aria-label="Descargar ${esc(a.filename)}">↓</a>`;
  if (a.kind === "audio") {
    return `<div class="rm-audio" data-aud="${a.id}">
      <audio preload="metadata" src="${esc(fileUrl(a))}" hidden></audio>
      <button type="button" class="rm-audio__play" aria-label="Reproducir ${esc(a.filename)}" aria-pressed="false">▶</button>
      <div class="rm-audio__mid"><div class="rm-audio__top"><b title="${esc(a.filename)}">${esc(a.filename)}</b><span class="rm-audio__time">--:--</span></div>${Ramas.wave(48, a.id, 0)}
        <span class="rm-field__help">${meta}</span></div>
      <div class="rm-audio__side">${dl}<button type="button" class="rm-iconbtn" data-tr="${a.id}" title="Pegar o editar transcripción" aria-label="Editar transcripción">¶</button>${del}</div>
      ${a.transcript ? `<div class="rm-audio__transcript">${esc(a.transcript)}</div>` : ""}
    </div>`;
  }
  if (a.kind === "image") {
    return `<div class="rm-att rm-att--img"><button type="button" class="rm-thumb rm-thumb--lg" data-zoom="${esc(fileUrl(a))}" aria-label="Ampliar ${esc(a.filename)}"><img src="${esc(fileUrl(a))}" alt="${esc(a.filename)}" loading="lazy"></button>
      <div class="rm-att__info"><b>${esc(a.filename)}</b><span class="rm-field__help">${meta}</span></div><span class="rm-audio__side">${dl}${del}</span></div>`;
  }
  return `<div class="rm-att"><div class="rm-att__info"><b>${esc(a.filename)}</b><span class="rm-field__help">${meta}</span></div><span class="rm-audio__side">${dl}${del}</span></div>`;
}

function logHtml(l) {
  const canResolve = (l.kind === "question" || l.kind === "blocker") && !l.resolved;
  const p = personOf(l.author);
  const cls = ["rm-log__item", p?.agent ? "rm-log__item--agent" : "", l.kind === "question" ? "rm-log__item--question" : "", l.resolved ? "is-resolved" : ""].filter(Boolean).join(" ");
  return `<div class="${cls}">${avOf(l.author, "md")}
    <div><div class="rm-log__meta"><span class="rm-log__author">${esc(l.author || "?")}</span>${Ramas.LOG[l.kind] ? Ramas.logtag(l.kind) : `<span class="rm-logtag">${esc(l.kind)}</span>`}<time>${esc(ago(l.created_at))}</time>
        ${l.ref_url ? `<a href="${esc(safeUrl(l.ref_url))}" target="_blank" rel="noopener">ver ↗</a>` : ""}
        <button type="button" class="rm-iconbtn rm-log__del" data-del-log="${l.id}" title="Borrar entrada" aria-label="Borrar entrada">×</button></div>
      <div class="rm-log__box rm-log__body">${linkify(esc(l.text))}
        ${l.answer ? `<div class="rm-log__answer">↳ ${esc(l.answer)}</div>` : ""}
        ${canResolve ? `<div class="rm-log__actions"><button type="button" class="rm-btn rm-btn--primary rm-btn--sm" data-resolve="${l.id}">Resolver</button></div>` : ""}</div></div></div>`;
}
function linkify(s) {
  return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\bR-(\d+)\b/g, '<a href="#" data-go="$1">R-$1</a>');
}

/* audios ya escuchados (por navegador): ids de adjuntos en localStorage */
const heardSet = () => { try { return new Set(JSON.parse(lsGet("ramas.heard") || "[]")); } catch { return new Set(); } };
function markHeard(id) { const s = heardSet(); if (!s.has(id)) { s.add(id); lsSet("ramas.heard", JSON.stringify([...s])); } }

function wireAudio(box) {
  const au = box.querySelector("audio"), btn = box.querySelector(".rm-audio__play"), time = box.querySelector(".rm-audio__time");
  const bars = [...box.querySelectorAll(".rm-wave i")];
  const audId = +box.dataset.aud;
  const setHeard = () => {
    box.classList.add("is-heard");
    if (!box.querySelector(".rm-audio__heard")) time.insertAdjacentHTML("beforebegin", `<span class="rm-audio__heard">✓ Escuchado</span>`);
  };
  if (heardSet().has(audId)) setHeard();
  const paint = () => {
    const f = au.duration > 0 && au.currentTime > 0 ? au.currentTime / au.duration : (box.classList.contains("is-heard") ? 1 : 0);
    bars.forEach((b, i) => b.classList.toggle("is-played", i / bars.length < f));
    time.textContent = au.duration > 0 ? `${mmss(au.currentTime)} / ${mmss(au.duration)}` : "--:--";
  };
  const state = (playing) => {
    box.classList.toggle("is-playing", playing);
    btn.textContent = playing ? "❚❚" : "▶";
    btn.setAttribute("aria-pressed", String(playing));
    btn.setAttribute("aria-label", `${playing ? "Pausar" : "Reproducir"} ${box.querySelector("b").textContent}`);
  };
  btn.onclick = () => {
    if (au.paused) {
      document.querySelectorAll("#drawer audio").forEach((o) => { if (o !== au) o.pause(); });
      au.play().catch(() => box.classList.add("is-error"));
    } else au.pause();
  };
  au.addEventListener("play", () => { state(true); markHeard(audId); setHeard(); });
  box.querySelector("a[download], a[href*='dl=1']")?.addEventListener("click", () => { markHeard(audId); setHeard(); paint(); });
  au.addEventListener("pause", () => state(false));
  au.addEventListener("ended", () => { state(false); au.currentTime = 0; paint(); });
  au.addEventListener("timeupdate", paint);
  au.addEventListener("loadedmetadata", paint);
  au.addEventListener("error", () => {
    box.classList.add("is-error");
    if (!box.querySelector(".rm-card__error")) box.insertAdjacentHTML("beforeend", `<div class="rm-card__error rm-card__error--wide">No pudimos cargar el audio. Probá descargarlo.</div>`);
  });
  const wave = box.querySelector(".rm-wave");
  if (wave) wave.onclick = (e) => {
    const r = wave.getBoundingClientRect();
    if (au.duration > 0 && r.width) { au.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * au.duration; paint(); }
  };
}

function wireDrawer(n) {
  const d = $("#drawer"), id = n.id;
  const patch = (body) => run(async () => { await api(`/api/nodes/${id}`, { method: "PATCH", body }); await refresh(); openNode(id); });
  const reload = async () => { await refresh(); openNode(id); };
  $("#closeD").onclick = () => closeDrawer();
  $("#copyLink").onclick = () => { copyText(location.href, "Link copiado"); };
  $("#copyRef").onclick = () => { closeMoreMenu(true); copyText(`R-${id}`, `R-${id} copiado: usalo en tus commits`); };
  $("#flowBtn").onclick = () => {
    go({ view: "flow", node: id });
    select(id);
    let tries = 0;
    const center = () => {
      if (S.view === "flow" && typeof FLOW !== "undefined" && FLOW.ctl) document.dispatchEvent(new CustomEvent("ramas:center", { detail: id }));
      else if (tries++ < 30) requestAnimationFrame(center);
    };
    requestAnimationFrame(center);
  };
  const menu = $("#moreMenu"), moreBtn = $("#moreBtn");
  const items = () => [...menu.querySelectorAll("[role=menuitem]")];
  moreBtn.onclick = () => {
    if (!menu.hidden) { closeMoreMenu(true); return; }
    menu.hidden = false; moreBtn.setAttribute("aria-expanded", "true"); items()[0].focus();
  };
  moreBtn.onkeydown = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); if (menu.hidden) moreBtn.click(); else items()[0].focus(); } };
  menu.onkeydown = (e) => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); it[(i + 1) % it.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
    else if (e.key === "Tab") closeMoreMenu();
  };
  d.querySelectorAll("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); go({ node: +a.dataset.go }); }));
  const title = $("#dTitle");
  title.oninput = () => { if (title.value.includes("\n")) title.value = title.value.replace(/\s*\n+\s*/g, " "); fitTitle(); };
  title.onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); title.blur(); }
    else if (e.key === "Escape") { e.stopPropagation(); title.value = n.title; title.blur(); }
  };
  title.onblur = () => { if (title.value.trim() && title.value.trim() !== n.title) patch({ title: title.value.trim() }); };
  $("#fStatus").onchange = (e) => patch({ status: e.target.value });
  $("#fPrio").onchange = (e) => patch({ priority: +e.target.value });
  $("#fWho").onchange = (e) => patch({ assignee: e.target.value || null });
  $("#fKind").onchange = (e) => patch({ kind: e.target.value });
  $("#fDesc").onblur = (e) => { if (e.target.value !== n.description) patch({ description: e.target.value }); };

  // adjuntos
  $("#recBtn").onclick = () => record((blob, ext) => uploadFiles(id, [new File([blob], `audio-${stamp()}.${ext}`, { type: blob.type })]));
  $("#upBtn").onclick = () => $("#fileIn").click();
  $("#fileIn").onchange = (e) => uploadFiles(id, [...e.target.files]);
  $("#linkBtn").onclick = () => { $("#linkRow").hidden = !$("#linkRow").hidden; if (!$("#linkRow").hidden) $("#linkUrl").focus(); };
  const saveLink = () => run(async () => {
    await api(`/api/nodes/${id}/links`, { method: "POST", body: { url: $("#linkUrl").value, title: $("#linkTitle").value } });
    await reload();
  });
  $("#linkSave").onclick = saveLink;
  $("#linkUrl").onkeydown = (e) => { if (e.key === "Enter") saveLink(); };
  d.querySelectorAll("[data-del-att]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal("Se borra el archivo del servidor. No se puede deshacer.", { danger: true, title: "¿Eliminar este adjunto?" }))) return;
    run(async () => { await api(`/api/attachments/${b.dataset.delAtt}`, { method: "DELETE" }); await reload(); });
  }));
  d.querySelectorAll("[data-tr]").forEach((b) => (b.onclick = async () => {
    const att = n.attachments.find((a) => a.id === +b.dataset.tr);
    // TODO backend: transcripción automática (hoy se pega a mano)
    const text = await promptModal("Transcripción del audio", { label: "Texto", value: att?.transcript || "", placeholder: "Pegá o escribí lo que dice el audio", multiline: true });
    if (text === null) return;
    run(async () => { await api(`/api/attachments/${b.dataset.tr}`, { method: "PATCH", body: { transcript: text } }); openNode(id); });
  }));
  d.querySelectorAll(".rm-audio[data-aud]").forEach(wireAudio);
  d.querySelectorAll("[data-zoom]").forEach((btn) => (btn.onclick = () => {
    const opener = document.activeElement;
    const lb = document.createElement("div"); lb.className = "rm-lightbox";
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "Imagen ampliada"); lb.tabIndex = -1;
    lb.innerHTML = `<img src="${esc(btn.dataset.zoom)}" alt=""><button type="button" class="rm-iconbtn rm-lightbox__x" aria-label="Cerrar imagen">×</button>`;
    const close = () => {
      lb.remove(); lightboxClose = null;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
    lightboxClose = close;
    lb.onclick = close;
    document.body.appendChild(lb); lb.querySelector("button").focus();
  }));

  // ramas: una por línea
  const parseLines = (t) => t.split("\n").map((s) => s.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
  const addKids = (lines = parseLines($("#kidIn").value)) => {
    if (!lines.length) return;
    run(async () => {
      if (lines.length === 1) await api(`/api/projects/${S.project.slug}/nodes`, { method: "POST", body: { title: lines[0], parent_id: id } });
      else await api(`/api/nodes/${id}/split`, { method: "POST", body: { tasks: lines.map((title) => ({ title })) } });
      await reload();
    });
  };
  $("#kidAdd").onclick = () => addKids();
  $("#kidIn").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addKids(); } };
  $("#kidIn").onpaste = async (e) => {
    const t = e.clipboardData.getData("text");
    if (!t.includes("\n")) return;
    e.preventDefault();
    const lines = parseLines(t);
    if (lines.length < 2) { $("#kidIn").value = lines[0] || ""; return; }
    if (await confirmModal(`Se crean ${lines.length} ramas nuevas dentro de R-${id}.`, { title: `¿Crear ${lines.length} ramas?`, okText: "Crear ramas" })) addKids(lines);
  };

  // bitácora
  const addLog = () => {
    const text = $("#logIn").value.trim(); if (!text) return;
    run(async () => { await api(`/api/nodes/${id}/logs`, { method: "POST", body: { kind: $("#logKind").value, text } }); await reload(); });
  };
  $("#logAdd").onclick = addLog;
  $("#logIn").onkeydown = (e) => { if (e.key === "Enter") addLog(); };
  d.querySelectorAll("[data-resolve]").forEach((b) => (b.onclick = async () => {
    const answer = await promptModal("Resolver", { label: "Respuesta (opcional)", placeholder: "Qué se decidió o cómo se resolvió", okText: "Resolver" });
    if (answer === null) return;
    run(async () => { await api(`/api/logs/${b.dataset.resolve}/resolve`, { method: "POST", body: { answer } }); await reload(); });
  }));
  d.querySelectorAll("[data-del-log]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal("La entrada se borra de la bitácora.", { danger: true, title: "¿Borrar esta entrada?" }))) return;
    run(async () => { await api(`/api/logs/${b.dataset.delLog}`, { method: "DELETE" }); await reload(); });
  }));

  const delNode = async () => {
    closeMoreMenu();
    const extra = n.children.length ? ` y sus ${n.children.length} ramas (con todo lo que cuelga)` : "";
    if (!(await confirmModal("Se borran también audios, imágenes y bitácora. No se puede deshacer.", { danger: true, title: `¿Eliminar R-${id}${extra}?` }))) return;
    run(async () => { await api(`/api/nodes/${id}`, { method: "DELETE" }); closeDrawer(); await refresh(); toast("Eliminado"); });
  };
  $("#delNode").onclick = delNode;
  $("#delMenu").onclick = delNode;
}

// pegar imágenes con Ctrl+V cuando el detalle está abierto
document.addEventListener("paste", (e) => {
  if (!S.openId || !$("#drawer").classList.contains("is-on")) return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;
  e.preventDefault();
  uploadFiles(S.openId, files.map((f) => new File([f], f.name && f.name !== "image.png" ? f.name : `captura-${stamp()}.png`, { type: f.type })));
});
