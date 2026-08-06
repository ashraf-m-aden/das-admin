#!/bin/sh
# =============================================================================
# Génère /usr/share/nginx/html/config.json à partir des variables d'env
# du conteneur, au démarrage. Permet de déployer la MÊME image sur
# dev/staging/prod sans rebuild : seule la config runtime change.
# =============================================================================
set -e

CONFIG_PATH=/usr/share/nginx/html/config.json

cat <<EOF > "$CONFIG_PATH"
{
  "apiBaseUrl": "${API_BASE_URL:-https://api.das.dj}",
  "mapTileUrl": "${MAP_TILE_URL:-}",
  "cognitoUserPoolId": "${COGNITO_USER_POOL_ID:-}",
  "cognitoClientId": "${COGNITO_CLIENT_ID:-}",
  "environment": "${APP_ENVIRONMENT:-production}",
  "useMockApi": ${USE_MOCK_API:-true}
}
EOF

echo "config.json généré :"
cat "$CONFIG_PATH"
