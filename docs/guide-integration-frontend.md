# DAS API — Guide d'intégration front

> À l'attention de l'équipe front. Ce document décrit **ce que l'API expose réellement** et
> les conventions transverses à respecter.
>
> **Mise à jour du 2026-08-18.** Cette version intègre les changements de contrat livrés ce
> jour-là (ville obligatoire / commune facultative sur un quartier, `code` de ville, numéro
> de quartier, code postal dérivé, code d'adresse) et répond à la question « région » restée
> ouverte depuis le 2026-08-12. **La section 0 liste ce qui casse par rapport à la version
> précédente** — commencez par là si vous aviez déjà intégré.
>
> **Source de vérité pour les payloads** : la spec OpenAPI, servie en Development sur
> `GET /openapi/v1.json`. Ce guide donne les conventions, les règles métier et l'inventaire ;
> la spec donne le détail champ par champ, et elle est générée depuis le code — elle ne peut
> pas diverger.

---

## 0. Ce qui change depuis la version du 2026-08-13

| Ce que vous faisiez | Ce qu'il faut faire | Où |
|---|---|---|
| `POST /api/quartiers` avec `communeId` seul | Envoyer **`cityId` (obligatoire)** + `communeId` **facultatif** | [§3.3](#33-quartiers) |
| Traiter `communeId: null` comme une donnée en attente de reprise | C'est un **état normal et définitif** : seule Djibouti-ville a des communes | [§3.3](#33-quartiers) |
| `POST /api/cities` avec `{ name, boundaryWkt }` | Ajouter **`code`** (entier 1–99, obligatoire ; Djibouti = 77) | [§3.1](#31-villes) |
| Lire `areaNumber: 0` sur les quartiers anciens | Le sentinelle `0` a été converti en **`null`** | [§2.2](#22-areanumber--le-numéro-du-quartier) |
| Composer un code postal côté front | Lire **`postcode`** dans `QuartierResponse` (dérivé serveur, parfois `null`) | [§2.4](#24-postcode--dérivé-jamais-saisi) |
| — | Nouveau champ **`addressCode`** dans `AdresseResponse` (`77-007-7-42`, **entièrement numérique**, `null` tant qu'aucun relevé n'a été validé définitivement) | [§2.5](#25-addresscode--figé-à-la-validation-définitive) |
| `POST`/`PATCH /api/blocs` avec `{ code, name }` | Ajouter **`number`** (entier > 0, obligatoire, unique dans le quartier) | [§3.4](#34-blocs-et-adresses) |
| Afficher `libelle` au format `42 B12, Gachamaleh, Djibouti` | Nouveau format : **`42, bloc 2, Gachamaleh Djibouti`** | [§3.4](#34-blocs-et-adresses) |
| Question ouverte « qu'est-ce qu'une région ? » | **Tranchée** : `region` = notre `City`. Pas de niveau au-dessus | [§7](#questions-encore-ouvertes) |
| `registry-api` : 0 route sur 7 | **Les 7 sont livrées.** Nouvelle section dédiée | [§5](#5-écran-registry--apiadresses) |
| — | Nouvel endpoint **productivité des releveurs** | [§4.7](#47-productivité-des-releveurs) |

Le reste du contrat est inchangé : auth, format d'erreur, enums en chaîne, WKT, et
l'ensemble des routes recensement/suggestions.

---

## 1. Conventions transverses

### 1.1 Environnements et CORS

En développement l'API écoute sur `https://localhost:7261` et `http://localhost:5026`.
`UseHttpsRedirection()` est actif : **visez le HTTPS directement**, un appel en clair est
redirigé (et un préflight CORS suivant une redirection échoue silencieusement dans le
navigateur).

La politique CORS autorise les origines dont l'hôte est `localhost` (n'importe quel port) ou
commence par `192.168.` — tous en-têtes, toutes méthodes, **avec credentials**. Une origine
servie depuis un autre réseau (tunnel, IP publique, domaine de préproduction) **sera
refusée** : prévenez-nous pour qu'on l'ajoute, plutôt que de chercher l'erreur côté client.

### 1.2 Préfixe et nommage

Toutes les routes sont préfixées **`/api`**. Aucune exception.

Le nommage des ressources est **mixte, et c'est assumé** : le code historique est en français
(`/api/adresses`, `/api/quartiers`, `/api/blocs`), le code neuf est en anglais
(`/api/streets`, `/api/campaigns`, `/api/surveys`, `/api/units`, `/api/cities`,
`/api/communes`, `/api/zones`). Nous ne renommons pas rétroactivement. Concrètement :

- `blocs` et non `blocks`
- `adresses` et non `addresses` / `properties`
- `quartiers`, `cities`, `communes`, `zones`, `streets`
- les champs de `City`, `Commune` et `Zone` sont en anglais (`name`, `code`), ceux de
  `Quartier` et `Adresse` restent en français (`nom`, `numero`, `libelle`) — les deux
  ressources se côtoient dans le même écran, c'est normal

Les clés JSON suivent le **camelCase** des identifiants C#.

### 1.3 Authentification

`POST /api/auth/login` avec `{ "username": "...", "password": "..." }` renvoie :

```json
{
  "token": "<JWT>",
  "expiresAtUtc": "2026-08-18T10:30:00Z",
  "refreshToken": "<chaîne opaque>",
  "refreshTokenExpiresAtUtc": "2026-08-25T10:00:00Z",
  "userId": "...",
  "fullName": "...",
  "roles": ["Superviseur"]
}
```

Toutes les autres routes attendent l'en-tête `Authorization: Bearer <token>`.

**Rotation obligatoire du refresh token.** `POST /api/auth/refresh` avec
`{ "refreshToken": "..." }` révoque le token présenté et en renvoie un nouveau. L'ancien
n'est **plus valide** — stockez systématiquement celui de la réponse. Rejouer un refresh
token déjà utilisé est interprété comme un vol : **tous** les tokens actifs de l'utilisateur
sont alors révoqués et il devra se reconnecter. Attention aux appels concurrents : deux
onglets qui rafraîchissent en même temps produisent exactement ce scénario, sérialisez le
refresh côté client.

`POST /api/auth/logout` avec `{ "refreshToken": "..." }` renvoie toujours `204`, même si le
token est inconnu ou déjà révoqué (idempotent, et volontairement muet sur l'état du token).
`login`, `refresh` et `logout` sont les seules routes anonymes.

### 1.4 Rôles et permissions

Quatre rôles : `Admin`, `Superviseur`, `AgentTerrain`, `Gestionnaire`. Un utilisateur peut en
cumuler plusieurs. Le JWT porte un claim `role` **par rôle** et un claim `permission` **par
permission** — lisez les claims multiples, pas seulement le premier.

Règles générales, utiles pour masquer les actions dans l'UI :

- **Gestionnaire** : crée et modifie le référentiel géographique.
- **Admin seul** : toutes les suppressions (`DELETE`), et la gestion des utilisateurs.
- **Superviseur** : lecture, plus validation / rejet / renvoi en correction des relevés.
- **AgentTerrain** : ses propres relevés uniquement, et les propositions de nom.

Attention : le back **ne se contente pas** de vérifier le rôle. Certaines règles dépendent de
la donnée (un superviseur ne valide pas son propre relevé, un agent ne relève que sur son
bloc) et produisent un `403` que le rôle seul ne laissait pas prévoir. Ne considérez pas un
`403` comme un bug d'affichage.

### 1.5 Format des erreurs

Deux formats distincts, à traiter séparément.

**Erreurs métier** (`400`, `403`, `404`, `409`) — objet `ErrorResponse` :

```json
{ "code": "Quartiers.AreaNumberAlreadyUsed", "message": "Un quartier porte déjà ce numéro dans cette ville." }
```

`code` est stable et fait pour être testé en code. `message` est en français et destiné à
l'affichage — il peut changer sans préavis, **ne le testez pas**.

Codes que vos écrans géographiques rencontreront le plus :

| Code | HTTP | Sens |
|---|---|---|
| `Quartiers.CodeAlreadyExists` | 409 | Le code fourni est déjà pris (unique toutes villes confondues) |
| `Quartiers.AreaNumberAlreadyUsed` | 409 | Numéro de quartier déjà utilisé dans cette ville |
| `Quartiers.CommuneOutsideCity` | 400 | La commune n'appartient pas à la ville indiquée |
| `Quartiers.ZoneOutsideCommune` | 400 | La zone n'appartient pas à la commune indiquée |
| `Quartiers.ZoneWithoutCommune` | 400 | `zoneId` fourni sans `communeId` |
| `Quartiers.CityNotChangeable` | 400 | Tentative de déplacer un quartier vers une autre ville |
| `Cities.HasCommunes` / `Communes.HasZones` / `Communes.HasQuartiers` / `Zones.HasQuartiers` | 409 | Suppression refusée : videz le niveau enfant d'abord |

**Erreurs de validation** (`400`) — `ValidationProblemDetails` standard ASP.NET :

```json
{
  "errors": {
    "Nom": ["Le nom est obligatoire."],
    "AreaNumber": ["AreaNumber doit être compris entre 1 et 999 : il forme les trois derniers chiffres du code postal."]
  }
}
```

Les clés sont les noms de propriétés en **PascalCase** (pas camelCase), à mapper sur vos
champs de formulaire.

`401` renvoie un corps vide : token absent, expiré ou invalide → tentez un refresh, puis
redirigez vers le login.

### 1.6 Sérialisation

- **Enums : chaînes, jamais nombres.** `"status": "InProgress"`, pas `"status": 2`. Vaut en
  entrée comme en sortie, y compris en query string (`?status=Submitted`).
- **Dates : UTC, suffixe `Z`.** Les champs sont explicitement nommés `...AtUtc`. Exception :
  les dates limites de campagne sont des **dates**, pas des instants — leur frontière est
  minuit **heure de Djibouti (UTC+3)**. Ne les comparez pas en UTC naïf.
- **Géométries : WKT, SRID 4326.** Les champs `...Wkt` transportent du texte
  (`MULTIPOLYGON((...))`, `POINT(...)`), pas du GeoJSON. Si votre bibliothèque de carte
  attend du GeoJSON, la conversion est à votre charge.
  ⚠️ **Écart assumé à venir** : le futur module Registry (`POST /api/adresses/search` & co,
  non implémenté à ce jour) portera du **GeoJSON**, comme convenu le 2026-08-18. Le CRUD
  géographique décrit ici reste au WKT. Ne supposez pas un format unique côté client.
- **Identifiants : `uuid`** partout.

### 1.7 Ce que l'API ne fait pas encore

À prendre en compte dans vos écrans dès maintenant :

- **Aucun endpoint de liste n'est paginé.** `GET /api/adresses` renvoie tout le jeu
  correspondant au filtre. Tenable sur `cities` ou `campaigns`, pas à l'échelle des adresses
  de Djibouti — la pagination est identifiée comme prioritaire côté back, elle n'existe pas
  aujourd'hui.
- **Pas de recherche multi-critères.** Les filtres sont des query params simples, listés plus
  bas ; il n'y a pas de `POST /search` avec corps de requête.
- **Pas d'action en masse.** Toutes les écritures portent sur une ressource à la fois, à
  l'exception de `POST /api/campaign-blocs/transfer`.
- **Le module Registry n'est pas commencé** : 0 route sur les 7 de votre contrat du
  2026-08-18. Les briques de données qu'il réclamait (code postal, code d'adresse) sont en
  revanche en place — voir §2.

---

## 2. Codes et identifiants — la partie qui prête le plus à confusion

Cinq notions se ressemblent et ne désignent pas la même chose. Ce tableau d'abord, les
détails ensuite.

| Champ | Ressource | Saisi ? | Stocké ? | Peut être `null` ? |
|---|---|---|---|---|
| `code` | `City` | **Oui**, entier 1–99 | Oui | Oui, sur les villes créées avant le 2026-08-18 |
| `areaNumber` | `Quartier` | **Oui**, entier 1–999 | Oui | Oui, sur les quartiers antérieurs à la règle |
| `code` | `Quartier` | Facultatif | Oui | Non — toujours présent en lecture |
| `postcode` | `Quartier` | **Non** — dérivé | **Non** | Oui, dès qu'un composant manque |
| `addressCode` | `Adresse` | **Non** — figé serveur | Oui | Oui, tant qu'aucune validation définitive |

### 2.1 `City.Code` — les deux premiers chiffres du code postal

Entier **1 à 99**, obligatoire à la création et à la modification d'une ville. Djibouti = 77.
Ce n'est pas l'indicatif pays (`DJ`, voir §2.5) : il identifie la **ville**.

Il est `null` en lecture sur les villes créées avant le 2026-08-18, en attente de reprise —
une ville sans code ne produit pas de code postal pour ses quartiers.

### 2.2 `areaNumber` — le numéro du quartier

Entier **1 à 999**, **obligatoire** à la création comme à la modification d'un quartier,
**unique dans sa ville** (`409 Quartiers.AreaNumberAlreadyUsed` sinon).

⚠️ **Le sentinelle `0` n'existe plus.** Les quartiers historiques non renseignés portent
désormais `null`, ce qui se lit « non renseigné » sans ambiguïté. Affichez un tiret, pas un
zéro. Vous ne pouvez pas recréer cet état via l'API : toute écriture exige un numéro valide.

### 2.3 `Quartier.Code` — deux lettres, dérivé du nom

**Facultatif à la saisie, unique en base, toujours présent en lecture.**

Omis, le serveur le dérive du nom : **toujours deux lettres majuscules**, l'initiale du nom
puis une lettre prise dans le deuxième mot s'il y en a un (`Guelleh Batal` → `GB`), sinon
dans la suite du mot unique (`Heron` → `HE`, `Gare` → `GA`). Parenthèses ignorées
(`Kartileh (Q7 bis)` → `KA`), accents dépliés (`Château d'eau` → `CD`).

**En cas de collision, la deuxième lettre avance ; le code ne s'allonge pas et ne se numérote
pas.** `Cité Sacuudi` occupe `CS`, donc `Cité Sinam` reçoit `CI` ; `Gare` occupe `GA`, donc
`Gachamaleh` reçoit `GC`. Corollaire pour vous : **le code dépend de ce qui existe déjà**, ce
n'est pas une fonction du seul nom — ne le recalculez pas côté front, lisez celui que renvoie
la réponse.

Si vous l'envoyez quand même : **au moins deux lettres majuscules, sans espace ni chiffre**
(400 sinon) et **libre** (409 `Quartiers.CodeAlreadyExists` sinon) — l'unicité porte sur
l'ensemble des quartiers, toutes villes confondues.

Sur un `PATCH`, **omettre `code` conserve celui en place** (et n'en dérive un que si le
quartier n'en avait pas). C'est ce qui laisse vivre les codes historiques non conformes
(`Ein`, `Q7`) sans les casser, et ce qui permet de renommer un quartier sans changer un code
déjà diffusé.

### 2.4 `postcode` — dérivé, jamais saisi

`City.Code` sur 2 chiffres suivi de `areaNumber` **zéro-padé sur 3** : quartier n° 101 de
Djibouti → `"77101"`, quartier n° 7 → `"77007"`.

Renvoyé en lecture seule dans `QuartierResponse`. Il n'est **pas stocké** : il se recalcule à
chaque lecture, donc corriger un `areaNumber` corrige immédiatement le code postal.

**Il vaut `null` dès qu'un composant manque** (ville sans `code`, quartier sans
`areaNumber`) — et c'est délibéré : concaténer un numéro absent donnerait `"77000"`, un code
postal syntaxiquement valide et faux, que rien en aval ne pourrait distinguer d'un vrai.
Affichez l'absence, ne la comblez pas.

### 2.5 `addressCode` — figé à la validation définitive

Format **`Ville-Quartier-Bloc-Numéro`, entièrement numérique** : `77-007-7-42` se lit
Djibouti (77), quartier 7, bloc 7, maison 42. `City.Code` sur 2 chiffres, `AreaNumber` sur 3,
puis le numéro de bloc et le numéro de maison au naturel. Exposé dans `AdresseResponse`.

> **Changement du 2026-08-18** — le format annoncé précédemment (`DJ-BLS-Q7-0042`) est
> abandonné. Il portait un segment commune, or seule Djibouti-ville a des communes : le nombre
> de segments variait d'une ville à l'autre et le code devenait indécodable. Le préfixe pays
> `DJ` a sauté pour la même raison — constant, il ne discrimine rien.

**Les quatre segments sont nécessaires à l'unicité**, aucun n'est décoratif : le numéro de
maison n'est unique que dans son bloc, le bloc que dans son quartier, le quartier que dans sa
ville. Sans le segment bloc, 165 adresses de notre base de test retombaient sur 67 codes.

Trois propriétés à retenir :

- **Il est posé une seule fois**, au moment où un relevé de cette parcelle est validé en
  `Definitive`, et **n'est plus jamais réécrit**. Renommer le quartier ensuite ne le change
  pas : c'est un identifiant, pas un libellé.
- **Il vaut `null` tant qu'aucun relevé définitif n'a eu lieu.** Ce n'est pas un manque de
  données à combler côté front — c'est l'information « cette adresse n'est pas encore
  officielle ». Un badge « en cours d'adressage » est le bon rendu.
- **Il vaut aussi `null` si un composant manque** : ville sans `code`, quartier sans
  `areaNumber`, bloc sans `number`. Mieux vaut aucun code qu'un code tronqué, puisqu'il n'est
  jamais réécrit.

À ne pas confondre avec `libelle`, qui est le libellé humain composé à la volée (numéro,
bloc, quartier, ville) et toujours présent.

---

## 3. Référentiel géographique

La hiérarchie est **City → [Commune] → [Zone] → Quartier → Bloc → Adresse**. `Street` est une
entité autonome, pas un niveau. `Arrondissement` et `Lot` **ont été supprimés** en août 2026 :
retirez-les de vos modèles s'ils y traînent encore.

Tous les niveaux suivent le même CRUD : `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`,
`DELETE /{id}` (**Admin seul** sur `DELETE`).

| Ressource | Route | Filtres de liste |
|---|---|---|
| Villes | `/api/cities` | — |
| Communes | `/api/communes` | `?cityId=` |
| Zones | `/api/zones` | `?communeId=` |
| Quartiers | `/api/quartiers` | `?cityId=`, `?communeId=`, `?zoneId=` (cumulables) |
| Blocs | `/api/blocs` | `?quartierId=` |
| Adresses (parcelles) | `/api/adresses` | `?blocId=` |
| Rues | `/api/streets` | — |

**Suppressions** : `DELETE` sur une ville, une commune ou une zone est refusé en `409` tant
qu'elle a des enfants (voir les codes en §1.5) — videz le niveau du dessous d'abord. À
l'inverse, supprimer un quartier ou un bloc **emporte en cascade** ses blocs et adresses,
sans avertissement. Confirmez côté UI.

Le `PATCH` de chaque ressource attend **le corps complet** de la ressource (ce n'est pas un
patch partiel champ par champ) : renvoyez l'objet tel que vous l'avez lu, modifié.

### 3.1 Villes

```jsonc
// POST /api/cities  et  PATCH /api/cities/{id}
{ "name": "Djibouti", "code": 77, "boundaryWkt": null }
```

`CityResponse` : `{ id, name, code, boundaryWkt }`. `code` est **obligatoire en écriture**
(1–99) et peut être `null` en lecture sur les villes antérieures au 2026-08-18.

### 3.2 Communes et zones

```jsonc
// POST /api/communes   { "name": "Boulaos", "code": "BLS", "boundaryWkt": null }
// POST /api/zones      { "name": "Zone 4",  "code": "Z4",  "boundaryWkt": null }
```

`CommuneResponse` : `{ id, name, code, cityId, boundaryWkt }`. `boundaryWkt` est **null pour
l'instant** : les délimitations SIG des communes ne sont pas encore fournies.

`ZoneResponse` est **enrichie** — elle renvoie les libellés de la chaîne de rattachement et
la composition de la zone, pour vous éviter des appels en cascade :

```json
{
  "id": "…", "name": "Zone 4", "code": "Z4",
  "communeId": "…", "communeName": "Boulaos",
  "cityId": "…",    "cityName": "Djibouti",
  "quartiers": [ { "id": "…", "nom": "Gachamaleh", "code": "GA" } ],
  "boundaryWkt": null
}
```

- **`cityName` est ce que vous appelez « région »** (question tranchée, §5).
- **`quartiers` est en lecture seule.** Le rattachement se fait *depuis le quartier*
  (`PATCH /api/quartiers/{id}`), un quartier à la fois. Il n'existe pas de
  `POST /api/zones { quartierIds: [...] }`, et il ne peut pas y en avoir tel quel : une zone
  étant une partie d'une commune, tous ses quartiers relèvent forcément de la même commune.
- **La liste peut être vide** — une zone sans quartier est un état normal.
- Les quatre routes (`GET /`, `GET /{id}`, `POST`, `PATCH /{id}`) renvoient **exactement
  cette forme**, création comprise.

### 3.3 Quartiers

⚠️ **Contrat modifié le 2026-08-18** — c'est le point le plus important de cette mise à jour,
et il **revient sur** ce que ce guide vous disait le 2026-08-12.

```jsonc
// POST /api/quartiers  et  PATCH /api/quartiers/{id}
{
  "nom": "Gachamaleh",
  "code": null,          // facultatif — dérivé du nom si absent (§2.3)
  "areaNumber": 101,     // OBLIGATOIRE, 1..999, unique dans la ville (§2.2)
  "cityId": "…",         // OBLIGATOIRE — n'est plus déduit de la commune
  "communeId": null,     // FACULTATIF — seule Djibouti-ville est découpée en communes
  "zoneId": null,        // facultatif, exige communeId
  "boundaryWkt": null
}
```

**Pourquoi ce retour en arrière.** La version précédente déduisait la ville de la commune, ce
qui supposait qu'un quartier ait toujours une commune. C'est faux : **seule Djibouti-ville est
découpée en communes**. Ali Sabieh et les autres villes n'en ont pas et n'en auront pas —
la règle précédente les rendait tout simplement inexprimables.

Conséquences directes pour vos écrans :

- **`cityId` est le rattachement structurant**, et il est fourni par vous. La commune est un
  **raffinement facultatif**.
- **`communeId: null` est un état normal et définitif**, pas une donnée en attente de reprise.
  Un sélecteur de commune obligatoire bloquerait la saisie de toutes les villes hors Djibouti.
- Le sélecteur de commune n'a de sens que **filtré sur la ville choisie**
  (`GET /api/communes?cityId=`) : une commune d'une autre ville est refusée en 400
  (`Quartiers.CommuneOutsideCity`).
- **Une zone sans commune est refusée** (`Quartiers.ZoneWithoutCommune`) : la zone est une
  partie de la commune, elle ne la remplace pas. Modélisez `zoneId` comme un raffinement de
  `communeId`, jamais comme un parent alternatif.
- **La ville n'est pas modifiable.** Un `PATCH` avec un autre `cityId` est refusé en 400
  (`Quartiers.CityNotChangeable`) : déplacer un quartier casserait les libellés et les codes
  d'adresse déjà émis. Un quartier peut changer de commune ou de zone, jamais de ville.

`QuartierResponse` :

```json
{
  "id": "…", "nom": "Gachamaleh", "code": "GA",
  "areaNumber": 101, "postcode": "77101",
  "cityId": "…", "communeId": null, "zoneId": null,
  "boundaryWkt": null
}
```

`areaNumber` et `postcode` peuvent être `null` sur les lignes historiques (§2.2, §2.4).

### 3.4 Blocs et adresses

`BlocResponse` : `{ id, code, name, number, quartierId, boundaryWkt }`. `code` est
l'identifiant technique, toujours présent ; `name` est la désignation réelle et vaut `null`
tant qu'aucune suggestion n'a été approuvée.

> **`number` est nouveau (2026-08-18) et obligatoire à la création.** Entier > 0, **unique
> dans le quartier**. C'est le segment « bloc » du code d'adresse, qui est entièrement
> numérique — `code` étant une chaîne (`CD-A`), il ne pouvait pas y servir. Il vaut `null` sur
> les blocs créés avant cette date : à reprendre via `PATCH /api/blocs/{id}`, sans quoi aucune
> adresse de ce bloc n'obtiendra de code. Un numéro déjà pris dans le quartier renvoie **409**.

`AdresseResponse` :

```json
{
  "id": "…", "blocId": "…", "numero": 42,
  "boundaryWkt": "MULTIPOLYGON(…)", "locationWkt": "POINT(…)",
  "blocCode": "B12", "blocName": null,
  "quartierNom": "Gachamaleh", "cityName": "Djibouti",
  "addressCode": "77-007-7-0042",
  "libelle": "42, bloc 2, Gachamaleh Djibouti"
}
```

- **`libelle` a changé de format le 2026-08-18** : `42, bloc 2, Gachamaleh Djibouti`. La
  virgule sépare la maison du bloc puis le bloc du quartier ; quartier et ville restent collés,
  ils forment la localité.
- **`libelle` est calculé côté serveur** et suit la chaîne de repli « **numéro ou nom** du
  bloc » : `blocName` s'il existe, sinon `blocNumber`, sinon `blocCode` —
  **affichez-le, ne le recomposez pas côté front**.
- `locationWkt` est un point garanti **à l'intérieur** de la parcelle (posez-y votre marqueur,
  n'utilisez pas le centroïde du polygone, qui peut en sortir).
- `addressCode` : voir §2.5. `null` = pas encore d'adresse officielle.
- **`numero` est obligatoire à la création** : une parcelle digitalisée mais pas encore
  numérotée n'est pas représentable aujourd'hui (voir §4, `addressing-api`).

Catalogues en lecture seule, pour vos listes déroulantes : `GET /api/types-occupation`,
`GET /api/etats-occupation`.

### 3.5 Suggestions de nom (blocs et rues)

Un bloc ou une rue sans `name` reçoit un nom **via un flux de proposition** : l'agent terrain
propose, le superviseur ou le gestionnaire tranche.

| Verbe | Route | Corps |
|---|---|---|
| GET | `/api/blocs/suggestions` | `?blocId=` `?status=` |
| GET | `/api/blocs/suggestions/{id}` | — |
| POST | `/api/blocs/suggestions` | `{ blocId, suggestedName, comment? }` |
| POST | `/api/blocs/suggestions/{id}/approve` | `{}` |
| POST | `/api/blocs/suggestions/{id}/reject` | `{ rejectionReason }` |

`/api/streets/suggestions` est identique, au champ `blocId` → `streetId` près.

**Trois points d'attention** — vos services divergent sur les trois :

1. **`POST`, pas `PATCH`**, sur `approve` et `reject`. Approuver n'est pas une modification
   partielle de la suggestion : c'est une transition d'état qui écrit *aussi* le nom sur le
   bloc.
2. **Pas de `blocId` dans l'URL.** L'identifiant de la suggestion suffit : le chemin est
   `/api/blocs/suggestions/{id}/approve`, pas
   `/api/blocs/{blocId}/suggestions/{id}/approve`.
3. Le champ de rejet s'appelle **`rejectionReason`**, pas `reason`.

`status` vaut `Pending`, `Approved` ou `Rejected`. Une seule suggestion `Pending` à la fois
par bloc : une seconde renvoie `409`. Après un rejet, l'agent peut en reproposer une.

**Il n'existe pas de route de nommage direct** (`POST /blocs/{id}/name`). Deux chemins
seulement : le flux ci-dessus, ou `PATCH /api/blocs/{id}` pour un Gestionnaire, qui écrit le
nom sans passer par la proposition.

---

## 4. Module recensement terrain

### 4.1 Campagnes — `/api/campaigns`

| Verbe | Route | Effet |
|---|---|---|
| GET | `/api/campaigns` `?status=` | Liste |
| GET | `/api/campaigns/{id}` | Détail |
| GET | `/api/campaigns/{id}/progress` | Avancement |
| POST | `/api/campaigns` | Création (état `Planned`) |
| POST | `/api/campaigns/{id}/start` | Démarrage |
| POST | `/api/campaigns/{id}/assignments` | Génère la feuille de route |
| POST | `/api/campaigns/{id}/addresses` | Ajoute des parcelles à recontrôler |
| POST | `/api/campaigns/{id}/extend` | Prolonge la date limite |
| POST | `/api/campaigns/{id}/close` | Clôture |

**L'ordre des étapes est contraint** : créer → affecter les blocs (autorisé dès `Planned`) →
`start` → générer la feuille de route → relevés. Une action hors séquence renvoie `409`.
`assignments` est **idempotent et rejouable** ; il est refusé tant que la campagne est
`Planned`.

`status` : `Planned`, `InProgress`, `Closed`. Le passage `InProgress → Closed` est
**automatique** dès la date limite dépassée sans prolongation active — une campagne peut donc
changer d'état entre deux de vos appels, sans que personne n'ait cliqué. **Ne mettez pas en
cache l'état d'une campagne.**

Au plus une campagne `InProgress` et une campagne `Planned` à la fois. Préparer la suivante
pendant que la courante tourne est le cas d'usage normal.

`GET /{id}/progress` renvoie séparément la **charge** (déduite des blocs affectés, elle suit
les réaffectations) et la **production** (comptée sur l'auteur des relevés, elle ne les suit
jamais). Ne les additionnez pas et ne les confondez pas dans un même graphique.

### 4.2 Affectation des blocs

| Verbe | Route | Corps |
|---|---|---|
| GET | `/api/campaigns/{campaignId}/blocs` `?agentId=` | — |
| POST | `/api/campaigns/{campaignId}/blocs` | Affecte un bloc à un agent |
| PATCH | `/api/campaigns/{campaignId}/blocs/{blocId}/agent` | `{ agentId }` — réaffecte |
| POST | `/api/campaign-blocs/transfer` | `{ fromAgentId, toAgentId, campaignId? }` |

**Point d'alignement.** Vos services attendent `PATCH /blocks/{id}/assign { userId }` : un
bloc aurait un titulaire absolu. Ce n'est pas notre modèle. Un bloc n'a de titulaire **que
dans une campagne donnée** — c'est ce qui permet à un agent réaffecté de conserver le crédit
du travail déjà fait, et à la charge de suivre la réaffectation sans réécrire la productivité
de personne. La route exige donc un `campaignId`, à résoudre côté front
(`GET /api/campaigns?status=InProgress`) avant d'affecter.

Un bloc déjà affecté se réaffecte par `PATCH`, jamais par un second `POST`. `transfer`
bascule d'un coup tous les blocs d'un agent vers un autre (départ, absence, compte
désactivé) ; les campagnes clôturées en sont exclues.

### 4.3 Feuille de route — `/api/campaign-assignments`

| Verbe | Route |
|---|---|
| GET | `/api/campaign-assignments` `?campaignId=` `?agentId=` `?status=` |
| POST | `/api/campaign-assignments/{id}/abandon` |

Une ligne = une parcelle à relever. Elle **ne porte pas d'agent** : le responsable se déduit
du bloc. Un `AgentTerrain` ne reçoit ici que les lignes des blocs dont il est titulaire.

### 4.4 Relevés — `/api/surveys`

| Verbe | Route | Rôle |
|---|---|---|
| GET | `/api/surveys` `?adresseId=` `?campaignId=` `?status=` `?validationType=` | Agent (les siens) / Superviseur |
| GET | `/api/surveys/current` `?blocId=` `?surveyedOnly=` | Superviseur |
| GET | `/api/surveys/stalled` | Superviseur |
| GET | `/api/surveys/suspicious` | Superviseur |
| GET | `/api/surveys/{id}` | |
| POST | `/api/surveys` | Agent |
| PATCH | `/api/surveys/{id}` | Agent |
| POST / GET | `/api/surveys/{id}/photos` | |
| POST | `/api/surveys/{id}/submit` | Agent |
| POST | `/api/surveys/{id}/validate` | Superviseur |
| POST | `/api/surveys/{id}/reject` | Superviseur |
| POST | `/api/surveys/{id}/request-correction` | Superviseur |

Notes pour vos écrans :

- **Trois issues de validation, pas deux.** `validate`, `reject`, et `request-correction`
  (renvoi à l'agent pour complément). Prévoyez le troisième bouton.
- **`validate` porte un `validationType`** : `Temporary` rend la parcelle livrable tout en la
  laissant recontrôlable ; **`Definitive`** la sort du périmètre des campagnes suivantes et
  **fige le `addressCode`** (§2.5). C'est irréversible côté données — l'UI devrait le dire
  avant de confirmer.
- `GET /api/surveys` est **la file de travail** : `?status=Submitted` pour le superviseur,
  `?status=Rejected` pour l'agent. Le filtre `?campaignId=` est nécessaire : la clôture
  n'arrête pas le superviseur, sa file est donc multi-campagnes.
- `GET /current` donne le **dernier relevé validé de chaque parcelle** — l'état courant. Il
  inclut par défaut les parcelles « non relevables » (démolies, introuvables), pour
  lesquelles `typeOccupationId` et `etatOccupationId` sont `null` : `?surveyedOnly=true` pour
  les exclure.
- `GET /suspicious` renvoie des **signaux** anti-fraude (GPS simulé, écart à la parcelle,
  horodatage incohérent), pas des verdicts. Présentez-les comme tels ; la décision reste
  humaine.
- `POST /api/surveys` renvoie **`201` à la création et `200` sur rejeu** d'un relevé déjà
  enregistré (tolérance hors ligne). Traitez les deux comme un succès, mais ne dupliquez pas
  la ligne dans l'UI sur un `200`.

### 4.5 Unités — `/api/units`

CRUD complet, filtre `?adresseId=`. Une unité est un logement ou local dans un immeuble. Elle
est rattachée à la **parcelle**, pas à la campagne : elle ne se duplique pas d'une campagne à
l'autre, même si sa saisie est faite sur le terrain.

### 4.6 Utilisateurs — `/api/users` *(Admin)*

| Verbe | Route | Corps |
|---|---|---|
| GET | `/api/users` | — |
| POST | `/api/users` | `{ fullName, username, password, roleNames[] }` |
| PATCH | `/api/users/{id}/roles` | `{ roleNames[] }` → `204` |
| PATCH | `/api/users/{id}/status` | `{ isActive }` → `204` |

`roles` **remplace** l'ensemble des rôles — ce n'est pas un ajout incrémental. Réponse :
`{ id, fullName, username, roles[], isActive }`.

---

### 4.7 Productivité des releveurs

`GET /api/surveys/productivity?campaignId=&agentId=` — les deux paramètres optionnels.
Permission `surveys.view`.

```json
[ { "campaignCode": "C2026-1", "campaignName": "…", "campaignStatus": "InProgress",
    "campaignOpenedAtUtc": "…", "campaignDeadline": "2026-09-30",
    "agentId": "…", "agentFullName": "Ali Hassan",
    "total": 42,
    "byStatus": { "draft": 0, "submitted": 8, "validated": 30, "rejected": 4 } } ]
```

Trois choses à comprendre :

- **La période est celle de la campagne**, il n'y a pas de filtre sur des dates. Un relevé
  appartient à une campagne, donc `campaignId` borne déjà le temps. Les bornes de la campagne
  sont dans la réponse pour votre en-tête d'écran.
- **La ventilation par statut est toujours renvoyée et n'est pas un filtre.** Un paramètre
  `status` vous obligerait à quatre appels pour afficher une ligne, avec trois défauts : un
  agent sans rejet serait *absent* de la réponse `rejected` (absence ≠ zéro), les quatre appels
  ne verraient pas le même instant (colonnes qui ne s'additionnent pas), et le total
  demanderait un cinquième appel.
- **C'est la production, pas la charge.** Elle est comptée sur l'agent qui a effectivement
  relevé et **ne suit jamais une réaffectation de bloc**. Pour la charge et l'avancement d'une
  campagne, c'est `GET /api/campaigns/{id}/progress`, qui renvoie les deux séparément.

Sans paramètre, une ligne par (campagne, agent) — ce qui permet de suivre un même releveur
d'une campagne à l'autre.

---

## 5. Écran Registry — `/api/adresses`

**Les 7 routes de votre contrat sont livrées** (2026-08-18). Cinq répondent telles quelles,
deux sont couvertes autrement — et c'est délibéré, voir §5.6.

| # | Route | Statut |
|---|---|---|
| 1 | `GET /api/adresses/summary` | ✅ 4 KPI sur 4 |
| 2 | `GET /api/adresses/filter-options` | ✅ 4 listes alimentées |
| 3 | `POST /api/adresses/search` | ✅ paginée |
| 4 | `GET /api/adresses/{id}` | ✅ fiche détail |
| 5 | `POST /api/adresses/approve` | ➡️ utilisez `PATCH /bulk` |
| 6 | `PATCH /api/adresses/bulk` | ✅ restreinte à `approved`/`published` |
| 7 | `POST /api/adresses/{id}/flag` | ➡️ utilisez `POST /api/surveys/{id}/reject` |

Toutes exigent la permission `adresses.view`, sauf `PATCH /bulk` qui exige
**`adresses.publish`** (nouvelle, accordée au Gestionnaire).

### 5.1 `GET /api/adresses/summary`

```json
{ "totalRecords": 165, "pendingReview": 8, "duplicatesFlagged": 3, "publishedToday": 2 }
```

⚠️ **`duplicatesFlagged` ne compte pas des doublons.** Le nom vient de votre contrat et nous
l'avons conservé pour ne pas casser votre type, mais il compte les adresses **dont le dernier
relevé a été rejeté**. N'écrivez pas « 3 doublons » dans l'UI — écrivez « 3 à revoir ».
C'est un état **dérivé** : un rejet suivi d'un nouveau relevé ne compte plus.

`publishedToday` compte la journée **de Djibouti** (UTC+3), pas la journée UTC.

### 5.2 `GET /api/adresses/filter-options`

```json
{ "postcodes": ["77007","77008"], "zones": ["Zone 5"],
  "regions": ["Ali Sabieh","Djibouti"], "teams": ["Ali Hassan"] }
```

Valeurs réellement présentes en base, listes vides possibles. Deux pièges :

- **`teams` contient des noms d'agents**, pas d'équipes — il n'existe pas d'équipe dans le
  modèle. La liste ne contient que les titulaires d'un bloc dans la **campagne en cours** :
  hors campagne active, elle est **vide**, et c'est exact.
- **`postcodes` est vide tant que les villes n'ont pas de `code` et les quartiers pas
  d'`areaNumber`.** Ce n'est pas une panne, c'est une saisie à faire.

### 5.3 `POST /api/adresses/search`

```json
{ "filters": { "search": null, "postcode": null, "zone": null, "region": null,
               "status": null, "team": null,
               "cityId": null, "communeId": null, "zoneId": null,
               "quartierId": null, "blocId": null },
  "page": 1, "pageSize": 25 }
```

Tous les filtres sont optionnels, se combinent en **ET**, et une chaîne vide vaut « pas de
filtre ». `filters` peut être omis entièrement.

**Tous les filtres du contrat sont réellement appliqués** — y compris `postcode`, `zone` et
`region`, que vous annonciez comme inutilisés. Aucun n'est accepté-puis-ignoré.

Réponse :

```json
{ "items": [ { "id": "…", "addressCode": "77-007-7-42", "postcode": "77007",
               "zone": "Zone 5", "street": null, "quartier": "Gachamaleh",
               "propertyType": "Villa", "workflowStage": "verified",
               "lastUpdate": "2026-08-18T09:30:00Z", "assignedTeamName": "Ali Hassan",
               "geom": null, "libelle": "42, bloc 2, Gachamaleh Djibouti" } ],
  "total": 165, "page": 1, "pageSize": 25 }
```

- **`total` est le nombre de lignes après filtrage**, pas la taille de la page.
- **`pageSize` est plafonné à 200** ; au-delà, `400`. `page` commence à 1.
- **`geom` et `street` valent toujours `null`.** La carte vient des tuiles ; la rue n'est pas
  modélisée. Les champs restent présents pour rester alignés sur vos types.
- **Un `status` inconnu renvoie `400`, il n'est pas ignoré.** Ignoré, il vous rendrait *toutes*
  les lignes et votre écran afficherait un résultat non filtré en croyant l'avoir filtré. Même
  chose pour un `postcode` mal formé.
- **L'enveloppe `{ items, total, page, pageSize }` devient notre convention** pour toutes les
  futures listes paginées. C'est votre proposition, elle était la bonne.

### 5.4 `GET /api/adresses/{id}`

**Sur-ensemble de l'ancienne réponse** : tous les champs historiques (`numero`, `libelle`,
`quartierNom`…) sont conservés à l'identique, les blocs Registry s'y ajoutent. Rien n'a
disparu — si vous consommiez déjà cette route, elle continue de fonctionner.

`404` sur identifiant inconnu.

```json
{ "…champs AdresseResponse…",
  "components": { "street": null, "quartierNom": "…", "zone": "…",
                  "commune": "…", "region": "Djibouti", "postcode": "77007" },
  "location": { "latitude": 11.57, "longitude": 43.14, "parcelNumber": "42" },
  "propertyInfo": { "propertyType": "Villa", "occupancyType": null, "buildingUse": null },
  "validation": { "score": 42, "percentage": 78, "notes": null },
  "history": [],
  "linked": [ { "id": "…", "kind": "block", "label": "bloc 2" } ] }
```

⚠️ **`validation.score` n'est pas une note sur 100.** C'est le **nombre de relevés effectués
par l'agent** sur la campagne — sa production — et `percentage` est sa part de charge
couverte. **Retirez le rendu en `%` sur `score`** : votre contrat annonçait « entier 0–100
interprété comme un pourcentage », ce n'est plus le cas.

⚠️ **`percentage` peut dépasser 100**, et ce n'est pas une anomalie. Après une réaffectation,
la charge bascule sur le nouveau titulaire mais la production reste à celui qui a relevé. Ne
le plafonnez pas et ne le traitez pas comme une erreur.

`linked[].kind` vaut `block`, `postcode` ou `team`. **`street` n'est jamais émis.**

Restent `null` faute de modèle : `street`, `occupancyType`, `buildingUse`,
`validation.notes`, et `history` est toujours `[]` — aucun journal d'audit n'existe.
Ne prévoyez pas de clés i18n `history.*` pour l'instant.

### 5.5 `PATCH /api/adresses/bulk`

```json
{ "ids": ["…", "…"], "stage": "Published" }
```

Réponse `204`. **`stage` ne peut valoir que `Approved` ou `Published`**, rien d'autre.

**Le champ `team` de votre contrat n'existe pas ici**, et n'existera pas : la maille
d'affectation est le **bloc**, pas l'adresse. Réassigner depuis une liste d'adresses
réaffecterait des blocs entiers — y compris les adresses que l'opérateur n'a pas
sélectionnées et ne voit pas à l'écran. Une action « sur 3 lignes » en déplacerait des
centaines, silencieusement. Pour réassigner :
`PATCH /api/campaigns/{campaignId}/blocs/{blocId}/agent`.

Dans le tiroir Registry, **`assignedTeamName` est donc en lecture seule.**

**Tout ou rien** : un seul identifiant inconnu fait échouer le lot entier en `404`, en nommant
les manquants. Un lot partiellement appliqué vous laisserait croire que toute la sélection est
passée.

`Publish` est **idempotent sur la date** : republier ne réécrit pas la date de publication,
sinon un passage groupé ferait remonter dans le KPI du jour des adresses diffusées depuis des
semaines.

### 5.6 Les deux routes que nous n'implémenterons pas

**`POST /api/adresses/approve`** fait double emploi avec `PATCH /bulk` + `stage: "Approved"`.
Deux routes pour une transition, à maintenir cohérentes indéfiniment. Utilisez `/bulk`.

**`POST /api/adresses/{id}/flag`** : signaler *est* rejeter le relevé, et cette action existe
déjà — `POST /api/surveys/{id}/reject`. Votre route ne pourrait de toute façon pas fonctionner
telle que spécifiée : son corps est `{}` vide, alors qu'un rejet exige un `rejectionReason` et
l'identité du superviseur.

**Et surtout : les étapes `registered`, `surveyed` et `verified` ne sont pas inscriptibles.**
Elles se **déduisent** du dernier relevé. Un relevé porte des **photos**, un point GPS, un
écart à la parcelle : le valider, c'est les examiner. Un bouton « approuver les 40
sélectionnées » ne fait pas ce contrôle — il le court-circuite en le donnant à croire, et
toute la valeur du cycle de validation vient de ce que quelqu'un a réellement regardé.

Conséquence pour votre UI : **la file de validation est une liste qu'on traite un élément à la
fois, photos affichées** — pas un tableau à cases à cocher suivi d'une action de masse. Les
routes à utiliser sont en §4.4, et `GET /api/surveys/{id}/photos` sert l'examen.

Les actions groupées restent légitimes sur `approved` / `published` : ce sont des décisions
administratives qui n'examinent aucune photo. D'où `/bulk`, restreint à ces deux étapes.

### 5.7 `workflowStage` — la fusion de deux cycles

| Valeur | D'où elle vient |
|---|---|
| `registered` | aucun relevé, **ou dernier relevé rejeté** |
| `surveyed` | dernier relevé en `Draft` ou `Submitted` |
| `verified` | dernier relevé `Validated` |
| `approved` | décision back-office (`PATCH /bulk`) |
| `published` | décision back-office (`PATCH /bulk`) |

Les trois premières sont **dérivées et en lecture seule**. Les deux dernières sont stockées et
**l'emportent** quand elles sont posées, étant postérieures au relevé.

Notez que **`Rejected` retombe sur `registered`**, pas sur `surveyed` : un relevé rejeté ne
vaut pas constat, la parcelle est à refaire. C'est ce qui garde `summary` et la liste cohérents
sur la même population.

⚠️ Ce mapping perd deux informations du modèle que vos 5 étapes ne peuvent pas porter : le
`ValidationType` (`Definitive` / `Temporary`) et la troisième issue du superviseur
(`request-correction`). Ne les gérez pas depuis le Registry — passez par `/api/surveys`.

---

## 6. Ce qui n'existe pas côté back

Ces routes figurent dans vos services et **n'ont aucune contrepartie**. Ce ne sont pas des
oublis d'implémentation : le besoin n'a jamais été conçu côté back.

> `registry-api` a quitté ce tableau le 2026-08-18 : les 7 routes sont livrées, voir
> [§5](#5-écran-registry--apiadresses).

| Votre service | Routes | Statut |
|---|---|---|
| `clients-api` | `clients`, `subscription-plans`, `zones`, `zone-access`, `api-token` (11 routes) | **Périmètre à confirmer.** Aucune entité `Client`, `SubscriptionPlan` ni `ApiToken`. Suppose un second modèle d'authentification (jeton machine). ⚠️ `/api/zones` **existe** mais désigne une subdivision de commune, **pas** un périmètre concédé à un client — même mot, deux notions. |
| `notifications-api` | `GET /notifications`, `PATCH /{id}/read`, `PATCH /read-all` | Non conçu. Chantier autonome ; il faut d'abord définir ce qui déclenche une notification. |
| `dashboard-api` | `GET /dashboard/summary` | N'existe pas. Le plus proche est `GET /api/campaigns/{id}/progress`, scopé à une campagne. |
| `review-api` | `GET /queue`, `POST /{submissionType}/{id}/approve\|reject` | **Logique présente, façade absente.** Utilisez les trois files : `/api/surveys?status=Submitted`, `/api/blocs/suggestions?status=Pending`, `/api/streets/suggestions?status=Pending`. Attention à ne pas perdre `request-correction`, troisième issue que votre modèle à deux boutons ne prévoit pas. |
| `addressing-api` | `GET /addressing/properties-to-number`, `PATCH /addressing/properties/{id}/house-number` | **Bloqué par le modèle.** `Adresse.Numero` est obligatoire à la création : une parcelle sans numéro n'est pas représentable. Arbitrage responsable projet en attente. |
| `addressing-api` | `POST /blocs/{id}/name`, `POST /streets/{id}/name` | Pas de nommage direct — voir le flux de suggestions (§3.5). |

---

## 7. Actions et questions

### De votre côté

1. **Passer `cityId` sur `POST`/`PATCH /api/quartiers`**, et rendre le sélecteur de commune
   **facultatif** — c'est le changement bloquant de cette version.
2. **Ajouter `code` au formulaire de ville** (entier 1–99).
3. **Lire `postcode` et `addressCode`** au lieu de les composer, et gérer leur `null` comme
   une information, pas comme une donnée manquante.
4. **Remplacer le test `areaNumber === 0`** par un test de `null`.
5. **Corriger les 8 appels de suggestions** : `POST` au lieu de `PATCH`, chemin sans
   `blocId`/`streetId`, champ `rejectionReason` au lieu de `reason`.
6. **Ajouter `campaignId`** à l'affectation d'un bloc.
7. **Prévoir le 3ᵉ bouton** `request-correction` sur l'écran de validation.
8. **Stocker le refresh token renvoyé** à chaque appel de `/refresh` (rotation), et
   sérialiser les refresh concurrents.
9. **Ajouter `number` au formulaire de bloc** (entier > 0, unique dans le quartier).
10. **Brancher les 7 routes Registry** (§5), en retirant `POST /approve` et
    `POST /{id}/flag` de vos services au profit de `PATCH /bulk` et
    `POST /api/surveys/{id}/reject`.
11. **Retirer le rendu en `%` de `validation.score`** — c'est un décompte de relevés, et
    `percentage` peut dépasser 100.
12. **Renommer l'affichage de `duplicatesFlagged`** : ce sont des relevés rejetés, pas des
    doublons.
13. **Retirer `street` de la liste, de la fiche et de `linked`** tant que la règle métier du
    module Voirie n'est pas arrêtée — le champ reste présent mais toujours `null`.
14. **Transformer la file de validation en traitement un-par-un** avec photos, plutôt qu'en
    tableau à cases à cocher (§5.6).

### De notre côté

**Livré le 2026-08-18** : module Registry complet (§5), pagination — l'enveloppe
`{ items, total, page, pageSize }` devient la convention transverse —, code postal et code
d'adresse dérivés, cycle de publication, endpoint de productivité.

Identifiés, non planifiés : façade de file de validation unifiée, module notifications,
journal d'audit (`history`), régime d'occupation (`occupancyType`), score de qualité d'un
relevé, pagination des autres listes.

### Questions encore ouvertes

**Tranchée depuis la version précédente — Q4 « région ».** `region` = notre `City`. Il n'y a
pas de niveau administratif au-dessus de la ville dans ce modèle ; `cityId` fait foi et
`region` n'est qu'un renommage à la projection. Si vous visiez les six régions
administratives de Djibouti comme un niveau **au-dessus** de la ville, dites-le maintenant :
c'est une entité, une migration et une reprise de données.

Restent ouvertes :

1. **Le back-office couvre-t-il le module recensement terrain** (campagnes, affectations,
   relevés), ou est-ce une application distincte ? Aucun de ces appels n'apparaît dans vos
   services, alors que c'est le module le plus fourni côté back. La réponse conditionne
   l'ordre de priorité de tout le reste.
2. **Une parcelle peut-elle exister sans numéro ?** Si oui, c'est un changement de modèle sur
   `Adresse`, pas un endpoint à ajouter — arbitrage responsable projet.
3. **Le module clients / abonnements / jetons d'API est-il dans le périmètre ?** 11 routes et
   4 entités inexistantes : c'est un chantier à part entière.
4. **`street` sur le Registry** : votre contrat porte une rue par adresse, notre `Street` est
   une entité autonome non rattachée aux parcelles. **Reporté à votre demande** — la règle
   métier du module Voirie n'est pas arrêtée. Le champ reste exposé et toujours `null`.
5. **`occupancyType`** (`owner` / `tenant` / `vacant`) n'est relevé nulle part. À ne pas
   confondre avec `EtatOccupation`, qui est l'état du **bâti** (Bon état, Dégradé, En
   ruine…). Si le régime d'occupation doit être collecté, c'est un champ à ajouter au relevé
   terrain — donc à l'application agent.
6. **`propertyType`** : nous renvoyons le libellé français du catalogue `TypeOccupation`
   (11 valeurs : Maison individuelle, Villa, Immeuble d'habitation, Immeuble mixte…), pas votre
   liste fermée `residential|commercial|industrial|institutional`. C'est un **catalogue en
   base**, fait pour évoluer sans déploiement, et les granularités ne coïncident pas
   (« Immeuble mixte » n'a pas de case chez vous). Contre-proposition : nous ajoutons une clé
   stable au catalogue (`maison_individuelle`, `villa`…) que vous traduisez en
   `registry.type.{clé}`, avec repli sur le libellé français renvoyé à côté — ainsi ajouter un
   type ne casse plus votre écran.
7. **`history[]`** : aucun journal d'audit n'existe, sur l'adresse ni ailleurs. Nous pouvons en
   construire un, mais il faut d'abord décider **ce qu'on trace** : création de parcelle,
   changement de numéro, de géométrie, transitions du relevé ? Les clés i18n suivront cette
   décision, pas l'inverse.
