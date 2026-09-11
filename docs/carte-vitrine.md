# Carte vitrine D.A.S — fond « façon Google Maps » et consommation par un tiers

Trois briques : la publication des tuiles (Martin), le style de carte, et l'écran
public qui l'expose aux partenaires.

> **À lire d'abord :** [`docs/plans/referentiel-public.md`](plans/referentiel-public.md) —
> les clés d'accès, les deux relais de tuiles et la fermeture de `/tiles/`. Ce
> document-ci décrit le RENDU ; celui-là décrit qui a le droit de le charger.

## 1. Martin : publication explicite

`docker/martin/config.yaml` est **monté** dans le conteneur (`docker-compose.yml`)
et Martin est lancé avec `--config`.

Avant, aucun fichier n'était monté : Martin tournait en auto-détection et
publiait **toutes** les tables géométriques de la base — 34 sources au relevé,
dont `Surveys`, `Units` et `DiscoveryReports`, des données de terrain qui n'ont
rien à faire dans un fond de carte, encore moins servi publiquement.

16 sources sont publiées, avec leur fenêtre de zoom :

| Source | Zooms | Rôle |
| --- | --- | --- |
| `contour_national` | 0–12 | terre émergée (peinte sur la mer) |
| `cities_tiles`, `cities_labels_tiles` | 4–14 | villes et leurs libellés |
| `route_principaux` | 7–13 | réseau structurant au dézoom |
| `voierie_secondaire` | 10–14 | voirie secondaire |
| `quartiers_tiles` | 9–20 | tache urbaine, limites, libellés |
| `streets_tiles` | 12–20 | voirie détaillée |
| `blocs_tiles` | 13–20 | îlots (texture bâtie) |
| `closes_tiles` | 13–20 | closes |
| `adresses_tiles` | 15–20 | parcelles |
| `poi_tiles` | 12–20 | points d'intérêt, bâtiment par bâtiment |
| `poi_sites_tiles` | 12–20 | les mêmes, **regroupés par site** — c'est celle-ci que la vitrine consomme |
| `ilots_extension`, `voierie_*` | 11–20 | couches SIG de travail (admin) |

Deux réglages viennent d'une mesure, pas d'une préférence :

* `streets_tiles` ne descend pas sous **z12** : une tuile z12 pèse 330 Ko
  (4 283 rues). Le dézoom est porté par `route_principaux` (23 tronçons,
  quelques kilo-octets), comme Google ne garde que les grands axes au niveau pays.
* `adresses_tiles` ne descend pas sous **z15** : 36 163 parcelles.

### ⚠️ Publier une source ≠ la rendre accessible

Martin n'est **pas** joignable depuis l'extérieur : `docker-compose.yml` ne publie
aucun port pour lui, et `/tiles/` rend un `410` depuis le 2026-09-10. Les tuiles
passent par l'API, qui valide l'appelant :

| Route | Contrôle | Sources |
| --- | --- | --- |
| `/api/tiles/…` | jeton de session (`?jeton=`) | 14 |
| `/api/public/tiles/…` | clé révocable (`?cle=`) | **5** |

**Liste blanche des deux côtés.** Ce fichier de configuration dit ce que Martin
publie ; il ne dit pas qui peut le demander. Ajouter une source ici ne la rend
donc pas visible de la carte publique — il faut aussi l'ajouter à la liste blanche
du relais public, côté back.

### Panne connue : Martin en boucle de redémarrage

`DATABASE_URL` pointe sur `host.docker.internal:5433`. Un tunnel SSH ouvert avec
`-L 5433:…` ne se lie qu'à `127.0.0.1` : le conteneur reçoit « Connection
refused » et redémarre en boucle. Ouvrir le tunnel sur toutes les interfaces :

```bash
ssh -L 0.0.0.0:5433:<hote-rds>:5432 <bastion>
```

## 2. Le style « façon Google Maps »

Généré, pas écrit à la main :

```bash
python scripts/map/build_styles.py      # -> commercial-style{,.en,.ar}.json, dans src/assets et public/assets
python scripts/map/patch_admin_style.py # aligne le FOND de map-style.json (admin)
```

* `scripts/map/palette.py` — teintes, polices, emprise : **source unique**.
* `scripts/map/basemap_layers.py` — sol, voirie hiérarchisée (contour +
  remplissage), libellés.
* `scripts/map/build_styles.py` — assemble **un style par langue**.
* `scripts/map/patch_admin_style.py` — applique la même palette au fond de
  `map-style.json` **sans toucher aux couches métier ni à leurs identifiants**
  (`basemap-groups.ts` les référence un par un ; un id renommé transforme une
  case à cocher en bouton inerte, sans erreur).

### Ce que le style vitrine NE contient pas

Le style vitrine se limite aux **cinq sources du relais public** :
`cities_labels_tiles`, `quartiers_tiles`, `streets_tiles`, `adresses_tiles`,
`poi_sites_tiles`. Ce qui en a été retiré, et ce que ça coûte à l'écran :

| Retiré | Conséquence visible |
| --- | --- |
| `contour_national` | **pas de mer** : le fond est la terre, le golfe de Tadjoura ne se distingue pas du désert |
| `route_principaux`, `voierie_secondaire` | **aucune route sous z12**, où `streets_tiles` ne rend rien |
| `blocs_tiles` | le sol reste nu entre z13 et z16, jusqu'aux parcelles |

Les rendre demande de les ajouter à la liste blanche de `/api/public/tiles/`,
côté back. Les couches existent déjà dans `basemap_layers.py` — elles ont été
retirées de `sources()` et des fonctions de couches, pas perdues ; l'historique
de `feat/carte-vitrine` les porte telles qu'elles étaient.

### Le rendu

Ce qui donne l'air d'un Google Maps : la voirie en deux passes
contour/remplissage avec une largeur qui suit le zoom, les libellés gris à halo
blanc, les lieux en pastille colorée par catégorie, la texture de parcelles à
partir de z16.

Deux détails appris en route :

* les emprises de villes sont des **rectangles administratifs** : en aplat, la
  carte affichait de grands carrés gris. La tache urbaine est portée par les
  quartiers, dont le contour suit le bâti ;
* les tronçons de rue sont courts (réseau éclaté en segments) : avec
  `symbol-placement: line`, MapLibre refusait de poser les noms de rue.
  `line-center` en pose un par tronçon.

### Le code postal est le sujet de cette carte

Trois mécanismes, tous nourris par la seule colonne `Postcode` de
`quartiers_tiles` :

1. **Le filigrane.** `77` pour Djibouti, `78` pour Ali Sabieh, en très grand et
   très pâle entre z8,5 et z12,5 (`postcode-watermark`). C'est la première moitié
   du code (`77` + `003` = `77003`) : le dézoom montre littéralement la même
   donnée que le zoom, tronquée.
2. **La hachure.** Les quartiers **sans** code postal sont hachurés plutôt que
   laissés vides (`quartiers-sans-code`). Mesuré le 2026-09-09 : 23 des 79
   emprises dessinables n'ont pas de code — 21 à Djibouti (`AreaNumber` absent),
   plus Dikhil et Tadjourah dont la ville n'a pas de `Code`. Un blanc se lirait
   comme un bug de rendu chez le partenaire ; une hachure se lit comme une
   information — le vide est un état, pas un défaut.
   > Le motif n'est pas dans un sprite : il est peint sur un canvas par le
   > composant, en réponse à `styleimagemissing`. Le nom de l'image doit rester
   > identique des deux côtés (`das-hachure-code-a-venir`).
3. **Le libellé de quartier.** Le code seul de z11 à z13, puis le code en vedette
   avec le nom en sous-titre. Sans code : le nom, et « code à venir » dessous.

### Trois langues, donc trois styles

Les seuls libellés traduisibles du fond — sous-catégories de lieux, « code à
venir » — sont écrits dans des expressions `match` imbriquées. Les réécrire à
l'exécution supposerait de connaître leur forme exacte : un couplage silencieux
qui casserait à la première refonte du style. D'où **un fichier statique par
langue**.

⚠️ `commercial-style.json` **sans suffixe est le français**, et c'est un contrat
externe (voir §4). Ne jamais le renommer ; les autres langues vivent à côté en
`commercial-style.<lang>.json`.

L'arabe demande deux choses de plus, sans lesquelles il sort en carrés vides ou à
l'envers :

* une police qui le couvre. Mesuré sur le CDN de glyphes, plage U+0600–06FF :
  `Open Sans Regular` rend 52 octets (aucun glyphe arabe), `Noto Sans Regular`
  52 349. D'où les piles composites `["Open Sans Bold", "Noto Sans Regular"]` —
  gras en latin, romain en arabe, faute de gras arabe sur ce CDN ;
* le greffon de mise en forme bidirectionnelle, servi **en local**
  (`public/assets/mapbox-gl-rtl-text.js`, pas depuis un CDN tiers) et posé avec
  `lazy: false` : il doit être là AVANT la première tuile arabe, sinon le premier
  rendu sort en carrés et n'est pas recalculé.

## 3. Écran vitrine `/carte`

Route **publique**, hors du shell authentifié (`features/carte-publique/`) : elle
est faite pour être ouverte par un partenaire, en lien ou en iframe. La passer
sous `authGuard` la renverrait sur l'écran de connexion et viderait l'iframe côté
partenaire.

Ni panneau de couches, ni état métier : chercher, cliquer, lire.

* **Recherche** sur tout le référentiel, servie par `GET /api/public/search`
  (index `public.recherche_index`). Chercher dans les tuiles rendues ne verrait
  que l'emprise visible — « Ambouli » depuis Balbala ne rendrait rien.
* **Clic** n'importe où : le plus précis l'emporte, lieu > parcelle > rue. Le
  quartier n'est jamais le sujet, il est le **contexte** — c'est lui qui porte le
  code postal, et il s'affiche donc en plus du reste.
* **Adresse postale** mise en forme comme elle s'écrirait sur un pli, avec un
  bouton « copier ». C'est le seul endroit de l'application où le code postal est
  présenté comme un produit et non comme une colonne.

| Paramètre | Effet |
| --- | --- |
| `lat`, `lng`, `z` | cadrage initial (`z` borné à 6–19) |
| `marker=lng,lat` | épingle (répétable) — **longitude d'abord**, l'ordre de MapLibre |
| `label=…` | libellé de la première épingle |
| `embed=1` | masque l'en-tête (iframe) |

```
http://localhost:4300/carte?lat=11.588&lng=43.145&z=16&marker=43.1425,11.5806&label=Agence%20Centrale
```

⚠️ Ces noms sont le **contrat d'ouverture** de la Plateforme 1 de La Poste
(`openInDasViewer()`). Ils ne changent pas sans prévenir l'autre dépôt.

## 4. Consommation par un tiers

`nginx.conf` renvoie `Access-Control-Allow-Origin: *` sur `/assets/` et
`/carto/` : sans cet en-tête, le navigateur du partenaire bloque le
téléchargement du style et sa carte reste vide, sans que rien n'apparaisse côté
serveur.

> Ce n'est pas une ouverture des données : ces deux chemins ne servent que des
> fichiers statiques déjà publics. Les **tuiles** et la **recherche**, elles,
> restent derrière une clé révocable.

Le même style est publié sous deux chemins — `/assets/commercial-style.json` et
`/carto/commercial-style.json`. Le second est celui que la Plateforme 1 attend
(`styleUrl: '/carto/commercial-style.json'`) : plutôt que d'imposer à l'autre
dépôt de changer son environnement, ou de dupliquer le fichier, on répond aux
deux.

Le partenaire récupère le style, remplace le marqueur `__TILES_BASE_URL__` par
l'URL de tuiles de son environnement, et passe le résultat à MapLibre — la
mécanique exacte de `MapStyleService`. C'est ce que fait La Poste de Djibouti
(`shared/components/das-map/`) : la cartographie reste propriété du référentiel,
elle n'est pas recopiée.
