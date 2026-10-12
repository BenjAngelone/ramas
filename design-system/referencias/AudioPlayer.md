# Reproductor de audio

`.rm-audio`: play/pausa cian, nombre + tiempo en mono, forma de onda `Ramas.wave(barras, semilla, reproducido)` y acciones descargar / transcripción. `.rm-audio__transcript` muestra la transcripción opcional.

**Estados:** default · `.is-playing` (borde luminoso, barras reproducidas en cian) · `.is-loading` · `.is-error` (mensaje + sugerir descarga) · vacío (invitar a grabar).
