"use strict";

const BOARD_EMPTY = {
  inbox: "Soltá una idea acá",
  inboxAlDia: "Inbox al día. Las ideas nuevas caen acá.",
  todo: "Soltá una tarea acá",
  doing: "Soltá lo que estés haciendo",
  review: "Soltá lo que esté para revisar",
  done: "Soltá lo que ya salió",
  blocked: "Nada bloqueado. Bien ahí.",
};

/* Mobile: una columna por vez. BOARD_MOBILE.status = estado visible (la estrategia es solo CSS: .rm-col:not(.is-current) se oculta). */
const BOARD_MOBILE = { status: null };
function showBoardStatus(board, st) {
  BOARD_MOBILE.status = st;
  board.querySelectorAll(".rm-col").forEach((c) => c.classList.toggle("is-current", c.dataset.status === st));
  board.parentElement.querySelectorAll(".rm-stab").forEach((b) => {
    const on = b.dataset.status === st;
    b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
  });
  drawBoardEdges();
}

function renderBoard(main) {
  const nodes = visible(S.nodes);
  const cols = S.meta.statuses.filter((s) => !(S.filter.hideDone && s === "done"));
  if (!cols.includes(BOARD_MOBILE.status)) BOARD_MOBILE.status = (["doing", ...cols].find((s) => cols.includes(s) && nodes.some((n) => n.status === s)) || cols[0]);
  const focusedCard = document.activeElement?.closest?.(".rm-card")?.dataset.id;  // el poll re-renderiza: se devuelve el foco a la misma tarjeta
  main.innerHTML = `<div class="rm-statusrow" role="group" aria-label="Estado">${cols.map((st) => {
    const on = st === BOARD_MOBILE.status;
    return `<button type="button" class="rm-stab rm-stab--${st}${on ? " is-on" : ""}" data-status="${st}" aria-pressed="${on}">${esc(Ramas.STATUS[st] || st)} <span class="rm-mono">${nodes.filter((n) => n.status === st).length}</span></button>`;
  }).join("")}</div><div class="rm-board rm-gridbg" id="rmBoard">${cols.map((st) => {
    const items = nodes.filter((n) => n.status === st);
    // mobile: el estado visible siempre ofrece "＋ Agregar en <Estado>"
    const mobileAdd = MOBILE_MQ.matches && st !== "inbox" && st !== "todo";
    const quick = st === "inbox" || st === "todo" || mobileAdd
      ? `<input class="rm-quickadd" data-status="${st}" aria-label="${mobileAdd ? `Agregar en ${esc(Ramas.STATUS[st] || st)}` : st === "inbox" ? "Idea rápida" : "Tarea rápida"}" placeholder="${mobileAdd ? `＋ Agregar en ${esc(Ramas.STATUS[st] || st)}` : st === "inbox" ? "＋ Idea rápida…" : "＋ Tarea rápida…"}">` : "";
    return `<section class="rm-col${items.length ? "" : " is-empty"}${st === BOARD_MOBILE.status ? " is-current" : ""}" data-status="${st}">
      <header class="rm-col__head"><span class="rm-col__name">${Ramas.pill(st)}</span><span class="rm-col__n">${items.length}</span></header>
      ${items.map((n) => Ramas.card(toTplNode(n), MOBILE_MQ.matches ? { compact: true } : undefined)).join("")}
      ${items.length ? "" : `<div class="rm-col__empty">${st === "inbox" && nodes.length ? BOARD_EMPTY.inboxAlDia : (BOARD_EMPTY[st] || "Soltá una tarjeta acá")}</div>`}
      ${quick}
    </section>`;
  }).join("")}<svg class="rm-board-edges" aria-hidden="true"></svg></div><div class="rm-board-hint" role="status" hidden></div>`;

  const board = main.querySelector(".rm-board");
  if (focusedCard) board.querySelector(`.rm-card[data-id="${CSS.escape(focusedCard)}"]`)?.focus({ preventScroll: true });
  main.querySelector(".rm-statusrow").onclick = (e) => {
    const b = e.target.closest(".rm-stab"); if (b) showBoardStatus(board, b.dataset.status);
  };
  board.onclick = (e) => { if (!e.target.closest(".rm-card, .rm-quickadd")) select(null); };
  board.onscroll = drawBoardEdges;

  board.querySelectorAll(".rm-card").forEach((c) => {
    const id = +String(c.dataset.id).replace(/^R-/, "");
    c.draggable = true;
    c.onclick = () => { select(id); go({ node: id }); };
    c.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); select(id); go({ node: id }); } };
    c.ondragstart = (e) => { e.dataTransfer.setData("text/plain", String(id)); c.classList.add("is-dragging"); };
    c.ondragend = () => c.classList.remove("is-dragging");
  });
  board.querySelectorAll(".rm-col").forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add("is-drop"); };
    col.ondragleave = (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("is-drop"); };
    col.ondrop = (e) => {
      e.preventDefault(); col.classList.remove("is-drop");
      const id = +e.dataTransfer.getData("text/plain");
      const n = S.nodes.find((x) => x.id === id);
      if (n && n.status !== col.dataset.status) setStatus(id, col.dataset.status);
    };
  });
  board.querySelectorAll(".rm-quickadd").forEach((inp) => {
    inp.onkeydown = (e) => {
      if (e.key !== "Enter" || !inp.value.trim()) return;
      const st = inp.dataset.status;
      run(async () => {
        await api(`/api/projects/${S.project.slug}/nodes`, { method: "POST", body: { title: inp.value.trim(), kind: st === "inbox" ? "idea" : "task", status: st } });
        await refresh();
        document.querySelector(`.rm-quickadd[data-status="${st}"]`)?.focus();
      });
    };
  });
  applyBoardSelection();
}

/* Marca seleccionada / atenuadas y dibuja conectores */
function applyBoardSelection() {
  const board = document.querySelector(".rm-board");
  if (!board) return;
  const sel = S.selectedId != null ? S.nodes.find((n) => n.id === S.selectedId) : null;
  const related = new Set();
  if (sel) {
    related.add(sel.id);
    if (sel.parent_id != null && S.nodes.some((n) => n.id === sel.parent_id)) related.add(sel.parent_id);
    S.nodes.forEach((n) => { if (n.parent_id === sel.id) related.add(n.id); });
  }
  board.querySelectorAll(".rm-card").forEach((c) => {
    const id = +String(c.dataset.id).replace(/^R-/, "");
    c.classList.toggle("is-selected", !!sel && id === sel.id);
    c.classList.toggle("is-path", !!sel && id !== sel.id && related.has(id));
    c.classList.toggle("is-dimmed", !!sel && !related.has(id));
  });
  const hint = board.parentElement.querySelector(".rm-board-hint");
  if (hint) {
    hint.hidden = !sel;
    if (sel) {
      const kids = S.nodes.filter((n) => n.parent_id === sel.id).length;
      const parent = sel.parent_id != null && S.nodes.some((n) => n.id === sel.parent_id) ? ` · padre <span class="rm-id">R-${+sel.parent_id}</span>` : "";
      hint.innerHTML = `<span class="rm-id">R-${+sel.id}</span> <b>seleccionada</b>${parent} · ${kids} ${kids === 1 ? "rama" : "ramas"} <span class="rm-kbd">Esc</span> para soltar`;
    }
  }
  drawBoardEdges();
}

function drawBoardEdges() {
  const board = document.querySelector(".rm-board");
  const svg = board?.querySelector("svg.rm-board-edges");
  if (!svg) return;
  const sel = S.selectedId != null ? S.nodes.find((n) => n.id === S.selectedId) : null;
  svg.style.width = board.scrollWidth + "px";
  svg.style.height = board.scrollHeight + "px";
  if (!sel) { svg.innerHTML = ""; return; }
  const base = board.getBoundingClientRect();
  const box = (id) => {
    const el = board.querySelector(`.rm-card[data-id="R-${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const l = r.left - base.left + board.scrollLeft, t = r.top - base.top + board.scrollTop;
    return { l, r: l + r.width, cy: t + r.height / 2 };
  };
  const pairs = [];
  if (sel.parent_id != null) pairs.push([S.nodes.find((n) => n.id === sel.parent_id), sel]);
  S.nodes.filter((n) => n.parent_id === sel.id).forEach((c) => pairs.push([sel, c]));
  let out = Ramas.arrowDefs("board");
  for (const [from, to] of pairs) {
    if (!from) continue;
    const a = box(from.id), b = box(to.id);
    if (!a || !b) continue; // fuera del tablero (columna oculta o filtrada)
    let d;
    if (b.l >= a.r) d = Ramas.edgePath(a.r, a.cy, b.l - 3, b.cy, "h");
    else if (b.r <= a.l) d = `M${a.l},${a.cy} C${a.l - 60},${a.cy} ${b.r + 60},${b.cy} ${b.r + 3},${b.cy}`;
    else d = `M${a.r},${a.cy} C${a.r + 44},${a.cy} ${b.r + 44},${b.cy} ${b.r + 3},${b.cy}`; // misma columna: lazo por la derecha
    const html = Ramas.edge(d, Ramas.edgeKind(to.status), { path: true, prefix: "board" });
    out += html.replace('<path class="rm-edge ', `<path data-edge="R-${from.id}&gt;R-${to.id}" class="rm-edge `);
  }
  svg.innerHTML = out;
}

async function setStatus(id, status) {
  await run(async () => {
    await api(`/api/nodes/${id}`, { method: "PATCH", body: { status } });
    await refresh();
    if (S.openId === id) openNode(id);
  });
}

if (!window.__ramasBoardBound) {
  window.__ramasBoardBound = true;
  window.addEventListener("resize", () => drawBoardEdges());
  document.addEventListener("ramas:select", () => { if (S.view === "board") applyBoardSelection(); });
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || recState || $("#modal").classList.contains("on")) return;
    if (e.key === "Escape" && S.view === "board" && S.selectedId != null && !e.target.closest?.("input, textarea")) select(null);
  });
}
