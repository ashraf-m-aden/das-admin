# DAS API — Guide d'intégration front

> À l'attention de l'équipe front. Ce document décrit **ce que l'API expose réellement** et
> les conventions transverses à respecter.
>
> **Mise à jour du 2026-08-26.** Introduction de la **close** — la portion de rue à
> l'intérieur d'un quartier, qui nomme désormais l'adresse à la place du bloc — avec l'écran
> de validation de la numérotation qu'elle impose ([§3.6](#36-closes--la-portion-de-rue-qui-nomme-ladresse)),
> et le champ `street`, `null` depuis l'origine, enfin rempli.
>
> **Mise à jour du 2026-08-18.** Ville obligatoire / commune facultative sur un quartier,
> `code` de ville, numéro de quartier, code postal dérivé, code d'adresse ; réponse à la
> question « région » restée ouverte depuis le 2026-08-12. **La section 0 liste ce qui casse
> par rapport aux versions précédentes** — commencez par là si vous aviez déjà intégré.
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
| Afficher `libelle` au format `42 B12, Gachamaleh, Djibouti` | Format actuel : **`42, rue de la Mosquée, Gachamaleh Djibouti`** — la rue a remplacé le bloc le 2026-08-23 | [§3.4](#34-blocs-et-adresses) |
| Lire `addressCode` comme `Ville-Quartier-**Bloc**-Numéro` | Le 3ᵉ segment est le numéro de **close** : `77-007-3-42` | [§2.5](#25-addresscode--figé-à-la-validation-définitive) |
| Traiter `street` comme définitivement `null` | **Rempli** : `closeId`, `closeCode` et `streetName` sont exposés sur `AdresseResponse` | [§3.6](#36-closes--la-portion-de-rue-qui-nomme-ladresse) |
| — | Nouvelle ressource **`/api/closes`** et **écran de validation de la numérotation** (aperçu sur carte, correction, application) | [§3.6](#36-closes--la-portion-de-rue-qui-nomme-ladresse) |
| Question ouverte « qu'est-ce qu'une région ? » | **Tranchée** : `region` = notre `City`. Pas de niveau au-dessus | [§7](#questions-encore-ouvertes) |
| `registry-api` : 0 route sur 7 | **Les 7 sont livrées.** Nouvelle section dédiée | [§5](#5-écran-registry--apiadresses) |
| — | Nouvel endpoint **productivité des releveurs** | [§4.7](#47-productivité-des-releveurs) |
| Parser `boundaryWkt` d'une rue comme `LINESTRING(…)` | ⚠️ **Rupture.** La sortie est désormais **toujours** `MULTILINESTRING ((…))`, y compris pour les rues créées avant. En **entrée**, `LINESTRING` reste accepté | [§1.6](#16-sérialisation) |
| Afficher les `reasons` de `/api/surveys/suspicious` telles quelles | ⚠️ **Rupture.** Ce ne sont plus des phrases françaises mais des objets **`{ code, args }`** : les libellés vous appartiennent | [§4.4](#44-relevés--apisurveys) |
| — | Nouvelle route **`POST /api/surveys/{id}/dismiss-suspicion`** (écarter un signal) + filtre **`?includeDismissed=`** sur la file anti-fraude | [§4.4](#44-relevés--apisurveys) |
| `POST /api/surveys/{id}/photos` avec `{ photoUrl }` | ⚠️ **Rupture.** Le corps est `{ photoId }`, et une photo se téléverse en **trois temps** via une URL pré-signée délivrée par l'API. Pas de période de compatibilité | [§4.4](#44-relevés--apisurveys) |
| — | Nouvelles routes **`POST /api/surveys/{id}/photos/upload-url`**, **`DELETE /api/surveys/{id}/photos/{photoId}`**, et la **galerie `GET /api/campaigns/{id}/photos`** | [§4.4](#44-relevés--apisurveys) |
| Afficher les photos d'un relevé à pleine taille | `thumbnailUrl` sert une **vignette** ; `expiresAtUtc` dit quand les URLs signées expirent | [§4.4](#44-relevés--apisurveys) |

Les **six dernières lignes datent des 2026-08-28 et 2026-08-30** et ne sont **pas encore en production** :
elles sont livrées sur la branche `feat/registry-adresses` et arriveront avec la prochaine mise
en production de `das-backend`. Elles sont documentées ici pour que vous puissiez préparer les
corrections — vérifiez la disponibilité avant de basculer vos écrans.

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
  ⚠️ **Le tracé d'une rue (`Street.boundaryWkt`) est un `MULTILINESTRING` depuis le
  2026-08-28**, parce qu'une rue réelle peut être coupée en plusieurs tronçons (rond-point,
  place, section non revêtue) — 24 rues de la livraison SIG sont dans ce cas. Deux
  conséquences asymétriques, à ne pas confondre :
  **en entrée**, rien ne change : un `LINESTRING(...)` envoyé à `POST`/`PATCH /api/streets`
  est toujours accepté, le serveur l'enveloppe (`ST_Multi`) ;
  **en sortie**, tout est `MULTILINESTRING ((...))`, y compris les rues créées avant ce
  changement. Un parseur qui teste le préfixe `LINESTRING` cesse de fonctionner — c'est le
  seul point d'attention réel de ce changement.
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

Format **`Ville-Quartier-Close-Numéro`, entièrement numérique** : `77-007-3-42` se lit
Djibouti (77), quartier 7, close 3, maison 42. `City.Code` sur 2 chiffres, `AreaNumber` sur 3,
puis le numéro de close et le numéro de maison au naturel. Exposé dans `AdresseResponse`.

> **Le troisième segment a changé de sens le 2026-08-23** : c'était le numéro de **bloc**,
> c'est le numéro de **close**. La structure ne bouge pas (quatre segments, même largeur), et
> le format n'ayant jamais été posé sur aucune parcelle avant cette date, il n'y a pas deux
> générations de codes à distinguer. Le bloc reste le découpage de **travail** (affectation
> des agents) ; il a seulement cessé de nommer l'adresse.

> **Changement du 2026-08-18** — le format annoncé précédemment (`DJ-BLS-Q7-0042`) est
> abandonné. Il portait un segment commune, or seule Djibouti-ville a des communes : le nombre
> de segments variait d'une ville à l'autre et le code devenait indécodable. Le préfixe pays
> `DJ` a sauté pour la même raison — constant, il ne discrimine rien.

**Les quatre segments sont nécessaires à l'unicité**, aucun n'est décoratif : le numéro de
maison n'est unique que dans sa close, la close que dans son quartier, le quartier que dans sa
ville. Sans le troisième segment, 165 adresses de notre base de test retombaient sur 67 codes.

Trois propriétés à retenir :

- **Il est posé une seule fois**, au moment où un relevé de cette parcelle est validé en
  `Definitive`, et **n'est plus jamais réécrit**. Renommer le quartier ensuite ne le change
  pas : c'est un identifiant, pas un libellé.
- **Il vaut `null` tant qu'aucun relevé définitif n'a eu lieu.** Ce n'est pas un manque de
  données à combler côté front — c'est l'information « cette adresse n'est pas encore
  officielle ». Un badge « en cours d'adressage » est le bon rendu.
- **Il vaut aussi `null` si un composant manque** : ville sans `code`, quartier sans
  `areaNumber`, **parcelle pas encore rattachée à une close**. Mieux vaut aucun code qu'un code
  tronqué, puisqu'il n'est jamais réécrit. Tant que la reprise des closes n'est pas faite,
  aucune validation définitive ne pose de code : c'est voulu.

À ne pas confondre avec `libelle`, qui est le libellé humain composé à la volée (numéro,
bloc, quartier, ville) et toujours présent.

---

## 3. Référentiel géographique

La hiérarchie est **City → [Commune] → [Zone] → Quartier → Close → Bloc → Adresse**.
`Arrondissement` et `Lot` **ont été supprimés** en août 2026 : retirez-les de vos modèles
s'ils y traînent encore.

> **La `Close` est nouvelle (2026-08-23) et c'est elle qui nomme désormais l'adresse** :
> c'est la portion d'une rue à l'intérieur d'un quartier. `Street` reste une entité autonome
> et transversale — une rue traverse plusieurs quartiers, elle ne peut donc pas en porter un —
> mais elle n'est plus sans lien avec la hiérarchie : c'est la close qui fait le raccord.
> Voir [§3.6](#36-closes--la-portion-de-rue-qui-nomme-ladresse).

Tous les niveaux suivent le même CRUD : `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`,
`DELETE /{id}` (**Admin seul** sur `DELETE`).

| Ressource | Route | Filtres de liste |
|---|---|---|
| Villes | `/api/cities` | — |
| Communes | `/api/communes` | `?cityId=` |
| Zones | `/api/zones` | `?communeId=` |
| Quartiers | `/api/quartiers` | `?cityId=`, `?communeId=`, `?zoneId=` (cumulables) |
| Blocs | `/api/blocs` | `?quartierId=` |
| Adresses (parcelles) | `/api/adresses` | `?blocId=`, `?closeId=` |
| Rues | `/api/streets` | — |
| Closes | `/api/closes` | `?quartierId=`, `?streetId=` |

**Suppressions** : `DELETE` sur une ville, une commune ou une zone est refusé en `409` tant
qu'elle a des enfants (voir les codes en §1.5) — videz le niveau du dessous d'abord. À
l'inverse, supprimer un quartier ou un bloc **emporte en cascade** ses blocs et adresses,
sans avertissement. Confirmez côté UI.

Le `PATCH` de chaque ressource attend **le corps complet** de la ressource (ce n'est pas un
patch partiel champ par champ) : renvoyez l'objet tel que vous l'avez lu, modifié.

**Rues** : `Street.boundaryWkt` est un **`MULTILINESTRING`** — une rue réelle peut être coupée
en plusieurs tronçons. Voir [§1.6](#16-sérialisation) pour l'asymétrie entrée/sortie.

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
  "addressCode": "77-007-3-42",
  "libelle": "42, rue de la Mosquée, Gachamaleh Djibouti",
  "closeId": "…", "closeCode": "GA-MOSQUEE", "streetName": "rue de la Mosquée"
}
```

- **`closeId`, `closeCode` et `streetName` sont nouveaux (2026-08-23).** Les trois valent
  `null` tant que le bloc de la parcelle n'est pas rattaché à une close — état normal en
  attendant la reprise, pas une donnée manquante. **Les champs `blocId` / `blocCode` /
  `blocName` restent en place** : le bloc demeure le découpage de travail.
- `streetName` est **brut** : il vaut `null` aussi quand la rue existe mais n'est pas encore
  nommée (elle se nomme par une suggestion, §3.5). C'est `libelle` qui porte le repli.
- **`libelle` nomme la parcelle par sa rue depuis le 2026-08-23** :
  `42, rue de la Mosquée, Gachamaleh Djibouti`. La virgule sépare la maison de la voie puis la
  voie du quartier ; quartier et ville restent collés, ils forment la localité.
- **`libelle` est calculé côté serveur** et suit une chaîne de repli qui ne le laisse jamais
  troué : `streetName`, sinon le numéro de close, sinon son code — et **tant que la parcelle
  n'a pas de close**, l'ancien libellé par bloc (`42, bloc 2, Gachamaleh Djibouti`).
  **Affichez-le, ne le recomposez pas côté front** : vous ne sauriez pas dans quel régime vous
  êtes.
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

### 3.6 Closes — la portion de rue qui nomme l'adresse

Une **close** est la portion d'une rue à l'intérieur d'un quartier. C'est ce qui manquait pour
rattacher les rues à la hiérarchie : une rue traverse plusieurs quartiers et ne peut donc pas
en porter un, une close si. **Un bloc appartient à une close et une seule**, et une parcelle
hérite de celle de son bloc — `Adresse.closeId` n'est jamais saisi, il est dérivé.

`CloseResponse` :

```json
{
  "id": "…", "quartierId": "…", "quartierNom": "Quartier 7", "quartierCode": "Q7",
  "streetId": "…", "streetCode": "R-MOSQUEE", "streetName": "rue de la Mosquée",
  "streetType": "Rue",
  "number": 3, "code": "Q7-MOSQUEE",
  "label": "rue de la Mosquée",
  "blocs": [ { "id": "…", "code": "Q7-A", "name": null, "number": 1 } ],
  "adresseCount": 21,
  "boundaryWkt": null
}
```

- `number` (1–999) est le **troisième segment du code d'adresse** (§2.5), unique dans le
  quartier. `code` est la désignation technique, également unique dans le quartier.
- `label` suit la même chaîne de repli que le libellé d'adresse : `streetName`, sinon
  `close {number}`, sinon `code`. `streetType` est exposé **brut et non concaténé** à
  `streetName` — le nom porte souvent déjà « rue », le préfixer donnerait « rue rue de la
  Mosquée ».
- **Le quartier n'est pas modifiable** après création : en changer déplacerait des parcelles
  déjà numérotées. Créez une close dans le bon quartier et déplacez-y les blocs.
- **Une rue ne porte au plus qu'une close par quartier** (409 sinon).

| Verbe | Route | Permission | Note |
|---|---|---|---|
| GET | `/api/closes?quartierId=&streetId=` | `closes.view` | |
| GET | `/api/closes/{id}` | `closes.view` | blocs rattachés + `adresseCount` |
| POST | `/api/closes` | `closes.create` | `{ quartierId, streetId, number, code, boundaryWkt? }` |
| PATCH | `/api/closes/{id}` | `closes.update` | corps complet ; changer `number` est refusé si un code d'adresse est figé |
| DELETE | `/api/closes/{id}` | `closes.delete` (**Admin**) | 409 tant qu'un bloc y est rattaché |
| POST | `/api/closes/{id}/blocs/preview` | `closes.update` | **n'écrit rien** — voir ci-dessous |
| POST | `/api/closes/{id}/blocs` | `closes.update` | rattache, et renumérote si on lui donne un plan |
| DELETE | `/api/closes/{id}/blocs/{blocId}` | `closes.update` | détache le bloc et retire la close de ses parcelles |

#### L'écran de validation de la numérotation

**Le problème que cet écran résout.** Chaque bloc numérote aujourd'hui ses parcelles à partir
de 1. Réunir plusieurs blocs sous une close fait donc collider leurs numéros — sur notre base
de test, 3 blocs du Quartier 7 donnaient 6 numéros portés par 2 ou 3 parcelles. Or dans un
adressage par rue, **les numéros courent le long de la voie et ne repartent pas à chaque
îlot** : rattacher impose de renuméroter. Le numéro finissant figé dans un code d'adresse qui
n'est jamais réécrit, la renumérotation ne peut pas être appliquée en aveugle : elle passe par
vous.

**Le parcours est en trois temps.**

**1. Demander une proposition** — `POST /api/closes/{id}/blocs/preview`

```json
{ "blocIds": ["…", "…"], "reverse": false }
```

```json
{
  "closeId": "…", "closeCode": "Q7-MOSQUEE",
  "orderingSource": "ParcelCloud", "reverse": false,
  "parcelCount": 21, "changedCount": 19,
  "adresses": [
    { "adresseId": "…", "blocId": "…", "blocCode": "Q7-A", "entering": true,
      "currentNumero": 5, "proposedNumero": 3, "distanceMeters": 25.9,
      "side": "Left", "addressCode": null,
      "locationWkt": "POINT (…)", "boundaryWkt": "MULTIPOLYGON (…)" }
  ]
}
```

Rien n'est écrit. La liste couvre **toutes les parcelles de la close résultante** — celles des
blocs demandés **et** celles déjà rattachées, dont les numéros peuvent devoir bouger pour
laisser la place aux nouvelles. Elle arrive triée par `proposedNumero`.

Les géométries sont dans la réponse pour que vous dessiniez sans second appel :
`boundaryWkt` pour la parcelle, `locationWkt` pour poser l'étiquette du numéro (ce point est
garanti **à l'intérieur** de la parcelle, contrairement au centroïde).

**2. Faire valider sur la carte.** C'est le cœur de l'écran : l'utilisateur doit voir que le
n° 1 précède bien le n° 2 le long de la voie. Deux corrections possibles, dans cet ordre :

- **le sens** — si la numérotation commence par le mauvais bout, rejouez l'aperçu avec
  `reverse: true`. C'est la correction la plus fréquente, le sens de parcours brut étant
  arbitraire (ouest → est, à défaut sud → nord) ;
- **au cas par cas** — l'utilisateur échange deux numéros, ou réordonne une portion. Vous
  modifiez le plan côté front, librement.

**3. Appliquer le plan validé** — `POST /api/closes/{id}/blocs`

```json
{
  "blocIds": ["…", "…"],
  "numbering": [ { "adresseId": "…", "numero": 1 }, { "adresseId": "…", "numero": 2 } ]
}
```

Rattachement et renumérotation dans une seule transaction. La réponse est le `CloseResponse`
complet — rafraîchissez la fiche close et les parcelles concernées.

**C'est bien le plan que vous renvoyez qui est écrit, pas un recalcul serveur.** Vos
corrections manuelles sont donc conservées telles quelles, et ce que l'utilisateur a validé
sur la carte est exactement ce qui part en base.

#### Les cinq règles que le serveur vérifie

| Règle | Erreur si violée | HTTP |
|---|---|---|
| Le plan couvre **toutes** les parcelles de la close résultante | `Closes.NumberingIncomplete` | 400 |
| Il ne contient **que** des parcelles de cette close | `Closes.NumberingForeignAdresse` | 400 |
| Les numéros sont **uniques** dans le plan | `Closes.NumberingDuplicate` | 400 |
| Les numéros sont compris entre **1 et 99 999** | `Closes.NumberingOutOfRange` | 400 |
| Aucune parcelle à **`addressCode` figé** ne change de numéro | `Closes.AddressCodeFrozen` | 409 |

Les autres refus possibles, communs à l'aperçu et à l'application : `Closes.NotFound` (404),
`Blocs.NotFound` (404, liste les identifiants inconnus), `Closes.BlocOutsideQuartier` (409 —
un bloc d'un autre quartier casserait le segment quartier du code d'adresse).

**L'aperçu applique exactement les mêmes gardes que l'écriture** : s'il répond, le plan est
applicable. Vous ne découvrirez pas un refus au dernier moment.

#### Six pièges

1. **`POST /api/closes/{id}/blocs` sans `numbering` est refusé en 409**
   (`Closes.DuplicateAdresseNumero`) dès que les blocs réunis portent des numéros en double —
   c'est-à-dire presque toujours. Ce n'est pas une erreur à afficher telle quelle : c'est le
   signal qu'il faut passer par l'aperçu. Le message le dit, mais l'utilisateur ne devrait
   jamais avoir à le lire — enchaînez directement sur l'écran de validation.
2. **`orderingSource` vaut aujourd'hui toujours `ParcelCloud`**, ce qui veut dire que l'ordre
   est déduit **des parcelles seules** : aucune rue n'a encore de tracé, l'axe est ajusté sur
   le nuage des parcelles. C'est une **estimation** — d'où cet écran. Le jour où les tracés
   arriveront, la valeur passera à `StreetLine` sans que le contrat change ; affichez-la, elle
   dit à l'utilisateur quelle confiance accorder à la proposition.
3. **`side` est indicatif et ne désigne pas un trottoir.** Sans tracé de rue, l'axe passe *à
   travers* les parcelles au lieu de passer *entre* les deux rangées : sur le Quartier 7, 16
   parcelles ressortent « à gauche » contre 5. **N'en déduisez aucune parité** (pairs d'un
   côté, impairs de l'autre) — c'est précisément pour ça que la numérotation proposée est une
   suite simple 1, 2, 3…
4. **`blocIds` peut être vide** si `numbering` est fourni : on ne fait alors que renuméroter
   une close existante. C'est le chemin pour corriger après coup un ordre qu'on s'aperçoit
   être faux.
5. **Rattachez tous les blocs d'une close en un seul appel** plutôt qu'un par un : l'ordre est
   calculé sur leur réunion. Bloc par bloc, chaque appel renumérote la close entière et vous
   validez N fois.
6. **`changedCount: 0` au rejeu de l'aperçu = la numérotation est stable.** C'est la façon de
   vérifier après coup qu'une close est bien numérotée : si le serveur ne propose plus rien de
   différent, l'ordre en base est celui qu'il aurait calculé.

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
| GET | `/api/surveys/suspicious` `?includeDismissed=` | Superviseur |
| GET | `/api/surveys/{id}` | |
| POST | `/api/surveys` | Agent |
| PATCH | `/api/surveys/{id}` | Agent |
| POST | `/api/surveys/{id}/photos/upload-url` | Agent |
| POST / GET | `/api/surveys/{id}/photos` | |
| DELETE | `/api/surveys/{id}/photos/{photoId}` | Agent |
| POST | `/api/surveys/{id}/submit` | Agent |
| POST | `/api/surveys/{id}/validate` | Superviseur |
| POST | `/api/surveys/{id}/reject` | Superviseur |
| POST | `/api/surveys/{id}/request-correction` | Superviseur |
| POST | `/api/surveys/{id}/dismiss-suspicion` | Superviseur |

Notes pour vos écrans :

- **Trois issues de validation, pas deux.** `validate`, `reject`, et `request-correction`
  (renvoi à l'agent pour complément). Prévoyez le troisième bouton.
- **`validate` porte un `validationType`** : `Temporary` rend la parcelle livrable tout en la
  laissant recontrôlable ; **`Definitive`** la sort du périmètre des campagnes suivantes et
  **fige le `addressCode`** (§2.5). C'est irréversible côté données — l'UI devrait le dire
  avant de confirmer.

  ⚠️ **Changement du 2026-08-31 : `validationType` est désormais REFUSÉ s'il est absent**
  (`400`, code `Surveys.MissingValidationType`). Il était typé enum non nullable : un corps
  `{}` se désérialisait en `Definitive` — premier membre de l'enum — et passait le contrôle
  sans rien signaler. **Tout appelant qui omettait le champ figeait donc le `addressCode` des
  parcelles qu'il validait, irréversiblement, sans l'avoir demandé.** Vérifiez vos appels :
  le champ n'a volontairement plus de valeur par défaut.

- **`validationType` est maintenant DANS `SurveyResponse`** (`null` tant que le relevé n'est
  pas validé). Le filtre `?validationType=` existait déjà, mais le champ n'était renvoyé nulle
  part : on pouvait demander les provisoires sans jamais pouvoir afficher qu'un relevé l'était.
  La file de suivi des `Temporary` — seule raison d'être de cette issue — est désormais
  constructible.
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

  ⚠️ **Rupture de contrat le 2026-08-28 : `reasons` n'est plus un `string[]`.** Le serveur
  envoyait des phrases françaises rédigées (`"Position GPS simulée signalée par l'appareil."`).
  Votre interface étant bilingue, elle affichait donc du français en anglais, sans aucun moyen
  de traduire : il aurait fallu reconnaître la phrase pour la retraduire. Chaque signal est
  maintenant un **code + des paramètres numériques**, et les libellés vous appartiennent :

  ```json
  { "code": "too_far", "args": { "distance": 138, "threshold": 100 } }
  ```

  Six codes, à couvrir tous les six : `mock_location`, `too_far`, `clock_ahead`, `late_sync`,
  `pushed_after_close`, `captured_late`. Les valeurs arrivent **en nombres, jamais
  pré-formatées** — le séparateur décimal dépend de la langue, c'est à vous de le poser.

  `too_far` transporte **aussi le seuil** (`threshold`), et la réponse porte
  `suspiciousDistanceM` à sa racine. Ne recodez pas « > 100 m » en dur : le seuil est
  configurable côté serveur (`Survey:SuspiciousDistanceM`) et **n'est pas arbitré à ce jour**
  — l'ordre de grandeur discuté va de 50 à 200 m. Un écran qui l'affiche en dur mentira au
  premier ajustement.

- **`POST /api/surveys/{id}/dismiss-suspicion`** — la file anti-fraude a enfin une sortie.
  Elle n'en avait aucune : un superviseur examinait un relevé signalé, concluait que l'écart
  s'expliquait, et retrouvait la même ligne au chargement suivant. Une file qui ne diminue
  jamais cesse d'être lue.

  > **Écarter un SIGNAL n'est pas valider le RELEVÉ.** Ce sont deux décisions, sur deux
  > écrans. Écarter dit « j'ai regardé cette alerte, elle est explicable » ; le relevé, lui,
  > **reste à valider ou rejeter normalement** dans la file de vérification
  > (`GET /api/surveys?status=Submitted`). Ne fusionnez pas les deux gestes dans un même
  > bouton : on validerait des relevés par inadvertance en nettoyant une file.

  Corps : `{ "reason": "…" }`, **motif obligatoire, 5 caractères minimum** — même exigence que
  le motif de rejet. Refusé sur son propre relevé. L'appel est **idempotent** : si un signal a
  déjà été écarté, un second appel ne remplace ni le motif ni l'auteur.

  Les relevés écartés **sortent de la file par défaut** et restent consultables avec
  **`?includeDismissed=true`** — un classement sans suite doit pouvoir être relu et contesté.
- `POST /api/surveys` renvoie **`201` à la création et `200` sur rejeu** d'un relevé déjà
  enregistré (tolérance hors ligne). Traitez les deux comme un succès, mais ne dupliquez pas
  la ligne dans l'UI sur un `200`.

- ⚠️ **Rupture de contrat le 2026-08-30 : les photos se téléversent en trois temps.**
  L'ancien circuit — le mobile déposait le fichier avec ses propres identifiants S3 puis
  envoyait `{ "photoUrl": "…" }` — est **supprimé sans période de compatibilité**. Des
  identifiants embarqués dans une application sont extractibles par décompilation ; il n'y en
  a désormais plus aucun, c'est l'API qui signe.

  1. `POST /api/surveys/{id}/photos/upload-url` avec `{ "photoId": "<uuid>", "contentType":
     "image/jpeg" }` → renvoie `uploadUrl`, `thumbnailUploadUrl`, `expiresAtUtc`, `maxBytes`.
  2. `PUT` des octets **directement** sur ces deux URLs. Le `Content-Type` est signé avec
     l'URL : envoyez exactement `image/jpeg`, sinon S3 refuse. Les octets ne passent jamais
     par l'API.
  3. `POST /api/surveys/{id}/photos` avec `{ "photoId": "<le même uuid>" }` → crée la ligne.

  **L'étape 3 n'est pas facultative** : S3 ne notifie personne après un `PUT`. Sans elle la
  photo reste invisible et le relevé reste bloqué à la soumission.

  **`photoId` est généré par vous**, côté mobile, avant tout réseau — l'agent photographie
  hors ligne. Les trois appels sont donc rejouables à l'identique après une coupure, sans
  doublon.

  **La vignette est obligatoire.** L'étape 3 refuse (`409 SurveyPhotos.ThumbnailMissing`) tant
  qu'elle n'est pas déposée. C'est elle qui rend la galerie du back-office utilisable sur une
  connexion lente : ne l'envoyez pas en pleine résolution.

  ⚠️ **Changement du 2026-08-31 : la vignette est contrôlée comme la photo pleine**, en taille
  et en format, alors que seule sa présence l'était. Les deux URLs signées ouvrent le même
  droit d'écriture : un envoi en pleine résolution sous la clé `_thumb` passait donc sans rien
  enfreindre, et le plafond ne couvrait que la moitié du circuit.

  **Vérifiez la taille AVANT d'envoyer.** Une URL PUT pré-signée ne peut pas borner ce qu'elle
  reçoit : le contrôle n'a lieu qu'à l'étape 3, donc **les octets ont déjà transité** quand le
  refus arrive. C'est précisément pour cela que `maxBytes` est renvoyé à l'étape 1 — sur une
  connexion de terrain, découvrir à la confirmation qu'un fichier de 20 Mo est refusé coûte
  deux minutes d'envoi pour rien.

  Les refus de l'étape 3, à traiter distinctement :

  | Code | Cause | L'objet est-il supprimé ? |
  |---|---|---|
  | `409 SurveyPhotos.NotUploaded` | aucun fichier déposé | — |
  | `409 SurveyPhotos.ThumbnailMissing` | vignette absente | **non** — la photo pleine est conservée, ne redéposez que la vignette |
  | `400 SurveyPhotos.TooLarge` | photo > 8 Mo | oui, tout redéposer |
  | `400 SurveyPhotos.InvalidFormat` | photo autre que JPEG | oui, tout redéposer |
  | `400 SurveyPhotos.ThumbnailTooLarge` | vignette > 8 Mo | oui, tout redéposer |
  | `400 SurveyPhotos.ThumbnailInvalidFormat` | vignette autre que JPEG | oui, tout redéposer |
  | `409 SurveyPhotos.TooMany` | 10 photos par relevé au maximum | — |

  La nuance sur `ThumbnailMissing` est délibérée : il ne manque qu'un petit fichier, tout
  effacer obligerait à retéléverser l'original pour rien.

- **`DELETE /api/surveys/{id}/photos/{photoId}`** — retirer un cliché flou d'un brouillon, par
  son auteur, tant que le relevé est en `Draft`. Le `{photoId}` de cette route est l'**`id` de
  la ligne** renvoyé par les lectures, pas l'uuid que vous aviez choisi à l'étape 1.

- **Lecture des photos** (`GET /api/surveys/{id}/photos` et la galerie) : chaque appel
  régénère des **URLs signées à durée limitée**. Deux champs à utiliser :
  - **`thumbnailUrl`** — la vignette. `null` pour les photos antérieures au 2026-08-30, qui
    n'en ont pas : retombez alors sur `readUrl`.
  - **`expiresAtUtc`** — l'expiration des deux URLs. Un écran laissé ouvert au-delà affiche
    des images cassées : rappelez l'endpoint plutôt que d'attendre l'erreur.

- **`GET /api/campaigns/{id}/photos`** — la galerie du back-office : toutes les photos d'une
  campagne, la plus récente d'abord, paginée (`page`, `pageSize`, 200 maximum) et filtrable
  par `blocId`, `agentId` et `status` (statut du **relevé** porteur). Réponse dans
  l'enveloppe `PagedResponse` habituelle ; chaque ligne porte `addressCode`, `agentId`,
  `surveyStatus` et `capturedAtUtc` de quoi légender la vignette sans second appel.

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
               "zone": "Zone 5", "street": "rue de la Mosquée", "quartier": "Gachamaleh",
               "propertyType": "Villa", "workflowStage": "verified",
               "lastUpdate": "2026-08-18T09:30:00Z", "assignedTeamName": "Ali Hassan",
               "geom": null, "libelle": "42, rue de la Mosquée, Gachamaleh Djibouti" } ],
  "total": 165, "page": 1, "pageSize": 25 }
```

- **`total` est le nombre de lignes après filtrage**, pas la taille de la page.
- **`pageSize` est plafonné à 200** ; au-delà, `400`. `page` commence à 1.
- **`geom` vaut toujours `null`.** La carte vient des tuiles.
- **`street` est rempli depuis le 2026-08-23** — la `Close` a créé la liaison adresse↔rue qui
  manquait (voir `contrat-api-registry.md` §3.2). Il contient le nom de la rue, à défaut
  « close N », à défaut le code de la close : **jamais une chaîne vide**. Il reste `null` pour
  une parcelle pas encore rattachée à une close, ce qui est le cas de **toute la base tant que la
  reprise de données n'est pas faite** — ne traitez pas ce `null` comme une anomalie.
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
  "components": { "street": "rue de la Mosquée", "quartierNom": "…", "zone": "…",
                  "commune": "…", "region": "Djibouti", "postcode": "77007" },
  "location": { "latitude": 11.57, "longitude": 43.14, "parcelNumber": "42" },
  "propertyInfo": { "propertyType": "Villa", "occupancyType": null, "buildingUse": null },
  "validation": { "score": 42, "percentage": 78, "notes": null },
  "history": [],
  "linked": [ { "id": "…", "kind": "block", "label": "bloc 2" },
              { "id": "…", "kind": "street", "label": "rue de la Mosquée" } ] }
```

⚠️ **`validation.score` n'est pas une note sur 100.** C'est le **nombre de relevés effectués
par l'agent** sur la campagne — sa production — et `percentage` est sa part de charge
couverte. **Retirez le rendu en `%` sur `score`** : votre contrat annonçait « entier 0–100
interprété comme un pourcentage », ce n'est plus le cas.

⚠️ **`percentage` peut dépasser 100**, et ce n'est pas une anomalie. Après une réaffectation,
la charge bascule sur le nouveau titulaire mais la production reste à celui qui a relevé. Ne
le plafonnez pas et ne le traitez pas comme une erreur.

`linked[].kind` vaut `block`, `postcode`, `street` ou `team`. **`street` est émis depuis le
2026-08-23** — et son `id` est celui de la **rue**, pas de la close : c'est l'entité que
l'utilisateur reconnaît. L'entrée `block` reste présente : le bloc ne nomme plus l'adresse, mais
il reste le découpage de travail par lequel on retrouve l'agent.

La fiche porte aussi `closeId`, `closeCode` et `streetName` à sa racine — ajoutés à côté des
champs bloc, qui sont tous conservés.

Restent `null` faute de modèle : `occupancyType`, `buildingUse`, `validation.notes`, et
`history` est toujours `[]` — aucun journal d'audit n'existe. Ne prévoyez pas de clés i18n
`history.*` pour l'instant.

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
13. ~~**Retirer `street` de la liste, de la fiche et de `linked`.**~~ **Annulé le 2026-08-23** :
    gardez-les, ils sont désormais alimentés (§5.3, §5.4). Prévoyez en revanche le rendu du
    `null` transitoire — voir §5.3.
14. **Transformer la file de validation en traitement un-par-un** avec photos, plutôt qu'en
    tableau à cases à cocher (§5.6).
15. ⚠️ **Remplacer l'affichage des `reasons` de `/api/surveys/suspicious`** : ce sont
    maintenant des objets `{ code, args }` et non des phrases. Prévoir les six codes et vos
    propres libellés, dans les deux langues (§4.4). **Bloquant** : sans cette correction,
    l'écran anti-fraude n'affiche plus rien d'exploitable.
16. ⚠️ **Vérifier tout parseur de `boundaryWkt` sur les rues** : la sortie est passée de
    `LINESTRING(…)` à `MULTILINESTRING ((…))`, y compris pour les rues existantes (§1.6).
    **Bloquant** si vous testez le préfixe.
17. **Brancher l'écartement d'un signal** (`POST /api/surveys/{id}/dismiss-suspicion`) et le
    filtre `?includeDismissed=`, en gardant ce geste **distinct** de la validation du relevé
    (§4.4).

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
4. ~~**`street` sur le Registry**~~ — **résolu le 2026-08-23, votre contrat avait raison.** Une
   adresse porte bien une rue. Le blocage tenait à ce qu'une rue traverse plusieurs quartiers ;
   la **close**, portion d'une rue à l'intérieur d'un quartier, le lève. `street`,
   `components.street` et `linked.kind = "street"` sont alimentés — vous n'avez **rien à changer**
   à vos types. Détail en §5.3/§5.4 et dans `docs/plans/contrat-api-registry.md` §3.2.
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
