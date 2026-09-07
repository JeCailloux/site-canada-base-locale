/* ============================================================
   CARIBOU — Vidéo de fond (caribou qui court)
   Deux <video> superposées qui se fondent l'une dans l'autre
   avant la fin du clip : la boucle devient invisible.
   Respecte prefers-reduced-motion et se met en pause quand
   l'onglet est caché ou après connexion.
   ============================================================ */

(function () {
  "use strict";

  var wrap = document.getElementById("video-bg");
  if (!wrap) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    wrap.remove();
    return;
  }

  var vids = Array.prototype.slice.call(wrap.querySelectorAll("video.vbg"));
  if (!vids.length) return;

  var active = vids[0];
  var standby = vids[1] || null;
  var FADE = 0.9; // secondes de fondu avant la fin du clip

  function tryPlay(v) {
    v.muted = true; // requis pour l'autoplay
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay bloqué : la veille suffira */ });
  }

  active.classList.add("on");
  tryPlay(active);
  if (standby) standby.load();

  function swap() {
    if (!standby) { // une seule vidéo : boucle simple
      active.currentTime = 0;
      return;
    }
    var old = active;
    active = standby;
    standby = old;
    try { active.currentTime = 0; } catch (e) { /* pas encore bufferisée */ }
    tryPlay(active);
    active.classList.add("on");
    old.classList.remove("on");
    setTimeout(function () { old.pause(); }, 1100);
  }

  setInterval(function () {
    if (document.hidden || wrap.classList.contains("gone")) return;
    var d = active.duration;
    if (d && d - active.currentTime <= FADE) swap();
  }, 200);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      vids.forEach(function (v) { v.pause(); });
    } else if (!wrap.classList.contains("gone")) {
      tryPlay(active);
    }
  });
})();
