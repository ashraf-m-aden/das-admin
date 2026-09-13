#!/usr/bin/env bash
# =============================================================================================
# Répare le déploiement de l'EC2 — cartes blanches et relais Martin resté ouvert.
#
#   bash reparer-ec2.sh            # SIMULATION : montre tout, n'écrit rien
#   bash reparer-ec2.sh --appliquer
#
# À lancer DEPUIS l'EC2, dans n'importe quel dossier :
#   ssh -i <cle>.pem ubuntu@<hôte>
#   curl -fsSLO https://raw.githubusercontent.com/ashraf-m-aden/das-admin/main/scripts/deploiement/reparer-ec2.sh
#   bash reparer-ec2.sh
#
# ---------------------------------------------------------------------------------------------
# CE QU'IL CORRIGE, ET POURQUOI LES CARTES SONT BLANCHES
# ---------------------------------------------------------------------------------------------
# Le dossier de déploiement n'est pas un clone du dépôt : c'est un assemblage manuel, et deux
# de ses fichiers sont MONTÉS dans les conteneurs. Reconstruire une image n'y change donc rien —
# le montage gagne toujours. Les images, elles, sont à jour : vérifié le 2026-09-13, le style
# servi porte bien ses dix sources et ses trois langues.
#
#   1. `.env` n'a pas MAP_PUBLIC_KEY  → config.json sert une clé vide → chaque tuile rend 401
#      C'est la carte publique D.A.S.
#   2. `.env` n'a pas LAPOSTE_DAS_KEY → le relais de la Plateforme 1 ne présente rien → 401
#   3. `nginx.conf` date du 17 août   → pas de `location /carto/`, donc le style de La Poste
#      retombe dans le repli SPA et rend `index.html`. `JSON.parse` échoue et la carte ne
#      s'affiche PAS DU TOUT — ce n'est pas un 401, c'est pire.
#   4. Le même `nginx.conf` n'a pas le `410` sur `/tiles/` → Martin est servi sans clé ni jeton,
#      35 sources publiées, dont `Surveys`, `Units` et `DiscoveryReports`.
#   5. Le même encore n'a pas `listen [::]:80` → le healthcheck tape `::1`, prend un refus, et
#      `das-admin` est `unhealthy` en boucle depuis le 17 août sur un site qui répond.
#
# ⚠️ L'ORDRE COMPTE. Le nouveau `nginx.conf` ferme `/tiles/`, et la carte d'ADMINISTRATION en
# dépend encore (`MAP_TILE_URL: "/tiles"`). Fermer sans corriger le compose lui coupe ses tuiles.
# Ce script fait donc les deux, ou aucun des deux.
# =============================================================================================

set -euo pipefail

DOSSIER="${DOSSIER:-$HOME/das-admin}"
BRUT="https://raw.githubusercontent.com/ashraf-m-aden/das-admin/main"

# ⚠️ Les deux clés se passent en VARIABLES, jamais écrites ici. Ce dépôt est public, et une clé
# committée est une clé publiée — le reste de ce fichier n'aurait aucun sens autrement.
#
#   MAP_PUBLIC_KEY_VAL='das_XXXXXXXX.…' \
#   LAPOSTE_DAS_KEY_VAL='das_YYYYYYYY.…' \
#   bash reparer-ec2.sh --appliquer
#
# Elles voyagent ensuite dans les URL de tuiles : publiques par nature, révocables par
# construction. Ce qu'elles apportent n'est pas le secret mais la révocabilité et l'attribution.
MAP_PUBLIC_KEY_VAL="${MAP_PUBLIC_KEY_VAL:-}"
LAPOSTE_DAS_KEY_VAL="${LAPOSTE_DAS_KEY_VAL:-}"

APPLIQUER=0
[ "${1:-}" = "--appliquer" ] && APPLIQUER=1

# On refuse d'écrire une clé vide plutôt que de « réussir » en laissant les cartes blanches :
# c'est précisément la panne qu'on vient réparer, et elle ne se signale nulle part.
#
# ⚠️ Une clé DÉJÀ dans `.env` suffit — c'est même la bonne façon de faire. Passée en variable sur
# la ligne de commande, elle se retrouve dans `~/.bash_history` et dans la liste des processus :
# préférer
#
#   printf 'MAP_PUBLIC_KEY=%s\n' 'das_…' >> .env      (ou l'écrire à l'éditeur)
#
# puis lancer ce script sans variable du tout.
if [ "$APPLIQUER" -eq 1 ]; then
  manquantes=""
  grep -q '^MAP_PUBLIC_KEY=.\+' "$DOSSIER/.env" 2>/dev/null || [ -n "$MAP_PUBLIC_KEY_VAL" ] \
    || manquantes="$manquantes MAP_PUBLIC_KEY"
  grep -q '^LAPOSTE_DAS_KEY=.\+' "$DOSSIER/.env" 2>/dev/null || [ -n "$LAPOSTE_DAS_KEY_VAL" ] \
    || manquantes="$manquantes LAPOSTE_DAS_KEY"
  if [ -n "$manquantes" ]; then
    printf '\n✗ Clé(s) introuvable(s), ni dans .env ni en variable :%s\n' "$manquantes" >&2
    printf '  Les clés se délivrent depuis l ecran /cles-api. Les poser dans .env :\n\n' >&2
    printf "    cd %s && printf 'MAP_PUBLIC_KEY=%%s\\\\n' 'das_…' >> .env\n\n" "$DOSSIER" >&2
    exit 1
  fi
fi

dire() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fait() { printf '  ✓ %s\n' "$*"; }
note() { printf '  · %s\n' "$*"; }

cd "$DOSSIER"

if [ "$APPLIQUER" -eq 0 ]; then
  dire "SIMULATION — rien ne sera écrit. Relancer avec --appliquer pour agir."
fi

# ── 0. Sauvegarde ────────────────────────────────────────────────────────────────────────────
dire "0. Sauvegarde"
SAUVE="$HOME/das-admin-sauvegarde-$(date +%Y%m%d-%H%M%S)"
if [ "$APPLIQUER" -eq 1 ]; then
  cp -a "$DOSSIER" "$SAUVE"
  fait "copie complète : $SAUVE"
else
  note "copierait $DOSSIER vers $SAUVE"
fi

# ── 1. nginx.conf et la configuration de Martin ──────────────────────────────────────────────
dire "1. Fichiers de configuration, depuis le dépôt"
for f in nginx.conf docker/martin/config.yaml; do
  if [ "$APPLIQUER" -eq 1 ]; then
    mkdir -p "$(dirname "$f")"
    curl -fsSL "$BRUT/$f" -o "$f.tmp"
    # On ne remplace qu'après téléchargement complet : une coupure réseau ne doit pas laisser
    # un nginx.conf tronqué, que nginx refuserait au redémarrage.
    mv "$f.tmp" "$f"
    fait "$f ($(wc -c < "$f") octets)"
  else
    note "téléchargerait $BRUT/$f"
  fi
done

# ── 2. Les deux clés manquantes ──────────────────────────────────────────────────────────────
dire "2. Clés dans .env"
ajouter_env() {
  local nom="$1" val="$2"
  if grep -q "^$nom=.\+" .env 2>/dev/null; then
    note "$nom déjà présent — laissé tel quel"
  elif [ -z "$val" ]; then
    note "$nom : aucune valeur fournie — rien fait"
  elif [ "$APPLIQUER" -eq 1 ]; then
    printf '%s=%s\n' "$nom" "$val" >> .env
    fait "$nom ajouté"
  else
    note "ajouterait $nom"
  fi
}
ajouter_env MAP_PUBLIC_KEY "$MAP_PUBLIC_KEY_VAL"
ajouter_env LAPOSTE_DAS_KEY "$LAPOSTE_DAS_KEY_VAL"

# ── 3. docker-compose.yml ────────────────────────────────────────────────────────────────────
dire "3. docker-compose.yml"
if [ "$APPLIQUER" -eq 1 ]; then
  python3 - "$DOSSIER/docker-compose.yml" <<'PY'
import re, sys

chemin = sys.argv[1]
s = open(chemin, encoding='utf-8').read()
avant = s

# 3a. La carte d'administration doit passer par le relais authentifie : /tiles rend 410 desormais.
s = re.sub(r'MAP_TILE_URL:\s*"/tiles".*', 'MAP_TILE_URL: "/api/tiles"', s)

# 3b. Les deux variables de la carte publique, posees juste apres.
if 'MAP_PUBLIC_KEY' not in s:
    s = s.replace(
        'MAP_TILE_URL: "/api/tiles"',
        'MAP_TILE_URL: "/api/tiles"\n'
        '      MAP_PUBLIC_TILE_URL: "/api/public/tiles"\n'
        '      MAP_PUBLIC_KEY: "${MAP_PUBLIC_KEY:-}"',
        1)

# 3c. Martin : sans --config il part en auto-detection et publie TOUT ce que son role peut lire.
if '--config' not in s:
    s = s.replace(
        '    image: ghcr.io/maplibre/martin:latest\n'
        '    container_name: martin\n',
        '    image: ghcr.io/maplibre/martin:latest\n'
        '    container_name: martin\n'
        '    command: ["--config", "/config.yaml", "--auto-bounds", "skip"]\n'
        '    volumes:\n'
        '      - ./docker/martin/config.yaml:/config.yaml:ro\n',
        1)

if s != avant:
    open(chemin, 'w', encoding='utf-8').write(s)
    print('  ✓ compose modifié')
else:
    print('  · compose déjà conforme')
PY
else
  note 'MAP_TILE_URL "/tiles" -> "/api/tiles"'
  note 'ajouterait MAP_PUBLIC_TILE_URL et MAP_PUBLIC_KEY au bloc das-admin'
  note 'ajouterait a martin : --config /config.yaml, et le montage du fichier'
fi

# ── 4. Validation, puis recréation ───────────────────────────────────────────────────────────
dire "4. Validation et recréation"
if [ "$APPLIQUER" -eq 1 ]; then
  # `config` relit tout et rend la main en erreur si le YAML ou une variable ne va pas. On le
  # passe AVANT de toucher aux conteneurs : un compose invalide arrêterait la pile sans la relever.
  docker compose config >/dev/null
  fait "docker compose config : valide"
  docker compose up -d --force-recreate das-admin martin das-laposte
  fait "das-admin, martin et das-laposte recréés"
else
  note "docker compose config, puis up -d --force-recreate das-admin martin das-laposte"
fi

# ── 5. Vérification ──────────────────────────────────────────────────────────────────────────
dire "5. Vérification"
if [ "$APPLIQUER" -eq 1 ]; then
  sleep 6
  v() { printf '  %-46s %s\n' "$1" "$(curl -s -o /dev/null -w '%{http_code} %{size_download}o' "$2" || echo ECHEC)"; }
  v "/tiles/ (doit etre 410)"                 "http://localhost/tiles/"
  v "/carto/...json (doit etre du JSON)"      "http://localhost/carto/commercial-style.json"
  # ⚠️ La clé est relue dans `.env`, jamais reprise de la variable : quand elle y était déjà,
  # la variable est vide et la vérification rendait un 401 alarmant sur une carte qui marche.
  CLE_VERIF="$(sed -n 's/^MAP_PUBLIC_KEY=//p' .env | head -1)"
  v "carte publique, tuile sous cle"          "http://localhost/api/public/tiles/quartiers_tiles/13/5077/3830?cle=$CLE_VERIF"
  v "La Poste (port 81)"                      "http://localhost:81/"
  printf '\n  type de /carto : %s\n' "$(curl -s -o /dev/null -w '%{content_type}' http://localhost/carto/commercial-style.json)"
  printf '  etat des conteneurs :\n'
  docker ps --format '    {{.Names}}  {{.Status}}'
else
  note "verifierait : /tiles = 410, /carto = JSON, tuile sous cle = 200, conteneurs healthy"
fi

dire "Terminé."
if [ "$APPLIQUER" -eq 0 ]; then
  printf 'Relancer avec : bash %s --appliquer\n\n' "$(basename "$0")"
else
  printf 'Retour arrière si besoin : rm -rf %s && cp -a %s %s\n\n' "$DOSSIER" "$SAUVE" "$DOSSIER"
fi
