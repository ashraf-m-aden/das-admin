# =============================================================================
# D.A.S Admin — Dockerfile multi-stage
# Stage 1 : build Angular (Node LTS)
# Stage 2 : service statique via nginx (image finale légère)
# =============================================================================

# ---- Stage 1 : build ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

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
