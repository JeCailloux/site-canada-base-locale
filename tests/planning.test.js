// Vérifie les calculs du planning : node tests/planning.test.js
const assert = require("assert");
const P = require("../js/planning.js");

assert.strictEqual(P.weekStart("2026-09-11"), "2026-09-07");          // vendredi → lundi
assert.strictEqual(P.weekStart("2026-09-13"), "2026-09-07");          // dimanche → lundi d'avant
assert.deepStrictEqual(P.weekDays("2026-09-07"), ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]);
assert.strictEqual(P.addDays("2026-10-31", 1), "2026-11-01");
assert.strictEqual(P.addDays("2026-03-08", 1), "2026-03-09");           // passage heure d'été (Canada)
assert.strictEqual(P.addMonths("2026-12-15", 1), "2027-01-01");
assert.strictEqual(P.addMonths("2026-01-31", -1), "2025-12-01");

// Mois : commence un lundi, couvre tout le mois, 7 jours par semaine
for (const m of ["2026-09-01", "2026-02-10", "2026-11-30", "2027-03-01"]) {
  const w = P.monthWeeks(m);
  assert.strictEqual(P.weekday(w[0][0]), 1);
  assert(w.every((x) => x.length === 7));
  const days = w.flat();
  assert(days.includes(m.slice(0, 8) + "01"));
  const last = P.iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0, 12));
  assert(days.includes(last), "dernier jour manquant " + last);
  assert(!w.some((x) => x.every((d) => d.slice(0, 7) !== m.slice(0, 7))), "semaine vide dans " + m);
}
assert.strictEqual(P.monthWeeks("2026-09-11").length, 5);

// Cours : mercredi + jeudi, bornés par la session si renseignée
assert.strictEqual(P.isCours("2026-09-09", {}), true);   // mercredi
assert.strictEqual(P.isCours("2026-09-10", {}), true);   // jeudi
assert.strictEqual(P.isCours("2026-09-11", {}), false);  // vendredi
assert.strictEqual(P.isCours("2026-12-23", { coursTo: "2026-12-18" }), false);

// Qui est où / qui est dispo
const plans = [
  { who: ["bastien", "axel"], type: "trip", place: "Calgary", from: "2026-09-12", to: "2026-09-15" },
  { who: ["leo"], type: "away", place: "Famille", from: "2026-09-01", to: "2026-09-30" }
];
assert.strictEqual(P.whereIs(plans, "bastien", "2026-09-12").place, "Calgary");
assert.strictEqual(P.whereIs(plans, "bastien", "2026-09-16"), null);
assert.strictEqual(P.whereIs(plans, "leo", "2026-09-20").type, "away");
assert.strictEqual(P.onDay(plans, "2026-09-13").length, 2);
const ids = ["bastien", "leo", "simon", "axel"];
assert.deepStrictEqual(P.freeOn(plans, ids, P.weekDays("2026-09-07")), ["simon"]);
assert.deepStrictEqual(P.freeOn(plans, ids, P.weekDays("2026-09-21")), ["bastien", "simon", "axel"]);

console.log("OK : calculs du planning valides");
