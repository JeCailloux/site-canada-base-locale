/* ============================================================
   CARIBOU — Itinéraire : calculs sans DOM (ordre, distances, liens)
   Testé par tests/itineraire.test.js
   ============================================================ */

(function () {
  "use strict";

  function hasPos(s) {
    return typeof s.lat === "number" && typeof s.lng === "number" && isFinite(s.lat) && isFinite(s.lng);
  }

  // Ordre du trajet : date d'arrivée, puis ordre d'ajout ; sans date = à la fin
  function sortStops(stops) {
    return stops.filter(hasPos).sort(function (a, b) {
      var da = a.from || "9999", db = b.from || "9999";
      if (da !== db) return da < db ? -1 : 1;
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
  }

  // Groupes d'étapes consécutives reliées par la route (un vol coupe le groupe).
  // Renvoie des listes d'index dans `stops` (au moins 2 étapes par groupe).
  function roadRuns(stops) {
    var runs = [], cur = [0];
    for (var i = 1; i < stops.length; i++) {
      if (stops[i].via === "plane") { runs.push(cur); cur = [i]; } else cur.push(i);
    }
    if (stops.length) runs.push(cur);
    return runs.filter(function (r) { return r.length > 1; });
  }

  // Distance à vol d'oiseau en km
  function km(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // 3.34 h → "3 h 20"
  function hours(h) {
    var m = Math.round(h * 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
  }

  function ll(s) { return s.lat.toFixed(5) + "," + s.lng.toFixed(5); }

  function gmapsDir(stops) {
    return "https://www.google.com/maps/dir/" + stops.map(ll).join("/");
  }

  function gmapsPlace(s) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.address || ll(s));
  }

  var API = { hasPos: hasPos, sortStops: sortStops, roadRuns: roadRuns, km: km, hours: hours, gmapsDir: gmapsDir, gmapsPlace: gmapsPlace };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.CaribouItin = API;
})();
