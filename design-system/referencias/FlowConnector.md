# Conector de flujo

Curva bezier con punta de flecha que une padre → hijo, pintada según el estado del hijo. SVG: `Ramas.arrowDefs(prefijo)` una vez por `<svg>` y `Ramas.edge(d, tipo, { path, dimmed, prefix })` por conector; `Ramas.edgePath(x1,y1,x2,y2,'h'|'v')` arma la curva.

| Hijo | Tipo | Clase |
| --- | --- | --- |
| Hecho | `done` | `.rm-edge--done` sólido con glow |
| Haciendo / Revisión | `doing` | `.rm-edge--doing` + `.rm-edge__pulse` (partícula, `dur-flow`) |
| Inbox / Por hacer | `pending` | `.rm-edge--pending` punteado |
| Bloqueado | `blocked` | `.rm-edge--blocked` rojo, guiones largos |

- Hover o selección de un nodo: ancestros + descendientes con `.is-path`; el resto con `.is-dimmed`.
- Horizontal en desktop (salida por la derecha del padre, entrada por la izquierda del hijo). Vertical en mobile.
- En el kanban, conectores sobre las columnas solo para la tarjeta seleccionada; si padre e hijo están en la misma columna, el lazo sale y vuelve por la derecha.
- Nunca dibujes conectores entre nodos que no son padre/hijo directos.
