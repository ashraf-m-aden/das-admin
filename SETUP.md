# D.A.S Admin — mise en place du projet Angular

## 1. Prérequis

```bash
node -v   # Node 22 LTS attendu (aligné avec le Dockerfile)
```

## 2. Générer le projet Angular (scaffold officiel via Angular CLI)

```bash
npm install -g @angular/cli@21

ng new das-admin \
  --standalone \
  --routing \
  --style=scss \
  --skip-git \
  --package-manager=npm

cd das-admin
```

## 3. Installer les dépendances métier

```bash
npm install @ngrx/store @ngrx/effects @ngrx/store-devtools
npm install @jsverse/transloco
npm install maplibre-gl
```

## 4. Fusionner ce dossier par-dessus le scaffold généré

Ce dossier (`das-admin-scaffold/`) contient tous les fichiers custom déjà
produits : `src/app/core/**`, `src/app/features/auth/**`, `src/styles/**`,
`src/assets/**`, `docker/`, `db/`, ainsi que `app.component.ts`,
`app.config.ts` et `app.routes.ts` qui REMPLACENT les versions générées par
`ng new`.

```bash
# Depuis la racine de das-admin/ (le projet généré à l'étape 2)
cp -r ../das-admin-scaffold/src/app/core        src/app/
cp -r ../das-admin-scaffold/src/app/features    src/app/
cp    ../das-admin-scaffold/src/app/app.component.ts src/app/
cp    ../das-admin-scaffold/src/app/app.config.ts    src/app/
cp    ../das-admin-scaffold/src/app/app.routes.ts    src/app/

cp -r ../das-admin-scaffold/src/styles          src/
cp    ../das-admin-scaffold/src/styles.scss     src/

cp -r ../das-admin-scaffold/src/assets/i18n     src/assets/
cp    ../das-admin-scaffold/src/assets/map-style.json src/assets/

cp -r ../das-admin-scaffold/docker              .
cp -r ../das-admin-scaffold/db                  .
cp    ../das-admin-scaffold/Dockerfile          .
cp    ../das-admin-scaffold/docker-compose.yml  .
cp    ../das-admin-scaffold/nginx.conf          .
```

Dans `angular.json`, vérifier que `styles` pointe bien vers
`src/styles.scss` et ajouter `"stylePreprocessorOptions": { "includePaths": ["src"] }`
sous `build.options` (nécessaire pour que `@use "styles/variables"`
fonctionne depuis les composants).

## 5. Lancer en local (mode mock actif par défaut)

```bash
npm start
# -> http://localhost:4200/login
# Comptes de démo : admin / superviseur / agent — mot de passe : das2026
```

Ou via Docker :

```bash
docker compose up das-admin-dev
```

## 6. Passer à l'API .NET réelle (quand elle sera prête)

Une seule variable à changer, dans `docker-compose.yml` (service
`das-admin`) ou la config du conteneur en prod :

```yaml
environment:
  USE_MOCK_API: "false"
```

Aucun fichier `.ts` à toucher — voir `DAS_Module_Auth.md` pour le détail du
mécanisme de bascule (`auth-api.provider.ts`).

## Notes

- `src/app/features/dashboard/dashboard.component.ts` est référencé dans
  `app.routes.ts` mais pas encore créé (prochain module).
- `src/assets/logo.svg` est référencé dans le login mais pas encore fourni.
