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

### La remise à usage unique — 2026-09-11

Le secret était montré une fois à l'écran, puis transmis **par courriel**. Il y existe alors
indéfiniment, dans deux boîtes, répliqué sur les serveurs, les sauvegardes et les téléphones, et
indexé par la recherche. On ne peut ni le rappeler, ni savoir qui l'a lu. La promesse ci-dessus ne
décrivait donc plus que **notre** base.

La délivrance prépare désormais un lien qui rend le secret **une fois**, puis l'efface :

```
POST /api/cles-api             → secret + jeton de remise   (protégé)
GET  /api/cles-api/remise/{j}  → le secret, une seule fois   (ANONYME)
```

La route de récupération est anonyme **et doit l'être** : le destinataire n'a pas de compte D.A.S,
c'est tout l'intérêt. Ce qui la protège est le jeton — 256 bits tirés au hasard, dont seule
l'empreinte SHA-256 est stockée.

> ⚠️ **Cette table DÉROGE à la règle « le secret n'est jamais stocké ».** Une remise oblige à le
> conserver, sinon il n'y a rien à remettre. Ne pas lire `CleApiPublique` comme si cette
> dérogation n'existait pas.

Quatre choses la bornent, et doivent le rester :

| | |
|---|---|
| Chiffré **AES-GCM** | avec `ClesApi:CleChiffrement`, 32 octets base64 en variable d'environnement — **jamais en base**. Un dump ne livre que du chiffré. |
| **GCM et non CBC** | il authentifie. Un octet modifié fait lever, au lieu de rendre un secret silencieusement faux que le destinataire collerait dans sa configuration. |
| Effacé **à la lecture** | dans la même transaction, et l'enregistrement précède la réponse — sinon deux lectures concurrentes repartiraient toutes deux avec la clé. |
| **Expire** | 72 h par défaut, lu ou non. |

La ligne, elle, n'est jamais supprimée : savoir **quand** une clé a été récupérée — ou qu'elle ne
l'a jamais été — fait partie de la trace de ce qui a été délivré. C'est précisément ce qu'un
courriel ne dit jamais.

**Sans clé de chiffrement configurée, la remise est simplement désactivée** : la délivrance
continue et le secret s'affiche une fois à l'écran, comme avant. Un déploiement qui oublie la
configuration perd une commodité, il ne casse rien.

> ⚠️ Tout échec rend le **même 404** — jeton inconnu, déjà consommé, expiré, malformé, ou chiffré
> devenu illisible après une rotation de la clé de chiffrement. Même discipline que le `401` des
> clés.

> ⚠️ **Le lien complet est composé par le FRONT**, sur l'origine courante. Le back ne connaît pas
> l'URL publique sous laquelle on le joint — derrière nginx, en local, depuis un tunnel — et la lui
> faire deviner produirait des liens morts, découverts par le destinataire et pas par nous.

### La clé de la carte publique est publique

`mapPublicKey` dans `config.json` voyage dans les URL que le navigateur émet — exactement comme un
jeton Mapbox. Ce qu'elle apporte n'est pas le secret mais la **révocabilité** et l'**attribution** :
savoir qui consomme, et pouvoir couper.

### La portée : une clé peut ne voir qu'une partie du pays

Une clé porte une liste de **villes**. **Liste vide = tout le pays**, et c'est le défaut : la
restriction est l'exception, pour un partenaire dont l'accord ne couvre qu'une partie du
territoire.

**La ville, et non la `Zone` du modèle géographique.** Une `Zone` raffine une commune, et seule
Djibouti-ville est découpée en communes : restreindre par zone ne saurait rien dire d'un
partenaire travaillant à Ali-Sabieh. La ville découpe le pays entier — c'est la seule maille qui
réponde à la question posée.

> C'était l'item « restriction par zone » de la liste des suites ; le nom a suivi le domaine.

### ⚠️ La portée est figée à la délivrance

Élargir ou réduire ce qu'un partenaire voit sans qu'il change de clé rendrait impossible de dire,
après coup, ce qui lui a été servi. Changer de portée = révoquer et redélivrer.

### ⚠️ L'emprise est CALCULÉE, jamais stockée sur la clé

Le contrôle des tuiles compare la tuile demandée à l'enveloppe géographique des villes autorisées.
Cette enveloppe est lue en base et gardée **dix minutes** en mémoire, pas figée à la délivrance.

La raison est mesurable : les emprises de villes ont déjà été recalculées deux fois dans ce projet
(`cities-emprise-depuis-quartiers.sql`, `cities-emprise-depuis-nour-ville.sql`). Une enveloppe
copiée sur la clé serait aujourd'hui périmée — et périmée **en silence**, ce qui est le pire défaut
possible pour un contrôle d'accès.

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

### Ce que la portée fait sur une tuile

Une clé restreinte ne reçoit que les tuiles qui **touchent** l'emprise de ses villes. Le test est
une intersection, pas une inclusion : aux petits zooms une tuile couvre le pays entier, et exiger
qu'elle tienne dans la ville viderait la carte là où elle est légitime. Aucun seuil de zoom n'est
nécessaire — l'intersection sert naturellement tout ce qui touche la zone et ne refuse que ce qui
en est entièrement dehors, ce qui, aux grands zooms où la tuile est petite, est exactement la
restriction voulue.

Vérifié sur la tuile réellement demandée par le front, `z13/5077/3830` : elle couvre
`lon [43.1104, 43.1543] · lat [11.5661, 11.6092]` — elle contient Djibouti-ville et exclut
Ali-Sabieh.

> ⚠️ La latitude n'est pas linéaire en `y` : Mercator étire les hautes latitudes. Interpoler
> linéairement — l'erreur naturelle — donnerait une emprise fausse partout sauf à l'équateur.
> D'où `atan(sinh(…))`.

### ⚠️ Le CONTENU d'une tuile n'est pas filtré

Une tuile servie au bord de la zone porte des objets situés au-delà. Les filtrer imposerait de
rendre **une tuile par clé**, ce qui détruirait le cache partagé pour un gain nul : la donnée
reste le référentiel public. Ce que la restriction borne, c'est l'**étendue** de ce qu'une clé peut
moissonner, pas le contenu d'une tuile isolée.

### ⚠️ Une tuile hors portée rend 404, pas 403

La même réponse qu'une source inconnue. Dire « cette tuile existe mais pas pour vous »
apprendrait à un partenaire restreint où s'arrête sa zone, et l'emprise servie n'est pas une
information qu'on lui doit. Côté carte, une tuile absente et une tuile refusée se dessinent
pareil : rien.

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

**Il est généré, pas écrit à la main** : `python scripts/map/build_styles.py` rend **un fichier
par langue** à partir de `scripts/map/palette.py` et `basemap_layers.py`. Les seuls libellés
traduisibles du fond — sous-catégories de lieux, « code à venir » — vivent dans des expressions
`match` imbriquées ; les réécrire à l'exécution supposerait de connaître leur forme exacte, un
couplage silencieux qui casserait à la première refonte du style.

> ⚠️ `commercial-style.json` **sans suffixe est le français**, et c'est un contrat externe : c'est
> ce nom que `nginx.conf` publie sous `/carto/` et que La Poste récupère. Ne jamais le renommer ;
> les autres langues s'ajoutent à côté en `commercial-style.<lang>.json`.

> ⚠️ **Le style ne peut contenir que les cinq sources de la liste blanche.** Une source ajoutée au
> style sans l'être au relais public ne se signale PAS : le relais rend 404 — la même réponse
> qu'une source inconnue — la couche reste vide, et le fond a simplement l'air incomplet. Le
> générateur documente ce qui a été retiré pour tenir dans la liste (terre et trait de côte, réseau
> structurant du dézoom, îlots) et ce que ça coûte à l'écran, dans `docs/carte-vitrine.md`.

### Le code postal est le sujet de la carte

Trois mécanismes, tous nourris par la seule colonne `Postcode` de `quartiers_tiles` :

1. **Le filigrane** `77` / `78` entre z8,5 et z12,5. C'est la première moitié du code
   (`77` + `003` = `77003`) : le dézoom montre la même donnée que le zoom, tronquée.
2. **La hachure** des quartiers sans code — 23 des 79 emprises dessinables au relevé du
   2026-09-09. Un blanc se lirait comme un bug de rendu chez le partenaire ; une hachure se lit
   comme une information. Le vide est un état, pas un défaut.
3. **Le libellé de quartier**, qui passe du code seul au code + nom à z13.

> ⚠️ Le motif de hachure n'est **pas dans un sprite** : le style ne déclare que `glyphs`, et en
> ajouter un imposerait un asset externe de plus à servir. Il est peint sur un canvas par le
> composant, en réponse à `styleimagemissing` — et non au `load`, sinon la couche est rendue avant
> l'ajout de l'image et MapLibre ne dessine rien, sans erreur. Le nom de l'image
> (`das-hachure-code-a-venir`) doit rester identique dans le composant et dans
> `scripts/map/basemap_layers.py`.

### L'arabe demande deux choses de plus

Sans elles, il sort en carrés vides ou à l'envers :

* une **police qui le couvre**. Mesuré sur le CDN de glyphes, plage U+0600–06FF :
  `Open Sans Regular` rend 52 octets — aucun glyphe arabe — et `Noto Sans Regular` 52 349. D'où
  les piles composites `["Open Sans Bold", "Noto Sans Regular"]` : gras en latin, romain en arabe,
  faute de gras arabe sur ce CDN ;
* le **greffon bidirectionnel**, servi depuis `public/assets/` et non depuis un CDN tiers, posé
  avec `lazy: false`. La mise en forme contextuelle se fait dans le worker de MapLibre, pas dans
  le navigateur — et le greffon doit être là AVANT la première tuile arabe, sinon le premier rendu
  sort en carrés et n'est jamais recalculé. Il est GLOBAL : le reposer lève une erreur, d'où le
  contrôle de `getRTLTextPluginStatus()`.

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

### La sélection du quartier

Surbrillance du quartier **cliqué** par `feature-state` — remplissage et contour, tous deux
déclarés dans le style, la règle du dépôt voulant que `feature-state` serve la sélection et non la
coloration de base.

> ⚠️ Le `feature-state` précédent doit être **retiré explicitement**. MapLibre ne le fait pas :
> sans cela, chaque quartier sélectionné reste allumé et toute la ville finit surlignée.

> ⚠️ `setStyle()` — au changement de langue — repart d'un style neuf : la sélection posée et les
> images ajoutées à la volée sont perdues. Il faut les reposer.

> **Historique.** Un médaillon flottant affichait le code au **survol**. Il a été remplacé le
> 2026-09-11 : le filigrane et le libellé de quartier portent déjà le code, en continu et sans
> qu'il faille promener la souris. Un médaillon de plus disait la même chose une troisième fois.

---

## 5. La recherche

`GET /api/public/search` — villes, quartiers, rues nommées, lieux remarquables, parcelles
identifiées. **999 entrées** dans `public.recherche_index`, vue matérialisée.

Elle remplace une recherche qui fouillait les tuiles rendues : celle-ci ne voyait que l'emprise
visible, et chercher « Ambouli » depuis Balbala ne rendait rien.

### ⚠️ Elle exige une clé depuis le 2026-09-10

Elle ne demande toujours aucun **compte** D.A.S — mais elle demande une **clé**, comme les tuiles.
La laisser ouverte pendant que les tuiles étaient fermées rendait la clé contournable : la
recherche rend le référentiel entrée par entrée, avec ses coordonnées. Une clé restreinte ne voit
que ses villes.

### Le rattachement à une ville se fait par jointure SPATIALE

`recherche_index` porte une colonne `ville_id`, calculée au rafraîchissement en cherchant quelle
emprise de ville contient le point de l'entrée. Pas par clé étrangère : les cinq branches de
l'UNION viennent de cinq tables qui ne portent pas toutes le même lien vers la ville —
`poi_sites_tiles` vient d'OSM et n'en a aucun. Le point, lui, existe partout.

> ⚠️ `ORDER BY ST_Area` : si deux emprises se chevauchent, on retient la **plus petite** qui
> contient le point. Sans cet ordre, le résultat dépendrait du plan d'exécution et changerait
> tout seul d'un rafraîchissement à l'autre.

**Une entrée sans ville n'est servie qu'aux clés non restreintes.** Une clé vendue pour une ville
ne doit pas recevoir ce qu'on ne sait pas rattacher : une restriction qui laisse passer ce qu'elle
ne sait pas classer n'est pas une restriction. Le script d'index compte ce reliquat à chaque
rafraîchissement, pour qu'il ne reste jamais inconnu.

### Le rafraîchissement est branché sur les neuf scripts d'import

`recherche_index` est matérialisée : elle ne se met pas à jour toute seule. Les neuf scripts qui
écrivent ses tables sources se terminent désormais par :

```sql
\ir rafraichir-recherche.sql
```

**Un fichier inclus, et non la commande recopiée neuf fois.** Le jour où le rafraîchissement
change, une copie oubliée ne se signalerait pas : elle continuerait de tourner en produisant
autre chose que les huit autres.

> ⚠️ `\ir` et non `\i` : `\ir` résout le chemin relativement au **script incluant**, `\i`
> relativement au répertoire courant de psql. Avec `\i`, l'inclusion ne marcherait que si l'on
> lance psql depuis le bon dossier — c'est-à-dire par hasard. Vérifié depuis la racine du dépôt,
> depuis `scripts/sig/nour/` et depuis `/tmp` : les trois résolvent.

> ⚠️ L'inclusion se place **après le `COMMIT`**, jamais entre `BEGIN` et `COMMIT` : Postgres
> refuse `REFRESH ... CONCURRENTLY` dans un bloc de transaction. Et `CONCURRENTLY` exige l'index
> unique sur `cle` — sans lui la vue serait verrouillée pendant tout le rafraîchissement et la
> recherche publique tomberait, en pleine journée.

L'enjeu a grandi avec `ville_id` : une entrée absente de l'index n'est plus seulement
introuvable, elle est **invisible au partenaire restreint qui a payé pour la voir**.

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

### La recherche sous clé ne change rien pour eux

`laposteDas` appelle `/addresses/search` sur **son propre back-end**, pas
`/api/public/search` chez nous : le fermer derrière une clé ne les touche pas. Le jour où leur
back relaiera notre recherche, il présentera la clé comme il présente déjà la sienne pour les
tuiles.

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

**Fait** — clés (délivrance, révocation, écran, **portée par ville**), deux relais de tuiles,
fermeture de `/tiles/`, recherche sous clé, carte publique avec recherche, panneau de détail,
code postal en vedette (filigrane, hachure, adresse postale), style généré en trois langues,
regroupement des lieux, et les deux raccords avec La Poste (chemin du style, paramètres
d'ouverture).

**Suites** — ouvrir cinq sources de plus sur le relais public (`contour_national`, `cities_tiles`,
`route_principaux`, `voierie_secondaire`, `blocs_tiles`) pour rendre à la carte vitrine sa mer, son
réseau structurant au dézoom et sa texture d'îlots. Les couches existent déjà dans le générateur ;
seule la liste blanche manque. Voir `docs/carte-vitrine.md`.

### ⚠️ Le piège qui a rendu la carte publique blanche

`CleApiFilter` demande un `IMemoryCache`, et **`AddMemoryCache()` n'était pas enregistré**. Le
conteneur DI ne résout les dépendances d'un filtre qu'à son activation : les deux projets
compilaient, l'application démarrait normalement, et la panne n'est apparue qu'à la première
requête publique — chaque tuile rendant 500, donc une carte vide sans explication.

**Ajouter une dépendance à un filtre d'endpoint impose de vérifier son enregistrement à la main.**
Aucun compilateur ne le fera.

### ✅ En service depuis le 2026-09-10, vérifié de bout en bout

Les deux opérations de base sont passées :

```
Applying migration '20260910111905_AddCleApiVillesAutorisees'.  →  Done.
recherche-index.sql  →  999 entrées, dont 46 sans ville (4,6 %) : 34 lieux, 12 rues
```

Vérification avec une vraie clé restreinte à Ali-Sabieh, délivrée par `/api/cles-api` puis
révoquée :

| | clé restreinte | clé nationale |
|---|---|---|
| tuile `13/5077/3830` (Djibouti-ville) | **404** | 200 |
| tuile `13/5067/3841` (Ali-Sabieh) | 200 | 200 |
| recherche « amb » | 0 résultat | 5 (Ambouli, ambassades…) |
| recherche « ali » | 5, tous Ali-Sabieh | 5, dont « Alia » ailleurs |
| recherche « djibouti » | 3 — **des routes d'Ali-Sabieh** dont le nom cite Djibouti | 5, tous à Djibouti-ville |
| après révocation | **401** | — |

La dernière ligne de recherche est la démonstration la plus nette : le filtre porte sur **où se
trouve** l'objet, jamais sur ce que son nom contient.

### Les 46 entrées sans ville — diagnostiquées le 2026-09-10

34 lieux et 12 rues tombent hors de toute emprise enregistrée. **Une clé restreinte ne les voit
pas** : ce qu'on ne sait pas rattacher n'est pas servi à qui n'a payé qu'une ville.

Le compte a servi à ce pour quoi il avait été mis en place — il a fait apparaître une anomalie.

> ⛔ **L'emprise d'Arta est au mauvais endroit.** `cities-emprise-depuis-nour-ville.sql` a
> remplacé, le 2026-09-06, le polygone de région (1 825 km²) par une « emprise réelle » de
> **10,9 km²** tirée de la livraison SIG. Mais `nour.quartiers_ville_pg` ne contient, pour la
> région ARTA, que **2 polygones, aucun nommé** — et ils sont en lisière sud de Djibouti-ville, à
> une trentaine de kilomètres d'Arta.
>
> | | longitude | latitude |
> |---|---|---|
> | emprise Arta actuelle | 43,112 … 43,194 | 11,516 … 11,533 |
> | ville d'Arta | ~42,85 | ~11,53 |
>
> Le tableau est en outre incohérent : quatre villes portent leur polygone de **région**
> (2 000 à 6 600 km²), Djibouti celui de la **ville** (97,7 km²), Arta un fragment.

**Ce que ça coûte** : 31 des 46 entrées sont des lieux bien réels de la région d'Arta —
l'Hôpital régional, le Lycée Hôtelier, le Terrain de Football, tout le groupe de Ouéa, Damêrdjôg,
et six routes nationales. Un partenaire ayant acheté la région d'Arta ne verrait **rien**.

**Appliqué le 2026-09-10** : `scripts/sig/cities-emprise-arta.sql`. Arta passe de **10,9 à
2 032,8 km²**, et les entrées sans ville de **46 à 15** (4,6 % → 1,5 %).
Arta se dérive par soustraction — le pays moins les quatre autres régions — faute de source
directe : aucune couche `nour` ne porte les régions, et le polygone d'origine a été écrasé.

| mesuré | |
|---|---|
| plus grand morceau retenu | **2 033 km²** (~1 780 officiels + Djibouti-ville qu'elle enserre) |
| échardes écartées | 142 morceaux, 7,65 km² |
| ancienne emprise perdue | **0,00 km²** |
| entrées récupérées | **31** — 19 lieux, 12 rues |
| restent sans ville | 15 |

Répartition après correction : Djibouti 743, Tadjourah 109, Ali Sabieh 56, **Arta 32**, Dikhil 24,
Obock 20.

Vérifié de bout en bout avec deux clés opposées, délivrées puis révoquées :

| tuile `z13` | clé Arta | clé Obock |
|---|---|---|
| Arta-ville `5071/3831` | **200** | 404 |
| Djibouti-ville `5077/3830` | 200 | 404 |
| Tadjourah `5071/3825` | 404 | 404 |
| Obock `5081/3821` | 404 | **200** |

La première ligne est celle qui était cassée : avant le correctif, une clé Arta ne recevait pas
la tuile d'Arta. Et la recherche « arta » sous clé Arta rend désormais l'Hôpital régional, le
Lycée Hôtelier, l'École Primaire — elle ne rendait rien.

### Le nettoyage des lieux hors frontière — 2026-09-10

Les 15 restantes étaient, à quatre près, **hors du pays** : débordement de la boîte d'extraction
OSM. `scripts/sig/nour/poi-hors-frontiere.sql` en a retiré 20 lignes de `nour.poi_osm`
(sauvegardées avec leur WKT dans `poi-hors-frontiere-supprimes-2026-09-10.csv`).

| | avant | après |
|---|---|---|
| `nour.poi_osm` | 961 | **941** |
| entrées d'index | 999 | **989** |
| sans ville | 15 | **5** (0,5 %) |

> ⛔ **Le critère n'est PAS « hors du contour national ».** Il détruirait de la donnée
> djiboutienne : sur les 43 lieux hors contour, **seize sont des hébergements groupés au large
> dans le golfe de Tadjoura** — très vraisemblablement les **îles Moucha et Maskali**, que le
> contour ne contient pas. Et l'Hôtel Corto Maltese est à **2 m** du trait, le point « Obock »
> — la ville — à **443 m**.
>
> **Le contour national est incomplet et approximatif sur le littoral.** Le corriger est le vrai
> remède ; tant que ce n'est pas fait, « hors du contour » ne peut pas servir de critère de
> suppression.

Le critère retenu est **plus de 15 km au-delà du trait**, lu dans la donnée et non choisi au
jugé : le groupe à conserver s'arrête à 11 521 m, celui à retirer commence à 21 758 m. Dix
kilomètres de vide entre les deux. Le script contrôle ce vide à chaque passage et le rapporte.

⚠️ **Le biais est délibérément conservateur.** Cinq entrées restent sans ville, dont trois
probablement étrangères — Rahayta (3,7 km, Érythrée), Dewele (5,3 km, frontière éthiopienne) et
un lieu de culte sans nom à l'ouest. Les retirer imposerait un seuil bas, qui emporterait les
îles. Garder trois points douteux coûte moins que d'effacer seize lieux djiboutiens.

Vérifié après coup : « mandab » et « wahdah » ne rendent plus rien ; « zeila » rend encore deux
résultats, mais ce sont la **rue de Zeila** et l'**Autoroute Loyada-Zeila**, deux voies bien
djiboutiennes.

### ⚠️ Le contrôle des tuiles porte sur l'ENVELOPPE, pas sur le polygone

`PorteeCle.Couvre` teste l'intersection avec la **boîte englobante** des villes autorisées, pas
avec leur contour. C'est ce qui explique la deuxième ligne du tableau — une clé Arta reçoit les
tuiles de Djibouti-ville.

Ici le résultat est de toute façon juste : la région d'Arta entoure réellement la capitale. Mais
la boîte est plus lâche que le contour, et ça se voit ailleurs — celle de Tadjourah
(lon 41,995 … 43,065) recouvre des morceaux d'Obock et d'Arta.

**Le compromis est assumé** : un test sur le polygone coûterait une intersection géométrique par
tuile, sur le chemin le plus chaud de l'API. Et ce qu'il laisse passer, ce sont des tuiles de
données publiques — la restriction borne l'étendue moissonnable, pas le secret. À resserrer si un
accord commercial l'exige, en gardant la boîte comme pré-filtre rapide.

> ⚠️ Arta enserre Djibouti-ville, et c'est correct — la région entoure la capitale. Aucune
> ambiguïté côté **recherche** : l'index rattache un point à la **plus petite** emprise qui le
> contient, donc Djibouti-ville l'emporte à l'intérieur de ses limites. C'est exactement le cas que cette règle
> sert à trancher.

### Historique : ce qui avait été annoncé comme non déployé

Le code est écrit et compile ; **rien n'est déployé**, parce que deux opérations sur la base
manquent et qu'aucune n'est faisable sans les identifiants applicatifs :

```bash
# 1. la colonne VillesAutorisees sur ClesApiPubliques
#    (l'application ne migre PAS au démarrage — c'est une commande à passer)
dotnet ef database update --project src/DASApi.Infrastructure --startup-project src/DASApi.WebApi

# 2. la colonne ville_id sur l'index de recherche — le script RECRÉE la vue,
#    un simple REFRESH n'ajouterait pas la colonne
psql "$DB" -v ON_ERROR_STOP=1 -f das-admin/scripts/sig/recherche-index.sql
```

Les deux ont été passées le 2026-09-10 — la section précédente en donne le résultat. L'ordre
comptait : déployer avant elles fait lire au code des colonnes qui n'existent pas.

**À faire**

**Sortir `.env` du dépôt.** Il est versionné et porte `RDS_PASSWORD` et `DB_CONNECTION` en clair ;
`docker-compose.yml` porte en plus le mot de passe `martin_ro` en dur. Le back lit déjà AWS
Secrets Manager, la mécanique existe.

> ⚠️ **Ne pas faire `git rm --cached .env` seul.** Le fichier est suivi : un `git pull` sur l'EC2
> l'effacerait du disque, et la pile perdrait `MAP_PUBLIC_KEY`, `RDS_HOST` et le reste. Il faut
> d'abord poser le fichier hors de Git sur chaque machine, puis le retirer du suivi. Et comme les
> secrets restent dans l'historique, **le mot de passe doit être tourné** — le retrait du fichier
> ne le protège pas rétroactivement.
