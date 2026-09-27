// Vérifie les calculs de l'itinéraire : node tests/itineraire.test.js
const assert = require("assert");
const I = require("../js/itineraire.js");

const s = (id, from, extra) => Object.assign({ id, lat: 45, lng: -73, from, createdAt: id }, extra);

// tri par date, égalité départagée par ordre d'ajout, sans date à la fin, sans position ignoré
const sorted = I.sortStops([s("c", ""), s("b", "2026-10-02"), s("a2", "2026-10-01"), s("a1", "2026-10-01"), s("x", "2026-09-01", { lat: NaN })]);
assert.deepStrictEqual(sorted.map((x) => x.id), ["a1", "a2", "b", "c"]);

// même jour : l'heure départage ; ordre manuel (glisser-déposer) prioritaire, sans ordre à la fin
const byTime = I.sortStops([s("soir", "2026-10-01", { fromTime: "18:00" }), s("matin", "2026-10-01", { fromTime: "08:30" })]);
assert.deepStrictEqual(byTime.map((x) => x.id), ["matin", "soir"]);
const manual = I.sortStops([s("a", "2026-10-01", { order: 1 }), s("b", "2026-10-05", { order: 0 }), s("new", "2026-09-01")]);
assert.deepStrictEqual(manual.map((x) => x.id), ["b", "a", "new"]);

// groupes routiers : un vol coupe le trajet
const st = [s(0), s(1), s(2, "", { via: "plane" }), s(3), s(4, "", { via: "plane" })];
assert.deepStrictEqual(I.roadRuns(st), [[0, 1], [2, 3]]);
assert.deepStrictEqual(I.roadRuns([s(0)]), []);
assert.deepStrictEqual(I.roadRuns([]), []);

// Montréal → Toronto ≈ 504 km à vol d'oiseau
const d = I.km({ lat: 45.5017, lng: -73.5673 }, { lat: 43.6532, lng: -79.3832 });
assert(Math.abs(d - 504) < 5, "distance " + d);

assert.strictEqual(I.hours(3 + 20 / 60), "3 h 20");
assert.strictEqual(I.hours(0.5), "30 min");
assert.strictEqual(I.hours(2.02), "2 h 01");

assert.strictEqual(I.gmapsDir([{ lat: 45.5, lng: -73.56 }, { lat: 43.65, lng: -79.38 }]),
  "https://www.google.com/maps/dir/45.50000,-73.56000/43.65000,-79.38000");
assert(I.gmapsPlace({ address: "1 rue A & B", lat: 1, lng: 2 }).endsWith("1%20rue%20A%20%26%20B"));

console.log("itineraire OK");
