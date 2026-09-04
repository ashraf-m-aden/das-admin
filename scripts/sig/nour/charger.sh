#!/usr/bin/env bash
# Chargement du schema "nour" — D.A.S
#
#   ./charger.sh "<conn psql>" [<dossier des dumps>]
#
# Les dumps volumineux (18 Mo) ne sont PAS versionnes : par defaut ils sont
# cherches dans ../../../../sig-nour (soit D:\projet\angular project\das\sig-nour),
# regeneres par gen_nour.py depuis les fichiers de l'expert.
set -euo pipefail
CONN="${1:?Chaine de connexion psql attendue}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DUMPS="${2:-$HERE/../../../../sig-nour}"

[ -d "$DUMPS" ] || { echo "Dossier de dumps introuvable : $DUMPS" >&2; exit 1; }

run() { echo "=== $(basename "$1")"; psql "$CONN" -v ON_ERROR_STOP=1 -q -f "$1"; }

run "$HERE/00_schema.sql"
for f in $(ls -1 "$DUMPS"/[0-9][0-9]_*.sql | sort); do run "$f"; done
run "$HERE/90_post.sql"
run "$HERE/91_controle.sql"

echo "=== termine"
psql "$CONN" -c "SELECT * FROM nour.v_inventaire ORDER BY couche;"
