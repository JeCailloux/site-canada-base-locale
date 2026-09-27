/* ============================================================
   CARIBOU — Logique de l'app
   Auth (session persistante), dépenses, soldes, remboursements.
   Données 100% locales (localStorage) + export/import JSON.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.CARIBOU_CONFIG;
  var LS_DATA = "caribou_data_v1";
  var LS_SESSION = "caribou_session";
  var COOKIE_NAME = "caribou_user";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 jours = maximum autorisé par les navigateurs

  var CATEGORIES = [
    { id: "food",      name: "Restos",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>' },
    { id: "grocery",   name: "Courses",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' },
    { id: "transport", name: "Transport", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>' },
    { id: "lodging",   name: "Logement",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
    { id: "activity",  name: "Activités", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>' },
    { id: "party",     name: "Soirée",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>' },
    { id: "shopping",  name: "Shopping",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
    { id: "other",     name: "Autre",     icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>' }
  ];

  var CAT_COLORS = {
    food: "#F59E0B",
    grocery: "#34D399",
    transport: "#38BDF8",
    lodging: "#A78BFA",
    activity: "#FB7185",
    party: "#FB923C",
    shopping: "#F472B6",
    other: "#94A3B8"
  };

  var fmtCAD = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
  var fmtCAD0 = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  var fmtEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var fmtEUR0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var fmtUSD = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "USD" });
  var fmtUSD0 = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var fmtDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  var FMT = { CAD: [fmtCAD, fmtCAD0], EUR: [fmtEUR, fmtEUR0], USD: [fmtUSD, fmtUSD0] };

  function validCur(c) { return FMT[c] ? c : "CAD"; }
  // 1 unité de la devise = X CAD
  function rateOf(cur) {
    return cur === "EUR" ? state.data.eurToCad : cur === "USD" ? state.data.usdToCad : 1;
  }

  var LS_CUR = "caribou_display_cur";
  var displayCur = validCur(localStorage.getItem(LS_CUR));

  // Montant fourni en CAD → formaté dans la devise d'affichage choisie
  function M(cad) {
    return FMT[displayCur][0].format(cad / rateOf(displayCur));
  }
  function M0(cad) {
    return FMT[displayCur][1].format(cad / rateOf(displayCur));
  }
  // même montant dans une autre devise (note secondaire) : EUR si on affiche des CAD, sinon CAD
  function MOther(cad) {
    var o = displayCur === "CAD" ? "EUR" : "CAD";
    return FMT[o][0].format(cad / rateOf(o));
  }
  function syncCurButtons() {
    $all(".cur-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.cur === displayCur); });
  }
  function setDisplayCur(cur) {
    displayCur = validCur(cur);
    localStorage.setItem(LS_CUR, displayCur);
    syncCurButtons();
    if (state.user) renderAll();
  }

  var state = {
    user: null,          // compte connecté
    data: null,          // { expenses: [], eurToCad: n }
    editingId: null,     // dépense en cours d'édition
    modalCurrency: "CAD",
    modalType: "expense",   // "expense" | "transfer"
    modalPayer: null,
    modalParts: [],
    modalBenef: null,       // bénéficiaire du remboursement
    modalDebts: {},         // dépenses cochées à rembourser {id: true}
    modalCat: "food",
    selectedLoginId: null
  };

  var cloud = null; // synchro Firestore (null = mode 100% local)

  /* ================= Utilitaires ================= */

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function uid() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function initials(name) {
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
  }

  function member(id) {
    for (var i = 0; i < CFG.accounts.length; i++) {
      if (CFG.accounts[i].id === id) return CFG.accounts[i];
    }
    return { id: id, name: "?", color: "#64748B" };
  }

  function category(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  function toCad(exp) {
    return exp.amount * rateOf(exp.currency);
  }

  function isTransfer(exp) {
    return exp.type === "transfer";
  }

  // vraies dépenses uniquement (les remboursements ne comptent pas dans les stats)
  function spentOnly() {
    return state.data.expenses.filter(function (e) { return !isTransfer(e); });
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- Confirmation stylée (remplace window.confirm) ---------- */
  var confirmResolve = null;

  function askConfirm(opts) {
    return new Promise(function (resolve) {
      $("#confirm-title").textContent = opts.title || "Confirmer ?";
      $("#confirm-message").textContent = opts.message || "";
      var ok = $("#confirm-ok");
      ok.textContent = opts.confirmLabel || "Confirmer";
      ok.className = opts.danger === false ? "btn-primary" : "btn-danger";
      document.querySelector("#confirm-modal .modal-confirm").classList.toggle("is-safe", opts.danger === false);
      $("#confirm-modal").hidden = false;
      document.body.style.overflow = "hidden";
      confirmResolve = resolve;
      setTimeout(function () { $("#confirm-cancel").focus(); }, 60);
    });
  }

  function closeConfirm(result) {
    if (!confirmResolve) return;
    $("#confirm-modal").hidden = true;
    // ne pas rendre le scroll si la modale de dépense est encore ouverte dessous
    document.body.style.overflow = $("#expense-modal").hidden && $("#plan-modal").hidden && $("#stop-modal").hidden ? "" : "hidden";
    var r = confirmResolve;
    confirmResolve = null;
    r(result);
  }

  function toast(msg, isError) {
    var box = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  function avatarDot(m, cls) {
    return '<span class="' + (cls || "avatar-dot") + '" style="background:' + m.color + '">' + esc(initials(m.name)) + "</span>";
  }

  /* ---------- Glisser-déposer (doigt ou souris) ----------
     On attrape la poignée (.drag-handle) d'une ligne `rowSel` de `list`, on lâche sur une autre :
     onDrop(from, to) reçoit les index de départ et d'arrivée parmi les lignes. */
  function dragSort(list, rowSel, onDrop) {
    list.addEventListener("pointerdown", function (e) {
      var h = e.target.closest(".drag-handle");
      var row = h && h.closest(rowSel);
      if (!row || !list.contains(row) || (e.pointerType === "mouse" && e.button !== 0)) return;
      var rows = Array.prototype.slice.call(list.querySelectorAll(rowSel));
      var from = rows.indexOf(row), to = from;
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      row.classList.add("dragging");

      function clearMarks() { rows.forEach(function (r) { r.classList.remove("drop-before", "drop-after"); }); }
      function move(ev) {
        to = 0;
        rows.forEach(function (r, i) { if (ev.clientY > r.getBoundingClientRect().top) to = i; });
        clearMarks();
        if (to !== from) rows[to].classList.add(to < from ? "drop-before" : "drop-after");
      }
      function end(ev) {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", end);
        h.removeEventListener("pointercancel", end);
        clearMarks();
        row.classList.remove("dragging");
        if (ev.type === "pointerup" && to !== from) onDrop(from, to);
      }
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
    });
    // un simple appui sur la poignée n'ouvre pas la ligne
    list.addEventListener("click", function (e) { if (e.target.closest(".drag-handle")) e.stopPropagation(); }, true);
  }

  /* ================= Stockage ================= */

  function loadData() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_DATA)); } catch (e) { /* corrompu */ }
    if (!raw || !Array.isArray(raw.expenses)) {
      raw = { expenses: [], eurToCad: CFG.eurToCadDefault };
    }
    if (typeof raw.eurToCad !== "number" || !(raw.eurToCad > 0)) raw.eurToCad = CFG.eurToCadDefault;
    if (typeof raw.usdToCad !== "number" || !(raw.usdToCad > 0)) raw.usdToCad = CFG.usdToCadDefault || 1.38;
    if (!Array.isArray(raw.movies)) raw.movies = [];
    if (!Array.isArray(raw.stops)) raw.stops = [];
    if (!Array.isArray(raw.trips)) raw.trips = [];
    if (!Array.isArray(raw.challenges)) raw.challenges = [];
    if (!raw.wheel || typeof raw.wheel !== "object") raw.wheel = {};
    if (!Array.isArray(raw.cities)) raw.cities = [];
    if (!Array.isArray(raw.hikes)) raw.hikes = [];
    if (!Array.isArray(raw.plans)) raw.plans = [];
    if (!Array.isArray(raw.shoplists)) raw.shoplists = [];
    if (!Array.isArray(raw.events)) raw.events = [];
    if (!raw.eventRanks || typeof raw.eventRanks !== "object") raw.eventRanks = {};
    state.data = raw;
  }

  function saveData() {
    localStorage.setItem(LS_DATA, JSON.stringify(state.data));
  }

  /* ================= Synchro (PocketBase, base locale) =================
     2 collections :
       - expenses : une dépense/remboursement par enregistrement (id = id app)
       - meta     : { kind: 'challenge'|'city'|'hike'|'wheel'|'setting', data }
     Temps réel via subscribe(); après chaque écriture on refetch + render. */

  function updateSyncBadge(ok) {
    var el = $("#sync-status");
    if (!el) return;
    el.classList.toggle("on", !!ok);
    el.textContent = ok
      ? "Synchro temps réel active : tout le crew voit les mêmes comptes."
      : "Base injoignable : vérifie que PocketBase tourne (voir README).";
  }

  function sortByCreated(a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); }

  function initCloud() {
    if (!CFG.pbUrl || typeof PocketBase === "undefined") return;
    var pb;
    try {
      pb = new PocketBase(CFG.pbUrl);
      pb.autoCancellation(false); // sinon les refetch rapprochés s'annulent
    } catch (e) { cloud = null; return; }

    cloud = { pb: pb, settingId: null };

    // --- lectures ---
    cloud.refetchExpenses = function () {
      return pb.collection("expenses").getFullList({ sort: "created" }).then(function (recs) {
        state.data.expenses = recs.map(function (r) {
          return {
            id: r.id, title: r.title, amount: r.amount, currency: r.currency,
            payerId: r.payerId, participants: r.participants || [], category: r.category,
            date: r.date, type: r.type || undefined, createdBy: r.createdBy, createdAt: r.createdAt
          };
        });
        saveData();
        updateSyncBadge(true);
        if (state.user) renderAll();
      }).catch(function () { updateSyncBadge(false); });
    };

    cloud.refetchMeta = function () {
      return pb.collection("meta").getFullList({ sort: "created" }).then(function (recs) {
        var chals = [], cities = [], hikes = [], movies = [], stops = [], trips = [], wheel = {}, plans = [], shops = [], events = [], ranks = {};
        recs.forEach(function (r) {
          var d = r.data || {};
          if (r.kind === "challenge") chals.push({ id: r.id, text: d.text, createdBy: d.createdBy, createdAt: d.createdAt });
          else if (r.kind === "plan") plans.push(planFields(d, r.id));
          else if (r.kind === "stop") stops.push(stopFields(d, r.id));
          else if (r.kind === "trip") trips.push({ id: r.id, name: d.name, createdBy: d.createdBy, createdAt: d.createdAt });
          else if (r.kind === "movie") movies.push({ id: r.id, name: d.name, addedBy: d.addedBy, createdAt: d.createdAt, seen: !!d.seen, ratings: d.ratings || {} });
          else if (r.kind === "event") events.push({ id: r.id, text: d.text, addedBy: d.addedBy, createdAt: d.createdAt });
          else if (r.kind === "eventrank" && d.user) ranks[d.user] = { id: r.id, order: d.order || [] };
          else if (r.kind === "shoplist") shops.push({ id: r.id, name: d.name, items: d.items || [], createdAt: d.createdAt, finishedAt: d.finishedAt || null });
          else if (r.kind === "city") cities.push({ id: r.id, name: d.name, addedBy: d.addedBy, createdAt: d.createdAt });
          else if (r.kind === "hike") hikes.push({ id: r.id, name: d.name, addedBy: d.addedBy, createdAt: d.createdAt });
          else if (r.kind === "wheel" && d.date) wheel[d.date] = d;
          else if (r.kind === "setting") {
            cloud.settingId = r.id;
            if (typeof d.eurToCad === "number" && d.eurToCad > 0) {
              state.data.eurToCad = d.eurToCad;
              var ri = $("#rate-input");
              if (ri) ri.value = d.eurToCad;
            }
            if (typeof d.usdToCad === "number" && d.usdToCad > 0) {
              state.data.usdToCad = d.usdToCad;
              var ru = $("#rate-usd-input");
              if (ru) ru.value = d.usdToCad;
            }
          }
        });
        chals.sort(sortByCreated); cities.sort(sortByCreated); hikes.sort(sortByCreated); movies.sort(sortByCreated);
        state.data.challenges = chals;
        state.data.cities = cities;
        state.data.hikes = hikes;
        state.data.movies = movies;
        state.data.events = events.sort(sortByCreated);
        state.data.eventRanks = ranks;
        state.data.stops = stops;
        state.data.trips = trips.sort(sortByCreated);
        state.data.wheel = wheel;
        state.data.plans = plans;
        state.data.shoplists = shops.sort(sortByCreated).reverse();
        saveData();
        if (state.user) renderAll();
      }).catch(function () { updateSyncBadge(false); });
    };

    // --- écritures ---
    function expenseFields(p) {
      return {
        title: p.title, amount: p.amount, currency: p.currency, payerId: p.payerId,
        participants: p.participants, category: p.category, date: p.date,
        type: p.type || "", createdBy: p.createdBy, createdAt: p.createdAt
      };
    }
    cloud.saveExpense = function (payload, editing) {
      var op = editing
        ? pb.collection("expenses").update(payload.id, expenseFields(payload))
        : pb.collection("expenses").create(expenseFields(payload));
      return op.then(cloud.refetchExpenses).catch(function () { toast("Enregistrement échoué", true); });
    };
    cloud.deleteExpense = function (id) {
      return pb.collection("expenses").delete(id).then(cloud.refetchExpenses).catch(function () { toast("Suppression échouée", true); });
    };
    cloud.clearExpenses = function () {
      return pb.collection("expenses").getFullList().then(function (recs) {
        return Promise.all(recs.map(function (r) { return pb.collection("expenses").delete(r.id); }));
      }).then(cloud.refetchExpenses).catch(function () { toast("Effacement échoué", true); });
    };

    cloud.addChallenge = function (c) {
      return pb.collection("meta").create({ kind: "challenge", data: { text: c.text, createdBy: c.createdBy, createdAt: c.createdAt } })
        .then(cloud.refetchMeta).catch(function () { toast("Ajout échoué", true); });
    };
    cloud.delMeta = function (id) {
      return pb.collection("meta").delete(id).then(cloud.refetchMeta).catch(function () { toast("Suppression échouée", true); });
    };
    cloud.setWheel = function (res) {
      return pb.collection("meta").create({ kind: "wheel", data: res })
        .then(cloud.refetchMeta).catch(function () { toast("Tirage non enregistré", true); });
    };
    cloud.addWish = function (kind, it) {
      var single = { cities: "city", hikes: "hike", movies: "movie" }[kind];
      var data = { name: it.name, addedBy: it.addedBy, createdAt: it.createdAt };
      if (kind === "movies") { data.seen = it.seen; data.ratings = it.ratings; }
      return pb.collection("meta").create({ kind: single, data: data })
        .then(cloud.refetchMeta).catch(function () { toast("Ajout échoué", true); });
    };
    // ponytail: notes de tous dans un seul enregistrement, deux notes à la même seconde => la dernière gagne
    cloud.saveMovie = function (m) {
      return pb.collection("meta").update(m.id, { data: { name: m.name, addedBy: m.addedBy, createdAt: m.createdAt, seen: !!m.seen, ratings: m.ratings || {} } })
        .then(cloud.refetchMeta).catch(function () { toast("Enregistrement échoué", true); });
    };
    cloud.addEvent = function (ev) {
      return pb.collection("meta").create({ kind: "event", data: { text: ev.text, addedBy: ev.addedBy, createdAt: ev.createdAt } })
        .then(cloud.refetchMeta).catch(function () { toast("Ajout échoué", true); });
    };
    // un enregistrement de classement par personne
    cloud.saveRank = function (user, order, id) {
      var data = { user: user, order: order };
      var op = id
        ? pb.collection("meta").update(id, { data: data })
        : pb.collection("meta").create({ kind: "eventrank", data: data });
      return op.then(cloud.refetchMeta).catch(function () { toast("Classement non enregistré", true); });
    };
    cloud.setRate = function () {
      var data = { eurToCad: state.data.eurToCad, usdToCad: state.data.usdToCad };
      var op = cloud.settingId
        ? pb.collection("meta").update(cloud.settingId, { data: data })
        : pb.collection("meta").create({ kind: "setting", data: data });
      return op.then(cloud.refetchMeta).catch(function () {});
    };
    cloud.savePlan = function (p, editing) {
      var data = planFields(p);
      delete data.id;
      var op = editing
        ? pb.collection("meta").update(p.id, { data: data })
        : pb.collection("meta").create({ kind: "plan", data: data });
      return op.then(cloud.refetchMeta).catch(function () { toast("Enregistrement échoué", true); });
    };
    cloud.saveStop = function (s, editing) {
      var data = stopFields(s);
      delete data.id;
      var op = editing
        ? pb.collection("meta").update(s.id, { data: data })
        : pb.collection("meta").create({ kind: "stop", data: data });
      return op.then(cloud.refetchMeta).catch(function () { toast("Enregistrement échoué", true); });
    };
    // renvoie l'id du trajet créé (pour l'afficher tout de suite)
    cloud.addTrip = function (t) {
      return pb.collection("meta").create({ kind: "trip", data: { name: t.name, createdBy: t.createdBy, createdAt: t.createdAt } })
        .then(function (rec) { return cloud.refetchMeta().then(function () { return rec.id; }); })
        .catch(function () { toast("Création échouée", true); return null; });
    };
    // supprime plusieurs enregistrements meta d'un coup (trajet + ses étapes)
    cloud.delMetas = function (ids) {
      return Promise.all(ids.map(function (id) { return pb.collection("meta").delete(id); }))
        .then(cloud.refetchMeta).catch(function () { toast("Suppression échouée", true); cloud.refetchMeta(); });
    };

    // ponytail: liste entière dans un seul enregistrement, deux modifs à la même seconde => la dernière gagne
    cloud.saveShop = function (l, isNew) {
      var data = { name: l.name, items: l.items, createdAt: l.createdAt, finishedAt: l.finishedAt || null };
      var op = isNew
        ? pb.collection("meta").create({ kind: "shoplist", data: data })
        : pb.collection("meta").update(l.id, { data: data });
      return op.then(function (rec) { if (isNew) shopId = rec.id; return cloud.refetchMeta(); })
        .catch(function () { toast("Enregistrement échoué", true); });
    };

    // --- temps réel ---
    pb.collection("expenses").subscribe("*", function () { cloud.refetchExpenses(); });
    pb.collection("meta").subscribe("*", function () { cloud.refetchMeta(); });

    // --- premier chargement ---
    cloud.refetchExpenses();
    cloud.refetchMeta();
  }

  /* ================= Auth / session ================= */

  function setCookie(value) {
    document.cookie = COOKIE_NAME + "=" + encodeURIComponent(value) +
      "; max-age=" + COOKIE_MAX_AGE + "; path=/; SameSite=Lax";
  }

  function getCookie() {
    var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function clearCookie() {
    document.cookie = COOKIE_NAME + "=; max-age=0; path=/";
  }

  function currentSessionUser() {
    var id = localStorage.getItem(LS_SESSION) || getCookie();
    if (!id) return null;
    var m = member(id);
    return m.name !== "?" ? m : null;
  }

  function login(account) {
    state.user = account;
    localStorage.setItem(LS_SESSION, account.id);
    setCookie(account.id); // cookie longue durée : connecté une fois, connecté pour de bon
    showApp();
  }

  function logout() {
    localStorage.removeItem(LS_SESSION);
    clearCookie();
    state.user = null;
    location.reload();
  }

  /* ================= Écran de login ================= */

  function buildLogin() {
    $("#trip-tagline").textContent = CFG.tagline;

    var grid = $("#avatar-grid");
    grid.innerHTML = "";
    CFG.accounts.forEach(function (acc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "avatar-btn";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.style.setProperty("--av-color", acc.color);
      b.innerHTML = '<span class="avatar-dot" style="background:' + acc.color + '">' + esc(initials(acc.name)) + "</span><span>" + esc(acc.name) + "</span>";
      b.addEventListener("click", function () {
        state.selectedLoginId = acc.id;
        $all(".avatar-btn").forEach(function (x) {
          x.classList.remove("selected");
          x.setAttribute("aria-checked", "false");
        });
        b.classList.add("selected");
        b.setAttribute("aria-checked", "true");
        $("#login-error").hidden = true;
        $("#login-password").focus();
      });
      grid.appendChild(b);
    });

    $("#toggle-pass").addEventListener("click", function () {
      var inp = $("#login-password");
      inp.type = inp.type === "password" ? "text" : "password";
    });

    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#login-error");
      if (!state.selectedLoginId) {
        err.textContent = "Choisis d'abord ton avatar !";
        err.hidden = false;
        return;
      }
      var acc = member(state.selectedLoginId);
      var pass = $("#login-password").value;
      if (pass !== acc.password) {
        err.textContent = "Mauvais mot de passe. Demande au groupe !";
        err.hidden = false;
        return;
      }
      err.hidden = true;
      login(acc);
      toast("Bienvenue à bord, " + acc.name + " !");
    });

    // Animations d'entrée
    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.to(".reveal", { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", delay: 0.15 });

      // Tilt 3D de la carte de login
      var card = $(".login-card");
      var rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
      var ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
      gsap.set(card, { transformPerspective: 900 });
      window.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        ry(Math.max(-1, Math.min(1, (e.clientX - cx) / 500)) * 4);
        rx(Math.max(-1, Math.min(1, (e.clientY - cy) / 500)) * -4);
      }, { passive: true });
    } else {
      $all(".reveal").forEach(function (el) { el.classList.add("shown"); });
    }
  }

  /* ================= Calculs ================= */

  // Soldes : positif = doit recevoir, négatif = doit rembourser
  function computeBalances() {
    var map = {};
    CFG.accounts.forEach(function (a) { map[a.id] = { paid: 0, share: 0 }; });

    state.data.expenses.forEach(function (exp) {
      var cad = toCad(exp);
      if (map[exp.payerId]) map[exp.payerId].paid += cad;
      var parts = exp.participants.filter(function (p) { return map[p]; });
      if (!parts.length) return;
      var each = cad / parts.length;
      parts.forEach(function (p) { map[p].share += each; });
    });

    return CFG.accounts.map(function (a) {
      var e = map[a.id];
      return { id: a.id, paid: e.paid, share: e.share, balance: e.paid - e.share };
    });
  }

  // Minimum de virements pour tout équilibrer (algorithme glouton)
  function computeSettlements(balances) {
    var debtors = [], creditors = [];
    balances.forEach(function (b) {
      if (b.balance < -0.005) debtors.push({ id: b.id, amt: -b.balance });
      else if (b.balance > 0.005) creditors.push({ id: b.id, amt: b.balance });
    });
    debtors.sort(function (a, b) { return b.amt - a.amt; });
    creditors.sort(function (a, b) { return b.amt - a.amt; });

    var out = [], i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      var x = Math.min(debtors[i].amt, creditors[j].amt);
      out.push({ from: debtors[i].id, to: creditors[j].id, amount: x });
      debtors[i].amt -= x;
      creditors[j].amt -= x;
      if (debtors[i].amt < 0.005) i++;
      if (creditors[j].amt < 0.005) j++;
    }
    return out;
  }

  /* ================= Rendus ================= */

  function renderAll() {
    renderStats();
    renderBalanceBars();
    renderCategoryBars();
    renderRecent();
    renderExpenseGroups();
    renderEquilibre();
    renderStatsTab();
    renderDefis();
    renderAgency();
    renderPlanning();
    renderShop();
    renderEvents();
  }

  function renderStats() {
    var spent = spentOnly();
    var total = spent.reduce(function (s, e) { return s + toCad(e); }, 0);
    $("#stat-total").textContent = M(total);
    $("#stat-total-eur").textContent = "≈ " + MOther(total);
    $("#stat-count").textContent = String(spent.length);

    var balances = computeBalances();
    var mine = balances.filter(function (b) { return b.id === state.user.id; })[0];
    var el = $("#stat-balance");
    var hint = $("#stat-balance-hint");
    el.classList.remove("pos", "neg");
    if (!mine || Math.abs(mine.balance) < 0.005) {
      el.textContent = M(0);
      hint.textContent = "Tu es à jour";
    } else if (mine.balance > 0) {
      el.textContent = "+" + M(mine.balance);
      el.classList.add("pos");
      hint.textContent = "On te doit de l'argent";
    } else {
      el.textContent = M(mine.balance);
      el.classList.add("neg");
      hint.textContent = "Tu dois rembourser";
    }

    // Compte à rebours
    var days = $("#stat-days");
    if (CFG.startDate) {
      var diff = Math.ceil((new Date(CFG.startDate + "T00:00:00") - new Date()) / 86400000);
      days.textContent = diff > 0 ? "Départ dans J-" + diff : "Vous y êtes !";
    } else {
      days.textContent = "";
    }
  }

  function renderBalanceBars() {
    var box = $("#balance-bars");
    var balances = computeBalances();
    var max = Math.max.apply(null, balances.map(function (b) { return Math.abs(b.balance); }).concat([1]));

    box.innerHTML = balances.map(function (b) {
      var m = member(b.id);
      var pct = Math.min(Math.abs(b.balance) / max * 50, 50);
      var cls = Math.abs(b.balance) < 0.005 ? "zero" : (b.balance > 0 ? "pos" : "neg");
      var fill = "";
      if (cls === "pos") fill = '<span class="bbar-fill pos" style="left:50%;width:' + pct + '%"></span>';
      else if (cls === "neg") fill = '<span class="bbar-fill neg" style="left:' + (50 - pct) + '%;width:' + pct + '%"></span>';
      var amount = (b.balance > 0.005 ? "+" : "") + M(b.balance);
      return '<div class="bbar">' + avatarDot(m) +
        '<span class="bbar-track">' + fill + "</span>" +
        '<span class="bbar-amount ' + cls + '">' + amount + "</span></div>";
    }).join("");
  }

  function renderCategoryBars() {
    var box = $("#category-bars");
    var totals = {};
    spentOnly().forEach(function (e) {
      totals[e.category] = (totals[e.category] || 0) + toCad(e);
    });
    var entries = Object.keys(totals).map(function (k) { return { cat: category(k), total: totals[k] }; });
    entries.sort(function (a, b) { return b.total - a.total; });

    if (!entries.length) {
      box.innerHTML = '<p class="empty-state">Aucune dépense pour l\'instant.</p>';
      return;
    }
    var max = entries[0].total;
    box.innerHTML = entries.map(function (e) {
      var color = CAT_COLORS[e.cat.id] || "#94A3B8";
      return '<div class="cbar">' + e.cat.icon +
        '<span class="cbar-name">' + esc(e.cat.name) + "</span>" +
        '<span class="cbar-amount">' + M(e.total) + "</span>" +
        '<span class="cbar-track"><span class="cbar-fill" style="width:' + (e.total / max * 100) + '%;background:' + color + '"></span></span>' +
        "</div>";
    }).join("");
  }

  /* ================= Onglet Stats ================= */

  function categoryTotals() {
    var totals = {};
    spentOnly().forEach(function (e) {
      totals[e.category] = (totals[e.category] || 0) + toCad(e);
    });
    return Object.keys(totals)
      .map(function (k) { return { cat: category(k), total: totals[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function arcPath(cx, cy, r, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M " + (cx + r * Math.cos(a0)).toFixed(2) + " " + (cy + r * Math.sin(a0)).toFixed(2) +
      " A " + r + " " + r + " 0 " + large + " 1 " +
      (cx + r * Math.cos(a1)).toFixed(2) + " " + (cy + r * Math.sin(a1)).toFixed(2);
  }

  function renderStatsTab() {
    var expenses = spentOnly(); // les remboursements ne sont pas de l'argent perdu
    var total = expenses.reduce(function (s, e) { return s + toCad(e); }, 0);
    var perHead = total / CFG.accounts.length;

    // --- Héro ---
    $("#stats-hero-total").textContent = M(total);
    $("#stats-hero-foot").textContent = expenses.length
      ? "≈ " + MOther(total) + " · soit " + M(perHead) + " par tête. Ces dollars sont partis vivre leur vie."
      : "Rien de perdu pour l'instant. Ça viendra.";

    // Remboursements affichés à part : ils circulent entre vous, ce n'est pas de l'argent dépensé
    var rembTotal = state.data.expenses
      .filter(isTransfer)
      .reduce(function (s, e) { return s + toCad(e); }, 0);
    var rembEl = $("#stats-remb");
    rembEl.hidden = rembTotal < 0.005;
    rembEl.textContent = "Remboursements entre vous : " + M(rembTotal) + " — non comptés (argent qui circule, pas dépensé).";

    // --- Donut par catégorie ---
    var donut = $("#stats-donut");
    var legend = $("#stats-legend");
    var entries = categoryTotals();
    if (!entries.length) {
      donut.innerHTML = "";
      legend.innerHTML = '<li class="empty-state" style="padding:10px 0">Ajoute des dépenses pour voir où part l\'argent.</li>';
    } else {
      var cx = 90, cy = 90, r = 68, gapA = 0.04;
      var svg = "";
      if (entries.length === 1) {
        var only = entries[0];
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (CAT_COLORS[only.cat.id] || "#94A3B8") + '" stroke-width="24"><title>' + esc(only.cat.name) + " — " + M(only.total) + " (100%)</title></circle>";
      } else {
        var angle = -Math.PI / 2;
        entries.forEach(function (e) {
          var frac = e.total / total;
          var span = frac * Math.PI * 2;
          var a0 = angle + gapA / 2;
          var a1 = angle + span - gapA / 2;
          if (a1 <= a0) a1 = a0 + 0.01;
          var color = CAT_COLORS[e.cat.id] || "#94A3B8";
          svg += '<path d="' + arcPath(cx, cy, r, a0, a1) + '" fill="none" stroke="' + color + '" stroke-width="24" stroke-linecap="butt"><title>' +
            esc(e.cat.name) + " — " + M(e.total) + " (" + Math.round(frac * 100) + "%)</title></path>";
          angle += span;
        });
      }
      svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut-center-value">' + esc(M0(total)) + "</text>";
      svg += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="donut-center-label">envolés</text>';
      donut.innerHTML = svg;

      legend.innerHTML = entries.map(function (e) {
        var color = CAT_COLORS[e.cat.id] || "#94A3B8";
        return '<li><span class="swatch" style="background:' + color + '"></span>' +
          "<span>" + esc(e.cat.name) + "</span>" +
          '<span class="pct">' + Math.round(e.total / total * 100) + "%</span>" +
          '<span class="amt">' + M(e.total) + "</span></li>";
      }).join("");
    }

    // --- Courbe cumulée ---
    var tl = $("#stats-timeline");
    if (!expenses.length) {
      tl.innerHTML = "";
      $("#tl-start").textContent = "";
      $("#tl-end").textContent = "";
    } else {
      var byDay = {};
      expenses.forEach(function (e) { byDay[e.date] = (byDay[e.date] || 0) + toCad(e); });
      var days = Object.keys(byDay).sort();
      var cum = 0;
      var points = days.map(function (d) { cum += byDay[d]; return { date: d, value: cum }; });
      if (points.length === 1) points.unshift({ date: points[0].date, value: 0 });

      var W = 320, H = 160, padT = 16, padB = 10, padX = 6;
      var maxV = points[points.length - 1].value;
      function px(i) { return padX + i / (points.length - 1) * (W - padX * 2); }
      function py(v) { return padT + (1 - v / maxV) * (H - padT - padB); }

      var line = points.map(function (p, i) { return (i ? "L " : "M ") + px(i).toFixed(1) + " " + py(p.value).toFixed(1); }).join(" ");
      var area = line + " L " + px(points.length - 1).toFixed(1) + " " + (H - padB) + " L " + px(0).toFixed(1) + " " + (H - padB) + " Z";

      var grid = "";
      [0.25, 0.5, 0.75].forEach(function (f) {
        var y = (padT + (1 - f) * (H - padT - padB)).toFixed(1);
        grid += '<line x1="' + padX + '" y1="' + y + '" x2="' + (W - padX) + '" y2="' + y + '" stroke="rgba(148,163,184,0.12)" stroke-width="1"/>';
      });

      var dots = points.map(function (p, i) {
        var fmtDay = new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.value).toFixed(1) + '" r="3.4" fill="#F59E0B" stroke="#0B1120" stroke-width="1.5"><title>' +
          fmtDay + " — " + M(p.value) + " au total</title></circle>";
      }).join("");

      tl.innerHTML =
        '<defs><linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/></linearGradient></defs>' +
        grid +
        '<path d="' + area + '" fill="url(#tl-grad)"/>' +
        '<path d="' + line + '" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots +
        '<text x="' + padX + '" y="11" fill="#94A3B8" font-size="10" font-weight="600">' + esc(M0(maxV)) + "</text>";

      var optsDate = { day: "numeric", month: "short" };
      $("#tl-start").textContent = new Date(days[0] + "T00:00:00").toLocaleDateString("fr-FR", optsDate);
      $("#tl-end").textContent = days.length > 1 ? new Date(days[days.length - 1] + "T00:00:00").toLocaleDateString("fr-FR", optsDate) : "";
    }

    // --- Podium des flambeurs ---
    var paid = {};
    CFG.accounts.forEach(function (a) { paid[a.id] = 0; });
    expenses.forEach(function (e) { if (paid[e.payerId] !== undefined) paid[e.payerId] += toCad(e); });
    var ranking = CFG.accounts
      .map(function (a) { return { m: a, paid: paid[a.id] }; })
      .sort(function (a, b) { return b.paid - a.paid; });
    var maxPaid = Math.max(ranking[0].paid, 1);
    $("#stats-podium").innerHTML = ranking.map(function (r, i) {
      return '<div class="podium-row"><span class="podium-rank">' + (i + 1) + "</span>" +
        avatarDot(r.m) +
        '<span class="podium-track"><span class="podium-fill" style="width:' + (r.paid / maxPaid * 100) + "%;background:" + r.m.color + '"></span></span>' +
        '<span class="podium-amt">' + M(r.paid) + "</span></div>";
    }).join("");

    // --- Records ---
    var records = $("#stats-records");
    if (!expenses.length) {
      records.innerHTML = "";
      return;
    }
    var biggest = expenses.reduce(function (a, b) { return toCad(b) > toCad(a) ? b : a; });
    var byDay2 = {};
    expenses.forEach(function (e) { byDay2[e.date] = (byDay2[e.date] || 0) + toCad(e); });
    var worstDay = Object.keys(byDay2).reduce(function (a, b) { return byDay2[b] > byDay2[a] ? b : a; });
    var topPayer = ranking[0];
    var nbDays = Object.keys(byDay2).length;

    function recordCard(color, icon, label, value, sub) {
      return '<div class="record-card"><span class="record-icon" style="background:' + color + '22;color:' + color + '">' + icon + "</span>" +
        '<div><p class="stat-label">' + label + '</p><p class="record-value">' + value + '</p><p class="record-sub">' + sub + "</p></div></div>";
    }
    var icoBolt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
    var icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
    var icoCrown = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 8 4 10h12L22 8l-5 4-5-7-5 7-5-4Z"/></svg>';
    var icoAvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v2"/><path d="M12 16v2"/></svg>';

    var worstDayLabel = new Date(worstDay + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    records.innerHTML =
      recordCard("#FB7185", icoBolt, "Plus grosse dépense", esc(M(toCad(biggest))), esc(biggest.title) + " · payé par " + esc(member(biggest.payerId).name)) +
      recordCard("#38BDF8", icoCal, "Journée la plus chère", esc(M(byDay2[worstDay])), esc(worstDayLabel)) +
      recordCard("#F59E0B", icoCrown, "Flambeur n°1", esc(topPayer.m.name), "a avancé " + esc(M(topPayer.paid))) +
      recordCard("#34D399", icoAvg, "Rythme de perte", esc(M(total / nbDays)) + " / jour", "sur " + nbDays + " jour" + (nbDays > 1 ? "s" : "") + " de dépenses");
  }

  var TRANSFER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>';

  function expenseRow(exp) {
    var m = member(exp.payerId);
    var cad = toCad(exp);
    // note secondaire : montant réellement saisi (dans sa devise d'origine)
    var origFmt = FMT[validCur(exp.currency)][0].format(exp.amount);
    var eurNote = origFmt + " saisi";

    var icon, meta;
    if (isTransfer(exp)) {
      var benef = member(exp.participants[0]);
      icon = '<span class="exp-icon transfer">' + TRANSFER_ICON + "</span>";
      meta = avatarDot(m, "mini-dot") + " " + esc(m.name) + " a remboursé " + esc(benef.name);
    } else {
      var cat = category(exp.category);
      icon = '<span class="exp-icon">' + cat.icon + "</span>";
      var nParts = exp.participants.length;
      meta = avatarDot(m, "mini-dot") + " " + esc(m.name) + " a payé · pour " + nParts + (nParts > 1 ? " personnes" : " personne");
    }
    return '<li class="expense-item" data-id="' + exp.id + '" tabindex="0" role="button" aria-label="Modifier ' + esc(exp.title) + '">' +
      icon +
      '<span class="exp-main"><p class="exp-title">' + esc(exp.title) + "</p>" +
      '<p class="exp-meta">' + meta + "</p></span>" +
      '<span class="exp-amount"><span class="cad">' + M(cad) + '</span><span class="eur">' + eurNote + "</span></span></li>";
  }

  function renderRecent() {
    var list = $("#recent-list");
    var sorted = spentOnly().sort(function (a, b) {
      return (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || ""));
    });
    if (!sorted.length) {
      list.innerHTML = '<li class="empty-state"><strong>Rien pour l\'instant</strong>Ajoute la première dépense du voyage !</li>';
      return;
    }
    list.innerHTML = sorted.slice(0, 5).map(expenseRow).join("");
  }

  // filtre de l'onglet Dépenses : "all", "transfer" ou un id de catégorie
  var expFilter = "all";

  function matchesFilter(e) {
    if (expFilter === "all") return true;
    if (expFilter === "transfer") return isTransfer(e);
    return !isTransfer(e) && category(e.category).id === expFilter;
  }

  function renderExpenseFilter() {
    var box = $("#exp-filter");
    var opts = [{ id: "all", name: "Tout", icon: "" }].concat(CATEGORIES, [{ id: "transfer", name: "Remboursements", icon: TRANSFER_ICON }]);
    box.innerHTML = opts.map(function (o) {
      return '<button type="button" class="filter-chip' + (o.id === expFilter ? " active" : "") + '" data-filter="' + o.id + '">' +
        o.icon + "<span>" + esc(o.name) + "</span></button>";
    }).join("");
  }

  function renderExpenseGroups() {
    var box = $("#expense-groups");
    renderExpenseFilter();
    var sorted = state.data.expenses.filter(matchesFilter).sort(function (a, b) {
      return (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || ""));
    });
    var sum = $("#exp-filter-sum");
    sum.hidden = expFilter === "all" || !sorted.length;
    sum.textContent = sorted.length + " ligne" + (sorted.length > 1 ? "s" : "") + " · " + M(sorted.reduce(function (s, e) { return s + toCad(e); }, 0));
    if (!sorted.length) {
      box.innerHTML = expFilter === "all"
        ? '<div class="card"><p class="empty-state"><strong>Aucune dépense</strong>Clique sur « Ajouter » pour lancer les comptes.</p></div>'
        : '<div class="card"><p class="empty-state">Rien dans cette catégorie.</p></div>';
      return;
    }
    var groups = {};
    var order = [];
    sorted.forEach(function (e) {
      if (!groups[e.date]) { groups[e.date] = []; order.push(e.date); }
      groups[e.date].push(e);
    });
    box.innerHTML = order.map(function (date) {
      var d = new Date(date + "T00:00:00");
      var label = isNaN(d) ? date : fmtDate.format(d);
      return '<div class="date-group"><p class="date-label">' + esc(label) + '</p><div class="card" style="padding:8px 12px"><ul class="expense-list">' +
        groups[date].map(expenseRow).join("") + "</ul></div></div>";
    }).join("");
  }

  function renderEquilibre() {
    var balances = computeBalances();
    var cards = $("#balance-cards");
    cards.innerHTML = balances.map(function (b) {
      var m = member(b.id);
      var cls = Math.abs(b.balance) < 0.005 ? "zero" : (b.balance > 0 ? "pos" : "neg");
      var val = (b.balance > 0.005 ? "+" : "") + M(b.balance);
      return '<div class="balance-card">' + avatarDot(m) +
        '<div><p class="who">' + esc(m.name) + '</p><p class="how ' + cls + '">' + val + "</p>" +
        '<p class="sub">a payé ' + M(b.paid) + "</p></div></div>";
    }).join("");

    var list = $("#settlement-list");
    var settlements = computeSettlements(balances);
    if (!settlements.length) {
      list.innerHTML = '<li class="empty-state"><strong>Tout le monde est à jour</strong>Aucun remboursement nécessaire. Beau travail d\'équipe.</li>';
      return;
    }
    var arrow = '<span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>';
    list.innerHTML = settlements.map(function (s) {
      var from = member(s.from), to = member(s.to);
      var amt = Math.round(s.amount * 100) / 100;
      return '<li class="settlement-item">' + avatarDot(from) + "<span>" + esc(from.name) + "</span>" +
        arrow + avatarDot(to) + "<span>" + esc(to.name) + "</span>" +
        '<span class="amount">' + M(amt) + "</span>" +
        '<button type="button" class="btn-ghost btn-xs settle-btn" data-from="' + from.id + '" data-to="' + to.id + '" data-amount="' + amt + '">Marquer payé</button></li>';
    }).join("");
  }

  /* ================= Modale dépense ================= */

  function buildModalChoices() {
    var payerBox = $("#exp-payer");
    var partBox = $("#exp-participants");
    var benefBox = $("#exp-beneficiary");
    payerBox.innerHTML = "";
    partBox.innerHTML = "";
    benefBox.innerHTML = "";

    CFG.accounts.forEach(function (acc) {
      var pb = document.createElement("button");
      pb.type = "button";
      pb.className = "chip-btn";
      pb.dataset.id = acc.id;
      pb.style.setProperty("--av-color", acc.color);
      pb.innerHTML = '<span class="mini-dot" style="background:' + acc.color + '">' + esc(initials(acc.name)) + "</span>" + esc(acc.name);
      pb.addEventListener("click", function () {
        state.modalPayer = acc.id;
        state.modalDebts = {};
        syncModalChoices();
      });
      payerBox.appendChild(pb);

      var cb = pb.cloneNode(true);
      cb.addEventListener("click", function () {
        var idx = state.modalParts.indexOf(acc.id);
        if (idx >= 0) state.modalParts.splice(idx, 1);
        else state.modalParts.push(acc.id);
        syncModalChoices();
      });
      partBox.appendChild(cb);

      var bb = pb.cloneNode(true);
      bb.addEventListener("click", function () {
        state.modalBenef = acc.id;
        state.modalDebts = {};
        syncModalChoices();
      });
      benefBox.appendChild(bb);
    });

    $all("#exp-type .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.modalType = b.dataset.type;
        $("#modal-title").textContent = modalTitleText();
        syncModalChoices();
      });
    });

    var catBox = $("#exp-category");
    catBox.innerHTML = "";
    CATEGORIES.forEach(function (cat) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-btn";
      b.dataset.id = cat.id;
      b.innerHTML = cat.icon + "<span>" + esc(cat.name) + "</span>";
      b.addEventListener("click", function () {
        state.modalCat = cat.id;
        syncModalChoices();
      });
      catBox.appendChild(b);
    });

    $all("#exp-currency .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.modalCurrency = b.dataset.cur;
        syncModalChoices();
      });
    });
  }

  function modalTitleText() {
    if (state.modalType === "transfer") {
      return state.editingId ? "Modifier le remboursement" : "Nouveau remboursement";
    }
    return state.editingId ? "Modifier la dépense" : "Nouvelle dépense";
  }

  function syncModalChoices() {
    var tr = state.modalType === "transfer";

    $all("#exp-type .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.type === state.modalType);
    });
    $("#field-participants").hidden = tr;
    $("#field-category").hidden = tr;
    $("#field-beneficiary").hidden = !tr;
    $("#exp-payer-label").textContent = tr ? "Qui rembourse" : "Payé par";
    $("#exp-title").placeholder = tr ? "Remboursement (facultatif)" : "Poutine chez Ashton";
    $("#exp-title").required = !tr;

    $all("#exp-payer .chip-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.id === state.modalPayer);
    });
    $all("#exp-participants .chip-btn").forEach(function (b) {
      b.classList.toggle("selected", state.modalParts.indexOf(b.dataset.id) >= 0);
    });
    $all("#exp-beneficiary .chip-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.id === state.modalBenef);
    });
    $all("#exp-category .cat-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.id === state.modalCat);
    });
    $all("#exp-currency .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.cur === state.modalCurrency);
    });

    $("#field-debts").hidden = !tr;
    if (tr) renderDebtChoices();
  }

  // Dépenses que "qui rembourse" doit au bénéficiaire (bénéficiaire a payé, payeur concerné)
  function debtCandidates() {
    var payer = state.modalPayer, benef = state.modalBenef;
    if (!payer || !benef || payer === benef) return [];
    return state.data.expenses.filter(function (e) {
      return !isTransfer(e) && e.payerId === benef &&
        e.participants.indexOf(payer) >= 0;
    }).map(function (e) {
      var parts = e.participants.filter(function (p) { return member(p).name !== "?"; });
      return { exp: e, share: parts.length ? toCad(e) / parts.length : 0 };
    }).sort(function (a, b) { return (b.exp.date || "").localeCompare(a.exp.date || ""); });
  }

  function renderDebtChoices() {
    var box = $("#exp-debts");
    var hint = $("#debt-hint");
    var cands = debtCandidates();

    if (!state.modalPayer || !state.modalBenef) {
      box.innerHTML = '<p class="debt-empty">Choisis qui rembourse et à qui pour voir les dépenses concernées.</p>';
      hint.textContent = "";
      return;
    }
    if (state.modalPayer === state.modalBenef) {
      box.innerHTML = '<p class="debt-empty">On ne se rembourse pas soi-même.</p>';
      hint.textContent = "";
      return;
    }
    if (!cands.length) {
      box.innerHTML = '<p class="debt-empty">Aucune dépense de ' + esc(member(state.modalBenef).name) + ' ne te concerne. Saisis le montant à la main.</p>';
      hint.textContent = "";
      return;
    }

    var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    box.innerHTML = cands.map(function (c) {
      var e = c.exp;
      var sel = state.modalDebts[e.id] ? " selected" : "";
      var d = new Date(e.date + "T00:00:00");
      var dl = isNaN(d) ? e.date : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return '<div class="debt-item' + sel + '" data-id="' + e.id + '">' +
        '<span class="debt-check">' + check + "</span>" +
        '<span class="debt-main"><p class="debt-title">' + esc(e.title) + "</p>" +
        '<p class="debt-sub">' + esc(dl) + " · " + M(toCad(e)) + " ÷ " + e.participants.length + "</p></span>" +
        '<span class="debt-share">' + M(c.share) + "</span></div>";
    }).join("");

    box.querySelectorAll(".debt-item").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.dataset.id;
        if (state.modalDebts[id]) delete state.modalDebts[id];
        else state.modalDebts[id] = true;
        applyDebtTotal();
        renderDebtChoices();
      });
    });

    applyDebtTotal(cands);
  }

  // Somme des parts cochées → remplit le montant (en CAD)
  function applyDebtTotal(cands) {
    cands = cands || debtCandidates();
    var totalCad = 0, n = 0;
    cands.forEach(function (c) {
      if (state.modalDebts[c.exp.id]) { totalCad += c.share; n++; }
    });
    var hint = $("#debt-hint");
    if (n > 0) {
      state.modalCurrency = "CAD";
      $("#exp-amount").value = (Math.round(totalCad * 100) / 100);
      $all("#exp-currency .seg-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.cur === "CAD");
      });
      hint.textContent = n + " dépense(s) · total " + fmtCAD.format(totalCad)
        + (displayCur !== "CAD" ? " (" + M(totalCad) + ")" : "");
    } else {
      hint.textContent = "Coche des dépenses pour calculer le montant, ou saisis-le à la main.";
    }
  }

  function openModal(expense) {
    state.editingId = expense ? expense.id : null;
    state.modalType = expense && isTransfer(expense) ? "transfer" : "expense";
    $("#modal-title").textContent = modalTitleText();
    $("#exp-delete").hidden = !expense;
    $("#exp-error").hidden = true;

    $("#exp-title").value = expense ? expense.title : "";
    $("#exp-amount").value = expense ? expense.amount : "";
    $("#exp-date").value = expense ? expense.date : todayISO();
    state.modalCurrency = expense ? expense.currency : "CAD";
    state.modalPayer = expense ? expense.payerId : state.user.id;
    state.modalParts = expense && !isTransfer(expense) ? expense.participants.slice() : CFG.accounts.map(function (a) { return a.id; });
    state.modalBenef = expense && isTransfer(expense) ? expense.participants[0] : null;
    state.modalDebts = {};
    state.modalCat = expense && !isTransfer(expense) ? expense.category : "food";
    syncModalChoices();

    $("#expense-modal").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { $("#exp-title").focus(); }, 60);
  }

  function closeModal() {
    $("#expense-modal").hidden = true;
    document.body.style.overflow = "";
    state.editingId = null;
  }

  function submitExpense(e) {
    e.preventDefault();
    var err = $("#exp-error");
    var isTr = state.modalType === "transfer";
    var title = $("#exp-title").value.trim();
    var amount = parseFloat($("#exp-amount").value);
    var date = $("#exp-date").value;

    if (!isTr && !title) { err.textContent = "Donne un titre à la dépense."; err.hidden = false; return; }
    if (!(amount > 0)) { err.textContent = "Le montant doit être supérieur à 0."; err.hidden = false; return; }
    if (!state.modalPayer) { err.textContent = isTr ? "Choisis qui rembourse." : "Choisis qui a payé."; err.hidden = false; return; }
    if (!isTr && !state.modalParts.length) { err.textContent = "Sélectionne au moins un participant."; err.hidden = false; return; }
    if (isTr && !state.modalBenef) { err.textContent = "Choisis qui reçoit l'argent."; err.hidden = false; return; }
    if (isTr && state.modalBenef === state.modalPayer) { err.textContent = "On ne se rembourse pas soi-même !"; err.hidden = false; return; }
    if (!date) { err.textContent = "Choisis une date."; err.hidden = false; return; }
    err.hidden = true;

    var editing = !!state.editingId;
    var existing = editing
      ? state.data.expenses.filter(function (x) { return x.id === state.editingId; })[0]
      : null;
    var payload = {
      id: editing ? state.editingId : uid(),
      title: isTr ? (title || "Remboursement") : title,
      amount: Math.round(amount * 100) / 100,
      currency: state.modalCurrency,
      payerId: state.modalPayer,
      participants: isTr ? [state.modalBenef] : state.modalParts.slice(),
      category: isTr ? "other" : state.modalCat,
      date: date,
      createdBy: existing ? existing.createdBy : state.user.id,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };
    if (isTr) payload.type = "transfer";

    if (cloud) {
      cloud.saveExpense(payload, editing); // le refetch met l'UI à jour
    } else {
      if (editing) {
        state.data.expenses = state.data.expenses.map(function (x) { return x.id === payload.id ? payload : x; });
      } else {
        state.data.expenses.push(payload);
      }
      saveData();
      renderAll();
    }
    toast(isTr
      ? (editing ? "Remboursement modifié" : "Remboursement enregistré")
      : (editing ? "Dépense modifiée" : "Dépense ajoutée"));
    closeModal();
  }

  function deleteExpense() {
    if (!state.editingId) return;
    var id = state.editingId;
    askConfirm({
      title: "Supprimer la dépense ?",
      message: cloud
        ? "Elle disparaîtra pour tout le monde. C'est définitif."
        : "Elle sera supprimée de cet appareil. C'est définitif.",
      confirmLabel: "Supprimer"
    }).then(function (yes) {
      if (!yes) return;
      if (cloud) {
        cloud.deleteExpense(id);
      } else {
        state.data.expenses = state.data.expenses.filter(function (x) { return x.id !== id; });
        saveData();
        renderAll();
      }
      closeModal();
      toast("Dépense supprimée");
    });
  }

  /* ================= Roue des défis ================= */

  var spinning = false, needleRot = 0, wheelBuilt = false;

  function buildWheelDisc() {
    if (wheelBuilt) return;
    wheelBuilt = true;
    var disc = $("#wheel-disc");
    var stops = CFG.accounts.map(function (a, i) {
      return a.color + " " + (i * 25) + "% " + ((i + 1) * 25) + "%";
    });
    disc.style.background = "conic-gradient(" + stops.join(",") + ")";
    CFG.accounts.forEach(function (a, i) {
      var ang = (i * 90 + 45) * Math.PI / 180;
      var el = document.createElement("span");
      el.className = "avatar-dot wheel-av";
      el.style.background = "#0B1120";
      el.style.color = a.color;
      el.style.left = (50 + Math.sin(ang) * 34) + "%";
      el.style.top = (50 - Math.cos(ang) * 34) + "%";
      el.textContent = initials(a.name);
      disc.appendChild(el);
    });
  }

  // Tirage pondéré selon CFG.wheelWeights (index dans CFG.accounts)
  function weightedPickIndex() {
    var w = CFG.wheelWeights || {};
    var tot = 0;
    var arr = CFG.accounts.map(function (a) {
      var v = w[a.id] > 0 ? w[a.id] : 1;
      tot += v;
      return v;
    });
    var r = Math.random() * tot;
    for (var i = 0; i < arr.length; i++) {
      r -= arr[i];
      if (r < 0) return i;
    }
    return arr.length - 1;
  }

  function spinWheel() {
    if (spinning) return;
    var today = todayISO();
    if (state.data.wheel[today]) { toast("Déjà tiré aujourd'hui, reviens demain !"); return; }
    if (!state.data.challenges.length) { toast("Crée d'abord un défi en dessous !", true); return; }

    spinning = true;
    $("#spin-btn").disabled = true;
    $("#spin-btn").textContent = "Le caribou tourne…";
    $("#wheel-result").innerHTML = "";

    var idx = weightedPickIndex();
    var victim = CFG.accounts[idx];
    var chal = state.data.challenges[(Math.random() * state.data.challenges.length) | 0];

    // fait tourner l'aiguille jusqu'au quart du gagnant (+ un peu de flou)
    var target = idx * 90 + 45 + (Math.random() * 40 - 20);
    var cur = ((needleRot % 360) + 360) % 360;
    needleRot += 5 * 360 + ((target - cur + 360) % 360);
    $("#wheel-needle").style.transform = "rotate(" + needleRot + "deg)";

    var res = {
      date: today,
      memberId: victim.id,
      challengeId: chal.id,
      text: chal.text,
      spunBy: state.user.id,
      at: new Date().toISOString()
    };
    var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 4800;
    setTimeout(function () {
      spinning = false;
      if (cloud) {
        cloud.setWheel(res);
      } else {
        state.data.wheel[res.date] = res;
        saveData();
      }
      renderDefis();
      toast("Le caribou a choisi " + victim.name + " !");
    }, delay);
  }

  function addChallenge(text) {
    var c = { id: uid(), text: text, createdBy: state.user.id, createdAt: new Date().toISOString() };
    if (cloud) {
      cloud.addChallenge(c);
    } else {
      state.data.challenges.push(c);
      saveData();
      renderDefis();
    }
    toast("Défi ajouté");
  }

  function deleteChallenge(id) {
    askConfirm({
      title: "Supprimer ce défi ?",
      message: cloud ? "Il disparaîtra pour tout le monde." : "Il sera supprimé de cet appareil.",
      confirmLabel: "Supprimer"
    }).then(function (yes) {
      if (!yes) return;
      if (cloud) {
        cloud.delMeta(id);
      } else {
        state.data.challenges = state.data.challenges.filter(function (c) { return c.id !== id; });
        saveData();
        renderDefis();
      }
      toast("Défi supprimé");
    });
  }

  function renderDefis() {
    if (!state.user) return;
    buildWheelDisc();
    $("#defis-warn").hidden = true;

    var today = todayISO();
    var res = state.data.wheel[today];
    var btn = $("#spin-btn");
    if (!spinning) {
      btn.disabled = !!res;
      btn.textContent = res ? "Déjà tiré aujourd'hui" : "Lancer la roue";
    }
    if (!spinning) renderWheelResult(res);
    renderChallengeList();
    renderWheelHistory();
  }

  function renderWheelResult(res) {
    var box = $("#wheel-result");
    if (!res) {
      box.innerHTML = '<p class="empty-state">Personne n\'a encore tourné la roue aujourd\'hui.</p>';
      return;
    }
    var m = member(res.memberId);
    box.innerHTML = '<div class="wheel-victim">' + avatarDot(m) +
      '<div><p class="wv-name">' + esc(m.name) + " !</p>" +
      '<p class="wv-chal">' + esc(res.text) + "</p>" +
      '<p class="wv-by">tiré par ' + esc(member(res.spunBy).name) + "</p></div></div>";
  }

  function renderChallengeList() {
    var list = $("#challenge-list");
    if (!state.data.challenges.length) {
      list.innerHTML = '<li class="empty-state"><strong>Aucun défi</strong>Ajoute la première idée au-dessus !</li>';
      return;
    }
    var trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    list.innerHTML = state.data.challenges.map(function (c) {
      var m = member(c.createdBy);
      return '<li class="challenge-item">' + avatarDot(m, "mini-dot") +
        '<span class="challenge-text">' + esc(c.text) + "</span>" +
        '<button type="button" class="icon-btn chal-del" data-id="' + c.id + '" aria-label="Supprimer le défi">' + trash + "</button></li>";
    }).join("");
  }

  function renderWheelHistory() {
    var list = $("#wheel-history");
    var today = todayISO();
    var dates = Object.keys(state.data.wheel).filter(function (d) { return d !== today; }).sort().reverse().slice(0, 5);
    if (!dates.length) {
      list.innerHTML = '<li class="empty-state">Les anciens tirages apparaîtront ici.</li>';
      return;
    }
    list.innerHTML = dates.map(function (d) {
      var r = state.data.wheel[d];
      var m = member(r.memberId);
      var dl = new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return '<li class="challenge-item"><span class="wh-date">' + esc(dl) + "</span>" +
        avatarDot(m, "mini-dot") +
        '<span class="challenge-text">' + esc(m.name) + " · " + esc(r.text) + "</span></li>";
    }).join("");
  }

  /* ================= Agenda des cours ================= */

  var agDate = null;

  function renderAgenda() {
    var AG = window.CaribouAgenda, body = $("#ag-body");
    if (!AG || !body || !PL) return;
    if (!agDate) agDate = todayISO();
    var days = PL.weekDays(agDate), today = todayISO();
    $("#ag-title").textContent = "Semaine du " + dm(days[0]) + " au " + dm(days[6]);
    var list = AG.sessions(days[0], days[6]);
    if (!list.length) { body.innerHTML = '<p class="empty-state">Pas de cours cette semaine.</p>'; return; }

    var html = "", lastDay = "";
    list.forEach(function (s) {
      var c = s.course;
      if (s.day !== lastDay) {
        html += (lastDay ? "</ul>" : "") + '<h3 class="ag-day' + (s.day === today ? " is-today" : "") + '">' +
          esc(fmtDayLong.format(PL.parse(s.day))) + '</h3><ul class="plan-list">';
        lastDay = s.day;
      }
      var where = s.remote
        ? (c.visio ? '<a href="' + esc(c.visio) + '" target="_blank" rel="noopener">Rejoindre la visio' + (c.tool ? " " + esc(c.tool) : "") + "</a>"
                   : "Lien " + (c.tool ? esc(c.tool) + " " : "visio ") + 'sur <a href="' + esc(c.moodle || "https://moodle.uqo.ca") + '" target="_blank" rel="noopener">Moodle</a>')
        : esc(c.room || "Salle non précisée");
      html += '<li class="plan-item ag-item"><div class="plan-item-main">' +
        "<strong>" + esc(c.code) + " · " + esc(c.name) + "</strong>" +
        "<span>" + esc(c.time || "Horaire non précisé") + " · " + where + "</span>" +
        (s.note ? '<span class="ag-note">' + esc(s.note) + "</span>" : "") +
        '</div><span class="plan-badge ' + (s.remote ? "ag-remote" : "ag-onsite") + '">' + (s.remote ? "Distanciel" : "Présentiel") + "</span></li>";
    });
    body.innerHTML = html + "</ul>";
  }

  /* ================= Planning (qui va où) ================= */

  var PL = window.CaribouPlanning;
  var PLAN_CFG = CFG.planning || {};
  var fmtDayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  var fmtDM = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  var fmtMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
  var fmtDayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  var plan = { view: "week", date: null, editing: null, type: "trip", who: [] };

  function planFields(d, id) {
    return {
      id: id || d.id, who: (d.who || []).slice(), type: d.type === "away" ? "away" : "trip",
      place: d.place || "", from: d.from, to: d.to, createdBy: d.createdBy, createdAt: d.createdAt
    };
  }

  function planLabel(p) { return p.place || (p.type === "away" ? "Absent" : "Voyage"); }
  function dm(d) { return fmtDM.format(PL.parse(d)); }
  function planRange(p) { return p.from === p.to ? dm(p.from) : dm(p.from) + " → " + dm(p.to); }
  function findPlan(id) { return state.data.plans.filter(function (x) { return x.id === id; })[0]; }

  function renderPlanning() {
    var body = $("#plan-body");
    if (!body || !PL) return;
    if (!plan.date) plan.date = todayISO();
    $all("#plan-view .seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.view === plan.view); });
    if (plan.view === "week") renderPlanWeek(body); else renderPlanMonth(body);
    renderPlanList();
  }

  function renderPlanWeek(body) {
    var days = PL.weekDays(plan.date), today = todayISO(), plans = state.data.plans;
    $("#plan-title").textContent = "Semaine du " + dm(days[0]) + " au " + dm(days[6]);

    var html = '<div class="plan-week"><span class="pw-corner"></span>';
    days.forEach(function (d) {
      html += '<span class="pw-day' + (PL.isCours(d, PLAN_CFG) ? " is-cours" : "") + (d === today ? " is-today" : "") + '">' +
        "<b>" + esc(fmtDayShort.format(PL.parse(d)).replace(".", "")) + "</b>" + PL.parse(d).getDate() + "</span>";
    });
    CFG.accounts.forEach(function (acc) {
      html += '<span class="pw-name">' + avatarDot(acc, "mini-dot") + "<span>" + esc(acc.name) + "</span></span>";
      for (var i = 0; i < 7;) {
        var p = PL.whereIs(plans, acc.id, days[i]), n = 1;
        if (p) {
          while (i + n < 7 && PL.whereIs(plans, acc.id, days[i + n]) === p) n++; // jours consécutifs = un seul bloc
          html += '<button type="button" class="pw-cell pw-plan type-' + p.type + '" style="grid-column: span ' + n + '" data-plan="' + esc(p.id) + '" title="' +
            esc(acc.name + " · " + planLabel(p) + " · " + planRange(p)) + '">' + esc(planLabel(p)) + "</button>";
        } else {
          html += '<button type="button" class="pw-cell pw-free' + (PL.isCours(days[i], PLAN_CFG) ? " is-cours" : "") +
            '" data-add="' + esc(acc.id + "|" + days[i]) + '" aria-label="' + esc(acc.name + " dispo le " + dm(days[i]) + ", ajouter une période") + '"></button>';
        }
        i += n;
      }
    });
    body.innerHTML = html + "</div>";

    var free = PL.freeOn(plans, CFG.accounts.map(function (a) { return a.id; }), days).map(function (id) { return member(id).name; });
    $("#plan-free").innerHTML = free.length
      ? "Dispo toute la semaine : <strong>" + esc(free.join(", ")) + "</strong>"
      : "Personne n'est dispo toute la semaine.";
  }

  function renderPlanMonth(body) {
    var month = plan.date.slice(0, 7), weeks = PL.monthWeeks(plan.date), today = todayISO(), plans = state.data.plans;
    var title = fmtMonth.format(PL.parse(month + "-01"));
    $("#plan-title").textContent = title.charAt(0).toUpperCase() + title.slice(1);

    var coursDays = PLAN_CFG.coursDays || [3, 4];
    var html = '<div class="plan-month">';
    weeks[0].forEach(function (d) {
      html += '<span class="pm-head' + (coursDays.indexOf(PL.weekday(d)) >= 0 ? " is-cours" : "") + '">' +
        esc(fmtDayShort.format(PL.parse(d)).replace(".", "")) + "</span>";
    });
    weeks.forEach(function (w) {
      w.forEach(function (d) {
        var chips = PL.onDay(plans, d).map(function (p) {
          return '<span class="pm-chip type-' + p.type + '">' + p.who.map(function (id) {
            var m = member(id);
            return '<i style="background:' + m.color + '">' + esc(initials(m.name).charAt(0)) + "</i>";
          }).join("") + "<em>" + esc(planLabel(p)) + "</em></span>";
        }).join("");
        html += '<button type="button" class="pm-day' + (d.slice(0, 7) !== month ? " is-out" : "") +
          (PL.isCours(d, PLAN_CFG) ? " is-cours" : "") + (d === today ? " is-today" : "") + '" data-day="' + d + '">' +
          '<span class="pm-num">' + PL.parse(d).getDate() + "</span>" + chips + "</button>";
      });
    });
    body.innerHTML = html + "</div>";
    $("#plan-free").textContent = "Touche un jour pour voir le détail de sa semaine.";
  }

  function renderPlanList() {
    var list = $("#plan-list");
    var today = todayISO();
    var items = state.data.plans.filter(function (p) { return p.to >= today; })
      .sort(function (a, b) { return a.from.localeCompare(b.from); });
    if (!items.length) {
      list.innerHTML = '<li class="empty-state">Rien de prévu pour l\'instant. Ajoute le premier voyage !</li>';
      return;
    }
    list.innerHTML = items.map(function (p) {
      return '<li><button type="button" class="plan-item" data-plan="' + esc(p.id) + '">' +
        '<span class="plan-dots">' + p.who.map(function (id) { return avatarDot(member(id), "mini-dot"); }).join("") + "</span>" +
        '<span class="plan-item-main"><strong>' + esc(planLabel(p)) + "</strong><span>" +
          esc(p.who.map(function (id) { return member(id).name; }).join(", ") + " · " + planRange(p)) + "</span></span>" +
        '<span class="plan-badge type-' + p.type + '">' + (p.type === "away" ? "Absent" : "Voyage") + "</span></button></li>";
    }).join("");
  }

  function openPlanModal(p, preset) {
    preset = preset || {};
    plan.editing = p ? p.id : null;
    plan.type = p ? p.type : "trip";
    plan.who = p ? p.who.slice() : [preset.who || state.user.id];
    $("#plan-modal-title").textContent = p ? "Modifier la période" : "Nouvelle période";
    $("#plan-place").value = p ? p.place : "";
    $("#plan-from").value = p ? p.from : preset.day || todayISO();
    $("#plan-to").value = p ? p.to : preset.day || todayISO();
    $("#plan-delete").hidden = !p;
    $("#plan-error").hidden = true;
    syncPlanModal();
    $("#plan-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function syncPlanModal() {
    var away = plan.type === "away";
    $all("#plan-type .seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.type === plan.type); });
    $all("#plan-who .chip-btn").forEach(function (b) { b.classList.toggle("selected", plan.who.indexOf(b.dataset.id) >= 0); });
    $("#plan-place-label").textContent = away ? "Raison (facultatif)" : "Où";
    $("#plan-place").placeholder = away ? "Famille, boulot…" : "Calgary";
  }

  function closePlanModal() {
    $("#plan-modal").hidden = true;
    document.body.style.overflow = "";
    plan.editing = null;
  }

  function submitPlan(e) {
    e.preventDefault();
    var from = $("#plan-from").value, to = $("#plan-to").value;
    var err = !plan.who.length ? "Choisis au moins une personne."
      : !from || !to ? "Indique les dates."
      : to < from ? "La date de fin est avant le début." : null;
    if (err) {
      $("#plan-error").textContent = err;
      $("#plan-error").hidden = false;
      return;
    }
    var existing = plan.editing ? findPlan(plan.editing) : null;
    var p = planFields({
      who: CFG.accounts.map(function (a) { return a.id; }).filter(function (id) { return plan.who.indexOf(id) >= 0; }),
      type: plan.type, place: $("#plan-place").value.trim(), from: from, to: to,
      createdBy: existing ? existing.createdBy : state.user.id,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    }, existing ? existing.id : uid());
    if (cloud) {
      cloud.savePlan(p, !!existing);
    } else {
      state.data.plans = state.data.plans.filter(function (x) { return x.id !== p.id; }).concat([p]);
      saveData();
    }
    plan.date = from; // on affiche la période qu'on vient d'enregistrer
    closePlanModal();
    renderPlanning();
    toast(existing ? "Période modifiée" : "Période ajoutée");
  }

  function deletePlan() {
    var id = plan.editing;
    askConfirm({ title: "Supprimer cette période ?", message: "Elle disparaîtra du planning de tout le monde.", confirmLabel: "Supprimer" })
      .then(function (ok) {
        if (!ok) return;
        if (cloud) {
          cloud.delMeta(id);
        } else {
          state.data.plans = state.data.plans.filter(function (x) { return x.id !== id; });
          saveData();
          renderPlanning();
        }
        closePlanModal();
        toast("Période supprimée");
      });
  }

  function bindPlanning() {
    var box = $("#plan-who");
    CFG.accounts.forEach(function (acc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip-btn";
      b.dataset.id = acc.id;
      b.style.setProperty("--av-color", acc.color);
      b.innerHTML = '<span class="mini-dot" style="background:' + acc.color + '">' + esc(initials(acc.name)) + "</span>" + esc(acc.name);
      b.addEventListener("click", function () {
        var i = plan.who.indexOf(acc.id);
        if (i >= 0) plan.who.splice(i, 1); else plan.who.push(acc.id);
        syncPlanModal();
      });
      box.appendChild(b);
    });
    $all("#plan-type .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { plan.type = b.dataset.type; syncPlanModal(); });
    });
    $all("#plan-view .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { plan.view = b.dataset.view; renderPlanning(); });
    });
    function move(dir) {
      plan.date = plan.view === "week" ? PL.addDays(plan.date, 7 * dir) : PL.addMonths(plan.date, dir);
      renderPlanning();
    }
    $("#plan-prev").addEventListener("click", function () { move(-1); });
    $("#plan-next").addEventListener("click", function () { move(1); });
    $("#plan-today").addEventListener("click", function () { plan.date = todayISO(); renderPlanning(); });
    $("#ag-prev").addEventListener("click", function () { agDate = PL.addDays(agDate, -7); renderAgenda(); });
    $("#ag-next").addEventListener("click", function () { agDate = PL.addDays(agDate, 7); renderAgenda(); });
    $("#ag-today").addEventListener("click", function () { agDate = todayISO(); renderAgenda(); });
    $("#plan-add").addEventListener("click", function () { openPlanModal(null); });
    $("#plan-modal-close").addEventListener("click", closePlanModal);
    $("#plan-modal").addEventListener("click", function (e) { if (e.target === $("#plan-modal")) closePlanModal(); });
    $("#plan-form").addEventListener("submit", submitPlan);
    $("#plan-delete").addEventListener("click", deletePlan);

    function onPlanClick(e) {
      var t = e.target.closest("[data-plan], [data-add], [data-day]");
      if (!t) return;
      if (t.dataset.plan) {
        var p = findPlan(t.dataset.plan);
        if (p) openPlanModal(p);
      } else if (t.dataset.add) {
        var a = t.dataset.add.split("|");
        openPlanModal(null, { who: a[0], day: a[1] });
      } else {
        plan.view = "week";
        plan.date = t.dataset.day;
        renderPlanning();
      }
    }
    $("#plan-body").addEventListener("click", onPlanClick);
    $("#plan-list").addEventListener("click", onPlanClick);
  }

  /* ================= Agence de voyage ================= */

  function wishAdd(kind, name, seen) {
    var it = { id: uid(), name: name, addedBy: state.user.id, createdAt: new Date().toISOString() };
    if (kind === "movies") { it.seen = !!seen; it.ratings = {}; }
    if (cloud) {
      cloud.addWish(kind, it);
    } else {
      state.data[kind].push(it);
      saveData();
      renderAgency();
    }
  }

  function wishDelete(kind, id) {
    if (cloud) {
      cloud.delMeta(id);
    } else {
      state.data[kind] = state.data[kind].filter(function (x) { return x.id !== id; });
      saveData();
      renderAgency();
    }
  }

  function renderAgency() {
    renderMovies();
    renderStops();
  }

  var FILM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M2 12h20"/></svg>';
  var TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  /* ================= Itinéraire (carte Canada / USA) =================
     Étapes et hôtels dans `meta` (kind "stop"). Carte Leaflet + fond OpenStreetMap,
     adresses via Nominatim (OpenStreetMap), trajets routiers via OSRM. */

  var IT = window.CaribouItin;
  var tripMap = null, mapLayers = null, routeCache = {};
  var stopEd = { id: null, type: "step", via: "road", lat: null, lng: null };
  var NOMINATIM = "https://nominatim.openstreetmap.org/";

  function stopFields(d, id) {
    return {
      id: id || d.id, type: d.type === "hotel" ? "hotel" : "step", via: d.via === "plane" ? "plane" : "road",
      name: d.name || "", address: d.address || "", lat: +d.lat, lng: +d.lng,
      from: d.from || "", to: d.to || "", fromTime: d.fromTime || "", toTime: d.toTime || "",
      order: typeof d.order === "number" ? d.order : undefined,
      trip: d.trip || DEFAULT_TRIP, createdBy: d.createdBy, createdAt: d.createdAt
    };
  }

  /* ---- Plusieurs trajets (Calgary, Miami…) : une carte par trajet ----
     Les étapes d'avant (sans trajet) vont dans un trajet « Premier trajet » virtuel. */
  var DEFAULT_TRIP = "default";
  var LS_TRIP = "caribou_trip";
  var curTrip = null;
  try { curTrip = localStorage.getItem(LS_TRIP); } catch (e) { /* stockage bloqué */ }

  function tripList() {
    var trips = state.data.trips.slice();
    var ids = trips.map(function (t) { return t.id; });
    var orphans = state.data.stops.some(function (s) { return ids.indexOf(s.trip) < 0; });
    if (orphans || !trips.length) trips.unshift({ id: DEFAULT_TRIP, name: trips.length ? "Premier trajet" : "Mon trajet" });
    return trips;
  }

  function activeTrip() {
    var list = tripList();
    return list.filter(function (t) { return t.id === curTrip; })[0] || list[0];
  }

  // étapes du trajet affiché (celles d'un trajet disparu tombent dans le trajet par défaut)
  function tripStops() {
    var t = activeTrip(), ids = state.data.trips.map(function (x) { return x.id; });
    return state.data.stops.filter(function (s) {
      return t.id === DEFAULT_TRIP ? ids.indexOf(s.trip) < 0 : s.trip === t.id;
    });
  }

  function selectTrip(id) {
    curTrip = id;
    try { localStorage.setItem(LS_TRIP, id); } catch (e) { /* ignoré */ }
    if (tripMap) tripMap.closePopup();
    renderStops(true);
  }

  function renderTripTabs() {
    var cur = activeTrip();
    $("#trip-tabs").innerHTML = tripList().map(function (t) {
      return '<button type="button" class="filter-chip' + (t.id === cur.id ? " active" : "") + '" data-trip="' + esc(t.id) + '">' + esc(t.name) + "</button>";
    }).join("") + '<button type="button" class="filter-chip trip-new-btn" id="trip-new-btn">+ Nouveau trajet</button>';
  }

  function createTrip(name) {
    var t = { id: uid(), name: name, createdBy: state.user.id, createdAt: new Date().toISOString() };
    if (cloud) {
      cloud.addTrip(t).then(function (id) { if (id) selectTrip(id); });
    } else {
      state.data.trips.push(t);
      saveData();
      selectTrip(t.id);
    }
    toast("Trajet « " + name + " » créé");
  }

  function deleteTrip() {
    var t = activeTrip(), stops = tripStops();
    askConfirm({
      title: "Supprimer « " + t.name + " » ?",
      message: stops.length ? "Ses " + stops.length + " étape(s) disparaîtront aussi, pour tout le monde." : "Le trajet est vide.",
      confirmLabel: "Supprimer"
    }).then(function (ok) {
      if (!ok) return;
      var ids = stops.map(function (s) { return s.id; }).concat(t.id === DEFAULT_TRIP ? [] : [t.id]);
      if (cloud) cloud.delMetas(ids);
      else {
        state.data.stops = state.data.stops.filter(function (s) { return ids.indexOf(s.id) < 0; });
        state.data.trips = state.data.trips.filter(function (x) { return x.id !== t.id; });
        saveData();
      }
      curTrip = null;
      renderStops(true);
      toast("Trajet supprimé");
    });
  }

  function findStop(id) { return state.data.stops.filter(function (x) { return x.id === id; })[0]; }
  function hm(t) { return t ? " " + t.replace(":", "h") : ""; }
  function stopRange(s) {
    if (!s.from) return "";
    var start = dm(s.from) + hm(s.fromTime);
    if (!s.to || (s.to === s.from && !s.toTime)) return start;
    return start + " → " + (s.to === s.from ? hm(s.toTime).trim() : dm(s.to) + hm(s.toTime));
  }

  // nouvel ordre choisi à la main : on renumérote tout le trajet
  function reorderStops(from, to) {
    var stops = IT.sortStops(tripStops());
    stops.splice(to, 0, stops.splice(from, 1)[0]);
    stops.forEach(function (x, i) {
      if (x.order === i) return;
      x.order = i; // affichage immédiat, la synchro suit
      if (cloud) cloud.saveStop(stopFields(x), true);
    });
    saveData();
    renderStops();
  }

  function initTripMap() {
    var el = $("#trip-map");
    if (tripMap || typeof L === "undefined" || !el || !el.offsetWidth) return; // onglet caché : on attend
    tripMap = L.map(el, { zoomControl: false, worldCopyJump: true });
    L.control.zoom({ position: "bottomright" }).addTo(tripMap);
    // fond vectoriel style Google Maps (OpenFreeMap, sans clé) ; repli sur les tuiles OSM classiques
    if (L.maplibreGL && window.maplibregl) {
      L.maplibreGL({
        style: "https://tiles.openfreemap.org/styles/liberty",
        attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(tripMap);
    } else {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(tripMap);
    }
    mapLayers = L.layerGroup().addTo(tripMap);
    tripMap.on("click", function (e) { openStopModal(null, { lat: e.latlng.lat, lng: e.latlng.lng }, true); });
    // les popups Leaflet bloquent la propagation des clics : on branche "Modifier" à l'ouverture
    tripMap.on("popupopen", function (e) {
      var a = e.popup.getElement().querySelector("[data-stop-edit]");
      if (a) a.onclick = function (ev) {
        ev.preventDefault();
        var s = findStop(a.dataset.stopEdit);
        if (s) openStopModal(s);
      };
    });
    renderTripMap(true);
  }

  // leg[i] = trajet de stops[i-1] à stops[i] : { km, h, plane } (h absent = pas encore calculé)
  function stopLegs(stops) {
    var legs = [];
    for (var i = 1; i < stops.length; i++) {
      legs[i] = { km: IT.km(stops[i - 1], stops[i]), plane: stops[i].via === "plane", approx: true };
    }
    IT.roadRuns(stops).forEach(function (run) {
      var r = routeCache[runKey(stops, run)];
      if (!r || !r.legs) return;
      r.legs.forEach(function (l, j) { legs[run[j + 1]] = { km: l.km, h: l.h, plane: false }; });
    });
    return legs;
  }

  function runKey(stops, run) {
    return run.map(function (i) { return stops[i].lng.toFixed(5) + "," + stops[i].lat.toFixed(5); }).join(";");
  }

  // un appel OSRM par groupe d'étapes reliées par la route, mis en cache
  function fetchRoute(key) {
    routeCache[key] = { pending: true };
    fetch("https://router.project-osrm.org/route/v1/driving/" + key + "?overview=full&geometries=geojson")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var rt = j.routes && j.routes[0];
        if (!rt) throw new Error(j.code);
        routeCache[key] = {
          geo: rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
          legs: rt.legs.map(function (l) { return { km: l.distance / 1000, h: l.duration / 3600 }; })
        };
      })
      .catch(function () { routeCache[key] = { failed: true }; })
      .then(function () { renderStops(); });
  }

  function renderTripMap(fit) {
    if (!tripMap) return;
    var stops = IT.sortStops(tripStops());
    mapLayers.clearLayers();

    // vols : ligne pointillée ; route : tracé OSRM (ligne droite tant qu'il n'est pas arrivé)
    for (var i = 1; i < stops.length; i++) {
      if (stops[i].via === "plane") {
        L.polyline([[stops[i - 1].lat, stops[i - 1].lng], [stops[i].lat, stops[i].lng]], { color: "#5F6368", weight: 3, dashArray: "1 8", lineCap: "round", opacity: 0.9 }).addTo(mapLayers);
      }
    }
    // tracé façon Google Maps : bleu avec liseré foncé
    IT.roadRuns(stops).forEach(function (run) {
      var key = runKey(stops, run), r = routeCache[key];
      if (!r) fetchRoute(key);
      var line = r && r.geo ? r.geo : run.map(function (i) { return [stops[i].lat, stops[i].lng]; });
      if (r && r.geo) {
        L.polyline(line, { color: "#1967D2", weight: 8, opacity: 1, lineJoin: "round" }).addTo(mapLayers);
        L.polyline(line, { color: "#4285F4", weight: 5, opacity: 1, lineJoin: "round" }).addTo(mapLayers);
      } else {
        L.polyline(line, { color: "#4285F4", weight: 4, opacity: 0.6, dashArray: "6 8" }).addTo(mapLayers);
      }
    });

    var n = 0;
    stops.forEach(function (s) {
      if (s.type !== "hotel") n++;
      // épingle en goutte (pointe = position exacte)
      var icon = L.divIcon({ className: "", iconSize: [32, 42], iconAnchor: [16, 41], popupAnchor: [0, -38],
        html: '<span class="gpin type-' + s.type + '"><b>' + (s.type === "hotel" ? "H" : n) + "</b></span>" });
      var popup = "<strong>" + esc(s.name) + "</strong>" +
        (s.address ? "<br>" + esc(s.address) : "") + (s.from ? "<br><em>" + esc(stopRange(s)) + "</em>" : "") +
        '<br><a href="' + esc(IT.gmapsPlace(s)) + '" target="_blank" rel="noopener">Google Maps</a> · ' +
        '<a href="#" data-stop-edit="' + esc(s.id) + '">Modifier</a>';
      L.marker([s.lat, s.lng], { icon: icon, draggable: true, title: s.name, zIndexOffset: s.type === "hotel" ? 0 : 100 })
        .bindPopup(popup)
        .on("dragend", function (e) {
          var p = e.target.getLatLng(), c = stopFields(s);
          c.lat = p.lat; c.lng = p.lng;
          saveStop(c, true);
          toast("Position de « " + s.name + " » mise à jour");
        })
        .addTo(mapLayers);
    });

    if (fit) {
      if (stops.length) tripMap.fitBounds(stops.map(function (s) { return [s.lat, s.lng]; }), { padding: [40, 40], maxZoom: 11 });
      else tripMap.fitBounds([[25, -125], [60, -60]]); // Canada + USA
    }
  }

  function renderStops(fit) {
    var list = $("#stop-list");
    if (!list || !IT) return;
    renderTripTabs();
    var stops = IT.sortStops(tripStops()), legs = stopLegs(stops);
    renderTripMap(fit === true);

    var gm = $("#route-gmaps");
    gm.hidden = stops.length < 2;
    gm.href = IT.gmapsDir(stops);

    var road = 0, roadH = 0, air = 0, pending = false;
    legs.forEach(function (l) {
      if (!l) return;
      if (l.plane) air += l.km;
      else { road += l.km; roadH += l.h || 0; if (l.approx) pending = true; }
    });
    $("#route-total").textContent = stops.length < 2 ? "" :
      (road ? "Route : " + Math.round(road).toLocaleString("fr-FR") + " km" + (pending ? " (à vol d'oiseau)" : " · " + IT.hours(roadH) + " de conduite") : "") +
      (road && air ? " · " : "") + (air ? "Avion : " + Math.round(air).toLocaleString("fr-FR") + " km" : "");

    if (!stops.length) {
      list.innerHTML = '<li class="empty-state">Aucune étape. Touche la carte ou cherche une adresse pour commencer le trajet.</li>';
      return;
    }
    var n = 0;
    list.innerHTML = stops.map(function (s, i) {
      var l = legs[i], leg = "";
      if (l) {
        leg = '<li class="stop-leg">' + (l.plane ? "✈ " : "↓ ") + Math.round(l.km).toLocaleString("fr-FR") + " km" +
          (l.plane ? " en avion" : l.approx ? " à vol d'oiseau" : " · " + IT.hours(l.h) + " de route") + "</li>";
      }
      if (s.type !== "hotel") n++;
      return leg + '<li><div class="plan-item stop-item" data-stop="' + esc(s.id) + '" role="button" tabindex="0">' +
        '<span class="map-pin drag-handle type-' + s.type + '" title="Glisser pour changer l\'ordre">' + (s.type === "hotel" ? "H" : n) + "</span>" +
        '<span class="plan-item-main"><strong>' + esc(s.name) + "</strong>" +
        "<span>" + esc([stopRange(s), s.address].filter(Boolean).join(" · ") || "Pas d'adresse") + "</span></span>" +
        '<a class="btn-ghost btn-xs" href="' + esc(IT.gmapsPlace(s)) + '" target="_blank" rel="noopener">Maps</a></div></li>';
    }).join("");
  }

  function openStopModal(s, preset, reverse) {
    preset = preset || {};
    var d = s || preset;
    stopEd.id = s ? s.id : null;
    stopEd.type = d.type === "hotel" ? "hotel" : "step";
    stopEd.via = d.via === "plane" ? "plane" : "road";
    stopEd.lat = d.lat; stopEd.lng = d.lng;
    $("#stop-modal-title").textContent = s ? "Modifier l'étape" : "Nouvelle étape";
    $("#stop-name").value = d.name || "";
    $("#stop-address").value = d.address || "";
    $("#stop-from").value = d.from || "";
    $("#stop-to").value = d.to || "";
    $("#stop-from-time").value = d.fromTime || "";
    $("#stop-to-time").value = d.toTime || "";
    $("#stop-delete").hidden = !s;
    $("#stop-error").hidden = true;
    syncStopModal();
    $("#stop-modal").hidden = false;
    document.body.style.overflow = "hidden";
    if (tripMap) tripMap.closePopup();

    // clic sur la carte : on devine l'adresse du point
    if (reverse) {
      fetch(NOMINATIM + "reverse?format=jsonv2&accept-language=fr&lat=" + d.lat + "&lon=" + d.lng)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if ($("#stop-modal").hidden || stopEd.id || stopEd.lat !== d.lat) return;
          var a = j.address || {};
          if (!$("#stop-address").value && j.display_name) $("#stop-address").value = j.display_name;
          if (!$("#stop-name").value) $("#stop-name").value = j.name || a.city || a.town || a.village || a.county || "";
        })
        .catch(function () {});
    }
  }

  function syncStopModal() {
    $all("#stop-type .seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.type === stopEd.type); });
    $all("#stop-via .seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.via === stopEd.via); });
    $("#stop-name").placeholder = stopEd.type === "hotel" ? "Hôtel Le Germain" : "Banff";
    $("#stop-from-label").textContent = stopEd.type === "hotel" ? "Arrivée" : "Le";
    $("#stop-to-label").textContent = stopEd.type === "hotel" ? "Départ" : "Jusqu'au (facultatif)";
  }

  function closeStopModal() {
    $("#stop-modal").hidden = true;
    document.body.style.overflow = "";
    stopEd.id = null;
  }

  function saveStop(s, editing) {
    if (cloud) {
      cloud.saveStop(s, editing);
    } else {
      state.data.stops = state.data.stops.filter(function (x) { return x.id !== s.id; }).concat([s]);
      saveData();
      renderStops();
    }
  }

  function submitStop(e) {
    e.preventDefault();
    var name = $("#stop-name").value.trim(), from = $("#stop-from").value, to = $("#stop-to").value;
    var fromTime = $("#stop-from-time").value, toTime = $("#stop-to-time").value;
    var err = !name ? "Donne un nom à l'étape."
      : to && !from ? "Indique aussi la date d'arrivée."
      : (fromTime && !from) || (toTime && !to) ? "Une heure va avec sa date."
      : to && (to < from || (to === from && fromTime && toTime && toTime < fromTime)) ? "Le départ est avant l'arrivée." : null;
    if (err) {
      $("#stop-error").textContent = err;
      $("#stop-error").hidden = false;
      return;
    }
    var existing = stopEd.id ? findStop(stopEd.id) : null;
    saveStop(stopFields({
      type: stopEd.type, via: stopEd.via, name: name, address: $("#stop-address").value.trim(),
      lat: stopEd.lat, lng: stopEd.lng, from: from, to: to, fromTime: fromTime, toTime: toTime,
      order: existing ? existing.order : undefined, // nouvelle étape : après celles rangées à la main
      trip: existing ? existing.trip : activeTrip().id,
      createdBy: existing ? existing.createdBy : state.user.id,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    }, existing ? existing.id : uid()), !!existing);
    closeStopModal();
    toast(existing ? "Étape modifiée" : "Étape ajoutée au trajet");
  }

  function deleteStop() {
    var id = stopEd.id;
    askConfirm({ title: "Supprimer cette étape ?", message: "Elle disparaîtra du trajet de tout le monde.", confirmLabel: "Supprimer" })
      .then(function (ok) {
        if (!ok) return;
        if (cloud) cloud.delMeta(id);
        else {
          state.data.stops = state.data.stops.filter(function (x) { return x.id !== id; });
          saveData();
          renderStops();
        }
        closeStopModal();
        toast("Étape supprimée");
      });
  }

  function searchPlaces(q) {
    var box = $("#stop-results");
    box.hidden = false;
    box.innerHTML = '<li class="stop-res-empty">Recherche…</li>';
    fetch(NOMINATIM + "search?format=jsonv2&limit=6&countrycodes=ca,us&accept-language=fr&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.length) { box.innerHTML = '<li class="stop-res-empty">Rien trouvé au Canada ou aux USA. Essaie avec la ville.</li>'; return; }
        box.innerHTML = res.map(function (r, i) {
          return '<li><button type="button" class="stop-res" data-i="' + i + '"><strong>' + esc(r.name || r.display_name.split(",")[0]) +
            "</strong><span>" + esc(r.display_name) + "</span></button></li>";
        }).join("");
        box.onclick = function (e) {
          var b = e.target.closest(".stop-res");
          if (!b) return;
          var r = res[+b.dataset.i];
          box.hidden = true;
          $("#stop-q").value = "";
          if (tripMap) tripMap.setView([+r.lat, +r.lon], 12);
          openStopModal(null, {
            lat: +r.lat, lng: +r.lon, name: r.name || r.display_name.split(",")[0], address: r.display_name,
            type: /hotel|motel|hostel|guest_house|apartment/.test(r.type) ? "hotel" : "step"
          });
        };
      })
      .catch(function () { box.innerHTML = '<li class="stop-res-empty">Recherche indisponible, réessaie dans un instant.</li>'; });
  }

  function bindStops() {
    $("#trip-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-trip]");
      if (b) { selectTrip(b.dataset.trip); return; }
      if (e.target.closest("#trip-new-btn")) {
        $("#trip-form").hidden = false;
        $("#trip-name").focus();
      }
    });
    $("#trip-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#trip-name").value.trim();
      if (!v) return;
      createTrip(v);
      $("#trip-name").value = "";
      $("#trip-form").hidden = true;
    });
    $("#trip-cancel").addEventListener("click", function () { $("#trip-form").hidden = true; });
    $("#trip-delete").addEventListener("click", deleteTrip);
    $("#stop-search").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("#stop-q").value.trim();
      if (q) searchPlaces(q);
    });
    $all("#stop-type .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { stopEd.type = b.dataset.type; syncStopModal(); });
    });
    $all("#stop-via .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { stopEd.via = b.dataset.via; syncStopModal(); });
    });
    $("#stop-form").addEventListener("submit", submitStop);
    $("#stop-delete").addEventListener("click", deleteStop);
    $("#stop-modal-close").addEventListener("click", closeStopModal);
    $("#stop-modal").addEventListener("click", function (e) { if (e.target === $("#stop-modal")) closeStopModal(); });
    function onItem(e) {
      if (e.type === "keydown" && e.key !== "Enter") return;
      if (e.target.closest("a")) return; // lien Maps
      var el = e.target.closest("[data-stop]");
      var s = el && findStop(el.dataset.stop);
      if (!s) return;
      if (tripMap) tripMap.setView([s.lat, s.lng], Math.max(tripMap.getZoom(), 11));
      openStopModal(s);
    }
    $("#stop-list").addEventListener("click", onItem);
    $("#stop-list").addEventListener("keydown", onItem);
    dragSort($("#stop-list"), ".stop-item", reorderStops);
  }

  /* ================= Films : à voir / vus (notés sur 10) ================= */

  function findMovie(id) { return state.data.movies.filter(function (x) { return x.id === id; })[0]; }

  function saveMovie(m) {
    if (cloud) cloud.saveMovie(m);
    else { saveData(); renderMovies(); }
  }

  function movieAvg(m) {
    var notes = Object.keys(m.ratings || {}).map(function (k) { return m.ratings[k]; });
    if (!notes.length) return null;
    return notes.reduce(function (a, b) { return a + b; }, 0) / notes.length;
  }

  function movieDel(m) {
    return '<button type="button" class="icon-btn wish-del" data-kind="movies" data-id="' + esc(m.id) + '" aria-label="Supprimer">' + TRASH_ICON + "</button>";
  }

  function renderMovies() {
    var list = $("#movie-list"), seenList = $("#seen-list");
    if (!list || !seenList) return;
    if (seenList.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return; // note en cours de choix
    var todo = state.data.movies.filter(function (m) { return !m.seen; });
    var seen = state.data.movies.filter(function (m) { return m.seen; });

    list.innerHTML = todo.length ? todo.map(function (m) {
      return '<li class="wish-item"><span class="wish-ico">' + FILM_ICON + "</span>" +
        '<span class="wish-name">' + esc(m.name) + "</span>" +
        '<span class="wish-by">' + esc(member(m.addedBy).name) + "</span>" +
        '<button type="button" class="btn-ghost btn-xs wish-seen" data-id="' + esc(m.id) + '">Vu ✓</button>' + movieDel(m) + "</li>";
    }).join("") : '<li class="empty-state">Aucun film noté. Ajoute le premier pour la prochaine soirée !</li>';

    // les mieux notés en haut
    function avgOr(m) { var v = movieAvg(m); return v === null ? -1 : v; }
    seen.sort(function (a, b) { return avgOr(b) - avgOr(a); });
    var opts = [""].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    seenList.innerHTML = seen.length ? seen.map(function (m) {
      var r = m.ratings || {}, avg = movieAvg(m), mine = r[state.user.id];
      var others = CFG.accounts.filter(function (a) { return a.id !== state.user.id && typeof r[a.id] === "number"; });
      return '<li class="wish-item seen-item"><span class="wish-ico">' + FILM_ICON + "</span>" +
        '<span class="wish-name">' + esc(m.name) + "</span>" +
        '<span class="seen-avg">' + (avg === null ? "—" : avg.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "/10") + "</span>" +
        movieDel(m) +
        '<div class="seen-rates"><label class="seen-rate">Ta note <select class="seen-select" data-id="' + esc(m.id) + '">' +
          opts.map(function (v) {
            return '<option value="' + v + '"' + (v === "" ? (typeof mine !== "number" ? " selected" : "") : v === mine ? " selected" : "") + ">" + (v === "" ? "–" : v) + "</option>";
          }).join("") + "</select></label>" +
          others.map(function (a) { return '<span class="seen-rate">' + avatarDot(a, "mini-dot") + r[a.id] + "</span>"; }).join("") +
        "</div></li>";
    }).join("") : '<li class="empty-state">Aucun film vu pour l\'instant.</li>';
  }

  function bindMovies() {
    $("#movie-list").addEventListener("click", function (e) {
      var b = e.target.closest(".wish-seen"), m = b && findMovie(b.dataset.id);
      if (!m) return;
      m.seen = true;
      saveMovie(m);
      toast("« " + m.name + " » rangé dans les films vus : à vos notes !");
    });
    $("#seen-list").addEventListener("change", function (e) {
      var sel = e.target.closest(".seen-select"), m = sel && findMovie(sel.dataset.id);
      if (!m) return;
      m.ratings = m.ratings || {};
      if (sel.value === "") delete m.ratings[state.user.id];
      else m.ratings[state.user.id] = +sel.value;
      sel.blur();
      saveMovie(m);
    });
  }

  /* ================= Events : chacun son classement ================= */

  var evWho = null; // classement affiché (par défaut le sien)

  // ordre perso de `uid` : ses events rangés, puis les nouveaux (ordre d'ajout)
  function eventRanking(uid) {
    var pos = Object.create(null);
    ((state.data.eventRanks[uid] || {}).order || []).forEach(function (id, i) { if (!(id in pos)) pos[id] = i; });
    function p(ev) { return ev.id in pos ? pos[ev.id] : Infinity; }
    return state.data.events.slice().sort(function (a, b) { return p(a) === p(b) ? 0 : p(a) < p(b) ? -1 : 1; }); // tri stable
  }

  function renderEvents() {
    var list = $("#event-list");
    if (!list) return;
    if (!evWho) evWho = state.user.id;
    var mine = evWho === state.user.id, who = member(evWho);
    $("#event-who").innerHTML = CFG.accounts.map(function (a) {
      return '<button type="button" class="filter-chip' + (a.id === evWho ? " active" : "") + '" data-who="' + esc(a.id) + '">' +
        avatarDot(a, "mini-dot") + "<span>" + esc(a.id === state.user.id ? "Moi" : a.name) + "</span></button>";
    }).join("");
    var evs = eventRanking(evWho);
    $("#event-hint").textContent = !evs.length ? "" : mine
      ? "Ton classement : fais glisser un numéro pour le changer."
      : "Le classement de " + who.name + ".";
    list.innerHTML = evs.length ? evs.map(function (ev, i) {
      return '<li class="plan-item event-item">' +
        '<span class="event-rank' + (mine ? " drag-handle" : "") + '"' + (mine ? ' title="Glisser pour changer l\'ordre"' : "") + ">" + (i + 1) + "</span>" +
        '<span class="plan-item-main"><strong>' + esc(ev.text) + "</strong><span>ajouté par " + esc(member(ev.addedBy).name) + "</span></span>" +
        (ev.addedBy === state.user.id ? '<button type="button" class="icon-btn event-del" data-id="' + esc(ev.id) + '" aria-label="Supprimer l\'event">' + TRASH_ICON + "</button>" : "") +
        "</li>";
    }).join("") : '<li class="empty-state">Aucun event pour l\'instant. Ajoute le premier au-dessus !</li>';
  }

  function saveRanking(order) {
    var uid = state.user.id, cur = state.data.eventRanks[uid] || {};
    state.data.eventRanks[uid] = { id: cur.id, order: order };
    saveData();
    renderEvents();
    if (cloud) cloud.saveRank(uid, order, cur.id);
  }

  function bindEvents() {
    $("#event-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#event-input").value.trim().slice(0, 150);
      if (!v) return;
      var ev = { id: uid(), text: v, addedBy: state.user.id, createdAt: new Date().toISOString() };
      if (cloud) cloud.addEvent(ev);
      else { state.data.events.push(ev); saveData(); renderEvents(); }
      $("#event-input").value = "";
      toast("Event ajouté");
    });
    $("#event-who").addEventListener("click", function (e) {
      var b = e.target.closest("[data-who]");
      if (b) { evWho = b.dataset.who; renderEvents(); }
    });
    $("#event-list").addEventListener("click", function (e) {
      var b = e.target.closest(".event-del");
      if (!b) return;
      var id = b.dataset.id;
      askConfirm({ title: "Supprimer cet event ?", message: "Il disparaîtra du classement de tout le monde.", confirmLabel: "Supprimer" })
        .then(function (ok) {
          if (!ok) return;
          if (cloud) cloud.delMeta(id);
          else { state.data.events = state.data.events.filter(function (x) { return x.id !== id; }); saveData(); renderEvents(); }
        });
    });
    dragSort($("#event-list"), ".event-item", function (from, to) {
      var ids = eventRanking(state.user.id).map(function (ev) { return ev.id; });
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      saveRanking(ids);
    });
  }

  /* ================= Liste de courses ================= */

  var shopId = null; // liste en cours choisie (sinon la plus récente pas finie)

  function shopActive() {
    var open = state.data.shoplists.filter(function (l) { return !l.finishedAt; });
    return open.filter(function (l) { return l.id === shopId; })[0] || open[0] || null;
  }

  // enregistre la liste : affichage immédiat en local, puis synchro
  function shopSave(l, isNew) {
    if (!isNew || !cloud) {
      if (isNew) state.data.shoplists.unshift(l);
      shopId = l.id;
      saveData();
      renderShop();
    }
    if (cloud) cloud.saveShop(l, isNew);
  }

  function shopCreate(items) {
    var d = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    shopSave({ id: uid(), name: "Courses du " + d, items: items || [], createdAt: new Date().toISOString() }, true);
  }

  function shopFind(id) {
    return state.data.shoplists.filter(function (l) { return l.id === id; })[0];
  }

  function plural(n, word) { return n + " " + word + (n > 1 ? "s" : ""); }

  function renderShop() {
    var box = $("#shop-items");
    if (!box) return;
    if (box.querySelector(".shop-edit")) return; // ne pas casser une modif en cours
    var l = shopActive();
    $("#shop-title").textContent = l ? l.name : "Liste de courses";
    $("#shop-finish").hidden = !l;
    if (!l || !l.items.length) {
      $("#shop-count").textContent = "";
      box.innerHTML = '<li class="empty-state">' + (l ? "Liste vide : ajoute un article." : "Pas de liste en cours : ajoute un article ou réutilise une ancienne liste.") + "</li>";
    } else {
      var done = l.items.filter(function (it) { return it.done; }).length;
      $("#shop-count").textContent = done + " / " + l.items.length + " dans le panier";
      // non cochés d'abord
      var sorted = l.items.filter(function (it) { return !it.done; }).concat(l.items.filter(function (it) { return it.done; }));
      box.innerHTML = sorted.map(function (it) {
        return '<li class="wish-item shop-item' + (it.done ? " done" : "") + '" data-id="' + esc(it.id) + '">' +
          '<input type="checkbox" class="shop-check"' + (it.done ? " checked" : "") + ' aria-label="Cocher">' +
          '<span class="wish-name shop-text">' + esc(it.text) + "</span>" +
          '<button type="button" class="icon-btn shop-del" aria-label="Supprimer">' + TRASH_ICON + "</button></li>";
      }).join("");
    }

    var old = state.data.shoplists.filter(function (x) { return x !== l; });
    $("#shop-old").innerHTML = old.length ? old.map(function (o) {
      var when = o.finishedAt
        ? "finie le " + new Date(o.finishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
        : "pas finie";
      return '<li class="shop-hist" data-id="' + esc(o.id) + '">' +
        '<details><summary><span class="wish-name">' + esc(o.name) +
        '<small class="shop-sub">' + plural(o.items.length, "article") + " · " + when + "</small></span></summary>" +
        '<p class="shop-peek">' + (o.items.map(function (it) { return esc(it.text); }).join(" · ") || "Liste vide") + "</p></details>" +
        '<button type="button" class="btn-primary btn-sm shop-copy">Réutiliser</button>' +
        '<button type="button" class="icon-btn shop-drop" aria-label="Supprimer la liste">' + TRASH_ICON + "</button></li>";
    }).join("") : '<li class="empty-state">Les courses finies apparaîtront ici.</li>';
  }

  function shopEdit(li, l) {
    var it = l.items.filter(function (x) { return x.id === li.dataset.id; })[0];
    var span = li.querySelector(".shop-text");
    var input = document.createElement("input");
    input.type = "text";
    input.maxLength = 80;
    input.className = "shop-edit";
    input.value = it.text;
    span.replaceWith(input);
    input.focus();
    var finished = false;
    function finish(keep) {
      if (finished) return;
      finished = true;
      var v = input.value.trim();
      input.remove(); // libère renderShop
      if (keep && v && v !== it.text) { it.text = v; shopSave(l); } else renderShop();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", function () { finish(true); });
  }

  function bindShop() {
    $("#shop-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#shop-input").value.trim();
      if (!v) return;
      var it = { id: uid(), text: v, done: false };
      var l = shopActive();
      if (l) { l.items.push(it); shopSave(l); } else shopCreate([it]);
      $("#shop-input").value = "";
      $("#shop-input").focus();
    });

    $("#shop-finish").addEventListener("click", function () {
      var l = shopActive();
      if (!l) return;
      var left = l.items.filter(function (it) { return !it.done; }).length;
      var go = left
        ? askConfirm({ title: "Courses finies ?", message: "Il reste " + plural(left, "article") + " pas coché" + (left > 1 ? "s" : "") + ". La liste part quand même dans l'historique.", confirmLabel: "C'est fini", danger: false })
        : Promise.resolve(true);
      go.then(function (yes) {
        if (!yes) return;
        l.finishedAt = new Date().toISOString();
        shopId = null;
        shopSave(l);
        toast("Courses finies, liste rangée dans l'historique");
      });
    });

    $("#shop-items").addEventListener("click", function (e) {
      var li = e.target.closest(".shop-item"), l = shopActive();
      if (!li || !l) return;
      var it = l.items.filter(function (x) { return x.id === li.dataset.id; })[0];
      if (!it) return;
      if (e.target.closest(".shop-check")) { it.done = e.target.checked; shopSave(l); }
      else if (e.target.closest(".shop-del")) { l.items = l.items.filter(function (x) { return x !== it; }); shopSave(l); }
      else if (e.target.closest(".shop-text")) shopEdit(li, l);
    });

    $("#shop-old").addEventListener("click", function (e) {
      var li = e.target.closest("li[data-id]");
      var o = li && shopFind(li.dataset.id);
      if (!o) return;
      if (e.target.closest(".shop-copy")) {
        // ajoute à la liste en cours les articles qui n'y sont pas déjà
        var cur = shopActive();
        var have = (cur ? cur.items : []).map(function (it) { return it.text.toLowerCase(); });
        var add = o.items.filter(function (it) {
          var k = it.text.toLowerCase();
          if (have.indexOf(k) >= 0) return false;
          have.push(k);
          return true;
        }).map(function (it) { return { id: uid(), text: it.text, done: false }; });
        if (!add.length) { toast("Tout est déjà dans la liste en cours"); return; }
        if (cur) { cur.items = cur.items.concat(add); shopSave(cur); } else shopCreate(add);
        toast(plural(add.length, "article") + " ajouté" + (add.length > 1 ? "s" : "") + " à la liste");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (e.target.closest(".shop-drop")) {
        askConfirm({ title: "Supprimer cette liste ?", message: o.name, confirmLabel: "Supprimer" }).then(function (yes) {
          if (!yes) return;
          if (cloud) cloud.delMeta(o.id);
          else {
            state.data.shoplists = state.data.shoplists.filter(function (x) { return x !== o; });
            saveData();
            renderShop();
          }
        });
      }
    });
  }

  /* ================= Conduite : jeu des doigts + roulette ================= */

  var FINGER_COLORS = ["#F59E0B", "#34D399", "#A78BFA", "#38BDF8", "#FB7185", "#FBBF24", "#F472B6", "#4ADE80", "#60A5FA", "#FB923C"];

  function initFingerGame() {
    var arena = $("#finger-arena"), hint = $("#finger-hint");
    if (!arena) return;
    var dots = {}, timer = null, decided = false, colorIdx = 0;

    function relPos(t) {
      var r = arena.getBoundingClientRect();
      return [t.clientX - r.left, t.clientY - r.top];
    }
    function clearAll() {
      Object.keys(dots).forEach(function (id) { dots[id].remove(); });
      dots = {}; decided = false;
      clearTimeout(timer);
    }
    function schedule() {
      clearTimeout(timer);
      var n = Object.keys(dots).length;
      if (decided) return;
      hint.textContent = n < 2 ? "Encore un doigt… (min. 2)" : "Ne bougez plus…";
      hint.style.opacity = n ? "1" : "";
      if (n >= 2) timer = setTimeout(pick, 2600);
    }
    function pick() {
      var ids = Object.keys(dots);
      if (ids.length < 2) return;
      decided = true;
      var win = ids[(Math.random() * ids.length) | 0];
      ids.forEach(function (id) {
        dots[id].classList.add(id === win ? "winner" : "loser");
      });
      hint.textContent = "🚗 Au volant !";
      hint.style.opacity = "1";
      if (navigator.vibrate) navigator.vibrate(120);
    }

    arena.addEventListener("touchstart", function (e) {
      e.preventDefault();
      if (decided) clearAll();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], p = relPos(t);
        var el = document.createElement("span");
        el.className = "finger-dot";
        el.style.setProperty("--c", FINGER_COLORS[colorIdx++ % FINGER_COLORS.length]);
        el.style.left = p[0] + "px"; el.style.top = p[1] + "px";
        arena.appendChild(el);
        dots[t.identifier] = el;
      }
      schedule();
    }, { passive: false });

    arena.addEventListener("touchmove", function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], el = dots[t.identifier];
        if (el) { var p = relPos(t); el.style.left = p[0] + "px"; el.style.top = p[1] + "px"; }
      }
    }, { passive: false });

    function onEnd(e) {
      e.preventDefault();
      if (decided) return; // garder l'affichage du gagnant jusqu'au prochain touch
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (dots[id]) { dots[id].remove(); delete dots[id]; }
      }
      schedule();
    }
    arena.addEventListener("touchend", onEnd, { passive: false });
    arena.addEventListener("touchcancel", onEnd, { passive: false });
  }

  var driverSpinning = false;
  function driverSpin() {
    if (driverSpinning) return;
    driverSpinning = true;
    var btn = $("#driver-spin"), slot = $("#driver-slot");
    btn.disabled = true;
    var winner = CFG.accounts[(Math.random() * CFG.accounts.length) | 0];
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function step(n) {
      var m = CFG.accounts[(Math.random() * CFG.accounts.length) | 0];
      slot.textContent = m.name;
      slot.style.color = m.color;
      if (n <= 0 || reduce) {
        slot.textContent = winner.name + " 🚗";
        slot.style.color = winner.color;
        btn.disabled = false;
        driverSpinning = false;
        toast(winner.name + " prend le volant !");
        return;
      }
      setTimeout(function () { step(n - 1); }, 60 + (22 - n) * 14); // décélère
    }
    step(reduce ? 0 : 22);
  }

  /* ================= Roue des tips ================= */
  // Astuce : onglet Conduite, puis Défis, puis Tips => la roue est truquée sur 0 % (elle tremble).

  var TIPS = [
    { label: "0%", size: 8, color: "#B91C1C" },
    { label: "15%", size: 68.8, color: "#D97706" },
    { label: "10%", size: 8, color: "#334155" },
    { label: "18%", size: 68.8, color: "#059669" },
    { label: "20%", size: 68.8, color: "#0284C7" },
    { label: "25%", size: 68.8, color: "#7C3AED" },
    { label: "50%", size: 68.8, color: "#DB2777" }
  ];
  var tipsRot = 0, tipsSpinning = false, tipsRigged = false, tabTrail = [];

  // point sur le cercle : angle 0 = en haut, sens horaire
  function tipsPt(r, deg) {
    var a = deg * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + " " + (-r * Math.cos(a)).toFixed(2);
  }

  function buildTipsDisc() {
    var disc = $("#tips-disc");
    if (disc.childNodes.length) return;
    var R = 88, a = 0, parts = "", labels = "";
    TIPS.forEach(function (s) {
      s.start = a;
      var end = a + s.size, mid = a + s.size / 2, tiny = s.size < 20;
      parts += '<path d="M0 0L' + tipsPt(R, a) + "A" + R + " " + R + " 0 " + (s.size > 180 ? 1 : 0) + " 1 " + tipsPt(R, end) +
        'Z" fill="' + s.color + '"/>';
      // texte le long du rayon, retourné côté gauche pour rester lisible
      var flip = mid > 180;
      labels += '<text transform="rotate(' + (flip ? mid + 90 : mid - 90) + ')" x="' + (flip ? -1 : 1) * (tiny ? 72 : 58) + '" y="0" class="tips-txt' + (tiny ? " tiny" : "") +
        '">' + s.label + "</text>";
      a = end;
    });
    var sep = TIPS.map(function (s) { return '<line x1="0" y1="0" x2="' + tipsPt(R, s.start).replace(" ", '" y2="') + '"/>'; }).join("");
    disc.innerHTML = '<svg viewBox="-90 -90 180 180">' +
      '<defs><radialGradient id="tips-shade"><stop offset=".25" stop-color="#fff" stop-opacity=".18"/>' +
      '<stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity=".45"/></radialGradient></defs>' +
      parts + '<circle r="' + R + '" fill="url(#tips-shade)"/>' +
      '<g stroke="#FDE68A" stroke-opacity=".55" stroke-width="1.2">' + sep + "</g>" + labels + "</svg>";

    var bulbs = "";
    for (var i = 0; i < 24; i++) bulbs += '<circle r="2.6" transform="translate(' + tipsPt(95, i * 15) + ')" class="' + (i % 2 ? "b2" : "b1") + '"/>';
    $("#tips-rim").innerHTML = '<svg viewBox="-100 -100 200 200">' +
      '<defs><linearGradient id="tips-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE68A"/>' +
      '<stop offset=".45" stop-color="#F59E0B"/><stop offset="1" stop-color="#92400E"/></linearGradient></defs>' +
      '<circle r="95" fill="#0B1120" stroke="url(#tips-gold)" stroke-width="9"/>' + bulbs + "</svg>";
  }

  // Faux historique : les derniers restos (dépenses "food"), tip toujours >= 20 %
  function renderTipsHistory() {
    var high = TIPS.filter(function (s) { return parseInt(s.label, 10) >= 20; });
    var restos = state.data.expenses.filter(function (e) { return e.category === "food" && e.date; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
    if (!restos.length) { // pas encore de resto saisi : dates bidon récentes
      restos = [2, 6, 11, 17, 24].map(function (n) {
        var d = new Date(); d.setDate(d.getDate() - n);
        return { id: String(n), title: "Resto", date: d.toISOString().slice(0, 10) };
      });
    }
    $("#tips-history").innerHTML = restos.map(function (e) {
      var h = 0;
      for (var i = 0; i < String(e.id).length; i++) h = (h * 31 + String(e.id).charCodeAt(i)) | 0;
      var s = high[Math.abs(h) % high.length]; // stable pour une même dépense
      var dl = new Date(e.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return '<li class="challenge-item"><span class="wh-date">' + esc(dl) + "</span>" +
        '<span class="challenge-text">' + esc(e.title) + "</span>" +
        '<strong style="color:' + s.color + '">' + s.label + "</strong></li>";
    }).join("");
  }

  function setTipsRigged(on) {
    tipsRigged = on;
    $("#tips-wrap").classList.toggle("rigged", on);
  }

  function tipsSpin() {
    if (tipsSpinning) return;
    tipsSpinning = true;
    var btn = $("#tips-spin"), out = $("#tips-result");
    btn.disabled = true;
    out.textContent = "…";
    // angle du disque qui finit sous le pointeur (en haut)
    // truquée : 0 % ; sinon jamais 0 ni 10 %, au hasard parmi les autres
    var ok = TIPS.filter(function (s) { return parseInt(s.label, 10) > 10; });
    var seg = tipsRigged ? TIPS[0] : ok[(Math.random() * ok.length) | 0];
    var angle = seg.start + seg.size * (tipsRigged ? 0.3 + Math.random() * 0.4 : 0.1 + Math.random() * 0.8);
    setTipsRigged(false);
    var cur = ((tipsRot % 360) + 360) % 360;
    tipsRot += 6 * 360 + ((360 - angle - cur + 720) % 360);
    $("#tips-disc").style.transform = "rotate(" + tipsRot + "deg)";
    var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 5200;
    setTimeout(function () {
      out.textContent = "Tip : " + seg.label;
      out.style.color = seg.color;
      btn.disabled = false;
      tipsSpinning = false;
      toast(seg.label === "0%" ? "0 % de tip, dommage 😬" : "La roue dit " + seg.label + " !");
    }, delay);
  }

  /* ================= Export Excel ================= */

  function exportExcel() {
    if (typeof XLSX === "undefined") { toast("Librairie Excel pas encore chargée, réessaie", true); return; }
    var me = state.user.id;
    var rate = state.data.eurToCad;

    var sorted = state.data.expenses.slice().sort(function (a, b) {
      return (a.date + (a.createdAt || "")).localeCompare(b.date + (b.createdAt || ""));
    });

    // Feuille 1 : lignes de dépenses / remboursements
    var rows = sorted.map(function (e) {
      var cad = toCad(e);
      var tr = isTransfer(e);
      var parts = e.participants.filter(function (p) { return member(p).name !== "?"; });
      var paid = e.payerId === me ? cad : 0;
      var share = (parts.indexOf(me) >= 0 && parts.length) ? cad / parts.length : 0;
      var impact = paid - share; // + = on te doit, - = tu dois
      return {
        "Date": e.date,
        "Type": tr ? "Remboursement" : "Dépense",
        "Titre": e.title,
        "Catégorie": tr ? "" : category(e.category).name,
        "Payé par": member(e.payerId).name,
        "Pour / À qui": tr ? member(e.participants[0]).name
          : parts.map(function (p) { return member(p).name; }).join(", "),
        "Montant saisi": Math.round(e.amount * 100) / 100,
        "Devise": e.currency,
        "Montant (CAD)": Math.round(cad * 100) / 100,
        "Montant (EUR)": Math.round(cad / rate * 100) / 100,
        "Ton impact (CAD)": Math.round(impact * 100) / 100
      };
    });
    var totalSpent = spentOnly().reduce(function (s, e) { return s + toCad(e); }, 0);
    rows.push({});
    rows.push({
      "Type": "TOTAL dépenses",
      "Montant (CAD)": Math.round(totalSpent * 100) / 100,
      "Montant (EUR)": Math.round(totalSpent / rate * 100) / 100
    });

    var ws1 = XLSX.utils.json_to_sheet(rows);
    ws1["!cols"] = [
      { wch: 11 }, { wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 11 },
      { wch: 24 }, { wch: 13 }, { wch: 7 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
    ];

    // Feuille 2 : soldes du crew + remboursements conseillés
    var balances = computeBalances();
    var soldeRows = balances.map(function (b) {
      return {
        "Membre": member(b.id).name,
        "A payé (CAD)": Math.round(b.paid * 100) / 100,
        "Sa part (CAD)": Math.round(b.share * 100) / 100,
        "Solde (CAD)": Math.round(b.balance * 100) / 100,
        "Statut": Math.abs(b.balance) < 0.005 ? "à jour"
          : (b.balance > 0 ? "on lui doit" : "doit rembourser")
      };
    });
    soldeRows.push({});
    soldeRows.push({ "Membre": "Remboursements conseillés :" });
    computeSettlements(balances).forEach(function (s) {
      soldeRows.push({
        "Membre": member(s.from).name + " → " + member(s.to).name,
        "Solde (CAD)": Math.round(s.amount * 100) / 100
      });
    });
    var ws2 = XLSX.utils.json_to_sheet(soldeRows);
    ws2["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Dépenses & remb.");
    XLSX.utils.book_append_sheet(wb, ws2, "Soldes");

    var trip = (CFG.tripName || "voyage").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    XLSX.writeFile(wb, "caribou-" + trip + "-" + todayISO() + ".xlsx");
    toast("Fichier Excel téléchargé");
  }

  /* ================= App ================= */

  function showApp() {
    $("#view-login").hidden = true;
    $("#view-login").style.display = "none";
    $("#view-app").hidden = false;
    document.body.classList.add("in-app"); // affiche le décor 3D

    // La vidéo du caribou n'accompagne que l'écran d'accueil
    var vb = $("#video-bg");
    if (vb) {
      vb.classList.add("gone");
      $all("#video-bg video").forEach(function (v) { v.pause(); });
    }

    $("#trip-chip").textContent = CFG.tripName;
    $("#user-chip").innerHTML = avatarDot(state.user) + "<span>" + esc(state.user.name) + "</span>";
    $("#rate-input").value = state.data.eurToCad;
    $("#rate-usd-input").value = state.data.usdToCad;
    syncCurButtons();

    renderAll();

    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.from(".view-app .card, .view-app .stat-card", {
        opacity: 0, y: 16, duration: 0.55, stagger: 0.05, ease: "power3.out", clearProps: "all"
      });
    }
  }

  function bindApp() {
    // Onglets
    $all(".tab").forEach(function (t) {
      t.addEventListener("click", function () { gotoTab(t.dataset.tab); });
    });
    $all("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () { gotoTab(b.dataset.goto); });
    });

    $all("#cur-switch .cur-btn").forEach(function (b) {
      b.addEventListener("click", function () { setDisplayCur(b.dataset.cur); });
    });

    $("#logout-btn").addEventListener("click", function () {
      askConfirm({
        title: "Se déconnecter ?",
        message: "Tu devras retaper ton mot de passe la prochaine fois.",
        confirmLabel: "Se déconnecter",
        danger: false
      }).then(function (yes) { if (yes) logout(); });
    });

    // Modale de confirmation
    $("#confirm-cancel").addEventListener("click", function () { closeConfirm(false); });
    $("#confirm-ok").addEventListener("click", function () { closeConfirm(true); });
    $("#confirm-modal").addEventListener("click", function (e) {
      if (e.target === $("#confirm-modal")) closeConfirm(false);
    });

    $("#add-expense-btn").addEventListener("click", function () { openModal(null); });
    $("#fab-add").addEventListener("click", function () { openModal(null); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#expense-modal").addEventListener("click", function (e) {
      if (e.target === $("#expense-modal")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#confirm-modal").hidden) closeConfirm(false);
      else if (!$("#expense-modal").hidden) closeModal();
      else if (!$("#plan-modal").hidden) closePlanModal();
      else if (!$("#stop-modal").hidden) closeStopModal();
    });
    $("#expense-form").addEventListener("submit", submitExpense);
    $("#exp-delete").addEventListener("click", deleteExpense);

    // Clic sur une dépense = édition
    document.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".expense-item") : null;
      if (!item || !item.dataset.id) return;
      var exp = state.data.expenses.filter(function (x) { return x.id === item.dataset.id; })[0];
      if (exp) openModal(exp);
    });

    // "Marquer payé" sur un remboursement conseillé → crée le remboursement
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".settle-btn") : null;
      if (!btn) return;
      var from = member(btn.dataset.from), to = member(btn.dataset.to);
      var amt = parseFloat(btn.dataset.amount);
      if (!(amt > 0)) return;
      askConfirm({
        title: "Remboursement fait ?",
        message: from.name + " a bien envoyé " + M(amt) + " à " + to.name + " ?",
        confirmLabel: "Oui, c'est payé",
        danger: false
      }).then(function (yes) {
        if (!yes) return;
        var payload = {
          id: uid(),
          title: "Remboursement",
          amount: amt,
          currency: "CAD",
          payerId: from.id,
          participants: [to.id],
          category: "other",
          date: todayISO(),
          type: "transfer",
          createdBy: state.user.id,
          createdAt: new Date().toISOString()
        };
        if (cloud) {
          cloud.saveExpense(payload, false);
        } else {
          state.data.expenses.push(payload);
          saveData();
          renderAll();
        }
        toast("Remboursement enregistré");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var item = e.target && e.target.classList && e.target.classList.contains("expense-item") ? e.target : null;
      if (!item) return;
      var exp = state.data.expenses.filter(function (x) { return x.id === item.dataset.id; })[0];
      if (exp) openModal(exp);
    });

    // Réglages
    function bindRate(sel, key, label) {
      $(sel).addEventListener("change", function () {
        var v = parseFloat(this.value);
        if (!(v > 0)) return;
        state.data[key] = v;
        saveData();
        if (cloud) cloud.setRate();
        renderAll();
        toast("Taux mis à jour : " + label + " = " + v + " $ CAD");
      });
    }
    bindRate("#rate-input", "eurToCad", "1 €");
    bindRate("#rate-usd-input", "usdToCad", "1 $ US");
    $("#export-xlsx-btn").addEventListener("click", exportExcel);

    // Roue des défis
    $("#spin-btn").addEventListener("click", spinWheel);
    $("#challenge-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#challenge-input").value.trim();
      if (!v) return;
      addChallenge(v);
      $("#challenge-input").value = "";
    });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".chal-del") : null;
      if (btn) deleteChallenge(btn.dataset.id);
    });

    // Agence de voyage
    bindPlanning();

    $("#movie-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#movie-input").value.trim();
      if (v) { wishAdd("movies", v); $("#movie-input").value = ""; }
    });
    $("#seen-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#seen-input").value.trim();
      if (v) { wishAdd("movies", v, true); $("#seen-input").value = ""; }
    });
    bindMovies();
    bindStops();
    bindEvents();

    // Filtre des dépenses par catégorie
    $("#exp-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (!b) return;
      expFilter = b.dataset.filter;
      renderExpenseGroups();
    });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".wish-del") : null;
      if (btn) wishDelete(btn.dataset.kind, btn.dataset.id);
    });

    // Conduite
    initFingerGame();
    $("#driver-spin").addEventListener("click", driverSpin);
    $("#tips-spin").addEventListener("click", tipsSpin);
    bindShop();

    $("#reset-btn").addEventListener("click", function () {
      askConfirm({
        title: "Tout effacer ?",
        message: cloud
          ? "Toutes les dépenses du voyage seront supprimées, pour tout le monde. Irréversible."
          : "Toutes les dépenses de cet appareil seront supprimées. Irréversible.",
        confirmLabel: "Tout effacer"
      }).then(function (yes) {
        if (!yes) return;
        if (cloud) {
          cloud.clearExpenses();
        } else {
          state.data.expenses = [];
          saveData();
          renderAll();
        }
        toast("Tout est effacé");
      });
    });
  }

  function gotoTab(name) {
    $all(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    $all(".tab-panel").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + name); });
    tabTrail = tabTrail.concat(name).slice(-3);
    if (name === "planning") renderAgenda();
    if (name === "voyage") {
      initTripMap();
      if (tripMap) tripMap.invalidateSize();
    }
    if (name === "tips") {
      buildTipsDisc();
      renderTipsHistory();
      if (!tipsSpinning) setTipsRigged(tabTrail.join() === "conduite,defis,tips");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ================= Démarrage ================= */

  function boot() {
    if (!CFG || !CFG.accounts || !CFG.accounts.length) {
      document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>Config manquante : vérifie js/config.js</p>";
      return;
    }
    loadData();
    initCloud();
    buildLogin();
    buildModalChoices();
    bindApp();

    var existing = currentSessionUser();
    if (existing) {
      state.user = existing;
      showApp();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
