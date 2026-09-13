# État du déploiement — relevé du 2026-09-13

> Constat fait en lecture seule sur l'EC2 de production, depuis l'extérieur puis en SSH.
> Rien n'y a été modifié. Ce document dit ce qui a été **mesuré**, pas ce qui était supposé.
>
> ⚠️ Ce dépôt est public : ni adresse de la machine, ni secret, ni requête prête à l'emploi
> ne figurent ici. Les chemins nommés le sont déjà dans `plans/referentiel-public.md`.

---

## 1. Une seule cause, quatre pannes

**Le dossier de déploiement de l'EC2 n'est pas une copie du dépôt.** Ce n'est pas un clone git
(`not a git repository`), mais un dossier assemblé à la main qui contient sept fichiers :

```
.env                 6 variables, celles de la base uniquement
.env*                un fichier littéralement nommé « .env* » — une glob shell restée collée
docker-compose.yml   édité sur place, + un .bak
nginx.conf           du 17 août, 1 335 o    (le dépôt en fait 5 543)
map-style.json
public/
(aucun docker/martin/config.yaml)
```

Deux de ces fichiers sont **montés dans les conteneurs** et écrasent ce que l'image contient :

```yaml
volumes:
  - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

> ### ❗ La conséquence qui compte
> **Reconstruire et pousser `nejishow/das-admin` ne change rien sur cette machine.** Le montage
> gagne toujours. C'est la staleness de bundle du §8 de `CLAUDE.md` sous une forme que le
> changement de hash ne révèle pas : l'image est neuve, la configuration servie a un mois.

De ce seul écart découlent les quatre pannes ci-dessous.

---

## 2. Ce qui ne marche pas

### 2.1 ⛔ Le relais direct vers Martin est resté ouvert

Le `nginx.conf` déployé est antérieur au **2026-09-10** : il porte encore le `proxy_pass` vers
Martin et **pas le bloc `410`**. Le chemin `/tiles/` sert donc des tuiles à qui les demande, sans
présenter aucune clé ni aucun jeton.

Et il n'y a **pas de `docker/martin/config.yaml`** sur la machine : Martin y tourne avec une
commande vide, donc **en auto-détection**. Relevé : **35 sources publiées**, parmi lesquelles
`Surveys`, `Surveys.1`, `Units` et `DiscoveryReports` — les tables du recensement.

C'est exactement le trou que la fermeture du 2026-09-10 devait boucher. Il n'a jamais été fermé
là où ça comptait. **C'est le point à traiter en premier, indépendamment de tout le reste.**

### 2.2 La carte publique est blanche — `mapPublicKey` est vide

Le `.env` de l'EC2 ne contient que six variables, toutes liées à la base. Il manque
`MAP_PUBLIC_KEY`, et le bloc `das-admin` du compose déployé ne déclare ni `MAP_PUBLIC_TILE_URL`
ni `MAP_PUBLIC_KEY`. Le `config.json` servi porte donc une clé vide, et **chaque tuile de la
carte vitrine rend `401`**.

Ce n'était ni la liste blanche, ni le style, ni le front : une variable d'environnement absente.

### 2.3 La carte de La Poste est blanche — `LAPOSTE_DAS_KEY` est absente

Le conteneur le dit lui-même à chaque démarrage :

```
[das] ⚠️  DAS_KEY absente. Le style se chargera, les tuiles rendront 401
```

Mesuré : `quartiers_tiles → 401`, `contour_national → 401`.

### 2.4 `/carto/` rend `index.html`

Le `nginx.conf` déployé n'a **pas** le bloc `location /carto/`. La requête retombe donc dans le
repli SPA et rend **12 704 octets de `text/html`** avec un code `200`.

La Poste reçoit du HTML là où elle attend un style MapLibre : `JSON.parse` échoue, et **la carte
casserait même avec une clé valide**. C'est mot pour mot le piège que le `nginx.conf` du dépôt
décrit pour `/tiles/` — « un client verrait un succès et décoderait de l'index.html » — sur un
autre chemin, et non commenté celui-là.

### 2.5 `das-admin` est `unhealthy` en permanence

Même fichier : pas de `listen [::]:80`. Le healthcheck interroge `http://localhost/`, qui résout
d'abord en `::1`, et reçoit « Connection refused » à chaque passage. En boucle depuis le 17 août,
sur un site qui répond parfaitement.

---

## 3. Ce qui va bien

- **Le correctif de la liste blanche est déployé.** `das-backend` tourne sur l'image portant les
  dix sources publiques (`SourcesPubliques` élargie, `SourcesAdministration` devenue une union).
- **La Plateforme 1 est déployée** et saine, sur le **port 81**. Attention : le compose du dépôt
  propose `8080` par défaut — les deux ont divergé, et `8080` est de toute façon occupé sur au
  moins un poste de développement.
- **Seul le port 80 est ouvert** vers l'extérieur : 3000, 5000, 5433, 8080 et 8081 ne répondent
  pas. Martin n'est donc pas joignable directement — le trou du 2.1 passe par nginx, pas par un
  port publié.
- L'API répond et parle à sa base.

---

## 4. Les corrections, dans l'ordre

⚠️ **L'ordre compte.** Le `nginx.conf` du dépôt ferme `/tiles/`, et la carte d'administration en
dépend aujourd'hui (`MAP_TILE_URL: "/tiles"`). Fermer sans corriger le compose lui coupe ses
tuiles. Les étapes 1 et 3 vont ensemble.

1. **Déposer `nginx.conf` et `docker/martin/config.yaml`** depuis le dépôt vers le dossier de
   déploiement. C'est ce qui referme le trou et rend `das-admin` sain.
2. **Compléter le `.env`** avec `MAP_PUBLIC_KEY` et `LAPOSTE_DAS_KEY`.
3. **Aligner le bloc `das-admin` du compose** : `MAP_TILE_URL: "/api/tiles"`, plus
   `MAP_PUBLIC_TILE_URL` et `MAP_PUBLIC_KEY`.
4. **Ajouter à Martin** sa commande `--config /config.yaml --auto-bounds skip` et le montage du
   fichier de configuration.
5. `docker compose config` pour valider, puis recréer `das-admin`, `martin` et `das-laposte`.

Ce qui doit changer, et comment le vérifier :

| | avant | après |
|---|---|---|
| catalogue Martin par `/tiles/` | `200`, 35 sources | `410` |
| `/carto/…style.json` | `200`, 12 704 o de **HTML** | `200`, 24 072 o de JSON |
| `das-admin` | `unhealthy` | `healthy` |
| carte publique D.A.S | `401` sur chaque tuile | tuiles servies |
| carte La Poste (port 81) | `401` sur chaque tuile | tuiles servies |

Une sauvegarde horodatée du dossier a été faite avant toute chose : `~/das-admin-sauvegarde-<date>/`.

---

## 5. Secrets à tourner — ce n'est pas optionnel

Trois secrets sont dans l'historique **public** de ce dépôt. Les retirer de la copie de travail
ne les désexpose pas : l'historique les garde, et un dépôt public est moissonné.

| Secret | Où | Depuis |
|---|---|---|
| `RDS_PASSWORD` | `.env` | des semaines |
| `DB_CONNECTION` (compte `postgres`) | `.env` | des semaines |
| mot de passe du rôle Martin | **`docker-compose.yml`**, en clair | 30 août |

`.env` est sorti du suivi le 2026-09-13 et remplacé par un `.env.example`. **`docker-compose.yml`
porte toujours le mot de passe en dur** : le déploiement de l'EC2, lui, fait correctement
`${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}`, et c'est cette forme qu'il faut reprendre ici.

> La seule sortie est la ROTATION. Un retrait par commit ultérieur ne fait rien.

---

## 6. Le compose du dépôt n'est pas celui du serveur

Relevé en comparant les deux, et **la version de l'EC2 est meilleure sur tous les points** :

| | dépôt | EC2 |
|---|---|---|
| mot de passe Martin | en dur | depuis `.env` |
| hôte de la base | `host.docker.internal:5433`, un tunnel SSH | RDS en direct |
| `das-backend` | **absent** | présent |
| `nginx.conf` | monté sans `:ro` | `:ro` |
| `platform` | absent | `linux/amd64` |
| port de La Poste | `8080` | `81` |

Le fichier du dépôt décrit un poste de développement. Quelqu'un qui le lance obtient une pile
**sans API**. Il ne faut donc pas le copier tel quel sur le serveur — les corrections du §4 sont
ciblées pour cette raison.

Décision à prendre, et elle n'est pas technique : le dépôt suit l'EC2, ou l'inverse. Tant que les
deux divergent, chaque déploiement est une réinvention.

---

## 7. Ce qui reste non vérifié

- **Le lien de remise à usage unique.** `ClesApi:CleChiffrement` n'est pas configuré : une
  création de clé ne renvoie pas de `remiseJeton`. La remise décrite dans la note d'intégration
  n'a donc jamais fonctionné.
- **La recherche publique** (`/api/public/search`), jamais exercée avec une clé valide.
- **Le rendu réel des cartes** dans un navigateur, après correction. Tous les constats ci-dessus
  sont des codes et des tailles de réponse, pas des captures d'écran.
- **`das.dj` n'existe pas** — aucun enregistrement DNS au 2026-09-13, alors que le TLD `.dj`
  répond et que `laposte.dj` résout. Les documents qui portaient `carte.das.dj` ont été corrigés
  en `<hôte D.A.S>`.

---

## 8. Ce que ce relevé apprend sur la méthode

Quatre affirmations de la documentation ont été vérifiées ce jour-là. **Les quatre étaient
fausses** : l'ouverture des dix sources de tuiles, l'existence du domaine, la clé de recette
délivrée à La Poste, et la fermeture du relais direct. Chacune était écrite au passé dans un
document, et aucune n'avait été mesurée après coup.

Le tableau de vérification de la Plateforme 1 disait « vérifié le 2026-09-11 » pour le chargement
du style. La mesure avait été faite **au curl contre le proxy**, pas à travers l'application —
qui, elle, préfixait l'URL et demandait le style au mauvais domaine. Une vérification qui
contourne le code qu'elle prétend couvrir ne couvre rien.

> Écrire une décision n'est pas l'appliquer. Mesurer une brique n'est pas mesurer le chemin.
