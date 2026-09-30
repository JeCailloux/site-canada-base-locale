/// <reference path="../pb_data/types.d.ts" />
// Suppression douce + journal :
//  - expenses / meta : champs deletedAt / deletedBy (enregistrement inactif, jamais effacé)
//  - suppression via l'API interdite (deleteRule = null → admin seulement)
//  - collection `logs` : qui a créé / modifié / supprimé / restauré quoi (ajout seul, non modifiable)

migrate((db) => {
  const dao = new Dao(db);
  const txt = (name) => new SchemaField({ name: name, type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  const json = (name) => new SchemaField({ name: name, type: "json", required: false, options: { maxSize: 2000000 } });

  ["expenses", "meta"].forEach((name) => {
    const c = dao.findCollectionByNameOrId(name);
    if (!c.schema.getFieldByName("deletedAt")) c.schema.addField(txt("deletedAt"));
    if (!c.schema.getFieldByName("deletedBy")) c.schema.addField(txt("deletedBy"));
    c.deleteRule = null;
    dao.saveCollection(c);
  });

  try { dao.findCollectionByNameOrId("logs"); } catch (e) {
    dao.saveCollection(new Collection({
      name: "logs",
      type: "base",
      listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null,
      schema: [txt("at"), txt("user"), txt("action"), txt("coll"), txt("recordId"), txt("label"), json("before"), json("after")]
    }));
  }
}, (db) => {
  const dao = new Dao(db);
  ["expenses", "meta"].forEach((name) => {
    const c = dao.findCollectionByNameOrId(name);
    c.deleteRule = "";
    dao.saveCollection(c);
  });
});
