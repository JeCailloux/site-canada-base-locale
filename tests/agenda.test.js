// Vérifie l'agenda des cours : node tests/agenda.test.js
const assert = require("assert");
const A = require("../js/agenda.js");

const codes = (list) => list.map((s) => s.day + " " + s.course.code + (s.remote ? " D" : " P"));

// Semaine du 7 sept. : les 5 cours démarrent
assert.deepStrictEqual(codes(A.sessions("2026-09-07", "2026-09-13")), [
  "2026-09-09 CYB6063 P", "2026-09-09 INF6303 D", // 8h30 avant 12h30
  "2026-09-10 CYB6023 P", "2026-09-10 INF6333 D", "2026-09-10 CYB1073 D"
]);

// Semaine d'études : rien
assert.strictEqual(A.sessions("2026-10-12", "2026-10-18").length, 0);

// Exceptions distanciel / présentiel
assert.deepStrictEqual(codes(A.sessions("2026-10-05", "2026-10-11")).filter((s) => s.includes("CYB60")), ["2026-10-07 CYB6063 D", "2026-10-08 CYB6023 D"]);
const exam = A.sessions("2026-10-29", "2026-10-29").find((s) => s.course.code === "CYB1073");
assert.strictEqual(exam.remote, false);
assert.strictEqual(exam.note, "Examen de mi-session");

// 15 semaines - 1 semaine d'études = 14 séances par cours
A.COURSES.forEach((c) => assert.strictEqual(A.sessions("2026-01-01", "2026-12-31", [c]).length, 14, c.code));

console.log("agenda OK");
