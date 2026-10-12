# Tarjeta de nodo

La unidad de Ramas: un nodo (`R-42`) con título, prioridad, contadores, estado y responsable. `.rm-card` (tarea) o `.rm-card rm-card--idea` (idea cero).

**Qué pasás:** id, título, estado, prioridad, responsable (o vacío), contadores (🎙 audios, 🖼 imágenes, 🔗 links, 🌿 ramas hechas/total, ❓ preguntas abiertas, ⏱ tiempo). Con JS: `Ramas.card(nodo, { toggle, collapsed, cls, compact })`.

**Partes:** `__head` (id + `rm-prio`), `__title`, `rm-counts`, `__foot` (pill + avatar), opcional `__origin` (onda del audio de la idea), `__toggle` / `__more` ("+5 ramas").

**Estados:** `:hover`/`.is-hover` · `.is-selected` (`glow-accent`) · `.is-path` / `.is-dimmed` (camino iluminado) · `.is-doing` (glow ámbar que respira, se agrega solo si el estado es Haciendo) · `.is-blocked` · `.is-done` · `:focus-visible`/`.is-focus` · `.is-disabled` · `.is-loading` (skeleton) · `.is-empty` · `.is-error` (con `__error`) · `.is-dragging`.

- La idea cero lleva esquinas de mira en `color-accent`, la etiqueta `◉ IDEA CERO` y la franja del audio original.
- ❓ en ámbar (`.is-alert`) cuando hay preguntas abiertas.
- No pongas más de una línea de metadatos además de los contadores; lo demás va al panel de detalle.
- Ancho fijo 252px (idea 288px) en el canvas; `width:100%` en columnas y mobile (`--compact`).
