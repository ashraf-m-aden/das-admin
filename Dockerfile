# =============================================================================
# D.A.S Admin — Dockerfile multi-stage
# Stage 1 : build Angular (Node LTS)
# Stage 2 : service statique via nginx (image finale légère)
# =============================================================================

# ---- Stage 1 : build ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

# ⚠️ Si ce `npm ci` casse sur « EUSAGE — Missing: … from lock file » alors que rien n'a
# changé dans les dépendances : le lock a été réécrit par un `npm install` lancé depuis
# Windows. npm y élague les binaires optionnels des AUTRES plateformes — ici le repli
# WebAssembly de rolldown (`@rolldown/binding-wasm32-wasi` et sa chaîne `@emnapi/*`) —
# que Linux, lui, réclame. Le build local continue de passer : seul celui-ci tombe.
#
#   Correction :  npm run lock:linux    (régénère le lock ici, dans cette image)
#
# ⚠️ Ne pas confondre avec l'AUTRE échec de cette étape, qui n'a rien à voir :
#
#   npm error code ECONNRESET
#   npm error network aborted
#
# Celui-là est un abandon de connexion pendant le téléchargement, pas un problème de lock —
# `npm run lock:linux` n'y changerait rien. L'arbre Angular pèse quelques centaines de paquets
# et la moindre coupure en plein tirage fait tomber le build entier, après une minute et demie
# de travail déjà fait. Les réglages ci-dessous laissent npm réessayer au lieu d'abandonner au
# premier incident.
#
# `NPM_CONFIG_*` plutôt qu'un `npm config set` : même effet, sans couche d'image en plus, et
# visible ici même quand on lit le fichier.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000

# `--no-audit --no-fund` : deux appels réseau de plus, dont la sortie n'est lue par personne
# dans un build. Sur une liaison instable, c'est autant d'occasions de tomber en moins.
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build -- --configuration=production

# ---- Stage 2 : runtime ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist/das-admin/browser /usr/share/nginx/html

COPY docker/env-config.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
