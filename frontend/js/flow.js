"use strict";

/* Vista Flujo: grafo idea → ramas con camino iluminado, pan, zoom, minimapa y colapso.
   Medidas del layout: variables --flow-* de ds/extra-flow.css (resueltas con .rm-flow-probe). */

const FLOW = { slug: null, view: null, hover: null, focus: null, focusId: null, metrics: null, ctl: null,
  dragging: false, dragAt: 0, pending: false, endDrag: null, ro: null, release: null, clearPointers: null, liveT: null, retries: 0, retryRaf: null, main: null };
const FLOW_RETRY_FRAMES = 120; // tope de reintentos por frame mientras el CSS no resolvió (después: evento load de hojas)

/* Lee las medidas --flow-* (px) y los números --flow-* (sin unidad) de ds/extra-flow.css. Sin literales:
   si el CSS todavía no cargó, devuelve lo que haya (ceros) y no cachea, para reintentar en el próximo render. */
const FLOW_PX = { colW: "--flow-col-w", rowH: "--flow-row-h", rootGap: "--flow-root-gap", sibW: "--flow-sib-w", lvlH: "--flow-lvl-h",
  edgeOut: "--flow-edge-out", edgeIn: "--flow-edge-in", pad: "--flow-pad", dragMin: "--flow-drag-min", mmMin: "--flow-mm-min",
  panMargin: "--flow-pan-margin", wheelLine: "--flow-wheel-line", gapX: "--flow-gap-x", indent: "--flow-indent", treeInset: "--flow-tree-inset", fitPad: "--flow-fit-pad", treeGap: "--flow-tree-gap" };
const FLOW_NUM = { zoomSens: "--flow-zoom-sens", zoomStep: "--flow-zoom-step", kMin: "--flow-k-min", kMax: "--flow-k-max",
  fitMax: "--flow-fit-max", startMin: "--flow-start-min" };
const FLOW_MS = { dragStale: "--flow-drag-stale", live: "--dur-slow" }; // duraciones (resueltas a ms)
function flowMetrics() {
  if (FLOW.metrics) return FLOW.metrics;
  const m = Object.fromEntries([...Object.keys(FLOW_PX), ...Object.keys(FLOW_NUM), ...Object.keys(FLOW_MS)].map((k) => [k, 0]));
  try {
    const p = document.createElement("div");
    p.className = "rm-flow-probe";
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    for (const [k, v] of Object.entries(FLOW_PX)) { p.style.width = `var(${v})`; m[k] = parseFloat(cs.width) || 0; }
    for (const [k, v] of Object.entries(FLOW_MS)) {
      p.style.transitionDelay = `var(${v})`; // delay: la regla de reduced-motion no lo pisa
      const t = cs.transitionDelay;
      m[k] = (parseFloat(t) || 0) * (/ms$/.test(t) ? 1 : 1000);
    }
    p.remove();
    const root = getComputedStyle(document.documentElement);
    for (const [k, v] of Object.entries(FLOW_NUM)) m[k] = parseFloat(root.getPropertyValue(v)) || 0;
  } catch { /* sin DOM: m queda en ceros */ }
  if (flowMetricsOk(m)) FLOW.metrics = m;
  return m;
}
/* Métricas utilizables: medidas y escalas positivas y finitas. */
function flowMetricsOk(m) {
  return ["colW", "rowH", "kMin", "kMax", "zoomStep", "zoomSens", "fitMax", "startMin"].every((k) => Number.isFinite(m[k]) && m[k] > 0)
    && m.kMin <= m.kMax && m.indent > 0 && m.treeGap > 0 && m.treeInset > 0 && m.fitPad > 0;
}

/* Layout por niveles sobre nodos crudos de la API ({id, parent_id, priority}).
   x = profundidad * --flow-col-w; y = hoja acumulada (padre centrado entre sus hijos).
   parent_id ausente o nodo dentro de un ciclo → raíz. Raíces apiladas con --flow-root-gap de aire. */
function layoutTree(nodes, orient = "h") {
  const M = flowMetrics();
  const byId = new Map();
  for (const n of nodes) if (!byId.has(n.id)) byId.set(n.id, n);
  const list = [...byId.values()];

  const onCycle = new Set();
  for (const n of list) {
    const seen = new Set();
    let cur = n;
    while (cur.parent_id != null && byId.has(cur.parent_id) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_id);
      if (cur === n) { onCycle.add(n.id); break; }
    }
  }
  const isRoot = (n) => n.parent_id == null || !byId.has(n.parent_id) || onCycle.has(n.id);
  const order = (a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.id - b.id;
  const kids = new Map();
  const roots = [];
  for (const n of list) {
    if (isRoot(n)) roots.push(n);
    else { if (!kids.has(n.parent_id)) kids.set(n.parent_id, []); kids.get(n.parent_id).push(n); }
  }
  roots.sort((a, b) => a.id - b.id);
  for (const arr of kids.values()) arr.sort(order);

  const vert = orient === "v", tree = orient === "i"; // "i": árbol indentado (mobile), un nodo por fila, x = nivel * --flow-indent
  const step = vert ? M.sibW : tree ? M.treeGap : M.rowH;
  const pos = new Map(), edges = [], visited = new Set();
  let maxDepth = 0;
  const at = (depth, b) => (vert ? { x: b, y: depth * M.lvlH } : tree ? { x: depth * M.indent, y: b } : { x: depth * M.colW, y: b });

  if (tree) {
    let cursor = 0, started = false;
    const place = (n, depth) => {
      visited.add(n.id);
      if (depth > maxDepth) maxDepth = depth;
      pos.set(n.id, at(depth, cursor)); cursor += step;
      for (const c of (kids.get(n.id) || []).filter((k) => !visited.has(k.id))) { edges.push({ from: n.id, to: c.id }); place(c, depth + 1); }
    };
    const start = (r) => { if (visited.has(r.id)) return; if (started) cursor += M.rootGap; started = true; place(r, 0); };
    roots.forEach(start);
    list.forEach(start);
    return { pos, edges, w: maxDepth * M.indent, h: Math.max(0, cursor), depth: maxDepth };
  }

  /* Árbol compacto por contornos (estilo Reingold–Tilford): cada subárbol se arrima al anterior lo justo para que,
     nivel por nivel, ningún par de nodos quede a menos de un paso (--flow-row-h); el padre queda centrado entre
     su primer y su último hijo. Así las nietas pueden compartir franja con las tías (como en la referencia). */
  const merge = (acc, s, off) => {
    if (!acc) return { lo: s.lo.map((v) => v + off), hi: s.hi.map((v) => v + off) };
    const n = Math.max(acc.lo.length, s.lo.length), lo = [], hi = [];
    for (let d = 0; d < n; d++) {
      lo[d] = Math.min(acc.lo[d] ?? Infinity, s.lo[d] !== undefined ? s.lo[d] + off : Infinity);
      hi[d] = Math.max(acc.hi[d] ?? -Infinity, s.hi[d] !== undefined ? s.hi[d] + off : -Infinity);
    }
    return { lo, hi };
  };
  const offsetFor = (acc, s, gap) => {
    let off = -Infinity;
    for (let d = 0; d < Math.min(acc.hi.length, s.lo.length); d++) off = Math.max(off, acc.hi[d] - s.lo[d] + gap);
    return off;
  };
  // build: contorno relativo a la raíz del subárbol (b = 0) y posiciones relativas de sus hijos
  const build = (n, depth) => {
    visited.add(n.id);
    if (depth > maxDepth) maxDepth = depth;
    const ch = (kids.get(n.id) || []).filter((c) => !visited.has(c.id));
    const subs = [];
    let acc = null;
    for (const c of ch) {
      edges.push({ from: n.id, to: c.id });
      const s = build(c, depth + 1);
      s.off = acc ? offsetFor(acc, s, step) : 0;
      acc = merge(acc, s, s.off);
      subs.push(s);
    }
    const mid = subs.length ? (subs[0].off + subs[subs.length - 1].off) / 2 : 0;
    return { n, depth, subs, mid, lo: [0, ...(acc ? acc.lo.map((v) => v - mid) : [])], hi: [0, ...(acc ? acc.hi.map((v) => v - mid) : [])] };
  };
  const assign = (s, b) => { pos.set(s.n.id, at(s.depth, b)); for (const c of s.subs) assign(c, b + c.off - s.mid); };
  let forest = null;
  const start = (r) => {
    if (visited.has(r.id)) return;
    const s = build(r, 0);
    s.off = forest ? offsetFor(forest, s, step + M.rootGap) : 0;
    forest = merge(forest, s, s.off);
    assign(s, s.off);
  };
  roots.forEach(start);
  list.forEach(start); // red de seguridad: nada queda sin posición
  // normalizar: la banda empieza en 0
  let minB = Infinity, maxB = -Infinity;
  for (const p of pos.values()) { const b = vert ? p.x : p.y; minB = Math.min(minB, b); maxB = Math.max(maxB, b); }
  if (!pos.size) { minB = 0; maxB = -step; }
  for (const p of pos.values()) { if (vert) p.x -= minB; else p.y -= minB; }
  const extent = Math.max(0, maxB - minB + step);
  return vert ? { pos, edges, w: extent, h: (maxDepth + 1) * M.lvlH }
              : { pos, edges, w: (maxDepth + 1) * M.colW, h: extent };
}

/* ------------------------------------------------------------ helpers sobre S.nodes */
function flowKids(nodes) {
  const k = new Map();
  for (const n of nodes) {
    if (n.parent_id == null || n.parent_id === n.id) continue;
    if (!k.has(n.parent_id)) k.set(n.parent_id, []);
    k.get(n.parent_id).push(n);
  }
  return k;
}
/* ancestros + descendientes (+ el propio) calculados con S.nodes, a prueba de ciclos */
function flowPathSet(id) {
  const set = new Set([id]);
  const byId = new Map(S.nodes.map((n) => [n.id, n]));
  let cur = byId.get(id);
  while (cur && cur.parent_id != null && !set.has(cur.parent_id) && byId.has(cur.parent_id)) {
    set.add(cur.parent_id); cur = byId.get(cur.parent_id);
  }
  const kids = flowKids(S.nodes), stack = [id], seen = new Set([id]);
  while (stack.length) {
    for (const c of kids.get(stack.pop()) || []) if (!seen.has(c.id)) { seen.add(c.id); set.add(c.id); stack.push(c.id); }
  }
  return set;
}

const FLOW_LEGEND = [["done", "Hecho"], ["doing", "En curso"], ["pending", "Pendiente"], ["blocked", "Bloqueado"]];
const FLOW_ACTIVE = new Set(["doing", "review", "blocked"]);
FLOW.scope = lsGet("ramas.flowScope") === "active" ? "active" : "all"; // segmentado "Todas las ideas / Solo activas"

/* "Solo activas": ids de los nodos cuya idea raíz tiene algún descendiente Haciendo / Revisión / Bloqueado. */
function flowActiveIds(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rootOfId = new Map();
  const root = (n) => {
    if (rootOfId.has(n.id)) return rootOfId.get(n.id);
    const seen = new Set([n.id]);
    let cur = n;
    while (cur.parent_id != null && byId.has(cur.parent_id) && !seen.has(cur.parent_id)) { cur = byId.get(cur.parent_id); seen.add(cur.id); }
    rootOfId.set(n.id, cur.id);
    return cur.id;
  };
  const live = new Set();
  for (const n of nodes) if (FLOW_ACTIVE.has(n.status) && root(n) !== n.id) live.add(root(n));
  return new Set(nodes.filter((n) => live.has(root(n))).map((n) => n.id));
}

/* Barra de herramientas del Flujo (reemplaza la fila de filtros genérica, que se oculta por CSS en esta vista). */
function flowToolbar() {
  const f = S.filter;
  const people = [...new Set([...S.users.map((u) => u.name), ...S.nodes.map((n) => n.assignee).filter(Boolean)])];
  const avatar = (n) => Ramas.avatar(Ramas.PEOPLE[n] || { id: n, name: n, emoji: avatarOf(n) }, { size: "xs" });
  const who = f.who === "all" ? null : f.who;
  const stack = (who ? [who] : people).map(avatar).join("");
  const seg = (v, l) => `<button type="button" class="${FLOW.scope === v ? "is-on" : ""}" aria-pressed="${FLOW.scope === v}" data-scope="${v}">${l}</button>`;
  return `<div class="rm-filters rm-flow__bar" role="toolbar" aria-label="Herramientas del flujo">
    <nav class="rm-crumbs" aria-label="Ubicación"><a href="#/p/${encodeURIComponent(S.project.slug)}/board">${esc(S.project.name)}</a><span class="rm-crumbs__sep" aria-hidden="true">/</span><span class="rm-flow__crumb-here" aria-current="page">Flujo</span></nav>
    <span class="rm-filters__sep" aria-hidden="true"></span>
    <div class="rm-seg" role="group" aria-label="Qué ideas mostrar">${seg("all", "Todas las ideas")}${seg("active", "Solo activas")}</div>
    <span class="rm-flow__people">
      <button type="button" class="rm-chip${who ? " is-on" : ""}" data-people aria-haspopup="menu" aria-expanded="false" aria-label="Responsable: ${who ? esc(who) : "todos"}"><span class="rm-avatar-stack">${stack}</span>${who ? esc(who) : "Todos"}</button>
      <div class="rm-flow__menu" role="menu" hidden>
        ${["all", ...people].map((n) => `<button type="button" role="menuitemradio" aria-checked="${f.who === n}" class="rm-flow__menuitem${f.who === n ? " is-on" : ""}" data-who="${esc(n)}">${n === "all" ? "Todos" : `${avatar(n)}<span>${esc(n)}</span>`}</button>`).join("")}
      </div>
    </span>
    <button type="button" class="rm-switch rm-flow__switch${f.hideDone ? " is-on" : ""}" role="switch" aria-checked="${f.hideDone}" data-hide><span class="rm-switch__t" aria-hidden="true"></span>Ocultar hechas</button>
    <span class="rm-flow__bar-spacer"></span>
    <div class="rm-legend" aria-label="Leyenda de conectores">${FLOW_LEGEND.map(([k, l]) =>
      `<span><svg class="rm-flow__legend-svg" viewBox="0 0 34 10" aria-hidden="true">${Ramas.arrowDefs("lg" + k)}${Ramas.edge("M2,5 L28,5", k, { prefix: "lg" + k })}</svg>${l}</span>`).join("")}</div>
  </div>`;
}
function bindFlowToolbar(main) {
  const bar = main.querySelector(":scope > .rm-flow__bar");
  if (!bar) return;
  const menu = bar.querySelector(".rm-flow__menu"), trigger = bar.querySelector("[data-people]");
  const setMenu = (open) => {
    menu.hidden = !open; trigger.setAttribute("aria-expanded", String(open));
    if (open) (menu.querySelector(".is-on") || menu.querySelector("button"))?.focus();
  };
  const rerender = () => { renderChrome(); renderMain(); };
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.scope) { FLOW.scope = b.dataset.scope; lsSet("ramas.flowScope", FLOW.scope); rerender(); }
    else if (b.hasAttribute("data-people")) setMenu(menu.hidden);
    else if (b.dataset.who) { S.filter.who = b.dataset.who; setMenu(false); rerender(); main.querySelector("[data-people]")?.focus(); }
    else if (b.hasAttribute("data-hide")) { S.filter.hideDone = !S.filter.hideDone; rerender(); main.querySelector("[data-hide]")?.focus(); }
  });
  bar.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setMenu(false); trigger.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus(); }
  });
  bar.addEventListener("focusout", (e) => { if (!menu.hidden && !bar.querySelector(".rm-flow__people").contains(e.relatedTarget)) setMenu(false); });
}

/* ------------------------------------------------------------ render */
function renderFlow(main) {
  const slug = S.project.slug;
  FLOW.main = main;
  // arrastre en curso sobre este mismo canvas (p.ej. llega el refresco de 10 s): no se corta, se difiere hasta pointerup.
  // Tope de seguridad: un arrastre sin actividad por más de --flow-drag-stale se da por perdido.
  const stale = FLOW.metrics && performance.now() - FLOW.dragAt > FLOW.metrics.dragStale;
  if (FLOW.dragging && !stale && FLOW.slug === slug && main.querySelector(":scope > .rm-flow:not(.is-empty):not(.is-loading)")) { FLOW.pending = true; return; }
  FLOW.dragging = FLOW.pending = false;
  clearTimeout(FLOW.liveT);
  cancelAnimationFrame(FLOW.retryRaf);
  FLOW.ro?.disconnect();
  if (FLOW.slug !== slug) Object.assign(FLOW, { slug, view: null, hover: null, focus: null, focusId: null });
  const hadFocus = main.contains(document.activeElement) && document.activeElement.closest?.(".rm-card");
  const M = flowMetrics();
  // CSS todavía sin resolver: estado de carga y reintento (por frame con tope; después, al cargar alguna hoja).
  // Nunca se calcula ni se persiste FLOW.view con métricas en cero.
  if (!FLOW.metrics) return renderFlowLoading(main);
  FLOW.retries = 0;

  // filtro: un nodo se muestra si él o algún descendiente pasa visible()
  const vis = new Set(visible(S.nodes).map((n) => n.id));
  const kids = flowKids(S.nodes);
  const memo = new Map();
  const shows = (n, stack) => {
    if (memo.has(n.id)) return memo.get(n.id);
    if (stack.has(n.id)) return vis.has(n.id);
    stack.add(n.id);
    const r = vis.has(n.id) || (kids.get(n.id) || []).some((c) => shows(c, stack));
    stack.delete(n.id);
    memo.set(n.id, r);
    return r;
  };
  const inScope = FLOW.scope === "active" ? flowActiveIds(S.nodes) : null;
  const shown = S.nodes.filter((n) => shows(n, new Set()) && (!inScope || inScope.has(n.id)));
  const shownKids = (id) => (kids.get(id) || []).filter((c) => memo.get(c.id));
  // colapso: todo lo que cuelga de un nodo colapsado queda fuera
  const hidden = new Set();
  for (const id of S.collapsed) {
    const stack = [id], seen = new Set([id]);
    while (stack.length) for (const c of shownKids(stack.pop())) if (!seen.has(c.id)) { seen.add(c.id); hidden.add(c.id); stack.push(c.id); }
  }
  const laid = shown.filter((n) => !hidden.has(n.id));

  if (!laid.length) return renderFlowEmpty(main, S.nodes.length > 0);

  const tree = MOBILE_MQ.matches; // mobile: árbol indentado con conectores que bajan
  const L = layoutTree(laid, tree ? "i" : "h");
  const pad = M.pad;
  // mobile: el ancho de la tarjeta se calcula para que el árbol entero entre en pantalla a 100%
  // las tarjetas comparten el borde derecho: cada nivel pierde su sangría de ancho (la raíz ocupa todo el ancho útil)
  const treeW = tree ? Math.max(M.colW / 2, document.documentElement.clientWidth - M.treeInset * 2) : 0;
  let stageW = (tree ? treeW : L.w) + pad * 2; // escritorio: se recalcula con los anchos reales de columna
  let stageH = L.h + pad * 2;
  // orden del DOM = orden lógico del árbol (pre-orden: idea → hijas en orden de lectura), que es el orden en que
  // layoutTree inserta en L.pos; así Tab recorre padre antes que hijos (WCAG 2.4.3). El posicionamiento sigue absoluto.
  const laidById = new Map(laid.map((n) => [n.id, n]));
  const cards = [...L.pos.keys()].map((id) => laidById.get(id)).filter(Boolean).map((n) => {
    const p = L.pos.get(n.id);
    const sk = shownKids(n.id).length;
    const all = kids.get(n.id) || [];
    const branches = all.length ? [all.filter((c) => c.status === "done").length, all.length] : null;
    const opts = S.collapsed.has(n.id) && sk ? { collapsed: sk, branches } : { toggle: sk > 0, branches, noGlow: n.kind === "idea" };
    // a11y sin tocar la plantilla: aria-expanded en el toggle / "+N ramas"
    const html = Ramas.card(toTplNode(n), tree ? { ...opts, compact: true } : opts)
      .replace('<button class="rm-card__toggle"', `<button class="rm-card__toggle" aria-expanded="true"`)
      .replace('<button class="rm-card__more"', `<button class="rm-card__more" aria-expanded="false" aria-label="Expandir ${sk} ramas"`);
    return `<div class="rm-flow__node" data-nid="${n.id}" style="left:${p.x + pad}px;top:${p.y + pad}px${tree ? `;width:${treeW - p.x}px` : ""}">${html}</div>`;
  }).join("");

  main.innerHTML = flowToolbar() + `<div class="rm-flow rm-dotgrid${tree ? " rm-flow--tree" : ""}" role="group" aria-roledescription="canvas" aria-label="Canvas de flujo: arrastrá o usá la rueda para moverte, ctrl + rueda o +/− para zoom; flechas para recorrer los nodos, Enter o Espacio para abrir">
    <div class="rm-flow__stage" style="width:${stageW}px;height:${stageH}px">
      <svg class="rm-flow__edges" width="${stageW}" height="${stageH}" aria-hidden="true"></svg>${cards}
    </div>
    <div class="rm-flow__hud rm-flow__hud--tl" data-hud="sel"></div>
    <div class="rm-flow__hud rm-flow__hud--br">
      <div class="rm-minimap" role="button" tabindex="0" aria-label="Minimapa: tocá para mover la vista"><div class="rm-minimap__view"></div></div>
      <button class="rm-btn rm-btn--secondary" data-act="center">⌖ Centrar en esta idea</button>
      <div class="rm-canvas-ctrl" role="group" aria-label="Zoom">
        <button class="rm-iconbtn" data-act="zin" aria-label="Acercar" title="Acercar (+)">＋</button>
        <span class="rm-canvas-ctrl__zoom" aria-hidden="true">100%</span><span class="rm-sr" role="status" data-zoom-live></span>
        <button class="rm-iconbtn" data-act="zout" aria-label="Alejar" title="Alejar (−)">−</button>
        <button class="rm-iconbtn" data-act="fit" aria-label="Ver todo" title="Ver todo">⤢</button>
      </div>
    </div>
  </div>`;

  bindFlowToolbar(main);
  const cv = main.querySelector(".rm-flow");
  const stage = cv.querySelector(".rm-flow__stage");
  const svg = cv.querySelector(".rm-flow__edges");
  const mm = cv.querySelector(".rm-minimap");
  const mmView = mm.querySelector(".rm-minimap__view");
  const zl = cv.querySelector(".rm-canvas-ctrl__zoom");
  const fitHeight = () => { cv.style.height = Math.max(0, window.innerHeight - cv.getBoundingClientRect().top) + "px"; };
  fitHeight();
  // árbol vertical: cada fila mide lo que mide su tarjeta (+ --flow-tree-gap de aire); layoutTree solo fija el orden
  if (tree) {
    let y = 0;
    const measured = new Map(); // tarjeta → alto con el que se armó el árbol
    [...cv.querySelectorAll(".rm-flow__node")].sort((a, b) => L.pos.get(+a.dataset.nid).y - L.pos.get(+b.dataset.nid).y).forEach((w) => {
      const h = w.firstElementChild.offsetHeight;
      measured.set(w.firstElementChild, h);
      L.pos.get(+w.dataset.nid).y = y; w.style.top = y + pad + "px"; y += h + M.treeGap;
    });
    stageH = y + pad * 2;
    stage.style.height = stageH + "px"; svg.setAttribute("height", stageH);
    // si una tarjeta cambia de alto después (fuentes, contadores), se vuelve a acomodar el árbol.
    // Se compara contra lo medido (no se saltea la "primera" notificación: un cambio previo a ella también cuenta).
    FLOW.ro?.disconnect();
    const ro = FLOW.ro = new ResizeObserver(() => {
      let changed = false;
      measured.forEach((h, c) => { if (c.isConnected && c.offsetHeight !== h) changed = true; });
      if (!changed) return;
      ro.disconnect();
      requestAnimationFrame(() => { if (S.view === "flow" && main.contains(cv)) renderFlow(main); });
    });
    measured.forEach((h, c) => ro.observe(c));
  }

  // geometría (una sola pasada de lectura)
  const geo = new Map(), cardEl = new Map();
  cv.querySelectorAll(".rm-flow__node").forEach((w) => {
    const id = +w.dataset.nid, c = w.firstElementChild, p = L.pos.get(id);
    cardEl.set(id, c);
    geo.set(id, { x: p.x + pad, y: p.y + pad, w: c.offsetWidth, h: c.offsetHeight });
  });
  // escritorio: cada columna arranca --flow-gap-x después de la tarjeta más ancha de la anterior (idea 288 / tarea 252),
  // así el aire entre niveles es parejo (layoutTree solo fija el nivel con x = nivel * --flow-col-w)
  if (!tree) {
    const lvl = (id) => Math.round(L.pos.get(id).x / M.colW);
    const colW = [];
    geo.forEach((g, id) => { const d = lvl(id); colW[d] = Math.max(colW[d] || 0, g.w); });
    const colX = [0];
    for (let d = 1; d < colW.length; d++) colX[d] = colX[d - 1] + (colW[d - 1] || 0) + M.gapX;
    cv.querySelectorAll(".rm-flow__node").forEach((w) => {
      const id = +w.dataset.nid, x = colX[lvl(id)];
      L.pos.get(id).x = x; geo.get(id).x = x + pad; w.style.left = x + pad + "px";
    });
    stageW = colX[colX.length - 1] + (colW[colW.length - 1] || 0) + M.edgeOut + pad * 2;
    stage.style.width = stageW + "px"; svg.setAttribute("width", stageW);
  }
  const byId = new Map(laid.map((n) => [n.id, n]));
  const topOf = (g) => (tree ? g.y : g.y + (M.rowH - g.h) / 2); // en el árbol la tarjeta arranca arriba de su fila
  const parentOf = new Map(L.edges.map((e) => [e.to, e.from]));
  const childrenOf = new Map();
  L.edges.forEach((e) => { if (!childrenOf.has(e.from)) childrenOf.set(e.from, []); childrenOf.get(e.from).push(e.to); });
  const edges = L.edges.map((e) => {
    const a = geo.get(e.from), b = geo.get(e.to);
    const d = tree
      ? Ramas.edgePath(a.x + M.indent / 2, a.y + a.h, b.x - M.edgeIn, b.y + b.h / 2, "v") // baja por la columna del padre y entra por el borde izquierdo
      : Ramas.edgePath(a.x + a.w + M.edgeOut, a.y + M.rowH / 2, b.x - M.edgeIn, b.y + M.rowH / 2, "h");
    return { ...e, d, kind: Ramas.edgeKind(byId.get(e.to).status) };
  });
  const rootIdOf = (id) => { let cur = id, g = 0; while (parentOf.has(cur) && g++ < laid.length) cur = parentOf.get(cur); return cur; };
  const subtree = (id) => { const out = [id]; for (let i = 0; i < out.length; i++) out.push(...(childrenOf.get(out[i]) || [])); return out; };

  // minimapa
  const inset = M.edgeOut / 2;
  const msRaw = Math.min((mm.clientWidth - inset * 2) / stageW, (mm.clientHeight - inset * 2) / stageH);
  const ms = Number.isFinite(msRaw) && msRaw > 0 ? msRaw : 0;
  const mox = (mm.clientWidth - stageW * ms) / 2, moy = (mm.clientHeight - stageH * ms) / 2;
  mm.insertAdjacentHTML("afterbegin", laid.map((n) => {
    const g = geo.get(n.id), top = topOf(g);
    return `<i class="rm-minimap__node rm-minimap__node--${n.status}" data-mid="${n.id}" style="left:${mox + g.x * ms}px;top:${moy + top * ms}px;width:${Math.max(M.mmMin, g.w * ms)}px;height:${Math.max(M.mmMin, g.h * ms)}px"></i>`;
  }).join(""));

  // vista
  const view = () => FLOW.view;
  const zLive = cv.querySelector("[data-zoom-live]");
  // lastK se siembra con el zoom vigente: un re-render (refresco de 10 s) no re-anuncia nada
  let lastK = FLOW.view ? FLOW.view.k : null, allB = null;
  // k siempre finito y dentro de [kMin, kMax] (kMin > 0 garantizado por flowMetricsOk)
  const clampK = (k) => (Number.isFinite(k) && k > 0 ? Math.min(M.kMax, Math.max(M.kMin, k)) : M.kMin);
  const fin = (n) => (Number.isFinite(n) ? n : 0);
  // límites de pan: al menos --flow-pan-margin del grafo queda dentro del viewport
  const clampView = (v) => {
    const k = clampK(v?.k);
    const b = allB ||= bounds(laid.map((n) => n.id)), cw = cv.clientWidth, ch = cv.clientHeight;
    const mx = Math.min(M.panMargin, cw / 2), my = Math.min(M.panMargin, ch / 2);
    const cl = (val, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, val)));
    return { k, x: fin(cl(fin(v?.x), mx - b.x1 * k, cw - mx - b.x0 * k)), y: fin(cl(fin(v?.y), my - b.y1 * k, ch - my - b.y0 * k)) };
  };
  const apply = (anim) => {
    const v = FLOW.view = clampView(view());
    if (lastK === null) lastK = v.k; // encuadre inicial: sin anuncio
    else if (v.k !== lastK) { // anuncio del zoom solo ante un cambio real y cuando se asienta (sin aria-live por tick)
      lastK = v.k;
      clearTimeout(FLOW.liveT);
      FLOW.liveT = setTimeout(() => { zLive.textContent = `Zoom ${Math.round(v.k * 100)}%`; }, M.live);
    }
    stage.classList.toggle("is-anim", !!anim);
    stage.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
    zl.textContent = Math.round(v.k * 100) + "%";
    mmView.style.left = mox + (-v.x / v.k) * ms + "px";
    mmView.style.top = moy + (-v.y / v.k) * ms + "px";
    mmView.style.width = (cv.clientWidth / v.k) * ms + "px";
    mmView.style.height = (cv.clientHeight / v.k) * ms + "px";
  };
  const zoomAt = (f, cx, cy, anim) => {
    const v = clampView(view()), k = clampK(v.k * f), r = k / v.k;
    FLOW.view = { x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r, k };
    apply(anim);
  };
  const zoomBy = (f) => zoomAt(f, cv.clientWidth / 2, cv.clientHeight / 2, true);
  const bounds = (ids) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach((id) => {
      const g = geo.get(id); if (!g) return;
      const top = topOf(g);
      x0 = Math.min(x0, g.x); y0 = Math.min(y0, top); x1 = Math.max(x1, g.x + g.w + M.edgeOut); y1 = Math.max(y1, top + g.h);
    });
    return { x0, y0, x1, y1 };
  };
  const fitTo = (ids, anim, maxK = M.fitMax, minK = M.kMin, alignTop = false, pad = M.pad) => {
    const b = bounds(ids), cw = cv.clientWidth, ch = cv.clientHeight;
    const k = clampK(Math.min(maxK, Math.max(minK, Math.min((cw - pad * 2) / (b.x1 - b.x0), (ch - pad * 2) / (b.y1 - b.y0)))));
    const x = (cw - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
    const tall = (b.y1 - b.y0) * k > ch - pad * 2;
    const y = alignTop && tall ? pad - b.y0 * k : (ch - (b.y1 - b.y0) * k) / 2 - b.y0 * k;
    FLOW.view = { x: alignTop && tall ? pad - b.x0 * k : x, y, k };
    apply(anim);
  };
  const firstRoot = () => { const ideas = laid.filter((n) => !parentOf.has(n.id)); return (ideas.find((n) => n.kind === "idea") || ideas[0]).id; };
  const centerIdea = () => {
    const sel = S.selectedId != null && byId.has(S.selectedId) ? S.selectedId : null;
    fitTo(subtree(rootIdOf(sel ?? firstRoot())), true);
  };
  const centerOn = (id) => {
    const g = geo.get(id), v = view();
    FLOW.view = { k: v.k, x: cv.clientWidth / 2 - (g.x + g.w / 2) * v.k, y: cv.clientHeight / 2 - (topOf(g) + g.h / 2) * v.k };
    apply(true);
  };
  // encuadre inicial: árbol de la primera idea, lo más cerca posible de 100%
  // mobile: el árbol entra a lo ancho a 100% y se recorre con pan vertical (no se achica para que entre todo el alto)
  const fitTop = () => {
    const b = bounds(subtree(firstRoot()));
    FLOW.view = { k: 1, x: M.treeInset - b.x0, y: M.treeInset - b.y0 };
    apply(false);
  };
  if (!FLOW.view) { if (tree) fitTop(); else fitTo(subtree(firstRoot()), false, 1, M.startMin, true, M.fitPad); } else apply(false);

  // camino iluminado
  const paint = () => {
    const pick = [FLOW.hover, FLOW.focus, S.selectedId].find((id) => id != null && byId.has(id));
    const set = pick != null ? flowPathSet(pick) : null;
    cardEl.forEach((c, id) => {
      c.classList.toggle("is-path", !!set && set.has(id));
      c.classList.toggle("is-dimmed", !!set && !set.has(id));
      c.classList.toggle("is-selected", id === S.selectedId);
    });
    svg.innerHTML = Ramas.arrowDefs("flow") + edges.map((e) => {
      const on = !!set && set.has(e.from) && set.has(e.to);
      return Ramas.edge(e.d, e.kind, { prefix: "flow", path: on, dimmed: !!set && !on })
        .replace('<path class="rm-edge ', `<path data-edge="R-${e.from}&gt;R-${e.to}" class="rm-edge `);
    }).join("");
    mm.querySelectorAll(".rm-minimap__node").forEach((m) => m.classList.toggle("is-dimmed", !!set && !set.has(+m.dataset.mid)));
    const hud = cv.querySelector('[data-hud="sel"]');
    const sn = S.selectedId != null ? S.nodes.find((n) => n.id === S.selectedId) : null;
    if (!sn) { hud.innerHTML = ""; return; }
    const root = byId.has(sn.id) ? rootIdOf(sn.id) : sn.id;
    hud.innerHTML = `<span class="rm-flow__selchip"><span class="rm-id">R-${sn.id}</span><b>${esc(sn.title)}</b><span class="rm-faint">· ${root === sn.id ? "idea cero" : "camino desde R-" + root}</span><button class="rm-iconbtn" data-act="clear" aria-label="Quitar selección">×</button></span>`;
  };
  paint();

  // ------------------------------------------------------------ eventos
  const idOf = (el) => { const w = el?.closest?.(".rm-flow__node"); return w ? +w.dataset.nid : null; };
  const open = (id) => { FLOW.focusId = id; select(id); go({ node: id }); };

  cv.addEventListener("mouseover", (e) => {
    const c = e.target.closest(".rm-card"); if (!c) return;
    const id = idOf(c);
    if (id !== FLOW.hover) { FLOW.hover = id; paint(); }
  });
  cv.addEventListener("mouseout", (e) => {
    const c = e.target.closest(".rm-card"); if (!c || c.contains(e.relatedTarget)) return;
    if (!e.relatedTarget?.closest?.(".rm-card")) { FLOW.hover = null; paint(); }
  });
  cv.addEventListener("focusin", (e) => {
    const c = e.target.closest(".rm-card"); if (!c) return;
    FLOW.focus = FLOW.focusId = idOf(c); paint();
  });
  cv.addEventListener("focusout", (e) => {
    if (e.relatedTarget?.closest?.(".rm-flow .rm-card")) return;
    FLOW.focus = null; paint();
  });

  cv.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "zin") zoomBy(M.zoomStep);
      else if (a === "zout") zoomBy(1 / M.zoomStep);
      else if (a === "fit") fitTo(laid.map((n) => n.id), true);
      else if (a === "center") centerIdea();
      else if (a === "clear") select(null);
      return;
    }
    const tog = e.target.closest(".rm-card__toggle, .rm-card__more");
    if (tog) {
      e.stopPropagation();
      const id = idOf(tog);
      S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id);
      lsSet("ramas.collapsed", JSON.stringify([...S.collapsed]));
      FLOW.focusId = id;
      const keep = main.contains(document.activeElement);
      renderFlow(main);
      if (keep) main.querySelector(`.rm-flow__node[data-nid="${id}"] .rm-card`)?.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest(".rm-minimap")) {
      const r = mm.getBoundingClientRect(), v = view();
      const sx = (e.clientX - r.left - mox) / ms, sy = (e.clientY - r.top - moy) / ms;
      FLOW.view = { k: v.k, x: cv.clientWidth / 2 - sx * v.k, y: cv.clientHeight / 2 - sy * v.k };
      apply(true);
      return;
    }
    const card = e.target.closest(".rm-card");
    if (card) open(idOf(card));
  });

  // pan (un dedo / mouse) y pinch (dos punteros). En táctil el pan también arranca sobre una tarjeta; si hubo arrastre se descarta el click.
  let drag = null, pinch = null, swallow = false;
  const pts = new Map();
  const pinchState = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  cv.addEventListener("click", (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  cv.addEventListener("pointerdown", (e) => {
    swallow = false;
    if (e.target.closest("button, .rm-minimap, .rm-flow__hud")) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { drag = null; cv.classList.remove("is-panning"); pinch = pinchState(); swallow = true; FLOW.dragging = true; FLOW.dragAt = performance.now(); return; }
    }
    if (e.button !== 0 || (e.target.closest(".rm-card") && e.pointerType === "mouse")) return;
    drag = { sx: e.clientX, sy: e.clientY, x: view().x, y: view().y, moved: false };
    drag.card = !!e.target.closest(".rm-card"); drag.id = e.pointerId;
    FLOW.dragging = true; FLOW.dragAt = performance.now();
    if (!drag.card) try { cv.setPointerCapture(e.pointerId); } catch { /* sin captura: quedan los fallbacks de window */ }
  });
  cv.addEventListener("pointermove", (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      FLOW.dragAt = performance.now();
      const n = pinchState(), r = cv.getBoundingClientRect(), v = view();
      FLOW.view = { k: v.k, x: v.x + n.mx - pinch.mx, y: v.y + n.my - pinch.my };
      zoomAt(n.d / pinch.d, n.mx - r.left, n.my - r.top, false);
      pinch = n;
      return;
    }
    if (!drag) return;
    FLOW.dragAt = performance.now();
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < M.dragMin) return;
    if (!drag.moved && drag.card) try { cv.setPointerCapture(drag.id); } catch { /* idem */ } // sobre una tarjeta se captura recién al arrastrar: un tap sigue siendo click
    drag.moved = true; swallow = true; cv.classList.add("is-panning");
    FLOW.view = { ...view(), x: drag.x + dx, y: drag.y + dy };
    apply(false);
  });
  const endDrag = (cancel = false) => {
    FLOW.dragging = false; // siempre se limpia, aunque este canvas ya no tenga drag propio
    if (!drag) { if (!pts.size && FLOW.pending) { FLOW.pending = false; if (S.view === "flow" && main.contains(cv)) renderFlow(main); } return; }
    const clicked = !drag.moved && !cancel && !drag.card;
    drag = null; cv.classList.remove("is-panning");
    if (FLOW.pending) { FLOW.pending = false; if (S.view === "flow" && main.contains(cv)) renderFlow(main); }
    if (clicked && S.selectedId != null) select(null); // click en el fondo: limpia selección
  };
  FLOW.endDrag = endDrag;
  const release = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  const lift = (e, cancel) => { release(e); endDrag(cancel); };
  FLOW.release = release;
  FLOW.clearPointers = () => { pts.clear(); pinch = null; };
  cv.addEventListener("pointerup", (e) => lift(e, false));
  cv.addEventListener("pointercancel", (e) => lift(e, true));
  cv.addEventListener("lostpointercapture", (e) => lift(e, true));
  // rueda: ctrl/⌘ (o pinch de trackpad, que llega como ctrl+wheel) = zoom proporcional al delta; sin modificador = pan
  cv.addEventListener("wheel", (e) => {
    const unit = e.deltaMode === 1 ? M.wheelLine : e.deltaMode === 2 ? cv.clientHeight : 1;
    let dx = e.deltaX * unit, dy = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      if (!dy) return;
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(Math.exp(-dy * M.zoomSens), e.clientX - r.left, e.clientY - r.top, false);
      return;
    }
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    if (!dx && !dy) return;
    e.preventDefault();
    const v = view();
    FLOW.view = { k: v.k, x: v.x - dx, y: v.y - dy };
    apply(false);
  }, { passive: false });

  // teclado sobre nodos
  const ensureVisible = (id) => {
    const c = cardEl.get(id).getBoundingClientRect(), r = cv.getBoundingClientRect();
    if (c.left < r.left || c.right > r.right || c.top < r.top || c.bottom > r.bottom) centerOn(id);
  };
  const neighbor = (id, key) => {
    if (key === "ArrowRight") return (childrenOf.get(id) || [])[0] ?? null;
    if (key === "ArrowLeft") return parentOf.get(id) ?? null;
    const g = geo.get(id), up = key === "ArrowUp";
    let best = null, bd = Infinity;
    geo.forEach((o, oid) => {
      if (oid === id || (!tree && o.x !== g.x)) return;
      const d = up ? g.y - o.y : o.y - g.y;
      if (d > 0 && d < bd) { bd = d; best = oid; }
    });
    return best;
  };
  cv.addEventListener("keydown", (e) => {
    if (e.target.closest(".rm-minimap") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); centerIdea(); return; }
    const card = e.target.closest(".rm-card");
    if (!card || e.target !== card) return;
    const id = idOf(card);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(id); return; }
    if (e.key.startsWith("Arrow")) {
      const nb = neighbor(id, e.key);
      e.preventDefault();
      if (nb != null) { cardEl.get(nb).focus({ preventScroll: true }); ensureVisible(nb); }
    }
  });

  FLOW.ctl = { zoomBy, step: () => M.zoomStep, paint, resize: () => { fitHeight(); apply(false); }, has: (id) => geo.has(id), centerOn };
  flowCenterPending(); // "Ver en flujo ⌖" pedido antes de que el canvas existiera

  if (hadFocus && FLOW.focusId != null && cardEl.has(FLOW.focusId)) cardEl.get(FLOW.focusId).focus({ preventScroll: true });
}

/* Pedido de centrado ("ramas:center", p.ej. desde "Ver en flujo ⌖" del detalle): se cumple apenas el canvas del Flujo
   está renderizado; si el nodo no está a la vista (filtro / colapso), se descarta. */
function flowCenterPending() {
  const id = FLOW.centerReq;
  if (id == null || S.view !== "flow" || !FLOW.ctl || !FLOW.main?.querySelector(":scope > .rm-flow:not(.is-empty):not(.is-loading)")) return;
  FLOW.centerReq = null;
  if (FLOW.ctl.has(id)) FLOW.ctl.centerOn(id);
}

function renderFlowLoading(main) {
  FLOW.ctl = null;
  if (!main.querySelector(":scope > .rm-flow.is-loading")) {
    main.innerHTML = `<div class="rm-flow rm-dotgrid is-loading" aria-busy="true" aria-label="Canvas de flujo">
      <div class="rm-flow__skel"><div class="rm-skel"></div><div class="rm-skel"></div><div class="rm-skel"></div></div>
      <span class="rm-sr" role="status">Cargando el flujo…</span></div>`;
  }
  if (FLOW.retries++ < FLOW_RETRY_FRAMES) FLOW.retryRaf = requestAnimationFrame(flowRetry);
}
/* Reintenta el render si seguimos en Flujo y todavía mostrando el estado de carga. */
function flowRetry() {
  const main = FLOW.main;
  if (!main || S.view !== "flow" || !S.project || !main.querySelector(":scope > .rm-flow.is-loading")) return;
  renderFlow(main);
}

function renderFlowEmpty(main, filtered) {
  FLOW.ctl = null;
  const onlyActive = filtered && FLOW.scope === "active";
  main.innerHTML = (filtered ? flowToolbar() : "") + `<div class="rm-flow rm-dotgrid is-empty" aria-label="Canvas de flujo">
    <div class="rm-empty">
      <div class="rm-empty__icon" aria-hidden="true">◉</div>
      <h2 class="rm-empty__title">${filtered ? (onlyActive ? "Ninguna idea está activa ahora" : "Nada coincide con los filtros") : "Todavía no hay ideas en este proyecto"}</h2>
      <p>${filtered ? (onlyActive ? "Cuando una rama pase a Haciendo, Revisión o Bloqueado, su idea aparece acá." : "Probá con otro responsable o mostrá las hechas.") : "Escribí la idea cero o grabala por audio: después la ramificás en tareas."}</p>
      ${filtered ? `<button class="rm-btn rm-btn--secondary" data-act="clearfilters">Limpiar filtros</button>` : `<button class="rm-btn rm-btn--primary" data-act="newidea">＋ Nueva idea</button>`}
    </div></div>`;
  bindFlowToolbar(main);
  const cv = main.querySelector(".rm-flow");
  cv.style.height = Math.max(0, window.innerHeight - cv.getBoundingClientRect().top) + "px";
  cv.onclick = (e) => {
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "newidea") newIdea();
    else if (a === "clearfilters") {
      S.filter = { who: "all", level: "all", hideDone: false };
      FLOW.scope = "all"; lsSet("ramas.flowScope", "all");
      renderChrome(); renderMain();
    }
  };
}

if (!window.__ramasFlowBound) {
  window.__ramasFlowBound = true;
  // una hoja de estilos que termina de cargar (p.ej. extra-flow.css tardía) destraba el estado de carga
  document.addEventListener("load", (e) => { if (e.target?.tagName === "LINK") { FLOW.retries = 0; flowRetry(); } }, true);
  // red de seguridad del arrastre: si se pierde el pointerup/captura, el próximo refresco no queda bloqueado
  window.addEventListener("pointerup", (e) => { FLOW.release?.(e); FLOW.endDrag?.(false); }, true);
  window.addEventListener("pointercancel", (e) => { FLOW.release?.(e); FLOW.endDrag?.(true); }, true);
  window.addEventListener("blur", () => { FLOW.clearPointers?.(); FLOW.endDrag?.(true); });
  document.addEventListener("ramas:select", () => { if (S.view === "flow") FLOW.ctl?.paint(); });
  // centrar en un nodo (detail = id numérico); si el Flujo todavía no se renderizó, queda pendiente para el próximo render
  document.addEventListener("ramas:center", (e) => {
    const id = Number(e.detail);
    if (!Number.isFinite(id)) return;
    FLOW.centerReq = id;
    flowCenterPending();
  });
  window.addEventListener("resize", () => { if (S.view === "flow") FLOW.ctl?.resize(); });
  document.addEventListener("keydown", (e) => {
    if (S.view !== "flow" || !FLOW.ctl || e.defaultPrevented || recState) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // no secuestrar Ctrl/⌘ +/− del navegador
    // atajos solo con el foco en el canvas o en el body: nunca dentro de drawer, modal, diálogos ni campos
    const t = e.target.closest ? e.target : document.body;
    if (t.closest("input, textarea, select, [contenteditable], #drawer, #modal, .modal-wrap, [role=dialog], #recorder")) return;
    if (document.querySelector("#modal.on") || (t !== document.body && !t.closest(".rm-flow"))) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); FLOW.ctl.zoomBy(FLOW.ctl.step()); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); FLOW.ctl.zoomBy(1 / FLOW.ctl.step()); }
    else if (e.key === "Escape" && S.selectedId != null) select(null);
  });
}
