# Inputs y selects

`.rm-field` con `.rm-field__label` (mayúscula espaciada), control y `.rm-field__help`. Controles: `.rm-input`, `.rm-select`, `.rm-textarea`; `.rm-inputwrap` para ícono a la izquierda y spinner a la derecha; `.rm-quickadd` para agregar en una columna o lista.

**Estados:** hover · foco (borde `color-accent` + halo `color-accent-soft`) · deshabilitado · cargando (spinner en `.rm-inputwrap`) · error (`.rm-field.is-error`: borde rojo, `glow-blocked`, ayuda en rojo que dice qué pasó y cómo seguir).

- Borde `color-border-control` (≥3:1). Placeholder en `color-text-3`.
