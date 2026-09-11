/* ============================================================
   CARIBOU — Planning : calculs de dates (sans DOM)
   Dates en texte "AAAA-MM-JJ" (comparables directement).
   Testé par tests/planning.test.js
   ============================================================ */

(function () {
  "use strict";

  function parse(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2], 12); // midi : pas de piège heure d'été
  }

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function addDays(s, n) {
    var d = parse(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function addMonths(s, n) {
    var d = parse(s);
    return iso(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
  }

  // 0 = dimanche … 6 = samedi
  function weekday(s) { return parse(s).getDay(); }

  // Lundi de la semaine
  function weekStart(s) { return addDays(s, -((weekday(s) + 6) % 7)); }

  function weekDays(s) {
    var start = weekStart(s), out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }

  // Semaines (lundi → dimanche) qui couvrent le mois de s
  function monthWeeks(s) {
    var month = s.slice(0, 7), weeks = [], day = weekStart(month + "-01");
    do { weeks.push(weekDays(day)); day = addDays(day, 7); } while (day.slice(0, 7) === month);
    return weeks;
  }

  function onDay(plans, day) {
    return plans.filter(function (p) { return p.from <= day && day <= p.to; });
  }

  // Où est ce membre ce jour-là ? (null = dispo)
  function whereIs(plans, memberId, day) {
    for (var i = 0; i < plans.length; i++) {
      var p = plans[i];
      if (p.from <= day && day <= p.to && p.who.indexOf(memberId) >= 0) return p;
    }
    return null;
  }

  // Jour de cours ? cfg : { coursDays: [3, 4], coursFrom: "AAAA-MM-JJ"|null, coursTo: … }
  function isCours(day, cfg) {
    cfg = cfg || {};
    var days = cfg.coursDays || [3, 4];
    if (days.indexOf(weekday(day)) < 0) return false;
    if (cfg.coursFrom && day < cfg.coursFrom) return false;
    if (cfg.coursTo && day > cfg.coursTo) return false;
    return true;
  }

  // Membres sans aucune période sur ces jours
  function freeOn(plans, memberIds, days) {
    return memberIds.filter(function (id) {
      return days.every(function (d) { return !whereIs(plans, id, d); });
    });
  }

  var API = {
    parse: parse, iso: iso, addDays: addDays, addMonths: addMonths, weekday: weekday,
    weekStart: weekStart, weekDays: weekDays, monthWeeks: monthWeeks,
    onDay: onDay, whereIs: whereIs, isCours: isCours, freeOn: freeOn
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.CaribouPlanning = API;
})();
