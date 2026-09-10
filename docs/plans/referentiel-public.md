# Référentiel public — carte, tuiles, recherche et clés d'accès

> Ce que D.A.S expose au monde extérieur : la carte publique, les tuiles vectorielles, la
> recherche, et le contrôle d'accès qui les protège.
>
> Périmètre : `das-admin` (carte `/carte`, écran `/cles-api`, style commercial) et `dasApi`
> (relais de tuiles, recherche, clés). Premier consommateur : la Plateforme 1 de La Poste
> (`laposteDas`).

---

## 1. La décision du 2026-09-10 : `cles-api` est le socle

Deux notions de clé coexistaient dans le dépôt, et il fallait trancher.

| | `core/clients` | `core/cles-api` |
|---|---|---|
| Concept | Un client commercial, son plan d'abonnement, ses accès par zone, **et** un jeton | Une clé délivrée à un consommateur |
| Routes back | `/clients/{id}/api-token` — **n'existent pas** | `/api/cles-api` — **vérifiées de bout en bout** |
| État | `status: 'mock'` dans `BACKEND_READINESS`, badge affiché à l'écran | Câblé, en service |

**Décision : `cles-api` est le socle du contrôle d'accès.** C'est lui qui délivre, vérifie et
révoque. Le modèle `clients` conserve sa raison d'être — la relation commerciale, l'abonnement,
la restriction par zone — mais **il ne doit pas porter un second système de jetons**.

> ⚠️ **`core/clients` n'est PAS du code mort et ne doit pas être supprimé.** C'est une
> fonctionnalité délibérément servie par un mock, déclarée telle dans `BACKEND_READINESS` et
> signalée par un badge à l'écran. Ma première recommandation disait « le reste, supprimé » ;
> elle était fondée sur une lecture incomplète — je croyais le port non fourni, alors qu'il l'est
> par `provideClientsApi()` avec une bascule mock/réel. Corrigé le 2026-09-10.

**Quand le back de `clients` existera** : son onglet « jeton d'API » doit déléguer à
`/api/cles-api` en passant le client comme consommateur, pas créer sa propre table. La restriction
par zone, elle, se posera sur la clé — c'est la seule pièce de `clients` qui manque réellement à
`cles-api` aujourd'hui.

---

## 2. La clé

Délivrée depuis `/cles-api`, réservée à l'`Admin` : ouvrir le référentiel à un tiers n'est pas une
opération courante.

### Ce qui est stocké, et ce qui ne l'est pas

**La clé en clair n'est jamais stockée.** Seuls son préfixe et une empreinte SHA-256 le sont. Elle
s'affiche une fois, à la création. Une clé perdue se révoque et se remplace — une fuite de la base
ne livre aucun accès.

Forme : `das_XXXXXXXX.<secret base64url>`. Le préfixe identifie la clé dans la liste sans la
révéler, et sert d'index à la vérification.

### ⚠️ SHA-256 et non BCrypt

Contrairement aux mots de passe. Une clé d'API est un secret **long et tiré au hasard** : elle n'a
rien à craindre d'une attaque par dictionnaire, que le coût de BCrypt sert précisément à ralentir.
Et ce coût serait rédhibitoire — une carte demande des centaines de tuiles par minute, chacune
vérifiée.

### ⚠️ Comparaison à temps constant

`CryptographicOperations.FixedTimeEquals`, jamais `==`. Une comparaison de chaînes s'arrête au
premier caractère différent : le temps de réponse révélerait alors combien de caractères sont
justes, et permettrait de reconstituer l'empreinte octet par octet.

### ⚠️ La clé est acceptée en en-tête ET en query string

`X-DAS-Key` ou `?cle=`. Les deux sont nécessaires : **MapLibre construit lui-même ses URL de
tuiles** et ne permet pas d'y ajouter un en-tête.

### La clé de la carte publique est publique

`mapPublicKey` dans `config.json` voyage dans les URL que le navigateur émet — exactement comme un
jeton Mapbox. Ce qu'elle apporte n'est pas le secret mais la **révocabilité** et l'**attribution** :
savoir qui consomme, et pouvoir couper.

### `LastUsedAtUtc` n'est écrit qu'une fois par heure

À chaque requête, une lecture deviendrait une écriture concurrente sur la même ligne, et le verrou
ferait chuter le débit.

---

## 3. ⛔ Le trou de sécurité fermé le 2026-09-10

`http://<hôte>/tiles/<source>/<z>/<x>/<y>` servait Martin **en clair, sans aucune
authentification**. Vérifié ce jour-là : `/tiles/quartiers_tiles/13/5077/3830` rendait **14 Ko de
données réelles**.

Et Martin **auto-publie tout ce que son rôle peut lire** — 34 sources au relevé, dont `Surveys`,
`Units` et `DiscoveryReports`. Ces trois-là ne fuyaient presque rien (9 relevés, 4 unités, 0
signalement), mais c'était une chance, pas une protection : à la première campagne, `Surveys`
portera des milliers de relevés géolocalisés.

Le système de clés livré la veille en devenait **décoratif** : pourquoi présenter une clé quand la
même tuile est en libre accès un chemin plus loin ?

### Les deux relais

| Route | Contrôle | Sources | Pour |
|---|---|---:|---|
| `/api/tiles/…` | Jeton de session (`?jeton=`) | 14 | Cartes d'administration |
| `/api/public/tiles/…` | Clé révocable (`?cle=` ou en-tête) | 5 | Carte publique et clients |

**Liste blanche des deux côtés, jamais une liste noire** : une source ajoutée à Martin ne doit pas
devenir accessible du seul fait qu'on a oublié de l'interdire. Vérifié : `/api/tiles/Surveys` rend
404 même avec un jeton valide.

### ⚠️ Le jeton de session voyage dans la query string

Pas dans un en-tête, et c'est la seule voie possible : MapLibre construit ses requêtes hors du
client HTTP d'Angular, aucun intercepteur ne les voit. La lecture de `?jeton=` est activée
**uniquement** sur `/api/tiles`, dans `JwtBearerEvents.OnMessageReceived` — aucune autre route ne
l'accepte ailleurs que dans l'en-tête.

Le compromis est borné et assumé : le jeton apparaît dans les journaux du proxy, il est de courte
durée.

### ⚠️ `/tiles/` est fermé par un 410 EXPLICITE

Sans ce bloc, le chemin retomberait dans le repli SPA et rendrait `200 text/html` pour une tuile :
un client verrait un succès et décoderait de l'`index.html` en protobuf, ce qui échoue sans rien
expliquer.

**Ne pas rétablir ce bloc sans avoir remis une authentification devant.**

### ⚠️ Le style admin est mis en cache avec le jeton du moment

`shareReplay(1)` dans `MapStyleService`. Après expiration de la session, les tuiles répondent 401
jusqu'au prochain chargement de l'application. Acceptable tant qu'une session dure plus qu'une
visite ; si ce n'est plus vrai, réémettre le style au rafraîchissement du jeton plutôt
qu'allonger sa durée de vie.

---

## 4. La carte publique

`/carte` — **hors du shell et sans `authGuard`**, le seul écran du dépôt accessible sans session.
Déclarée AVANT la route racine : Angular retient la première correspondance, et une route placée
dans les enfants du shell hériterait du guard.

**Aucune donnée ne transite par l'API au clic.** Tout ce que le panneau affiche est lu dans les
attributs de la tuile déjà chargée. C'est ce qui permet à l'écran de rester public : il n'y a rien
à autoriser, la tuile est la seule source.

### Le style commercial

`assets/commercial-style.json`, 20 couches, palette relevée sur Google Maps. **C'est le MÊME
fichier que celui publié aux clients** : La Poste le récupère tel quel et résout
`__TILES_BASE_URL__` avec son propre relais. On ne maintient pas deux rendus — ce que voit un
partenaire est ce que nous voyons.

### Le regroupement des lieux

`public.poi_sites_tiles` : **961 bâtiments deviennent 560 sites**. L'Université de Djibouti passe
de 72 pastilles à une seule.

> ⚠️ **Ce ne sont PAS des doublons.** Seuls **4 points sur 961** se superposent réellement à moins
> d'un mètre. Les 67 points de l'Université sont les bâtiments du campus, cartographiés un par un
> dans OSM. Les supprimer effacerait le campus. Le défaut était d'affichage, pas de donnée : rien
> n'est supprimé, `nour.poi_osm` et `public.poi_tiles` restent intacts.

Le regroupement est fait **en base et non dans le client** : MapLibre ne sait agréger (`cluster`)
que les sources GeoJSON, jamais les tuiles vectorielles.

> ⚠️ Le transtypage `::geometry(Point, 4326)` dans la vue est **obligatoire**. Sans lui,
> `array_agg` rend une géométrie sans typmod, `geometry_columns` la déclare `GEOMETRY` en SRID 0,
> et Martin refuse de publier la source — avec pour seule explication « does not exist ».

### Les codes postaux au survol

Surbrillance du quartier par `feature-state`, et médaillon flottant portant le code.

> ⚠️ Le `feature-state` précédent doit être **retiré explicitement**. MapLibre ne le fait pas :
> sans cela, chaque quartier traversé reste allumé et toute la ville finit surlignée.

---

## 5. La recherche

`GET /api/public/search` — villes, quartiers, rues nommées, lieux remarquables, parcelles
identifiées. **999 entrées** dans `public.recherche_index`, vue matérialisée.

Elle remplace une recherche qui fouillait les tuiles rendues : celle-ci ne voyait que l'emprise
visible, et chercher « Ambouli » depuis Balbala ne rendait rien.

### ⚠️ La vue ne se rafraîchit pas toute seule

Après un import ou une campagne de nommage :

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.recherche_index;
```

`CONCURRENTLY` exige l'index unique sur `cle` : sans lui, la vue est verrouillée pendant tout le
rafraîchissement et la recherche tombe.

### ⚠️ `unaccent()` n'est pas indexable

Elle est déclarée `STABLE` et non `IMMUTABLE`, et Postgres refuse toute fonction non immuable dans
une expression d'index. La forme normalisée est donc une **colonne** de la vue, calculée au
rafraîchissement, et c'est elle que l'index GIN trigramme couvre. Toute requête doit comparer sur
`normalise`, jamais sur `libelle`.

### Ce que la recherche ne fait pas

**Pas de tolérance aux fautes de frappe.** « ambuli » ne trouve pas « Ambouli ».
`EF.Functions.TrigramsAreSimilar` vient du paquet Npgsql, que la couche `Application` ne référence
pas — elle reste agnostique du fournisseur, et cette frontière n'a pas été cassée pour une
fonction. Ce n'est pas une perte de performance : un `LIKE '%…%'` est précisément ce qu'un index
`gin_trgm_ops` accélère. À rouvrir en exposant la similarité derrière une abstraction implémentée
dans Infrastructure, si l'usage le réclame.

**Les 36 163 parcelles ne sont pas indexées.** Un numéro seul (« 12 ») n'est pas un terme de
recherche : il n'a de sens qu'avec sa rue, et c'est la close qui portera ce lien. À rouvrir quand
les closes seront généralisées.

---

## 6. Ce que consomme La Poste

Le dépôt `laposteDas` attend trois URL, déclarées dans `src/environments/` :

```ts
map: {
  styleUrl: '/carto/commercial-style.json',  // style publie par D.A.S
  tilesUrl: '/tiles',                        // relaye par le back-end postal
  viewerUrl: 'https://carte.das.dj/carte',   // carte vitrine D.A.S
}
```

Son composant récupère le style en texte brut et remplace `__TILES_BASE_URL__` par l'URL de tuiles
de son environnement — exactement la mécanique de `MapStyleService`.

**Règle d'architecture, chapitre 2 de son cahier des charges : la Plateforme 1 ne s'adresse jamais
directement à D.A.S.** Son back-end relaie. Notre relais de tuiles applique le même principe un
cran plus bas — D.A.S relaie Martin.

### Les deux raccords, faits le 2026-09-10

**Le style est servi sous les deux chemins** — `/assets/commercial-style.json` et
`/carto/commercial-style.json`, le même fichier par un `alias` nginx. Plutôt que d'imposer à
l'autre dépôt de changer son environnement, ou de dupliquer le style, on répond aux deux.

> ⚠️ `alias` et non `root` : avec `root`, nginx concaténerait le chemin de la requête au dossier
> et chercherait `/usr/share/nginx/html/assets/carto/…`, qui n'existe pas.

**`/carte` lit les paramètres d'ouverture** : `?lat=&lng=&z=&marker=&label=`. C'est le contrat
d'ouverture depuis un consommateur externe — La Poste les construit exactement ainsi dans
`openInDasViewer()`.

> ⚠️ `marker` vaut « **longitude,latitude** » — l'ordre de MapLibre, pas celui de `lat`/`lng` qui
> l'accompagnent dans la même URL. Ces noms et cette forme viennent du dépôt La Poste et ne
> doivent pas changer sans prévenir l'autre côté.

Tout est facultatif et validé : un paramètre absent ou illisible rend le cadrage par défaut,
jamais une carte vide. Le zoom est borné à 19 — au-delà les tuiles n'existent plus et la carte se
vide, ce qui se lit comme une panne.

---

## 7. État et suites

**Fait** — clés (délivrance, révocation, écran), deux relais de tuiles, fermeture de `/tiles/`,
carte publique avec recherche, panneau de détail, survol des codes postaux, regroupement des lieux,
et les deux raccords avec La Poste (chemin du style, paramètres d'ouverture).

**À faire, par ordre d'utilité**

1. **Restriction par zone sur la clé** — la seule pièce de `clients` qui manque à `cles-api`.
2. **Sortir `.env` du dépôt** : il est versionné et porte `RDS_PASSWORD` et `DB_CONNECTION` en
   clair. Le back lit déjà AWS Secrets Manager.
3. **Automatiser `REFRESH MATERIALIZED VIEW`** dans les scripts d'import, plutôt que de le confier
   à la mémoire.
