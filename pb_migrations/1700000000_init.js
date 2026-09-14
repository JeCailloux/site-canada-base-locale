/// <reference path="../pb_data/types.d.ts" />
// Crée les collections `expenses` et `meta` avec règles publiques.
// Appliqué automatiquement au démarrage de PocketBase (dossier pb_migrations).

migrate((db) => {
  const txt = (name) => ({ name: name, type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  const num = (name) => ({ name: name, type: "number", required: false, options: { min: null, max: null, noDecimal: false } });
  const json = (name) => ({ name: name, type: "json", required: false, options: { maxSize: 2000000 } });
  // collections déjà créées à la main (base existante) : ne rien toucher
  const exists = (name) => { try { Dao(db).findCollectionByNameOrId(name); return true; } catch (e) { return false; } };

  if (!exists("expenses")) {
  const expenses = new Collection({
    name: "expenses",
    type: "base",
    listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
    schema: [
      txt("title"), num("amount"), txt("currency"), txt("payerId"),
      json("participants"), txt("category"), txt("date"), txt("type"),
      txt("createdBy"), txt("createdAt")
    ]
  });
  Dao(db).saveCollection(expenses);
  }

  if (!exists("meta")) {
  const meta = new Collection({
    name: "meta",
    type: "base",
    listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
    schema: [ txt("kind"), json("data") ]
  });
  Dao(db).saveCollection(meta);
  }
}, (db) => {
  const dao = Dao(db);
  try { dao.deleteCollection(dao.findCollectionByNameOrId("expenses")); } catch (e) {}
  try { dao.deleteCollection(dao.findCollectionByNameOrId("meta")); } catch (e) {}
});
