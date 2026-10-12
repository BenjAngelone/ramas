# Panel lateral

`.rm-panel`, vidrio medio a la derecha (440–500px) con el detalle del nodo. Estructura: `__head` (breadcrumb `.rm-crumbs` de ancestros + acciones, título editable `.rm-title-edit`), `__body` con secciones `.rm-section` (título `// LABEL`).

Orden de secciones: campos (`.rm-props`: estado, prioridad, responsable, tipo) → descripción → adjuntos (audio, miniaturas `.rm-thumbs`, links `.rm-link`) → ramas hijas (`.rm-branches` + input) → bitácora (`.rm-log`) → historial (`.rm-history`).

- Cargando: skeletons con la misma estructura. Vacío por sección: una línea en `color-text-3` + acción.
- Se abre con `dur-base` / `ease-out`; el canvas de fondo mantiene el camino iluminado del nodo.
