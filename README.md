# 🍁 Caribou — version base locale (PocketBase)

Même app que [site-canada](https://github.com/JeCailloux/site-canada), mais la
synchro ne passe plus par Firebase : elle tourne sur **PocketBase**
(base SQLite auto-hébergée, 1 conteneur Docker) sur ton VPS.

- Site statique (HTML/CSS/JS) servi par **Caddy** (HTTPS auto).
- Données + temps réel via **PocketBase** derrière Caddy.
- 2 sous-domaines DuckDNS, même IP VPS :
  - `bastien-site.duckdns.org` → le site
  - `bastien-db.duckdns.org` → PocketBase (API + admin `/_/`)

## 1. DNS

DuckDNS → crée `bastien-db` (en plus de `bastien-site`), **même IP VPS**.

## 2. Déploiement VPS

```bash
cd ~
git clone https://github.com/JeCailloux/site-canada-base-locale.git
cd site-canada-base-locale
docker compose up -d
docker compose logs -f caddy   # attends "certificate obtained successfully" (x2)
```

Caddy prend un certificat pour chaque sous-domaine. Ports 80/443 libres et ouverts.

## 3. PocketBase : admin + collections (une fois)

Ouvre **https://bastien-db.duckdns.org/_/** → crée le compte admin.

Les collections `expenses` et `meta` (avec règles publiques) sont créées
**automatiquement** au démarrage par la migration `pb_migrations/1700000000_init.js`.
Rien à créer à la main.

*(Règles ouvertes = même posture que les règles Firestore ouvertes d'avant ; le
sous-domaine `bastien-db` obscur fait barrière. Pour durcir : règles + auth PocketBase.)*

## 4. Importer les anciennes données

`caribou-dump.json` (export Firestore) est dans le dépôt.

1. Ouvre **`import.html`** en local (double-clic) — ou sers-le temporairement.
2. URL PocketBase : `https://bastien-db.duckdns.org`.
3. **Importer** → pousse dépenses + défis + villes + randos + roue + taux.

À lancer **une seule fois** (relancer = doublons).

## 5. Fini

`https://bastien-site.duckdns.org` → login (4 comptes, cf `js/config.js`) → tout synchronisé via ta base.

## Config

Tout se personnalise dans [`js/config.js`](js/config.js) : comptes, mots de passe,
couleurs, nom du voyage, poids de la roue, et **`pbUrl`** (l'URL PocketBase).
`pbUrl: null` = mode 100% local (sans synchro).

## Mr. White

Onglet **Mr. White** → [`mrwhite.html`](mrwhite.html) : jeu Undercover, sur un seul téléphone
ou chacun le sien (code à 4 lettres, les invités sans compte peuvent rejoindre).
Les parties et les paires déjà jouées vivent dans la table `meta`
(`kind` = `mrwhite-game` / `mrwhite-used`). Les 2 000+ paires sont dans
[`js/mrwhite-mots.js`](js/mrwhite-mots.js), une par ligne, modifiables à la main.

Vérif logique + mots : `node tests/mrwhite.test.js`

## Sauvegarde

La base vit dans le volume Docker `pb_data`. Backup :
```bash
docker run --rm -v site-canada-base-locale_pb_data:/data -v $PWD:/backup alpine \
  tar czf /backup/pb-backup-$(date +%F).tar.gz -C /data .
```

## Mises à jour du site

```bash
cd ~/site-canada-base-locale && git pull && docker compose up -d
```

## Comptes par défaut

| Compte | Mot de passe |
|---|---|
| Bastien | poutine2026 |
| Léo | sirop2026 |
| Simon | orignal2026 |
| Axel | castor2026 |
