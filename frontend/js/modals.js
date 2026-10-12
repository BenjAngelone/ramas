"use strict";

/* ------------------------------------------------------------ modales
   modal(html, onMount) / closeModal(): base de dialogModal/confirmModal/promptModal (detail.js).
   El host conserva la clase `modal` por compatibilidad con detail.js (m.querySelector(".modal")); su
   estilo viejo se neutraliza en extra-modals.css y la caja visible es el `.rm-modal` interno. */
let modalOpener = null;
const MODAL_FOCUSABLE = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

function modal(html, onMount) {
  const m = $("#modal");
  if (!m.classList.contains("on")) modalOpener = document.activeElement;
  m.innerHTML = `<div class="modal rm-modal-host" role="dialog" aria-modal="true">${html}</div>`;
  const host = m.firstElementChild;
  const title = host.querySelector("[id$='Title'], .rm-modal__title[id]");
  if (title) host.setAttribute("aria-labelledby", title.id);
  m.classList.add("on");
  m.onclick = (e) => {
    if (e.target !== m) return;
    if (m.dataset.closable !== "0") closeModal(); else if (!host.contains(document.activeElement)) (host.querySelector(MODAL_FOCUSABLE))?.focus();
  };
  m.onkeydown = (e) => {
    if (e.defaultPrevented) return;
    if (e.key === "Escape" && m.dataset.closable !== "0") { e.preventDefault(); closeModal(); return; }
    if (e.key === "Tab") {
      const f = [...host.querySelectorAll(MODAL_FOCUSABLE)];
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (!host.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  onMount?.(m);
  if (!host.contains(document.activeElement)) (host.querySelector("input, textarea") || host.querySelector(MODAL_FOCUSABLE))?.focus();
}
function closeModal() {
  const m = $("#modal");
  m.classList.remove("on"); m.innerHTML = ""; m.onkeydown = null;
  const o = modalOpener; modalOpener = null;
  if (o && o.isConnected && o.focus) o.focus();
}

/* Caja estándar: cabecera (eyebrow + título + ×), cuerpo y pie. */
function modalShell({ eyebrow = "Ramas", title, lede = "", bodyHtml, footHtml = "", wide = false, closeId = "mdX", dismissable = true }) {
  return `<div class="rm-modal${wide ? " rm-modal--wide" : ""}">
    <div class="rm-modal__head"><div><div class="rm-label rm-modal__eyebrow">${esc(eyebrow)}</div><h2 class="rm-modal__title" id="mdTitle">${esc(title)}</h2>${lede ? `<p class="rm-modal__lede">${esc(lede)}</p>` : ""}</div>
      ${dismissable ? `<button type="button" class="rm-iconbtn" id="${closeId}" aria-label="Cerrar">×</button>` : ""}</div>
    <div class="rm-modal__body">${bodyHtml}</div>
    ${footHtml ? `<div class="rm-modal__foot">${footHtml}</div>` : ""}
  </div>`;
}
const ANIMAL_ES = { "🐥": "Pollito", "🦊": "Zorro", "🐸": "Rana", "🐼": "Panda", "🐨": "Koala", "🐙": "Pulpo", "🦉": "Búho", "🐢": "Tortuga", "🦔": "Erizo", "🐧": "Pingüino", "🐝": "Abeja", "🦄": "Unicornio", "🐳": "Ballena", "🦦": "Nutria", "🐞": "Mariquita", "🦖": "Dinosaurio" };
const animalLabel = (a) => ANIMAL_ES[a] || "Animalito";
const orgBrand = () => `<span class="rm-brand rm-onb__brand"><img class="rm-logo" src="/static/img/tsc-logo.png" alt="">Ramas<span class="rm-org">TSC</span></span>`;
const onbDots = (n) => `<div class="rm-onb__step"><div class="rm-onb__dots" aria-hidden="true"><i class="on"></i><i class="${n > 1 ? "on" : ""}"></i></div><span class="rm-label">Paso ${n} de 2</span></div>`;

function askKey() {
  $("#modal").dataset.closable = "0";
  modal(`<div class="rm-modal rm-onb">
    <div class="rm-modal__body rm-onb__body">
      ${onbDots(1)}${orgBrand()}
      <div><h2 class="rm-onb__h" id="keyTitle">Entrá a TSC</h2><p class="rm-onb__p" id="keyDesc">No hay cuentas ni contraseñas. Pegá la clave que te pasó alguien del equipo.</p></div>
      <label class="rm-field" id="keyField"><span class="rm-field__label">Clave de equipo</span>
        <input class="rm-input rm-onb__key" type="password" id="keyIn" placeholder="Clave del workspace" autocomplete="off" aria-describedby="keyHelp">
        <span class="rm-field__help" id="keyHelp" role="alert">Pedísela a quien administra Ramas en tu equipo.</span></label>
      <button type="button" class="rm-btn rm-btn--primary rm-btn--lg" id="keyOk">Entrar →</button>
    </div></div>`, () => {
    const inp = $("#keyIn"), field = $("#keyField"), help = $("#keyHelp");
    const fail = (msg, invalid = true) => { if (invalid) { inp.classList.add("is-error"); field.classList.add("is-error"); inp.setAttribute("aria-invalid", "true"); } help.textContent = msg; inp.focus(); };
    const ok = async () => {
      const k = inp.value.trim();
      if (!k) return fail("Pegá la clave para entrar.");
      let r;
      try { r = await fetch("/api/meta", { headers: { "X-Ramas-Key": k } }); }
      catch { return fail("No pudimos verificar la clave. Probá de nuevo.", false); }
      if (r.status === 401) return fail("Esa clave no coincide. Revisala con tu equipo.");
      if (!r.ok) return fail("No pudimos verificar la clave. Probá de nuevo.", false);
      S.key = k; lsSet("ramas.key", S.key); $("#modal").dataset.closable = "1"; closeModal(); boot();
    };
    inp.oninput = () => { inp.classList.remove("is-error"); field.classList.remove("is-error"); inp.removeAttribute("aria-invalid"); };
    $("#keyOk").onclick = ok; inp.onkeydown = (e) => { if (e.key === "Enter") ok(); }; inp.focus();
  });
}

function askWho() {
  const first = !S.me;
  if (first) $("#modal").dataset.closable = "0";
  const taken = new Map(S.users.filter((u) => !S.me || u.name !== S.me.name).map((u) => [u.avatar, u.name]));
  const avs = S.meta.avatars;
  let avatar = avs.includes(S.me?.avatar) ? S.me.avatar : (avs.find((a) => !taken.has(a)) || avs[0]);
  const nP = S.users.length, nA = AGENT_NAMES.length;
  const team = `<div class="rm-onb__team"><span class="rm-project__dot"></span><b>TSC</b>${S.project ? ` · proyecto ${esc(S.project.name)}` : ""} · ${nP} ${nP === 1 ? "persona" : "personas"} · ${nA} ${nA === 1 ? "agente" : "agentes"}</div>`;
  const av = (e, cls = "") => `<span class="rm-avatar ${cls}" aria-hidden="true">${esc(e)}</span>`;
  modal(`<div class="rm-modal rm-onb rm-onb--who">
    <div class="rm-modal__body rm-onb__body">
      ${first ? onbDots(2) : ""}${orgBrand()}${team}
      <div><h2 class="rm-onb__h" id="whoTitle">${first ? "¿Quién sos?" : "Cambiar de persona"}</h2><p class="rm-onb__p">Elegí un animalito y un nombre. Así te van a ver en el tablero y la bitácora.</p></div>
      ${S.users.length ? `<div><div class="rm-label">Si ya estás</div><div class="rm-onb__people" id="whoPeople">${S.users.map((u) => `<span class="rm-onb__pwrap"><button type="button" class="rm-onb__person" data-u="${esc(u.name)}" title="Entrar como ${esc(u.name)}">${av(u.avatar)}<span>${esc(u.name)}</span></button>${S.me && u.name === S.me.name ? "" : `<button type="button" class="rm-iconbtn rm-onb__del" data-del-u="${esc(u.name)}" aria-label="Eliminar a ${esc(u.name)}" title="Eliminar a ${esc(u.name)}">×</button>`}</span>`).join("")}</div></div>` : ""}
      <div class="rm-onb__animals" id="whoAnimals" role="radiogroup" aria-label="Avatar">${avs.map((a) => {
        const t = taken.get(a);
        return `<button type="button" class="rm-avatar-pick${t ? " is-taken" : ""}" role="radio" data-a="${esc(a)}" aria-checked="false" aria-label="${esc(animalLabel(a))}${t ? `, ocupado por ${esc(t)}` : ""}"${t ? ` disabled aria-disabled="true"` : ""}>${av(a)}<span class="rm-onb__lbl">${t ? esc(t) : "&nbsp;"}</span></button>`;
      }).join("")}</div>
      <label class="rm-field"><span class="rm-field__label">Tu nombre</span><input class="rm-input" id="whoName" placeholder="Tu nombre" autocomplete="off" value="${first ? "" : esc(S.me.name)}"></label>
      <div class="rm-onb__actions">${first ? "" : `<button type="button" class="rm-btn rm-btn--ghost" id="whoCancel">Cancelar</button>`}<button type="button" class="rm-btn rm-btn--primary rm-btn--lg" id="whoOk">Entrar</button></div>
    </div></div>`, (m) => {
    const sync = () => {
      m.querySelectorAll("[data-a]").forEach((b) => {
        const on = b.dataset.a === avatar && !b.disabled;
        b.classList.toggle("is-on", on); b.classList.toggle("is-selected", on); b.setAttribute("aria-checked", String(on));
        if (!b.disabled) b.querySelector(".rm-onb__lbl").textContent = on ? "Elegido" : " ";
      });
      $("#whoOk").innerHTML = `Entrar como ${av(avatar, "rm-avatar--xs")} ${esc($("#whoName").value.trim())}`;
    };
    m.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => { if (b.disabled) return; avatar = b.dataset.a; sync(); }));
    const set = (u) => { S.me = { name: u.name, avatar: u.avatar }; lsSet("ramas.me", JSON.stringify(S.me)); $("#modal").dataset.closable = "1"; closeModal(); boot(); };
    m.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => set(S.users.find((u) => u.name === b.dataset.u))));
    m.querySelectorAll("[data-del-u]").forEach((b) => (b.onclick = () => run(async () => {
      const name = b.dataset.delU;
      if (!confirm(`¿Eliminar a ${name}? Sus tareas conservan el nombre.`)) return;
      await api(`/api/users/${encodeURIComponent(name)}`, { method: "DELETE" });
      S.users = await api("/api/users"); syncTemplates(); askWho();
    })));
    const go2 = () => run(async () => {
      const name = $("#whoName").value.trim(); if (!name) { toast("Poné un nombre", true); return $("#whoName").focus(); }
      const u = await api("/api/users", { method: "POST", body: { name, avatar } });
      S.users = await api("/api/users"); set(u);
    });
    $("#whoOk").onclick = go2;
    $("#whoName").oninput = sync; $("#whoName").onkeydown = (e) => { if (e.key === "Enter") go2(); };
    if ($("#whoCancel")) $("#whoCancel").onclick = closeModal;
    sync(); $("#whoName").focus();
  });
}

function newProject() {
  modal(modalShell({
    title: "Nuevo proyecto",
    bodyHtml: `<p class="rm-md__p">Cada proyecto tiene su tablero y su slug, que es como lo van a nombrar los agentes.</p>
      <label class="rm-field"><span class="rm-field__label">Nombre</span><input class="rm-input" id="pName" placeholder="Nombre del proyecto" autocomplete="off"></label>
      <label class="rm-field"><span class="rm-field__label">Repo de GitHub (opcional)</span><input class="rm-input" id="pRepo" placeholder="https://github.com/…" autocomplete="off"></label>`,
    footHtml: `<button type="button" class="rm-btn rm-btn--ghost" id="pCancel">Cancelar</button><button type="button" class="rm-btn rm-btn--primary" id="pOk">Crear</button>`,
  }), () => {
    $("#pCancel").onclick = closeModal; $("#mdX").onclick = closeModal; $("#pName").focus();
    const ok = () => run(async () => {
      const p = await api("/api/projects", { method: "POST", body: { name: $("#pName").value, repo_url: $("#pRepo").value.trim() || null } });
      S.projects = await api("/api/projects"); closeModal(); S.project = null; go({ slug: p.slug, view: "board", node: null });
    });
    $("#pOk").onclick = ok; $("#pName").onkeydown = (e) => { if (e.key === "Enter") ok(); };
  });
}

function newIdea() {
  modal(modalShell({
    title: "Nueva idea",
    bodyHtml: `<p class="rm-md__p">La idea cero. Después la ramificás en tareas.</p>
      <label class="rm-field"><span class="rm-field__label">Título</span><input class="rm-input" id="iTitle" placeholder="Título" autocomplete="off"></label>
      <label class="rm-field"><span class="rm-field__label">Contexto (opcional)</span><textarea class="rm-textarea" id="iDesc" rows="4" placeholder="Contexto"></textarea></label>`,
    footHtml: `<button type="button" class="rm-btn rm-btn--ghost" id="iCancel">Cancelar</button><button type="button" class="rm-btn rm-btn--primary" id="iOk">Crear</button>`,
  }), () => {
    $("#iCancel").onclick = closeModal; $("#mdX").onclick = closeModal; $("#iTitle").focus();
    const ok = () => run(async () => {
      const n = await api(`/api/projects/${S.project.slug}/nodes`, { method: "POST", body: { title: $("#iTitle").value, description: $("#iDesc").value, kind: "idea" } });
      closeModal(); await refresh(); go({ node: n.id });
    });
    $("#iOk").onclick = ok; $("#iTitle").onkeydown = (e) => { if (e.key === "Enter") ok(); };
  });
}

function showAgents() {
  if (!Object.keys(Ramas.PEOPLE).length) syncTemplates();
  const base = S.meta.public_url || location.origin;
  const slug = S.project?.slug || "<slug-del-proyecto>";
  const claudeCmd = `claude mcp add --transport http ramas ${base}/mcp \\\n  --header "Authorization: Bearer $RAMAS_AGENT_TOKEN"`;
  const codexToml = `[mcp_servers.ramas]\nurl = "${base}/mcp"\nbearer_token_env_var = "RAMAS_AGENT_TOKEN"`;
  const snippet = `## Tablero (Ramas)
Este repo usa el tablero Ramas, proyecto \`${slug}\`, vía el MCP \`ramas\`.
- Antes de implementar algo, leé la tarea con \`get_node\` (o \`branch_status\` para la rama completa).
- Al empezar: \`update_node(status="doing", assignee="claude", author="claude")\`.
- Si la tarea se desglosa, creá las subtareas con \`split_node\`.
- Después de cada commit, \`add_log(kind="summary")\` con 1-3 líneas y el link al commit/PR.
- Dudas para los humanos: \`add_log(kind="question")\`. Decisiones: \`kind="decision"\`.
- Al terminar: \`update_node(status="review")\`.
- En los mensajes de commit incluí la referencia de la tarea (ej. \`R-42\`).`;
  // TODO backend: estado de conexión por agente (hoy solo se muestra info real: URL base y variable de entorno)
  const agentRow = (name) => {
    const p = Ramas.PEOPLE[name] || { id: name, name, emoji: "🤖", agent: true };
    return `<div class="rm-agentrow" data-agent="${esc(name)}">${Ramas.avatar({ ...p, agent: true, emoji: "🤖" }, { size: "lg" })}
      <div><span class="rm-who__name--agent rm-agentrow__name">${esc(name)}</span><small>MCP · <span class="rm-mono">${esc(base)}/mcp</span></small></div>
      <span class="rm-id">RAMAS_AGENT_TOKEN</span></div>`;
  };
  const block = (n, label, lang, i, text, extra = "") => `<div><div class="rm-stepn"><b>${n}</b><strong>${esc(label)}</strong>${extra}</div>
    <div class="rm-code" data-c="${i}"><div class="rm-code__bar"><span class="rm-id">${lang}</span><button type="button" class="rm-btn rm-btn--ghost rm-btn--sm" data-copy="${i}">⧉ Copiar</button></div><pre>${esc(text)}</pre></div></div>`;
  modal(modalShell({
    eyebrow: "// Agentes", title: "Conectar agentes", wide: true,
    lede: "Los agentes leen nodos, escriben en la bitácora y mueven estados como cualquiera del equipo.",
    bodyHtml: `<p class="rm-md__p">Los agentes usan un token propio (<code>RAMAS_AGENT_TOKEN</code>), distinto de la clave de ustedes. Exportalo en tu shell antes de correr estos comandos.</p>
      <div class="rm-agents">${["claude", "codex"].map(agentRow).join("")}</div>
      ${block("01", "Claude Code", "bash", 0, claudeCmd)}
      ${block("02", "Codex", "toml", 1, codexToml, ' <span class="rm-faint">(~/.codex/config.toml)</span>')}
      ${block("03", "Para tu CLAUDE.md / AGENTS.md", "markdown", 2, snippet)}`,
    footHtml: `<button type="button" class="rm-btn rm-btn--primary" id="agOk">Cerrar</button>`,
  }), (m) => {
    const texts = [claudeCmd, codexToml, snippet];
    m.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => {
      const box = b.closest(".rm-code");
      Promise.resolve().then(() => navigator.clipboard.writeText(texts[+b.dataset.copy])).then(() => {
        toast("Copiado");
        box.classList.add("is-copied"); b.textContent = "✓ Copiado";
        setTimeout(() => { box.classList.remove("is-copied"); b.textContent = "⧉ Copiar"; }, cssMs("--rm-copied-ms", 2000));
      }, () => toast("No se pudo copiar. Seleccioná el texto y copialo a mano.", true));
    }));
    $("#agOk").onclick = closeModal; $("#mdX").onclick = closeModal;
  });
}
