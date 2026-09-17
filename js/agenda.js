/* ============================================================
   CARIBOU — Agenda des cours (automne 2026, UQO), sans DOM
   Données tirées des plans de cours (dossier pdf/).
   Testé par tests/agenda.test.js
   ============================================================ */

(function () {
  "use strict";

  // mode : mode par défaut ; remote / onsite : dates qui font exception ; off : pas de cours
  // visio : lien de la visio (aucun lien dans les PDF : à coller ici quand tu l'as)
  var COURSES = [
    {
      code: "INF6303", name: "Techniques d'analyse des mégadonnées", prof: "N'Dah Daniel Yapi",
      first: "2026-09-09", last: "2026-12-16", time: "12h30 – 15h30", room: "B1028",
      mode: "onsite", remote: ["2026-09-09", "2026-09-23", "2026-10-28"], off: ["2026-10-14"],
      tool: "Zoom", visio: "",
      notes: { "2026-10-21": "Examen de mi-session", "2026-12-09": "Présentation des projets", "2026-12-16": "Examen final" }
    },
    {
      code: "CYB6063", name: "Méthodes avancées en cybersécurité basée sur l'IA", prof: "Hajar Moudoud",
      first: "2026-09-09", last: "2026-12-16", time: "8h30 – 11h30", room: "Lucien-Brault B1006",
      mode: "onsite", remote: ["2026-10-07", "2026-11-18"], off: ["2026-10-14"],
      tool: "", visio: "",
      notes: { "2026-10-28": "Examen de mi-session", "2026-12-09": "Présentation des projets", "2026-12-16": "Examen final" }
    },
    {
      code: "CYB6023", name: "Forensique numérique avancée et réponse aux incidents", prof: "Hajar Moudoud",
      first: "2026-09-10", last: "2026-12-17", time: "8h30 – 11h30", room: "Lucien-Brault A2402",
      mode: "onsite", remote: ["2026-10-08", "2026-11-12", "2026-11-26"], off: ["2026-10-15"],
      tool: "", visio: "",
      notes: { "2026-10-29": "Examen de mi-session", "2026-12-10": "Présentation orale des projets", "2026-12-17": "Examen final" }
    },
    {
      code: "INF6333", name: "Éléments d'intelligence artificielle appliquée", prof: "Ana-Maria Cretu",
      first: "2026-09-10", last: "2026-12-17", time: "12h30 – 15h30", room: null,
      mode: "remote", onsite: ["2026-12-10"], off: ["2026-10-15"],
      tool: "Zoom", visio: "",
      notes: { "2026-10-29": "Quiz (Moodle, présence Zoom)", "2026-12-10": "Examen final (campus Gatineau)", "2026-12-17": "Présentations de projets" }
    },
    {
      code: "CYB1073", name: "Cybersécurité comportementale", prof: "David Caissy",
      first: "2026-09-10", last: "2026-12-17", time: "19h – 22h", room: null,
      mode: "remote", onsite: ["2026-10-29", "2026-12-17"], off: ["2026-10-15"],
      tool: "Teams", visio: "", moodle: "https://moodle.uqo.ca/course/view.php?id=49848",
      notes: { "2026-10-29": "Examen de mi-session", "2026-12-17": "Examen final" }
    }
  ];

  function addDays(s, n) {
    var p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n, 12);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function has(list, day) { return (list || []).indexOf(day) >= 0; }

  // Séances entre from et to inclus, triées par date puis heure
  function sessions(from, to, courses) {
    var out = [];
    (courses || COURSES).forEach(function (c) {
      for (var d = c.first; d <= c.last; d = addDays(d, 7)) {
        if (d < from || d > to || has(c.off, d)) continue;
        var remote = c.mode === "remote" ? !has(c.onsite, d) : has(c.remote, d);
        out.push({ day: d, course: c, remote: remote, note: (c.notes || {})[d] || "" });
      }
    });
    return out.sort(function (a, b) {
      // tri par heure de début ("8h30" avant "12h30") ; sans horaire = en dernier
      function key(s) { return s.day + String(parseInt(s.course.time, 10) || 99).padStart(2, "0"); }
      var ka = key(a), kb = key(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  var API = { COURSES: COURSES, sessions: sessions };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.CaribouAgenda = API;
})();
