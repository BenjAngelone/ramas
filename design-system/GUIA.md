Ramas es la herramienta interna de **TSC**: la consola donde un equipo de dos devs y sus agentes (claude, codex) siguen el camino de cada idea: de un audio grabado a la feature terminada. Todo es un **nodo** (`R-42`) en un árbol de profundidad libre. La interfaz es una sala de control oscura: precisa, tranquila, con luz solo donde algo está pasando.

## Principios

1. **El camino es el producto.** Cada tarjeta muestra de dónde viene y hacia dónde se ramifica. Si una pantalla esconde la relación padre → hijo, está mal.
2. **Luz = actividad.** El glow (`glow-accent`, `glow-doing`, `glow-record`) se reserva para lo que está vivo: tarea en curso, grabando, hover, camino seleccionado. Nada brilla en reposo.
3. **Legible antes que lindo.** Todo texto cumple AA (4.5:1) sobre su fondo. Estado y prioridad nunca dependen solo del color: siempre van con palabra, glifo o forma.
4. **Personas y agentes, distinguibles de un vistazo.** Humanos: círculo cálido con animalito. Agentes: cuadrado frío con 🤖 y tag `BOT`.

## Voz y contenido

- Español rioplatense, voseo, tono de compañero: "¿Quién sos?", "Agregá una rama", "Soltá el audio acá", "Listo".
- Verbos al frente en botones: "Resolver", "Centrar en esta idea", "Copiar". Nada de "Click aquí" ni "Usted".
- Estados y etiquetas técnicas en MAYÚSCULA espaciada con el estilo `label` (`POR HACER`, `// BITÁCORA`). Títulos y cuerpo en oración normal.
- Ids, tiempos, hashes y métricas siempre en mono (`mono-sm`, `mono-md`, `metric-xl`): `R-3`, `02:14`, `38h 20m`, `a3f9c1e`.
- Emoji solo con función: los animalitos de avatar (🐥 🦊 🐸 🐼 🦉 🐙), 🤖 para agentes y los íconos de contador (🎙 🖼 🔗 🌿 ❓ ⏱). Nunca como decoración.
- Los agentes se nombran en minúscula y en mono (`claude`, `codex`), como un proceso.
- La empresa es **TSC**, siempre en mayúsculas. Aparece como sello en mono junto a la marca (`.rm-org`), nunca reemplaza al nombre del producto.

## Color

- Fondos en capas, de abajo hacia arriba: `color-bg-0` (raíz) → `color-bg-1` (canvas/tablero, lleva grilla) → `color-bg-2` (paneles, columnas) → `color-bg-3` (tarjetas) → `color-bg-4` (hover, inputs) → `color-bg-5` (seleccionado). Subí una capa por cada nivel de elevación; no saltees.
- Texto en 3 niveles: `color-text-1` principal, `color-text-2` secundario, `color-text-3` para ids, timestamps y placeholders. `color-text-3` nunca va sobre `color-bg-5`.
- Bordes finos de 1px: `color-border-subtle` (divisores), `color-border-default` (tarjetas, paneles), `color-border-strong` (hover), `color-border-control` (inputs y chips, ≥3:1), `color-border-glow` (lo activo).
- Primario único: cian `color-accent`. Usalo para la acción principal de la vista, la tab activa, links y el camino iluminado. Texto sobre cian siempre `color-on-accent`.
- Un color por estado: Inbox `color-status-inbox` · Por hacer `color-status-todo` · Haciendo `color-status-doing` · Revisión `color-status-review` · Hecho `color-status-done` · Bloqueado `color-status-blocked`. Cada uno tiene su `-soft` para fondos de pill. Las pills además llevan un glifo distinto por estado (cuadrado, círculo hueco, punto que respira, rombo, ✓, !).
- Prioridad: `color-prio-urgent`, `color-prio-high`, `color-prio-medium`, `color-prio-low`, siempre con 4/3/2/1 barras + palabra.
- Bitácora: `color-log-summary`, `color-log-decision`, `color-log-question`, `color-log-blocker`, `color-log-note`, `color-log-commit`.
- Grabar es rojo propio: `color-record` con texto `color-on-record` (no blanco: no llega a AA).

## Tipografía

- UI en **Sora** (`--font-sans`), geométrica. Técnica en **JetBrains Mono** (`--font-mono`). Ambas desde Google Fonts.
- Escala: `display` 32 · `title-lg` 22 (título editable) · `title-md` 17 (secciones, modales) · `title-sm` 14/600 (título de tarjeta) · `body` 14 · `body-sm` 13 · `caption` 12 · `label` 11 en mayúscula con 0.14em.
- Mono: `metric-xl` 34 (KPIs), `mono-md` 13 (timers), `mono-sm` 11 (ids, contadores).
- Una sola familia por bloque de texto; nunca mono para oraciones.

## Espacio, radios, superficies

- Todo en múltiplos de 4: `space-1` (4) … `space-16` (64). Tarjeta: padding `space-3`; panel: `space-5`; gap entre tarjetas: `space-2`.
- Radios: `radius-xs` etiquetas · `radius-sm` controles y avatar de agente · `radius-md` tarjetas · `radius-lg` paneles y columnas · `radius-xl` modales · `radius-pill` pills, chips, avatar humano.
- Vidrio sutil solo en lo que flota sobre contenido: `color-glass-1` + `blur-glass-sm` (minimapa, zoom), `color-glass-2` + `blur-glass-md` (barra superior, panel lateral), `color-glass-3` + `blur-glass-lg` (modales, toasts, grabador).
- Sombras: `shadow-1` tarjetas, `shadow-2` flotantes, `shadow-3` modales. Glow solo en activo: `glow-accent` (seleccionado), `glow-doing` (en curso, respira con `dur-pulse`), `glow-blocked`, `glow-record`.
- Fondo técnico: `.rm-gridbg` (líneas cada `space-8`) en el tablero; `.rm-dotgrid` (puntos cada `space-6`) en el canvas Flujo.

## Líneas de flujo

El conector se pinta según el estado del **hijo** (destino), con curva bezier horizontal (desktop) o vertical (mobile) y punta de flecha:

| Destino | Clase | Trazo |
| --- | --- | --- |
| Hecho | `.rm-edge--done` | sólido, `color-flow-done`, con glow |
| Haciendo / Revisión | `.rm-edge--doing` + `.rm-edge__pulse` | base tenue + partícula que recorre la línea cada `dur-flow` |
| Inbox / Por hacer | `.rm-edge--pending` | punteado `2 6`, `color-flow-pending` |
| Bloqueado | `.rm-edge--blocked` | rojo, guiones largos `10 4` |

- Hover o selección de un nodo: sus ancestros y descendientes reciben `.is-path` (borde `color-border-glow`, trazo 2.5px, punteados pasan a `color-flow-path`); el resto `.is-dimmed` (`opacity-dimmed`). Transición `dur-base` con `ease-out`.
- En el kanban, al seleccionar una tarjeta se dibujan los mismos conectores hacia su padre y sus hijos por encima de las columnas.
- Nodos con hijos llevan un toggle; colapsados muestran `+N ramas` (`.rm-card__more`).
- Con `prefers-reduced-motion`, la partícula se apaga y el conector en curso queda sólido.

## Movimiento

- `dur-fast` + `ease-out` para hover y foco; `dur-base` para paneles y atenuar el grafo; `dur-slow` para modales, toasts y "Centrar en esta idea" (`ease-in-out`).
- Loops solo en lo vivo: partícula del conector (`dur-flow`, `ease-linear`), respiración de tarjeta en curso y punto REC (`dur-pulse`), onda en vivo.

## Estados de interacción

- **Hover:** subí una capa de fondo y pasá el borde a `color-border-strong`.
- **Foco:** `ring-focus` (2px `color-focus` con 2px de separación). Nunca quitar el foco sin reemplazo.
- **Activo / seleccionado:** `color-accent-soft` de fondo + `color-accent` en texto o borde; tarjetas con `glow-accent`.
- **Deshabilitado:** `opacity-disabled`, sin glow, cursor `not-allowed`.
- **Cargando:** spinner `.rm-spin` en botones/inputs, skeleton `.rm-skel` en tarjetas y tablas.
- **Vacío:** borde punteado `color-border-strong` + una frase que invite a actuar ("Soltá una idea acá").
- **Error:** borde `color-status-blocked`, `glow-blocked`, mensaje en `caption` con qué pasó y cómo seguir.

## Iconografía

- Contadores de tarjeta con emoji funcional: 🎙 audios · 🖼 imágenes · 🔗 links · 🌿 ramas `x/y` · ❓ preguntas abiertas · ⏱ tiempo.
- Glifos de interfaz con caracteres tipográficos (▸ ▾ ✓ ! ⌖ ＋ ↗ ×), sin set de íconos externo. No hay logo provisto: la marca es la palabra "Ramas" en Sora 700 junto a un glifo de ramificación hecho con trazos, en `color-accent`, seguida del sello `TSC` (`.rm-org`: mono 10px, borde `color-border-strong`, texto `color-text-2`).

## Componentes y pantallas

Componentes: Tarjeta de nodo, Conector, Pill de estado, Prioridad, Etiqueta de bitácora, Avatar, Botones, Inputs y selects, Chips de filtro, Panel lateral, Modal, Toast, Reproductor de audio, Grabador, KPI, Tabla, Barra de progreso, Barra superior. Pantallas (previews de página): Flujo (protagonista), Tablero, Detalle, Métricas, Onboarding, Conectar agentes, Mobile.

## Usarlo en tu frontend (HTML/CSS/JS puro)

1. Cargá `export/ramas-tokens.css` (todas las variables `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`/`--glow-*`, `--opacity-*`, `--blur-*`, `--dur-*`, `--ease-*`, `--font-*`).
2. Cargá `components/bundle.css` (componentes con prefijo `rm-`, importa Sora y JetBrains Mono).
3. Armá el markup como en cada preview. Los estados se activan con `:hover`/`:focus-visible` reales o con clases (`.is-hover`, `.is-focus`, `.is-on`, `.is-selected`, `.is-path`, `.is-dimmed`, `.is-doing`, `.is-loading`, `.is-error`, `.is-empty`).
4. Nunca escribas un color o duración a mano: usá la variable.
