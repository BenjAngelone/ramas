# Grabador de audio

`.rm-recorder` flotante, abajo al centro sobre la pantalla actual. REC rojo que respira, timer `mono` grande, onda en vivo (`Ramas.wave(n, s, 0, 'live')`), destino de la idea y botones Cancelar / Pausa / Listo.

**Estados:** grabando · `.is-paused` (gris, onda quieta) · `.is-error` (sin permiso de micrófono, Listo deshabilitado).

- Atajos: Esc cancelar, Espacio pausa, Enter listo.
- Mientras graba, el botón de la barra superior pasa a `.is-recording` con el tiempo.
