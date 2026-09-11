/* ============================================================
   CARIBOU — Mr. White (Undercover)
   Deux modes : un seul téléphone qui tourne, ou chacun le sien
   (synchro PocketBase, table `meta`, kind "mrwhite-game").
   Les paires déjà jouées sont cochées dans meta kind "mrwhite-used".
   ============================================================ */

(function () {
  "use strict";

  /* ================= Logique pure (tests/mrwhite.test.js) ================= */

  var ROLE_NAMES = { civil: "Civil", undercover: "Undercover", white: "Mr. White" };
  var WIN_TEXT = {
    civil: "Les Civils gagnent !",
    undercover: "Les Undercovers gagnent !",
    white: "Mr. White gagne !"
  };

  // Répartition conseillée (tableau du guide)
  function defaultMix(n) {
    if (n < 4) return { undercover: 1, white: 0 };
    return {
      undercover: n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : Math.floor(n / 4),
      white: n >= 13 ? 2 : 1
    };
  }

  function mixError(n, mix) {
    if (n < 3) return "Il faut au moins 3 joueurs.";
    if (mix.undercover + mix.white < 1) return "Il faut au moins un Undercover ou un Mr. White.";
    if (n - mix.undercover - mix.white < 1) return "Il faut au moins un Civil.";
    return null;
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Paire au hasard parmi celles pas encore jouées (null si tout est joué)
  function pickPair(pairs, used, rng) {
    var done = {};
    used.forEach(function (p) { done[p] = true; });
    var free = pairs.filter(function (p) { return !done[p]; });
    return free.length ? free[Math.floor(rng() * free.length)] : null;
  }

  // Distribue rôles et mots. players : [{pid, name}]
  function deal(players, mix, pair, rng) {
    var words = pair.split("|");
    if (rng() < 0.5) words.reverse(); // qui a quel mot : au hasard
    var roles = players.map(function (p, i) {
      return i < mix.white ? "white" : i < mix.white + mix.undercover ? "undercover" : "civil";
    });
    roles = shuffle(roles, rng);
    var list = players.map(function (p, i) {
      var r = roles[i];
      return { pid: p.pid, name: p.name, role: r, word: r === "white" ? null : r === "civil" ? words[0] : words[1], alive: true };
    });
    var starters = list.filter(function (p) { return p.role !== "white"; }); // Mr. White ne commence jamais
    return {
      players: list, pair: pair, civilWord: words[0], underWord: words[1],
      startPid: starters[Math.floor(rng() * starters.length)].pid
    };
  }

  // Ordre de parole : dans le cercle, à partir du premier joueur, vivants seulement
  function speakOrder(players, startPid) {
    var i0 = 0;
    players.forEach(function (p, i) { if (p.pid === startPid) i0 = i; });
    var out = [];
    for (var k = 0; k < players.length; k++) {
      var p = players[(i0 + k) % players.length];
      if (p.alive) out.push(p);
    }
    var guard = out.length;
    while (guard-- > 0 && out[0].role === "white") out.push(out.shift()); // si possible, pas Mr. White en premier
    return out;
  }

  function winner(players) {
    var c = 0, u = 0, w = 0;
    players.forEach(function (p) {
      if (!p.alive) return;
      if (p.role === "civil") c++; else if (p.role === "undercover") u++; else w++;
    });
    if (w > 0 && c + u + w <= 2) return "white";   // Mr. White tient jusqu'aux 2 derniers
    if (u === 0 && w === 0) return "civil";
    if (w === 0 && u >= c) return "undercover";
    return null;
  }

  // Élimination après un vote. Mr. White passe d'abord par sa tentative.
  function eliminate(g, pid) {
    var p = g.players.filter(function (x) { return x.pid === pid; })[0];
    if (!p || !p.alive) return;
    p.alive = false;
    g.lastOut = { pid: p.pid, name: p.name, role: p.role };
    if (p.role === "white") { g.status = "guess"; return; }
    endIfWon(g);
  }

  function whiteGuess(g, found) {
    if (found) { g.winner = "white"; g.status = "over"; return; }
    g.status = "play";
    endIfWon(g);
  }

  function endIfWon(g) {
    var w = winner(g.players);
    if (w) { g.winner = w; g.status = "over"; }
    else g.status = "play";
  }

  var MW = {
    defaultMix: defaultMix, mixError: mixError, pickPair: pickPair, deal: deal,
    speakOrder: speakOrder, winner: winner, eliminate: eliminate, whiteGuess: whiteGuess
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = MW; return; }

  /* ================= Interface ================= */

  var CFG = window.CARIBOU_CONFIG || { accounts: [] };
  var PAIRS = window.MRWHITE_PAIRS || [];
  var LS_SOLO = "mrwhite_solo";       // partie 1 téléphone en cours
  var LS_GAME = "mrwhite_game_id";    // partie multi rejointe
  var LS_PID = "mrwhite_pid";
  var LS_NAME = "mrwhite_name";
  var LS_USED = "mrwhite_used";       // secours si pas de base

  var root = document.getElementById("mw-root");
  var pb = null;
  var g = null;          // partie affichée
  var gameId = null;     // id PocketBase (mode multi)
  var used = [];         // paires déjà jouées
  var ui = { shown: false, confirmPid: null, showWord: false, soloName: "" };
  var me = identity();

  function $(sel) { return root.querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg, isError) {
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    document.getElementById("toasts").appendChild(el);
    setTimeout(function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 300); }, 3200);
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  // Compte Caribou connecté sur cet appareil, sinon invité
  function identity() {
    var m = document.cookie.match(/(?:^|;\s*)caribou_user=([^;]*)/);
    var id = lsGet("caribou_session") || (m && decodeURIComponent(m[1]));
    var acc = (CFG.accounts || []).filter(function (a) { return a.id === id; })[0];
    if (acc) return { pid: acc.id, name: acc.name, crew: true };
    var pid = lsGet(LS_PID);
    if (!pid) { pid = "g-" + Math.random().toString(36).slice(2, 10); lsSet(LS_PID, pid); }
    return { pid: pid, name: lsGet(LS_NAME) || "", crew: false };
  }

  function isHost() { return g && (g.mode === "solo" || g.host === me.pid); }
  function mixOf(game) { return game.custom ? game.mix : defaultMix(game.players.length); }

  /* ---------- Base (PocketBase) ---------- */

  function initPb() {
    if (!CFG.pbUrl || typeof PocketBase === "undefined") return;
    try { pb = new PocketBase(CFG.pbUrl); pb.autoCancellation(false); } catch (e) { pb = null; }
  }

  function usedRecords() {
    return pb.collection("meta").getFullList({ filter: 'kind="mrwhite-used"' });
  }

  function loadUsed() {
    if (!pb) {
      try { used = JSON.parse(lsGet(LS_USED)) || []; } catch (e) { used = []; }
      return Promise.resolve(used);
    }
    return usedRecords().then(function (recs) {
      var all = {};
      recs.forEach(function (r) { ((r.data && r.data.pairs) || []).forEach(function (p) { all[p] = true; }); });
      used = Object.keys(all);
      return used;
    });
  }

  // Écrit la liste complète dans le 1er enregistrement (fusionne les doublons éventuels)
  function writeUsed(list) {
    used = list;
    if (!pb) { lsSet(LS_USED, JSON.stringify(list)); return Promise.resolve(); }
    return usedRecords().then(function (recs) {
      var ops = recs.slice(1).map(function (r) { return pb.collection("meta").delete(r.id); });
      ops.push(recs.length
        ? pb.collection("meta").update(recs[0].id, { data: { pairs: list } })
        : pb.collection("meta").create({ kind: "mrwhite-used", data: { pairs: list } }));
      return Promise.all(ops);
    });
  }

  function markUsed(pair) {
    return loadUsed().then(function (list) {
      if (list.indexOf(pair) < 0) return writeUsed(list.concat([pair]));
    }).catch(function () { toast("Paire non cochée (base injoignable)", true); });
  }

  // Lit la partie fraîche, applique la modif, réécrit (limite les écrasements entre téléphones)
  function mutate(fn) {
    if (g.mode === "solo") { fn(g); saveSolo(); render(); return Promise.resolve(); }
    return pb.collection("meta").getOne(gameId).then(function (rec) {
      var fresh = rec.data;
      fn(fresh);
      fresh.updated = new Date().toISOString();
      g = fresh; render();
      return pb.collection("meta").update(gameId, { data: fresh });
    }).catch(function () { toast("Action non envoyée (base injoignable)", true); });
  }

  function saveSolo() { lsSet(LS_SOLO, g ? JSON.stringify(g) : null); }

  function watchGame(id) {
    gameId = id;
    lsSet(LS_GAME, id);
    pb.collection("meta").subscribe(id, function (e) {
      if (e.action === "delete") { leaveLocal(); toast("La partie a été fermée par l'hôte"); return; }
      var prev = g && g.status;
      g = e.record.data;
      if (prev !== g.status) { ui.shown = false; ui.confirmPid = null; ui.showWord = false; }
      // arrivé en même temps qu'un autre et écrasé ? on se remet dans la liste
      if (g.status === "lobby" && !inGame()) mutate(addMe);
      render();
    }).catch(function () {});
  }

  function inGame() { return g.players.some(function (p) { return p.pid === me.pid; }); }
  function addMe(d) {
    if (!d.players.some(function (p) { return p.pid === me.pid; })) d.players.push({ pid: me.pid, name: me.name });
  }

  function leaveLocal() {
    if (pb && gameId) pb.collection("meta").unsubscribe(gameId).catch(function () {});
    g = null; gameId = null; lsSet(LS_GAME, null);
    ui = { shown: false, confirmPid: null, showWord: false, soloName: "" };
    render();
  }

  function genCode() {
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ", s = "";
    for (var i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  function createMulti() {
    if (!askName()) return;
    var old = Date.now() - 2 * 24 * 3600 * 1000;
    var game = {
      code: genCode(), mode: "multi", host: me.pid, status: "lobby", custom: false,
      mix: defaultMix(4), players: [{ pid: me.pid, name: me.name }], updated: new Date().toISOString()
    };
    pb.collection("meta").getFullList({ filter: 'kind="mrwhite-game"' }).then(function (recs) {
      // ménage : parties de plus de 2 jours
      recs.forEach(function (r) {
        if (new Date((r.data && r.data.updated) || 0).getTime() < old) pb.collection("meta").delete(r.id).catch(function () {});
      });
      return pb.collection("meta").create({ kind: "mrwhite-game", data: game });
    }).then(function (rec) {
      g = rec.data;
      watchGame(rec.id);
      render();
    }).catch(function () { toast("Impossible de créer la partie (base injoignable)", true); });
  }

  function joinMulti(code) {
    if (!askName()) return;
    code = (code || "").trim().toUpperCase();
    if (code.length !== 4) { toast("Le code fait 4 lettres", true); return; }
    pb.collection("meta").getFullList({ filter: 'kind="mrwhite-game"' }).then(function (recs) {
      var rec = recs.filter(function (r) { return r.data && r.data.code === code; })[0];
      if (!rec) { toast("Aucune partie avec le code " + code, true); return; }
      g = rec.data;
      gameId = rec.id;
      if (!inGame() && g.status !== "lobby") { toast("Partie déjà lancée : attends la prochaine manche", true); g = null; gameId = null; return; }
      watchGame(rec.id);
      if (!inGame()) mutate(addMe); else render();
    }).catch(function () { toast("Base injoignable", true); });
  }

  function askName() {
    var inp = $("#mw-name");
    var name = inp ? inp.value.trim() : me.name;
    if (!name) { toast("Entre ton prénom", true); if (inp) inp.focus(); return false; }
    me.name = name.slice(0, 20);
    if (!me.crew) lsSet(LS_NAME, me.name);
    return true;
  }

  /* ---------- Actions de jeu ---------- */

  function startGame() {
    var n = g.players.length;
    var mix = mixOf(g);
    var err = mixError(n, mix);
    if (err) { toast(err, true); return; }
    loadUsed().catch(function () { return used; }).then(function () {
      var pair = PAIRS.length ? MW.pickPair(PAIRS, used, Math.random) : null;
      if (!pair) { toast("Toutes les paires ont été jouées : réinitialise la liste", true); return; }
      mutate(function (d) {
        var dealt = deal(d.players.map(function (p) { return { pid: p.pid, name: p.name }; }), mixOf(d), pair, Math.random);
        d.players = dealt.players; d.pair = dealt.pair; d.civilWord = dealt.civilWord;
        d.underWord = dealt.underWord; d.startPid = dealt.startPid;
        d.mix = mixOf(d); d.lastOut = null; d.winner = null;
        d.status = d.mode === "solo" ? "reveal" : "play";
        d.revealIdx = 0;
      });
      ui.shown = false;
      markUsed(pair);
    });
  }

  function backToLobby() {
    mutate(function (d) {
      d.players = d.players.map(function (p) { return { pid: p.pid, name: p.name }; });
      d.status = "lobby"; d.lastOut = null; d.winner = null; d.pair = null;
      d.civilWord = null; d.underWord = null;
    });
  }

  function quit() {
    if (!g) return;
    if (g.mode === "solo") { g = null; saveSolo(); render(); return; }
    if (isHost()) {
      var id = gameId;
      leaveLocal();
      pb.collection("meta").delete(id).catch(function () {});
      return;
    }
    var id2 = gameId;
    if (g.status === "lobby") {
      pb.collection("meta").getOne(id2).then(function (rec) {
        var d = rec.data;
        d.players = d.players.filter(function (p) { return p.pid !== me.pid; });
        return pb.collection("meta").update(id2, { data: d });
      }).catch(function () {});
    }
    leaveLocal();
  }

  /* ---------- Rendu ---------- */

  function render() {
    if (!g) return renderHome();
    if (g.status === "lobby") return g.mode === "solo" ? renderSoloSetup() : renderLobby();
    if (g.status === "reveal") return renderReveal();
    if (g.status === "over") return renderOver();
    return renderPlay();
  }

  function card(title, sub, body, cls) {
    return '<article class="card ' + (cls || "") + '">' +
      (title ? '<h2 class="card-title">' + title + "</h2>" : "") +
      (sub ? '<p class="card-sub">' + sub + "</p>" : "") + body + "</article>";
  }

  function renderHome() {
    var noPb = !pb;
    root.innerHTML =
      card("Mr. White", "Civils, Undercovers et Mr. White : donnez un indice, votez, démasquez les imposteurs.",
        '<div class="mw-modes">' +
          '<button class="mw-mode" data-act="solo"><span class="mw-mode-ico">📱</span><strong>Un seul téléphone</strong><span>Il passe de main en main</span></button>' +
          '<button class="mw-mode" data-act="multi"' + (noPb ? " disabled" : "") + '><span class="mw-mode-ico">📱📱</span><strong>Chacun son téléphone</strong><span>' + (noPb ? "Base injoignable" : "Crée une partie avec un code") + "</span></button>" +
        "</div>" +
        '<label class="field mw-name-field"><span class="field-label">Ton prénom (mode chacun son téléphone)</span>' +
          '<input type="text" id="mw-name" maxlength="20" value="' + esc(me.name) + '" placeholder="Prénom"></label>' +
        '<div class="mw-join"><input type="text" id="mw-code" maxlength="4" placeholder="CODE" autocapitalize="characters" value="' + esc(codeFromUrl()) + '">' +
          '<button class="btn-ghost" data-act="join"' + (noPb ? " disabled" : "") + ">Rejoindre</button></div>") +
      card("Paires de mots", null,
        '<p class="mw-used"><strong id="mw-used-count">' + used.length + "</strong> / " + PAIRS.length +
          " paires déjà jouées. Elles sont cochées automatiquement et ne ressortent plus.</p>" +
        '<button class="btn-ghost btn-xs" data-act="reset-used">Réinitialiser la liste</button>') +
      card("Règles express", null,
        '<details class="mw-rules"><summary>Afficher</summary>' +
        "<p><strong>Civils</strong> : ont le mot principal. Ils doivent éliminer tous les imposteurs.</p>" +
        "<p><strong>Undercovers</strong> : ont un mot proche, sans le savoir. Ils gagnent s'ils sont au moins aussi nombreux que les Civils une fois Mr. White éliminé.</p>" +
        "<p><strong>Mr. White</strong> : n'a pas de mot. Éliminé, il peut deviner le mot des Civils pour gagner. Il gagne aussi s'il tient jusqu'aux 2 derniers.</p>" +
        "<p>Chaque tour : un indice chacun (pas de répétition), débat, vote à l'oral, puis on indique ici qui est éliminé.</p></details>");
  }

  // QR du lien de la partie (librairie qrcode-generator ; si elle n'a pas chargé, pas de QR)
  function qrBlock(link) {
    if (typeof qrcode === "undefined") return "";
    var qr = qrcode(0, "M");
    qr.addData(link);
    qr.make();
    return '<div class="mw-qr">' + qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: "QR code pour rejoindre la partie" }) + "</div>" +
      '<p class="mw-qr-hint">Scanne pour rejoindre directement</p>';
  }

  function codeFromUrl() {
    var m = location.search.match(/[?&]code=([A-Za-z]{4})/);
    return m ? m[1].toUpperCase() : "";
  }

  function mixBlock(editable) {
    var n = g.players.length, mix = mixOf(g), civ = n - mix.undercover - mix.white;
    var err = mixError(n, mix);
    var row = function (key, label, val) {
      return '<div class="mw-step"><span>' + label + "</span>" +
        (editable && g.custom && key
          ? '<button class="mw-step-btn" data-act="mix" data-key="' + key + '" data-d="-1" aria-label="Moins">−</button><strong>' + val +
            '</strong><button class="mw-step-btn" data-act="mix" data-key="' + key + '" data-d="1" aria-label="Plus">+</button>'
          : (editable && g.custom ? '<i class="mw-step-pad"></i><strong>' + val + '</strong><i class="mw-step-pad"></i>' : "<strong>" + val + "</strong>")) + "</div>";
    };
    return '<div class="mw-mix">' +
      (editable
        ? '<div class="seg mw-seg"><button class="seg-btn' + (g.custom ? "" : " active") + '" data-act="custom" data-v="0">Classique</button>' +
          '<button class="seg-btn' + (g.custom ? " active" : "") + '" data-act="custom" data-v="1">Custom</button></div>'
        : "") +
      row(null, "Civils", Math.max(civ, 0)) + row("undercover", "Undercovers", mix.undercover) + row("white", "Mr. White", mix.white) +
      (err ? '<p class="login-error">' + esc(err) + "</p>" : "") + "</div>";
  }

  function renderSoloSetup() {
    root.innerHTML = card("Un seul téléphone", "Ajoute les joueurs dans l'ordre où vous êtes assis.",
      '<ul class="mw-players">' + g.players.map(function (p, i) {
        return "<li><span>" + esc(p.name) + '</span><button class="icon-btn" data-act="rm" data-i="' + i + '" aria-label="Retirer ' + esc(p.name) + '">✕</button></li>';
      }).join("") + "</ul>" +
      '<form class="mw-join" id="mw-add"><input type="text" id="mw-add-name" maxlength="20" placeholder="Ajouter un joueur" value="' + esc(ui.soloName) + '">' +
      '<button class="btn-ghost" type="submit">Ajouter</button></form>') +
      card("Répartition", null, mixBlock(true) +
        '<div class="mw-actions"><button class="btn-ghost" data-act="quit">Retour</button>' +
        '<button class="btn-primary" data-act="start">Distribuer les mots</button></div>');
    var inp = $("#mw-add-name");
    if (ui.focusAdd && inp) { inp.focus(); ui.focusAdd = false; }
  }

  function renderLobby() {
    var host = isHost();
    var link = location.origin + location.pathname + "?code=" + g.code;
    root.innerHTML = card("Salle d'attente", null,
      '<p class="mw-code-label">Code de la partie</p><p class="mw-code">' + esc(g.code) + "</p>" +
      qrBlock(link) +
      '<p class="mw-link">Ou envoie le lien : <a href="' + esc(link) + '">' + esc(link) + "</a></p>" +
      '<ul class="mw-players">' + g.players.map(function (p) {
        return "<li><span>" + esc(p.name) + (p.pid === g.host ? ' <em class="mw-tag">hôte</em>' : "") +
          (p.pid === me.pid ? ' <em class="mw-tag">toi</em>' : "") + "</span></li>";
      }).join("") + "</ul>") +
      card("Répartition", host ? null : "L'hôte choisit la répartition et lance la partie.", mixBlock(host) +
        '<div class="mw-actions"><button class="btn-ghost" data-act="quit">' + (host ? "Fermer la partie" : "Quitter") + "</button>" +
        (host ? '<button class="btn-primary" data-act="start">Lancer</button>' : '<p class="mw-wait">En attente de l\'hôte…</p>') + "</div>");
  }

  function wordCard(p) {
    var inner = ui.shown
      ? (p.role === "white"
          ? '<span class="mw-word-role">Tu es</span><span class="mw-word">Mr. White</span><span class="mw-word-hint">Tu n\'as pas de mot. Écoute bien et bluffe.</span>'
          : '<span class="mw-word-role">Ton mot</span><span class="mw-word">' + esc(p.word) + "</span>")
      : '<span class="mw-word-hint">Appuie pour voir ton mot, en cachette</span>';
    return '<button class="mw-secret' + (ui.shown ? " open" : "") + '" data-act="toggle-word">' + inner + "</button>";
  }

  function renderReveal() {
    var p = g.players[g.revealIdx];
    root.innerHTML = card("Distribution des mots", "Joueur " + (g.revealIdx + 1) + " sur " + g.players.length,
      '<p class="mw-pass">Passe le téléphone à <strong>' + esc(p.name) + "</strong></p>" + wordCard(p) +
      (ui.shown
        ? '<button class="btn-primary" data-act="next-reveal">' + (g.revealIdx + 1 < g.players.length ? "C'est retenu, joueur suivant" : "C'est retenu, on joue") + "</button>"
        : ""));
  }

  function roleBadge(role) {
    return '<span class="mw-role mw-role-' + role + '">' + ROLE_NAMES[role] + "</span>";
  }

  function renderPlay() {
    var host = isHost();
    var mine = g.players.filter(function (p) { return p.pid === me.pid; })[0];
    var order = speakOrder(g.players, g.startPid);
    var html = "";

    if (g.mode === "multi" && mine) html += card(null, null, wordCard(mine) + (mine.alive ? "" : '<p class="mw-wait">Tu es éliminé : tu peux encore suivre la partie.</p>'));
    if (g.mode === "multi" && !mine) html += card(null, "Tu regardes la partie (tu n'y joues pas).", "");

    if (g.lastOut) {
      html += card(null, null, '<p class="mw-out"><strong>' + esc(g.lastOut.name) + "</strong> était " + roleBadge(g.lastOut.role) + "</p>", "mw-out-card");
    }

    if (g.status === "guess") {
      var body = "<p>" + esc(g.lastOut.name) + " doit deviner le mot des Civils, à voix haute.</p>";
      if (host) {
        body += (ui.showWord
          ? '<p class="mw-civil-word">Mot des Civils : <strong>' + esc(g.civilWord) + "</strong></p>"
          : '<button class="btn-ghost btn-xs" data-act="show-word">Afficher le mot des Civils</button>') +
          '<div class="mw-actions"><button class="btn-danger" data-act="guess" data-v="0">Raté</button>' +
          '<button class="btn-primary" data-act="guess" data-v="1">Trouvé !</button></div>';
      } else body += '<p class="mw-wait">L\'hôte valide la réponse…</p>';
      root.innerHTML = html + card("Mr. White est démasqué !", null, body, "mw-guess-card");
      return;
    }

    html += card("Ordre de parole", "Un indice chacun, dans cet ordre. Puis débat et vote.",
      '<ol class="mw-order">' + order.map(function (p, i) {
        return "<li" + (i === 0 ? ' class="first"' : "") + ">" + esc(p.name) + (i === 0 ? ' <em class="mw-tag">commence</em>' : "") + "</li>";
      }).join("") + "</ol>");

    var alive = g.players.filter(function (p) { return p.alive; });
    var dead = g.players.filter(function (p) { return !p.alive; });
    var vote = "";
    if (host) {
      vote = '<p class="card-sub">Touchez le joueur éliminé par le vote.</p><div class="mw-vote">' + alive.map(function (p) {
        return '<button class="chip-btn' + (ui.confirmPid === p.pid ? " selected" : "") + '" data-act="pick" data-pid="' + esc(p.pid) + '">' + esc(p.name) + "</button>";
      }).join("") + "</div>";
      if (ui.confirmPid) {
        var cp = alive.filter(function (p) { return p.pid === ui.confirmPid; })[0];
        if (cp) vote += '<div class="mw-actions"><button class="btn-ghost" data-act="pick" data-pid="">Annuler</button>' +
          '<button class="btn-danger" data-act="eliminate">Éliminer ' + esc(cp.name) + "</button></div>";
      }
    } else vote = '<p class="mw-wait">L\'hôte indique qui est éliminé après le vote.</p>';
    if (dead.length) vote += '<p class="mw-dead">Éliminés : ' + dead.map(function (p) { return esc(p.name) + " " + roleBadge(p.role); }).join(", ") + "</p>";
    html += card("Vote", null, vote);
    html += '<div class="mw-actions mw-foot"><button class="btn-ghost btn-xs" data-act="quit">' + (host ? "Arrêter la partie" : "Quitter") + "</button></div>";
    root.innerHTML = html;
  }

  function renderOver() {
    var host = isHost();
    var rows = g.players.map(function (p) {
      return "<li" + (p.alive ? "" : ' class="dead"') + "><span>" + esc(p.name) + "</span>" + roleBadge(p.role) +
        '<span class="mw-over-word">' + esc(p.word || "—") + "</span></li>";
    }).join("");
    root.innerHTML = card(WIN_TEXT[g.winner] || "Partie terminée",
      "Civils : <strong>" + esc(g.civilWord) + "</strong> · Undercovers : <strong>" + esc(g.underWord) + "</strong>",
      '<ul class="mw-over">' + rows + "</ul>" +
      '<div class="mw-actions"><button class="btn-ghost" data-act="quit">' + (host && g.mode === "multi" ? "Fermer la partie" : "Quitter") + "</button>" +
      (host ? '<button class="btn-primary" data-act="lobby">Rejouer</button>' : '<p class="mw-wait">L\'hôte peut relancer une manche.</p>') + "</div>",
      "mw-win mw-win-" + g.winner);
  }

  /* ---------- Événements ---------- */

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var act = b.dataset.act;

    if (act === "solo") {
      g = { mode: "solo", status: "lobby", custom: false, mix: defaultMix(4),
            players: (CFG.accounts || []).map(function (a) { return { pid: a.id, name: a.name }; }) };
      saveSolo(); render();
    } else if (act === "multi") createMulti();
    else if (act === "join") joinMulti(($("#mw-code") || {}).value);
    else if (act === "reset-used") {
      if (!confirm("Remettre à zéro les " + used.length + " paires déjà jouées ?")) return;
      writeUsed([]).then(function () { toast("Liste des paires remise à zéro"); render(); })
        .catch(function () { toast("Base injoignable", true); });
    } else if (act === "rm") {
      var i = +b.dataset.i;
      mutate(function (d) { d.players.splice(i, 1); });
    } else if (act === "custom") {
      var custom = b.dataset.v === "1";
      mutate(function (d) { if (custom && !d.custom) d.mix = defaultMix(d.players.length); d.custom = custom; });
    } else if (act === "mix") {
      var key = b.dataset.key, delta = +b.dataset.d;
      mutate(function (d) { d.mix[key] = Math.max(0, d.mix[key] + delta); });
    } else if (act === "start") startGame();
    else if (act === "toggle-word") { ui.shown = !ui.shown; render(); }
    else if (act === "next-reveal") {
      ui.shown = false;
      mutate(function (d) { if (d.revealIdx + 1 < d.players.length) d.revealIdx++; else d.status = "play"; });
    } else if (act === "pick") { ui.confirmPid = b.dataset.pid || null; render(); }
    else if (act === "eliminate") {
      var pid = ui.confirmPid;
      ui.confirmPid = null; ui.showWord = false;
      mutate(function (d) { eliminate(d, pid); });
    } else if (act === "show-word") { ui.showWord = true; render(); }
    else if (act === "guess") {
      var found = b.dataset.v === "1";
      ui.showWord = false;
      mutate(function (d) { whiteGuess(d, found); });
    } else if (act === "lobby") backToLobby();
    else if (act === "quit") {
      if (g && g.status !== "lobby" && g.status !== "over" && !confirm("Quitter la partie en cours ?")) return;
      quit();
    }
  });

  root.addEventListener("submit", function (e) {
    if (e.target.id !== "mw-add") return;
    e.preventDefault();
    var inp = $("#mw-add-name");
    var name = inp.value.trim().slice(0, 20);
    if (!name) return;
    ui.soloName = ""; ui.focusAdd = true;
    mutate(function (d) { d.players.push({ pid: "p-" + Date.now() + Math.random().toString(36).slice(2, 6), name: name }); });
  });

  root.addEventListener("input", function (e) {
    if (e.target.id === "mw-add-name") ui.soloName = e.target.value;
    if (e.target.id === "mw-code") e.target.value = e.target.value.toUpperCase();
  });

  /* ---------- Démarrage ---------- */

  function boot() {
    initPb();
    try { g = JSON.parse(lsGet(LS_SOLO)); } catch (e) { g = null; }
    render();
    loadUsed().then(function () { var c = document.getElementById("mw-used-count"); if (c) c.textContent = used.length; })
      .catch(function () {});
    var savedId = lsGet(LS_GAME);
    var urlCode = codeFromUrl();
    if (!g && pb && savedId) {
      pb.collection("meta").getOne(savedId).then(function (rec) {
        if (urlCode && rec.data.code !== urlCode) { lsSet(LS_GAME, null); autoJoin(urlCode); return; } // nouveau QR scanné
        g = rec.data;
        watchGame(rec.id);
        render();
      }).catch(function () { lsSet(LS_GAME, null); autoJoin(urlCode); });
    } else autoJoin(urlCode);
  }

  // Arrivé par le lien / QR : on rejoint direct si on connaît déjà le prénom
  function autoJoin(code) {
    if (g || !pb || !code) return;
    if (me.name) { joinMulti(code); return; }
    var n = $("#mw-name");
    if (n) n.focus();
    toast("Entre ton prénom puis appuie sur Rejoindre");
  }

  boot();
})();
