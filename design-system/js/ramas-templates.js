/* Ramas — plantillas de markup en JS puro (sin framework). Devuelven strings HTML/SVG con las clases rm- de bundle.css.
   No hay lógica de negocio: solo presentación + datos de ejemplo del proyecto "App Turnos". */
(function () {
  var STATUS = {
    inbox: 'Inbox', todo: 'Por hacer', doing: 'Haciendo', review: 'Revisión', done: 'Hecho', blocked: 'Bloqueado'
  };
  var PRIO = { urgent: ['Urgente', 4], high: ['Alta', 3], medium: ['Media', 2], low: ['Baja', 1] };
  var LOG = { summary: 'Resumen', decision: 'Decisión', question: 'Pregunta abierta', blocker: 'Bloqueo', note: 'Nota', commit: 'Commit' };
  var PEOPLE = {
    benja:  { id: 'benja',  name: 'Benja',  emoji: '🐥' },
    tomi:   { id: 'tomi',   name: 'Tomi',   emoji: '🦊' },
    claude: { id: 'claude', name: 'claude', emoji: '🤖', agent: true },
    codex:  { id: 'codex',  name: 'codex',  emoji: '🤖', agent: true }
  };
  var ANIMALS = ['🐥', '🦊', '🐸', '🐼', '🦉', '🐙', '🐨', '🐧', '🦔', '🐢', '🦝', '🐝'];

  /* Árbol de ejemplo. parent = null para la idea cero. */
  var NODES = [
    { id: 'R-1', parent: null, kind: 'idea', title: 'Reservas de turnos por WhatsApp', status: 'doing', prio: 'high', owner: 'tomi',
      counts: { audio: 1, img: 2, link: 1, q: 1, time: '10h 40m' }, origin: { name: 'idea-tomi.m4a', dur: '02:14' } },
    { id: 'R-2', parent: 'R-1', kind: 'task', title: 'Webhook de WhatsApp Cloud API', status: 'review', prio: 'high', owner: 'benja',
      counts: { link: 2, time: '3h 20m' } },
    { id: 'R-3', parent: 'R-1', kind: 'task', title: 'Modelo de turnos y disponibilidad', status: 'doing', prio: 'urgent', owner: 'claude',
      counts: { audio: 1, img: 1, link: 1, q: 1, time: '6h 40m' } },
    { id: 'R-4', parent: 'R-1', kind: 'task', title: 'Mensajes de confirmación', status: 'todo', prio: 'medium', owner: 'codex',
      counts: { link: 1 } },
    { id: 'R-5', parent: 'R-1', kind: 'task', title: 'Panel para el negocio', status: 'todo', prio: 'low', owner: null,
      counts: { img: 3 } },
    { id: 'R-6', parent: 'R-3', kind: 'task', title: 'Tabla de slots', status: 'done', prio: 'high', owner: 'claude',
      counts: { link: 1, time: '2h 15m' } },
    { id: 'R-7', parent: 'R-3', kind: 'task', title: 'Bloqueo por feriados', status: 'todo', prio: 'medium', owner: 'benja',
      counts: {} }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function byId(id) { for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i]; return null; }
  function children(id) { return NODES.filter(function (n) { return n.parent === id; }); }
  function descendants(id) { var out = []; children(id).forEach(function (c) { out.push(c); out = out.concat(descendants(c.id)); }); return out; }
  function ancestors(id) { var out = [], n = byId(id); while (n && n.parent) { n = byId(n.parent); out.unshift(n); } return out; }
  function branchCount(id) { var c = children(id); return c.length ? [c.filter(function (x) { return x.status === 'done'; }).length, c.length] : null; }

  function prio(level, opts) {
    var p = PRIO[level] || PRIO.low; opts = opts || {};
    return '<span class="rm-prio rm-prio--' + level + '" title="Prioridad ' + p[0] + '"><span class="rm-prio__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + (opts.bare ? '<span class="rm-sr">' + p[0] + '</span>' : p[0]) + '</span>';
  }
  function pill(status, opts) {
    opts = opts || {};
    return '<span class="rm-pill rm-pill--' + status + (opts.interactive ? ' is-interactive' : '') + (opts.cls ? ' ' + opts.cls : '') + '">' + STATUS[status] + '</span>';
  }
  function logtag(type) { return '<span class="rm-logtag rm-logtag--' + type + '">' + LOG[type] + '</span>'; }
  function avatar(who, opts) {
    opts = opts || {};
    var p = typeof who === 'string' ? PEOPLE[who] : who;
    var size = opts.size ? ' rm-avatar--' + opts.size : '';
    if (!p) return '<span class="rm-avatar is-empty' + size + '" title="Sin responsable">＋</span>';
    return '<span class="rm-avatar' + size + (p.agent ? ' rm-avatar--agent' : '') + (opts.working ? ' is-working' : '') + (opts.cls ? ' ' + opts.cls : '') +
      '" title="' + esc(p.name) + (p.agent ? ' (agente)' : '') + '" role="img" aria-label="' + esc(p.name) + (p.agent ? ', agente' : '') + '">' + p.emoji + '</span>';
  }
  function who(id, opts) {
    var p = PEOPLE[id]; if (!p) return '<span class="rm-who rm-faint">' + avatar(null, { size: 'sm' }) + 'Sin asignar</span>';
    return '<span class="rm-who">' + avatar(p, opts || { size: 'sm' }) + '<span class="' + (p.agent ? 'rm-who__name--agent' : '') + '">' + esc(p.name) + '</span></span>';
  }
  /* Onda determinística: n barras, seed, fracción reproducida. */
  function wave(n, seed, played, cls) {
    var s = seed || 7, out = '';
    for (var i = 0; i < n; i++) {
      s = (s * 9301 + 49297) % 233280;
      var r = s / 233280, env = Math.sin(Math.PI * (i + 0.5) / n) * 0.55 + 0.35;
      var h = Math.max(0.12, Math.min(1, env * (0.45 + r * 0.75)));
      var st = '--h:' + h.toFixed(2) + (cls === 'live' ? ';animation-delay:-' + (r * 900).toFixed(0) + 'ms;animation-duration:' + (600 + r * 600).toFixed(0) + 'ms' : '');
      out += '<i style="' + st + '"' + (played && i / n < played ? ' class="is-played"' : '') + '></i>';
    }
    return '<span class="rm-wave' + (cls === 'live' ? ' rm-wave--live' : '') + '" aria-hidden="true">' + out + '</span>';
  }
  function counts(c, br) {
    c = c || {}; var out = '';
    function item(i, v, alert, label) { out += '<span class="rm-count' + (alert ? ' is-alert' : '') + '" title="' + label + '"><span class="rm-count__i" aria-hidden="true">' + i + '</span>' + v + '</span>'; }
    if (c.audio) item('🎙', c.audio, false, 'Audios');
    if (c.img) item('🖼', c.img, false, 'Imágenes');
    if (c.link) item('🔗', c.link, false, 'Links');
    if (br) item('🌿', br[0] + '/' + br[1], false, 'Ramas hechas / total');
    if (c.q) item('❓', c.q, true, 'Preguntas abiertas');
    if (c.time) item('⏱', c.time, false, 'Tiempo trabajado');
    return '<div class="rm-counts">' + out + '</div>';
  }
  /* Tarjeta de nodo. opts: cls, collapsed (número), toggle, compact */
  function card(n, opts) {
    if (typeof n === 'string') n = byId(n);
    opts = opts || {};
    var br = opts.branches !== undefined ? opts.branches : branchCount(n.id);
    var isIdea = n.kind === 'idea';
    var cls = 'rm-card' + (isIdea ? ' rm-card--idea' : '') + (opts.compact ? ' rm-card--compact' : '') +
      (n.status === 'doing' && !opts.noGlow ? ' is-doing' : '') + (n.status === 'blocked' ? ' is-blocked' : '') + (n.status === 'done' ? ' is-done' : '') + (opts.cls ? ' ' + opts.cls : '');
    var h = '<article class="' + cls + '" data-id="' + n.id + '" tabindex="0" aria-label="' + esc(n.id + ' ' + n.title) + '">';
    h += '<div class="rm-card__head"><span class="rm-card__kind">' + (isIdea ? '<span class="rm-label rm-idea-tag">◉ Idea cero</span>' : '') + '<span class="rm-id">' + n.id + '</span></span>' + prio(n.prio) + '</div>';
    h += '<h3 class="rm-card__title">' + esc(n.title) + '</h3>';
    if (isIdea && n.origin && !opts.compact) h += '<div class="rm-card__origin"><span class="rm-count__i" aria-hidden="true">🎙</span>' + wave(36, 11, 0) + '<span class="rm-audio__time">' + n.origin.dur + '</span></div>';
    h += counts(n.counts, br);
    h += '<div class="rm-card__foot">' + pill(n.status) + avatar(n.owner, { size: 'sm', working: n.status === 'doing' }) + '</div>';
    if (opts.collapsed) h += '<button class="rm-card__more" title="Expandir">+' + opts.collapsed + ' ramas</button>';
    else if (opts.toggle) h += '<button class="rm-card__toggle" title="Colapsar ramas" aria-label="Colapsar ramas">−</button>';
    return h + '</article>';
  }
  /* Curva bezier entre (x1,y1) y (x2,y2). orient 'h' (izq→der) o 'v' (arriba→abajo). */
  function edgePath(x1, y1, x2, y2, orient) {
    if (orient === 'v') { var my = (y1 + y2) / 2; return 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + my + ' ' + x2 + ',' + my + ' ' + x2 + ',' + y2; }
    var dx = Math.max(40, (x2 - x1) * 0.5);
    return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
  }
  function edgeKind(status) { return status === 'done' ? 'done' : (status === 'doing' || status === 'review') ? 'doing' : status === 'blocked' ? 'blocked' : 'pending'; }
  /* <defs> con las 5 puntas de flecha. Usar una vez por <svg>. */
  function arrowDefs(prefix) {
    prefix = prefix || 'rm';
    return '<defs>' + ['done', 'doing', 'pending', 'blocked', 'path'].map(function (k) {
      return '<marker id="' + prefix + '-arrow-' + k + '" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rm-arrow rm-arrow--' + k + '" d="M1,1.2 L9,5 L1,8.8 L3,5 Z"/></marker>';
    }).join('') + '</defs>';
  }
  /* Un conector completo: base + (pulso si está en curso). opts: path (bool), dimmed (bool), prefix */
  function edge(d, kind, opts) {
    opts = opts || {}; var pre = opts.prefix || 'rm';
    var st = (opts.path ? ' is-path' : '') + (opts.dimmed ? ' is-dimmed' : '');
    var marker = opts.path && kind === 'pending' ? 'path' : kind;
    var s = '<path class="rm-edge rm-edge--' + kind + st + '" d="' + d + '" marker-end="url(#' + pre + '-arrow-' + marker + ')"/>';
    if (kind === 'doing') s += '<path class="rm-edge__pulse' + (opts.dimmed ? ' is-dimmed' : '') + '" d="' + d + '"/>';
    return s;
  }

  var MARK = '<svg class="rm-brand__mark" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11h6M9 11c4 0 4-6 9-6M9 11c4 0 4 6 9 6" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="11" r="2" fill="var(--color-accent)"/><circle cx="18" cy="5" r="1.8" fill="var(--color-status-done)"/><circle cx="18" cy="17" r="1.8" fill="var(--color-status-doing)"/></svg>';
  /* Barra superior. tab: 'Tablero' | 'Flujo' | 'Métricas'. opts.recording */
  function topbar(tab, opts) {
    opts = opts || {};
    return '<header class="rm-topbar">' +
      '<span class="rm-brand">' + MARK + 'Ramas<span class="rm-org">TSC</span></span>' +
      '<button class="rm-project"><span class="rm-project__dot"></span>App Turnos<span class="rm-faint">▾</span></button>' +
      '<nav class="rm-tabs" role="tablist">' + ['Tablero', 'Flujo', 'Métricas'].map(function (t) { return '<button class="rm-tab' + (t === tab ? ' is-on' : '') + '" role="tab" aria-selected="' + (t === tab) + '">' + t + '</button>'; }).join('') + '</nav>' +
      '<span class="rm-topbar__spacer"></span>' +
      '<span class="rm-inputwrap" style="width:220px"><span class="rm-inputwrap__icon">⌕</span><input class="rm-input" placeholder="Buscar R-42 o texto" style="height:32px"></span>' +
      '<button class="rm-btn rm-btn--secondary rm-agents-btn"><span class="rm-livedot"></span>Agentes <span class="rm-avatar-stack">' + avatar('claude', { size: 'xs' }) + avatar('codex', { size: 'xs' }) + '</span></button>' +
      '<button class="rm-btn rm-btn--secondary">＋ Idea</button>' +
      '<button class="rm-btn rm-btn--record' + (opts.recording ? ' is-recording' : '') + '">' + (opts.recording ? '<span class="rm-recdot"></span>Grabando ' + opts.recording : '🎙 Idea por audio') + '</button>' +
      avatar('benja') + '</header>';
  }

  window.Ramas = {
    MARK: MARK, topbar: topbar,
    STATUS: STATUS, PRIO: PRIO, LOG: LOG, PEOPLE: PEOPLE, ANIMALS: ANIMALS, NODES: NODES,
    byId: byId, children: children, descendants: descendants, ancestors: ancestors, branchCount: branchCount,
    esc: esc, prio: prio, pill: pill, logtag: logtag, avatar: avatar, who: who, wave: wave, counts: counts, card: card,
    edgePath: edgePath, edgeKind: edgeKind, arrowDefs: arrowDefs, edge: edge
  };
})();
