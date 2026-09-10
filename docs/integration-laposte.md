# Brancher la Plateforme 1 sur le référentiel public D.A.S

> Note d'intégration destinée à l'équipe technique de La Poste de Djibouti.
> Version du 2026-09-10. Clé `das_SEjertCf`.
>
> Côté D.A.S, la source de vérité reste [`plans/referentiel-public.md`](plans/referentiel-public.md).

---

## La clé

| | |
|---|---|
| Préfixe | `das_SEjertCf` |
| Délivrée à | La Poste de Djibouti — backend Plateforme 1 (prod) |
| Portée | **tout le pays** |
| Délivrée le | 10 septembre 2026 |

Le préfixe identifie la clé **sans la révéler** : c'est lui qui figure dans nos écrans et dans nos
échanges. Le secret complet vous parvient par un autre canal.

> ⚠️ Le secret ne doit jamais apparaître dans un ticket, un dépôt, ni une capture d'écran.

---

## Ce qui a changé

Martin, notre serveur de tuiles, **auto-publiait tout ce que son rôle peut lire** — 34 sources au
dernier relevé, dont les tables du recensement. Il était accessible sans authentification.

**Cette porte est fermée.** Les anciens chemins rendent `410 Gone`. Ce n'est pas une panne et ce
ne sera pas rouvert : le relais est le seul endroit où l'appelant peut être vérifié avant que
l'octet ne parte.

À la place, un relais qui n'expose qu'une **liste blanche** de cinq sources.

---

## Présenter la clé

Deux formes sont acceptées. **Pour vous, c'est l'en-tête.**

```http
X-DAS-Key: das_SEjertCf.…
```

> ⚠️ **Ne posez jamais la clé dans le navigateur.** Le paramètre d'URL `?cle=` existe uniquement
> parce que MapLibre construit lui-même ses URL de tuiles et n'accepte aucun en-tête. Votre
> architecture n'a pas cette contrainte : la Plateforme 1 relaie, donc la clé reste dans votre
> configuration serveur — variable d'environnement ou `appsettings`, jamais dans le code livré au
> client.

Une clé absente, inconnue ou révoquée rend le **même `401`**. Nous ne distinguons pas les cas :
cela indiquerait à un tiers lesquels de ses essais tombent sur une clé ayant existé.

---

## Les tuiles

```http
GET https://carte.das.dj/api/public/tiles/{source}/{z}/{x}/{y}
X-DAS-Key: das_SEjertCf.…
```

C'est cette base qui remplace `__TILES_BASE_URL__` dans le style.

### Les cinq sources autorisées

| Source | Contenu |
|---|---|
| `quartiers_tiles` | Quartiers, avec leur code postal |
| `streets_tiles` | Voirie — rues, avenues, routes, pistes |
| `adresses_tiles` | Parcelles adressées |
| `poi_sites_tiles` | Lieux remarquables, regroupés par site |
| `cities_labels_tiles` | Étiquettes des villes |

Toute autre valeur rend `404`, **y compris avec une clé valide**. La liste est blanche et non
noire : une source ajoutée chez nous ne devient pas accessible du seul fait qu'on aurait oublié de
l'interdire.

### Les codes de réponse

| Code | Sens | À faire |
|---|---|---|
| `200` | La tuile, en protobuf | Relayer telle quelle |
| `204` | Tuile vide — **légitime** | Relayer le 204 |
| `401` | Clé absente, inconnue ou révoquée | Vérifier la configuration, nous contacter |
| `404` | Source hors liste blanche | Corriger le nom de la source |

> ⚠️ **Ne transformez pas un `204` en erreur.** Une tuile vide est la réponse normale pour la très
> grande majorité des tuiles d'un niveau de zoom. La traiter comme un échec ferait clignoter des
> erreurs sur une carte qui fonctionne parfaitement.

---

## Le style

Inchangé, et toujours récupéré chez nous plutôt que recopié — c'est ce qui garantit que vous voyez
exactement ce que nous voyons.

```http
GET https://carte.das.dj/carto/commercial-style.json     ← le chemin que vous utilisez
GET https://carte.das.dj/assets/commercial-style.json    ← le même fichier
```

Les deux chemins servent le même octet. **Pas de clé requise** : le style ne contient aucune
donnée, seulement la façon de la dessiner.

---

## La recherche

Si vous branchez un jour notre recherche plutôt que la vôtre, elle exige **la même clé**, dans le
même en-tête.

```http
GET https://carte.das.dj/api/public/search?q=ambouli&limite=8
X-DAS-Key: das_SEjertCf.…
```

Elle couvre villes, quartiers, rues nommées, lieux remarquables et parcelles identifiées.
Insensible aux accents — `ecole` trouve `École`. Deux caractères au minimum ; en deçà la réponse
est vide.

---

## La carte vitrine

Votre bouton « Ouvrir dans la carte D.A.S » fonctionne déjà. Page publique, **aucune clé à
présenter** — elle porte la sienne.

```
https://carte.das.dj/carte?lat=11.5939&lng=43.1509&z=17&marker=43.1509,11.5939&label=Agence%20centrale
```

> ⚠️ **`marker` vaut « longitude,latitude ».** C'est l'ordre de MapLibre — l'inverse de `lat` et
> `lng`, qui l'accompagnent pourtant dans la même URL. Les deux conventions cohabitent dans une
> seule requête ; c'est la source d'erreur classique, et un repère posé à l'envers tombe en pleine
> mer.

Tous les paramètres sont facultatifs et validés : un paramètre absent ou illisible rend le cadrage
par défaut, **jamais une carte vide**. Le zoom est plafonné à 19 — au-delà les tuiles n'existent
pas et la carte se viderait, ce qui se lit comme une panne.

---

## À corriger chez vous

### 1. Le relais de production doit présenter la clé

Votre `README` décrit bien le relais, mais **aucune clé n'y est câblée** — nous avons cherché
`X-DAS-Key`, `dasKey` et `apiKey` dans le dépôt. Sans l'en-tête, toutes les tuiles rendront `401`
et la carte restera blanche.

### 2. La procédure de démonstration locale ne tient plus

`environment.development.ts` pointe `tilesUrl` sur `http://localhost:3000`, et le `README`
annonce « Martin publié sur :3000 ». **Martin n'expose plus aucun port** : il n'existe que sur le
réseau interne de la composition Docker.

Faites passer le développement par le relais, exactement comme la production — avec une clé de
recette distincte, que nous vous délivrons sur demande. Le mode dev répète alors le vrai geste, y
compris « on a perdu la clé, on en redemande une ».

---

## Si la clé fuite

Dites-le-nous, sans hésiter ni attendre. Nous révoquons et redélivrons ; de votre côté c'est une
ligne de configuration à changer. **C'est précisément pour que ce soit anodin que la clé existe.**

Nous ne pouvons pas vous la **retrouver** : nous n'en conservons que l'empreinte, jamais le
secret. Une clé perdue ne se récupère pas, elle se remplace.

Pour une clé de recette, un élargissement de portée ou une révocation, revenez vers nous avec le
préfixe `das_SEjertCf`.
