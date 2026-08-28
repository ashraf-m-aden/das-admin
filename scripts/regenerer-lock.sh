#!/usr/bin/env bash
# =============================================================================
# Régénère package-lock.json DANS L'IMAGE DE BUILD (Linux), pas sous Windows.
#
# ── Pourquoi ce script existe ────────────────────────────────────────────────
# `npm install` lancé sous Windows ÉLAGUE du lock les binaires optionnels des
# autres plateformes — ici `@rolldown/binding-wasm32-wasi` et sa chaîne
# `@emnapi/*`, plus une résolution différente de `chokidar@3.6.0`. Ces entrées
# sont indispensables à Linux : sans elles, le `npm ci` du Dockerfile s'arrête
# sur `EUSAGE — Missing: … from lock file` et l'image ne se construit plus.
#
# Le piège est que RIEN ne le signale : les dépendances déclarées n'ont pas
# bougé, `npm install` répond « up to date », le build local passe. Seul le
# build Docker casse, et souvent bien plus tard.
#
# Conséquence pratique : **après tout `npm install`, `npm i`, `npm remove` ou
# `npm update` fait sur le poste Windows, relancer ce script avant de commiter.**
#
# ── Ce qu'il fait ────────────────────────────────────────────────────────────
# 1. Génère le lock dans la même image que le Dockerfile.
# 2. Vérifie que `npm ci` l'accepte — c'est le contrôle qui compte.
# 3. N'écrit le fichier QUE si les deux étapes passent.
#
#   bash scripts/regenerer-lock.sh
# =============================================================================

set -euo pipefail

# Doit rester identique au `FROM ... AS build` du Dockerfile : un lock validé
# sur une autre image ne prouve rien sur celle qui construit réellement.
IMAGE_BUILD="node:22-alpine"

cd "$(dirname "$0")/.."
RACINE="$(pwd)"

if [ ! -f package.json ]; then
  echo "package.json introuvable dans $RACINE" >&2
  exit 1
fi

# Git Bash réécrit les chemins façon Windows dans les arguments Docker.
export MSYS_NO_PATHCONV=1
MONTAGE_PKG="$(echo "$RACINE" | sed 's|^\([A-Za-z]\):|/\L\1|')/package.json"

TEMPO="$(mktemp)"
trap 'rm -f "$TEMPO"' EXIT

echo "→ génération du lock dans $IMAGE_BUILD…"
# On passe par la sortie standard plutôt que par un montage en écriture : le
# montage d'un dossier hôte depuis Git Bash vise un /tmp qui n'est pas celui du
# conteneur, et le fichier atterrit ailleurs sans que rien n'échoue.
docker run --rm \
  -v "$MONTAGE_PKG:/src/package.json:ro" \
  "$IMAGE_BUILD" \
  sh -c 'mkdir -p /work && cp /src/package.json /work/ && cd /work \
         && npm install --package-lock-only >/dev/null 2>&1 \
         && cat package-lock.json' > "$TEMPO"

if [ ! -s "$TEMPO" ]; then
  echo "✗ lock vide — package-lock.json laissé intact." >&2
  exit 1
fi

echo "→ vérification : npm ci accepte-t-il ce lock ?"
# Le lock candidat est copié à côté du package.json réel : `npm ci` compare les
# deux, il faut donc les lui présenter ensemble.
cp "$TEMPO" "$RACINE/package-lock.json.candidat"
MONTAGE_CANDIDAT="$(echo "$RACINE" | sed 's|^\([A-Za-z]\):|/\L\1|')/package-lock.json.candidat"

if docker run --rm \
     -v "$MONTAGE_PKG:/app/package.json:ro" \
     -v "$MONTAGE_CANDIDAT:/app/package-lock.json:ro" \
     -w /app "$IMAGE_BUILD" \
     sh -c 'npm ci >/dev/null 2>&1'; then
  mv "$RACINE/package-lock.json.candidat" "$RACINE/package-lock.json"
  echo "✓ package-lock.json régénéré et validé par npm ci."
else
  rm -f "$RACINE/package-lock.json.candidat"
  echo "✗ npm ci refuse le lock généré — package-lock.json laissé intact." >&2
  exit 1
fi
