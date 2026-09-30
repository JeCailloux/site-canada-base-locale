#!/bin/sh
# Mise en ligne en une commande (depuis le PC, dans Git Bash) : ./deploy.sh
# 1. envoie les commits sur GitHub
# 2. sur le VPS : sauvegarde la base, récupère le code, redémarre PocketBase
#    (applique les nouvelles migrations) et recharge Caddy.
# Les iPhone se mettent à jour tout seuls au prochain retour sur l'app.
set -e
git push origin main
ssh ubuntu@51.178.54.226 '
  set -e
  cd ~/site-canada-base-locale
  docker cp caribou-pb:/pb_data ~/pb_backup-$(date +%Y%m%d-%H%M%S)
  git pull --ff-only
  docker compose restart pocketbase
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  git log -1 --oneline
'
echo "En ligne."
