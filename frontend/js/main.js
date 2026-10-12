/* Ramas — arranque: refresco periódico y boot. */
"use strict";

/* ------------------------------------------------------------ actualización periódica */
async function pollOnce() {
  if (document.hidden || !S.project || recState || $("#modal").classList.contains("on")) return;
  const ae = document.activeElement;
  // un campo vacío del "agregar rápido" no cuenta como edición: si no, el poll nunca corre tras crear una tarea
  const idleQuick = ae?.classList?.contains("rm-quickadd") && !ae.value;
  const editing = ae?.closest?.("input, textarea, select") && !idleQuick;
  const playing = [...document.querySelectorAll("audio")].some((a) => !a.paused);
  if (editing || playing || $(".rm-lightbox")) return;
  try {
    await loadNodes();
    syncTemplates();
    if (S.view !== "metrics") renderMain();
    if (idleQuick) document.querySelector(`.rm-quickadd[data-status="${ae.dataset.status}"]`)?.focus({ preventScroll: true });
    if (S.openId) {
      // no pisar el panel si hay un menú abierto o el foco está en un control sin id (se perdería al re-renderizar)
      const d = $("#drawer"), ae = document.activeElement;
      const busy = d.querySelector("#moreMenu:not([hidden])") || (ae && d.contains(ae) && ae !== d && !ae.id);
      if (!busy) { const n = await api(`/api/nodes/${S.openId}`); renderDrawer(n); }
    }
  } catch (e) {
    if (e.status === 404 && S.openId) { toast("Esa tarea ya no existe", true); closeDrawer(); }
    /* el resto: silencioso */
  }
}
setInterval(pollOnce, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pollOnce(); });

boot();

