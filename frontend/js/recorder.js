"use strict";

function stamp() { const d = new Date(); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }

async function uploadFiles(id, files) {
  const max = S.meta.max_upload_mb * 1048576;
  for (const f of files) {
    if (f.size > max) { toast(`${f.name} supera ${S.meta.max_upload_mb} MB`, true); continue; }
    const fd = new FormData(); fd.append("file", f, f.name);
    toast(`Subiendo ${f.name}…`);
    await run(() => api(`/api/nodes/${id}/attachments`, { method: "POST", body: fd }));
  }
  await refresh(); if (S.openId === id) openNode(id);
}

/* ------------------------------------------------------------ grabación */
let recState = null;
/* Lee una duración (ms) de una custom property; el valor vive en extra-recorder.css / extra-modals.css. */
function cssMs(name, fallback) { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return v > 0 ? v : fallback; }
/* Botón de la barra superior: clase .is-recording y, en el principal, "Grabando mm:ss" con .rm-recdot. */
function recButton(on, label = "") {
  document.querySelectorAll("#audioIdeaBtn, #recFab").forEach((b) => b.classList.toggle("is-recording", on));
  const b = $("#audioIdeaBtn"); if (!b) return;
  if (on) {
    if (b.dataset.idleHtml === undefined) b.dataset.idleHtml = b.innerHTML;
    const html = `<span class="rm-recdot"></span>Grabando ${label}`;
    if (b.innerHTML !== html) b.innerHTML = html;
  } else if (b.dataset.idleHtml !== undefined) { b.innerHTML = b.dataset.idleHtml; delete b.dataset.idleHtml; }
}
/* Atenúa el tablero mientras graba (sin inert: el foco y el refresco siguen intactos). */
function recDim(on) { const m = $("#main"); if (m) m.classList.toggle("rm-main--dim", on); }
function recTip(on) {
  let t = $("#recTip");
  if (!on) return t?.remove();
  if (t) return;
  t = document.createElement("div"); t.id = "recTip"; t.className = "rm-rec-tip";
  t.innerHTML = `<span class="rm-kbd">Esc</span> cancelar · <span class="rm-kbd">Espacio</span> pausa · <span class="rm-kbd">↵</span> listo`;
  document.body.appendChild(t);
}
function recReset() {
  if (recState?.timer) clearInterval(recState.timer);
  recState = null;
  const box = $("#recorder"); box.hidden = true; box.innerHTML = "";
  recButton(false); recDim(false); recTip(false);
}
function recFail(msg) {
  recReset(); toast(msg, true);
}
async function record(onDone, opts = {}) {
  if (recState) return toast("Ya hay una grabación en curso", true);
  if (!navigator.mediaDevices?.getUserMedia) return recFail("Este navegador no permite grabar (¿la app está en HTTPS?)");
  recState = { starting: true };
  const opener = document.activeElement;
  let stream, rec;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return recFail("No hay permiso para usar el micrófono"); }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
  const chunks = []; let cancelled = false;
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      document.removeEventListener("keydown", onKey);
      recReset();
      if (opener && opener.isConnected && opener.focus) opener.focus();
      if (cancelled) return;
      if (!chunks.length) return toast("No se grabó nada. Revisá el micrófono e intentá de nuevo.", true);
      const type = rec.mimeType || mime || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      onDone(new Blob(chunks, { type: type.split(";")[0] }), ext);
    };
    rec.onerror = () => {
      cancelled = true;
      try { rec.state !== "inactive" && rec.stop(); } catch { /* ya detenido */ }
      stream.getTracks().forEach((t) => t.stop()); document.removeEventListener("keydown", onKey);
      recFail("La grabación falló. Probá de nuevo.");
    };
    rec.start(cssMs("--rm-rec-timeslice", 1000));
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return recFail("No se pudo iniciar la grabación en este navegador");
  }
  // TODO backend: transcripción automática (campo opcional "Transcribir")
  const canPause = typeof rec.pause === "function" && typeof rec.resume === "function";
  const dest = opts.dest || "Se adjunta al nodo abierto";
  const box = $("#recorder");
  box.className = "rm-recorder"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Grabador de audio"); box.tabIndex = -1;
  box.innerHTML = `<div class="rm-recorder__top"><span class="rm-rec">REC</span>
      <span class="rm-recorder__who">${Ramas.avatar(S.me?.name, { size: "sm" })}<span>${esc(S.me?.name || "")}</span></span></div>
    <div class="rm-recorder__mid"><span class="rm-recorder__timer" id="recTime" role="timer">00:00.0</span>${Ramas.wave(64, 41, 0, "live")}</div>
    <div class="rm-recorder__dest">${esc(dest)}</div>
    <div class="rm-recorder__foot"><button type="button" class="rm-btn rm-btn--ghost" id="recCancel">Cancelar</button>
      <span class="rm-recorder__btns">${canPause ? `<button type="button" class="rm-btn rm-btn--secondary" id="recPause">❚❚ Pausa</button>` : ""}<button type="button" class="rm-btn rm-btn--primary" id="recStop">✓ Listo</button></span></div>`;
  box.hidden = false;
  let acc = 0, t0 = Date.now(), paused = false;
  const elapsed = () => acc + (paused ? 0 : Date.now() - t0);
  const two = (v) => String(v).padStart(2, "0");
  const fmt = (dec = true) => { const ms = elapsed(), s = Math.floor(ms / 1000); return `${two(Math.floor(s / 60))}:${two(s % 60)}${dec ? "." + Math.floor((ms % 1000) / 100) : ""}`; };
  const paint = () => { const t = $("#recTime"); if (t) t.textContent = fmt(); recButton(true, fmt(false)); };
  recState = { timer: setInterval(paint, cssMs("--rm-rec-tick", 100)) };
  paint(); recDim(true); recTip(true);
  const stop = () => rec.state !== "inactive" && rec.stop();
  const cancel = () => { cancelled = true; stop(); };
  const togglePause = () => {
    if (!canPause || rec.state === "inactive") return;
    if (!paused) { rec.pause(); acc += Date.now() - t0; paused = true; }
    else { rec.resume(); t0 = Date.now(); paused = false; }
    box.classList.toggle("is-paused", paused);
    $("#recPause").textContent = paused ? "▶ Reanudar" : "❚❚ Pausa";
    paint();
  };
  /* Atajos: Esc cancela, Espacio pausa/reanuda, Enter = Listo. Solo con el foco en el panel
     o en el body (con un botón enfocado se activa ese botón nativamente) y sin modal abierto. */
  const onKey = (e) => {
    if ($("#modal").classList.contains("on") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") { cancel(); return; }
    const t = e.target;
    if (t !== document.body && !box.contains(t)) return;
    if (t.closest("button")) return;  // con un botón enfocado, Espacio/Enter lo activan nativamente
    if (e.key === " ") { e.preventDefault(); togglePause(); }
    else if (e.key === "Enter") { e.preventDefault(); stop(); }
  };
  document.addEventListener("keydown", onKey);
  $("#recStop").onclick = stop;
  $("#recCancel").onclick = cancel;
  if (canPause) $("#recPause").onclick = togglePause;
  box.focus();
}

function audioIdea() {
  record(async (blob, ext) => {
    const when = new Date().toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const n = await run(() => api(`/api/projects/${S.project.slug}/nodes`, { method: "POST", body: { title: `Audio de ${S.me.name} · ${when}`, kind: "idea" } }));
    if (!n) return;
    await uploadFiles(n.id, [new File([blob], `idea-${stamp()}.${ext}`, { type: blob.type })]);
    go({ node: n.id });
    toast("Idea guardada. Ponele un título cuando quieras.");
  }, { dest: "Nueva idea en Inbox" });
}

