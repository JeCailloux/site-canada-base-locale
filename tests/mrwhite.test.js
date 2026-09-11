// Vérifie la logique de Mr. White et la liste de mots : node tests/mrwhite.test.js
const assert = require("assert");
const MW = require("../js/mrwhite.js");
global.window = global;
require("../js/mrwhite-mots.js");

// --- mots : 2000+, pas de doublon (même inversé), pas de paire vide ou identique
const pairs = window.MRWHITE_PAIRS;
assert(pairs.length >= 2000, "moins de 2000 paires : " + pairs.length);
const seen = new Set();
for (const p of pairs) {
  const w = p.split("|").map((s) => s.trim().toLowerCase());
  assert(w.length === 2 && w[0] && w[1] && w[0] !== w[1], "paire invalide : " + p);
  const k = w.sort().join("|");
  assert(!seen.has(k), "doublon : " + p);
  seen.add(k);
}

// --- tirage : ne ressort jamais une paire jouée, null quand tout est joué
assert.strictEqual(MW.pickPair(["a|b", "c|d"], ["a|b"], Math.random), "c|d");
assert.strictEqual(MW.pickPair(["a|b"], ["a|b"], Math.random), null);

// --- répartition conseillée (tableau du guide)
const civ = (n) => { const m = MW.defaultMix(n); return [n - m.undercover - m.white, m.undercover, m.white]; };
assert.deepStrictEqual(civ(4), [2, 1, 1]);
assert.deepStrictEqual(civ(7), [4, 2, 1]);
assert.deepStrictEqual(civ(10), [6, 3, 1]);
assert.strictEqual(MW.mixError(4, { undercover: 3, white: 1 }), "Il faut au moins un Civil.");
assert.strictEqual(MW.mixError(4, { undercover: 0, white: 0 }), "Il faut au moins un Undercover ou un Mr. White.");
assert.strictEqual(MW.mixError(5, { undercover: 2, white: 2 }), null); // custom libre

// --- distribution : bons comptes, mots cohérents, Mr. White ne commence jamais
const players = ["A", "B", "C", "D", "E", "F"].map((n) => ({ pid: n, name: n }));
for (let t = 0; t < 200; t++) {
  const d = MW.deal(players, { undercover: 2, white: 1 }, "Chat|Chien", Math.random);
  const count = (r) => d.players.filter((p) => p.role === r).length;
  assert.deepStrictEqual([count("civil"), count("undercover"), count("white")], [3, 2, 1]);
  assert.notStrictEqual(d.players.find((p) => p.pid === d.startPid).role, "white");
  assert.deepStrictEqual([d.civilWord, d.underWord].sort(), ["Chat", "Chien"]);
  d.players.forEach((p) => assert.strictEqual(p.word, p.role === "white" ? null : p.role === "civil" ? d.civilWord : d.underWord));
  assert.notStrictEqual(MW.speakOrder(d.players, d.startPid)[0].role, "white");
}

// --- victoires
const P = (role, alive = true) => ({ role, alive });
assert.strictEqual(MW.winner([P("civil"), P("civil"), P("undercover"), P("white")]), null);
assert.strictEqual(MW.winner([P("civil"), P("civil"), P("undercover", false), P("white", false)]), "civil");
assert.strictEqual(MW.winner([P("civil"), P("undercover"), P("white", false)]), "undercover");
assert.strictEqual(MW.winner([P("civil"), P("white"), P("undercover", false)]), "white"); // 2 derniers
assert.strictEqual(MW.winner([P("civil"), P("civil"), P("civil"), P("undercover"), P("white", false)]), null);

// --- déroulé : Mr. White éliminé passe par sa tentative
const g = { status: "play", players: [
  { pid: "a", name: "a", role: "civil", alive: true }, { pid: "b", name: "b", role: "civil", alive: true },
  { pid: "c", name: "c", role: "undercover", alive: true }, { pid: "w", name: "w", role: "white", alive: true }] };
MW.eliminate(g, "w");
assert.strictEqual(g.status, "guess");
MW.whiteGuess(g, false);
assert.strictEqual(g.status, "play");
MW.eliminate(g, "c");
assert.deepStrictEqual([g.status, g.winner], ["over", "civil"]);
const g2 = { status: "play", players: [{ pid: "a", role: "civil", alive: true }, { pid: "b", role: "civil", alive: true }, { pid: "w", role: "white", alive: true }] };
MW.eliminate(g2, "w");
MW.whiteGuess(g2, true);
assert.deepStrictEqual([g2.status, g2.winner], ["over", "white"]);

console.log("OK : " + pairs.length + " paires, logique Mr. White valide");
