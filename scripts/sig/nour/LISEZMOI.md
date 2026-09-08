# Schéma `nour` — couches SIG livrées le 2026-09-04

Reprise des dumps GDAL de l'expert SIG, réécrits du schéma `public` vers `nour`.
**Rien n'est modifié dans `public`.** Les dumps d'origine restent dans `~/Downloads`.

## Organisation

Seuls les scripts écrits à la main sont ici (versionnés). Les 17 dumps réécrits pèsent 18 Mo
et vivent **hors du dépôt**, dans `D:/projet/angular project/das/sig-nour`.
`gen_nour.py` les régénère depuis les fichiers de l'expert (`~/Downloads`) : il ne fait que
réécrire `public.<table>` en `nour.<table cible>`, rien d'autre.

```bash
python gen_nour.py                      # regénère les dumps dans ../../../../sig-nour
PGPASSWORD=... ./charger.sh "host=localhost port=5433 dbname=das user=postgres"
```

Ordre : `00_schema` → `10..23` (national) → `30..32` (Djibouti-ville) → `90_post` (reprojection 4326 + réparation géométries) → `91_controle` (vues de contrôle).
Chaque dump est dans sa propre transaction et commence par `DROP TABLE IF EXISTS "nour".<table> CASCADE` : le chargement est rejouable.

## Contenu

### Lot national (fond de carte) — nouveau
| Table `nour` | Fichier source | Géom | Lignes |
|---|---|---|---|
| `frontiere` | FRONTIERE.sql | MULTILINESTRING | 3 |
| `contour_rdd` | ContourRDD.sql | MULTIPOLYGON | 10 |
| `lacs` | LAKE.sql | MULTIPOLYGON | 13 |
| `banquise_sel` | BANQUISEL.sql | MULTIPOLYGON | 1 |
| `forets` | FORETS.sql | MULTIPOLYGON | 9 |
| `oueds_principaux` | OUEDPRINCIPAUX.sql | MULTILINESTRING | 1 475 |
| `routes_1` | ROUTES1.sql | MULTILINESTRING | 73 |
| `routes_2` | ROUTES2.sql | MULTILINESTRING | 31 |
| `pistes_1` | PISTES1.sql | MULTILINESTRING | 438 |
| `pistes_2` | PISTES2.sql | MULTILINESTRING | 153 |
| `chemin_fer` | CHEMINFER.sql | MULTILINESTRING | 2 |
| `villes_pt` | VILLE.sql *(lot 16h31)* | POINT | 6 |
| `villages_pt` | VILLAGE.sql | POINT | 79 |
| `postes_administratifs` | POSTADMINST.sql | POINT | 8 |

### Lot Djibouti-ville
| Table `nour` | Fichier source | Géom | Lignes | Remarque |
|---|---|---|---|---|
| `quartiers_ville_pg` | `VILLE.sql` *(zip WhatsApp)* | MULTIPOLYGON | 130 | **Ce sont les quartiers, pas les villes.** Probable doublon de `delimitations_quartiers`. |
| `ilots_src` | ILOTS.sql | MULTIPOLYGON | 3 701 | brut, non codifié |
| `parcelles_src` | Parcels.sql | MULTIPOLYGON | 28 476 | brut, non codifié |

## Pièges relevés dans la livraison

1. **Collision de nom `VILLE.sql`.** Deux fichiers différents portent ce nom et créent
   tous les deux `public.ville` : celui de 16h31 = 6 points (chefs-lieux), celui du zip = 130
   polygones (quartiers de Djibouti-ville). Chargés tels quels dans le même schéma, le second
   **détruit** le premier. Ici : `villes_pt` et `quartiers_ville_pg`.
2. **SRID hétérogène.** Tout est en **32638** (UTM 38N) sauf `chemin_fer`, livré en **4326**.
   `90_post.sql` reprojette tout en 4326.
3. **`ILOTS.sql` / `Parcels.sql` ne sont pas une mise à jour.** Ce sont les couches sources
   *avant* codification. Géométries identiques à `public.ilots_codifies` / `parcelles_codifiees`,
   mais **sans** `code_ilot`, `quartier_ville`, `num_parcelle`, `code_parcelle`.
   Écart réel : **1 îlot et 2 parcelles** en plus dans le brut (`nour.v_ilots_nouveaux`,
   `nour.v_parcelles_nouvelles`). Ne pas repartir du brut.
4. **Libellés sales dans `ilots_src`** : `BOUALOS`/`BOULAOS`, `DEUEXIEME`, `TROISIIEME`,
   `QUATIER 1`, `QUARTIIER 6`, `CITE STATE`, `QUARTIER4` vs `QUARTIER 4`, `Z . I . S.` vs
   `Z . I . S .` — et **1 014 lignes sur 3 701 (27 %) avec commune/quartier à NULL**.
   Voir `nour.v_ilots_libelles`.
5. **`parcelles_src.type_usage` : 94 % NULL** (26 734/28 476) et 17 variantes orthographiques
   pour ~8 valeurs réelles (`INSTITUTIONNEL`/`INSTITUTIONNELLE`/`INSTITUTIONNALE`/`INTITUTIONNEL`,
   `COMMERCIAL`/`COMMERCIALE`, `AUTRE`/`AUTR`). Inexploitable en l'état comme `propertyType`.
6. **`quartiers_ville_pg` : 39 polygones sur 130 sans nom** (`name IS NULL`).
   Communes présentes : `BOULAOS`, `BALBALA`, `RAS DIKA` — pas de zone.
7. **`quartiers_ville_pg` est très probablement `delimitations_quartiers` re-livré.**
   Cette table est déjà en base et alimente `scripts/sig/emprises-quartiers.sql` — même SRID
   32638, même MULTIPOLYGON, **mêmes 91 emprises nommées**, seul `nom` devient `name`.
   Si c'est confirmé, la reprise des quartiers (13 → 76 emprises sur 84, faite le 2026-08-27)
   n'a rien à rejouer. Le bloc « B bis » de `91_controle.sql` tranche en comparant les
   géométries et émet un `NOTICE`.
8. **Deux jeux `routes_1`/`routes_2` et `pistes_1`/`pistes_2`** sans critère de découpage
   documenté. À clarifier avec l'expert avant de les fusionner en une couche « voirie ».

## Exposition Martin

Le schéma `nour` n'est pas publié tant qu'il n'est pas dans la config Martin.
Attention aux **collisions de nom de source** avec `public` (ex. `forets` seul vs `nour.forets`) :
préférer un nommage explicite côté config. `promoteId` doit rester `ogc_fid` pour ces couches,
comme les `sig*` déjà en place dans `map-style.json`.

## État — chargé le 2026-09-04

17 tables + 3 vues dans `nour`, **toutes reprojetées en 4326**. Réparations `ST_MakeValid`
appliquées : 2 géométries dans `forets`, 2 dans `contour_rdd`, 4 dans `ilots_src`,
4 dans `parcelles_src` (auto-intersections).

Vérifications sorties du chargement :

| Contrôle | Résultat |
|---|---|
| `quartiers_ville_pg` vs `delimitations_quartiers` | **130/130 géométries identiques** → doublon exact |
| `v_ilots_nouveaux` | 1 îlot, **0 m²** → artefact vide |
| `v_parcelles_nouvelles` | 2 parcelles, **0 m²** → artefacts vides |
| `routes_*` / `pistes_*` vs `voierie_*` et `route_principaux` en base | **0 % de recouvrement** → réellement nouveau |
| `nour.villes_pt` vs `public."Cities"` | 6 chefs-lieux contre **2 villes en base** |

Autrement dit : **seul le lot national est neuf.** Les trois couches Djibouti-ville sont des
re-livraisons, et ce qu'elles ont « en plus » est vide.

### Deux pièges rencontrés au chargement

- **Types trop étroits dans les dumps.** `ContourRDD.area` est déclaré `NUMERIC(13,11)`
  (max 99,99…) pour des valeurs à 2040,83 → `numeric field overflow`. `gen_nour.py` relâche
  `NUMERIC(p,s)` → `NUMERIC` et `VARCHAR(n)` → `VARCHAR` sur les `ADD COLUMN`, sans toucher
  aux valeurs.
- **Le rôle Martin est `martin_ro`, pas `martin`.** Le `GRANT` initial visait le mauvais nom :
  le schéma restait invisible aux tuiles. Corrigé dans `00_schema.sql`.
  **Martin doit être redémarré** pour publier les nouvelles sources (`frontiere`, `lacs`,
  `routes_1`…). Ajouter ensuite les sources voulues dans `src/assets/map-style.json`,
  `promoteId: "ogc_fid"` comme les couches `sig*` existantes.

## Déploiement — 2026-09-04

- Les 4 villes manquantes créées (`95_cities_emprises_provisoires.sql`), emprise = polygone de
  région, `Code` à `NULL`.
- Image `nejishow/das-admin:latest` reconstruite, stack relancé. `das-admin`, `martin`, `redis`
  sains.
- **Martin publiait en boucle d'échec.** Le conteneur en place se connectait en `postgres` avec
  un mot de passe périmé — pas l'URL `martin_ro` du `docker-compose.yml` : il datait d'une
  révision antérieure du compose et redémarrait sans fin (`/tiles` en 502). `docker compose up -d
  --force-recreate martin` l'a réaligné. **Un conteneur `restart: unless-stopped` peut masquer
  une dérive de configuration pendant des jours** : vérifier `docker logs`, pas seulement
  `docker ps`.
- Martin auto-publie `schemas=nour, public` : **17 couches `nour` sur 17** sont servies, les
  sources existantes sont intactes (51 sources au total). Tuiles vérifiées en 200 sur
  `contour_rdd`, `routes_1/2`, `pistes_1`, `oueds_principaux`, `villes_pt`, `villages_pt`,
  `frontiere`, `lacs`, `quartiers_ville_pg`, `ilots_src`, `parcelles_src`.

### Martin ne publie plus `nour` (décision du 2026-09-04)

`nour` est un schéma de travail, pas une source de tuiles. Martin auto-publie **tout ce qu'il
peut lire** : le simple `GRANT SELECT` suffisait à exposer les 17 couches. `00_schema.sql`
**révoque** désormais l'accès de `martin_ro`. Vérifié après redémarrage : Martin logue
`Auto-publishing tables schemas=public`, 31 sources, **0 couche `nour`**, sources DAS intactes.

Le référentiel se nourrit de `nour` par les scripts `95_` à `97_`, pas par les tuiles.

### À savoir si l'on décidait un jour de republier `nour`

- **`parcelles_src` pèse 2,4 Mo par tuile en z12.** Aucune simplification : ne pas l'afficher
  tel quel. `ilots_src` est à 350 Ko, déjà lourd. Ces deux couches font doublon avec le
  référentiel (`Blocs`, `Adresses`) — leur intérêt cartographique est nul.
- Le lot national a du sens à **bas zoom** (contour, frontière, routes, pistes, oueds) là où
  les couches urbaines existantes n'ont rien à montrer.
- `promoteId: "ogc_fid"` pour toutes ces sources, comme les `sig*` déjà en place.

### Signalé par Martin, antérieur à ce lot

`public."Closes"`, `public."Communes"` et `public."Zones"` **n'ont pas d'index spatial** sur
`Boundary`. Martin les sert quand même, en scan complet.

## Reprise du référentiel depuis `nour` — 2026-09-04

| Table | Versé | Pourquoi |
|---|---|---|
| `Cities` | **+4 lignes, 6/6 avec emprise** | Arta, Dikhil, Obock, Tadjourah créées (`95_`) ; Djibouti et Ali Sabieh, jamais géométrisées, complétées (`96_`). Emprises **provisoires** = polygone de région. `Code` à `NULL` sur les 4 nouvelles. |
| `Streets` | **+692 lignes** (652 → 1 344) | Réseau national : 102 routes (883 km) + 590 pistes (3 569 km). `Name` à `NULL`, `Code` `SIG-RT1/RT2/PI1/PI2-*`. |
| `Quartiers` | **rien** | `quartiers_ville_pg` = 130/130 géométries identiques à `delimitations_quartiers`, déjà reprise le 2026-08-27. |
| `Blocs` | **rien** | `ilots_src` ⊃ `ilots_codifies` d'un seul îlot, **de 0 m²**. |
| `Adresses` | **rien** | `parcelles_src` ⊃ `parcelles_codifiees` de deux parcelles, **de 0 m² toutes les deux**. |
| `Communes`, `Zones`, `Closes` | **rien** | Aucune couche `nour` ne correspond à ces niveaux. |

Contrôles après écriture : **0 géométrie invalide**, **0 code dupliqué introduit** (les 17
doublons de `Code` sont antérieurs — `BLD BONHOURE`, `Av ADM BERNARD`… — et déjà connus).

Sauvegardes : `backup-cities-avant-2026-09-04.csv`, `backup-streets-avant-2026-09-04.csv`.

### Ce que le versement dans `Streets` ne règle pas

Les 692 tronçons sont **anonymes**, et le resteront tant que personne ne les nomme : le seul
champ texte de la source, `id_`, porte la couleur du crayon du cartographe (`magenta0`,
`noir282`). `Streets` passe donc de 249 à 941 lignes sans nom sur 1 344. Utilisables comme
géométrie de voirie ; **inutilisables pour adresser** tant qu'ils n'ont pas d'identité.

---

## Livraison du 2026-09-08 — équipements de Djibouti-ville + îlots codifiés

Cinq fichiers, chargés dans `nour` le 2026-09-08. Ajouts seuls, aucune écriture dans `public`.

| Fichier source | Table `nour` | Lignes | Verdict |
|---|---|---:|---|
| `ilots_complete.sql` | `ilots_complet` | 6 932 | **Exploitable** — codifié, aligné sur le référentiel |
| `Mosquėe.sql` | `mosquees` | 165 | ⛔ Mal géoréférencé |
| `Hôtel.sql` | `hotels` | 29 | ⛔ Mal géoréférencé |
| `Banque.sql` | `banques` | 20 | ⛔ Mal géoréférencé |
| `Bureau_poste_(PTT).sql` | `bureaux_poste` | 5 | ⛔ Mal géoréférencé |

### ⚠️ Trois pièges de ce lot

**1. Noms de table en octets invalides.** `Mosquée` et `Hôtel` arrivent comme
`mosqu\xe4\x97e` et `h\xe3\xb4tel` : le producteur a appliqué une mise en minuscules **octet par
octet** sur de l'UTF-8, ce qui a détruit l'octet de tête (`\xc3`→`\xe3`, `\xc4`→`\xe4`). Aucun
encodage ne les décode. `gen_nour.py` les déclare donc en `bytes` littéraux et les renomme en
ASCII. `bureau_poste_(ptt)` porte en plus des parenthèses dans l'identifiant.

**2. SRID déclaré à 0.** Les quatre fichiers d'équipements appellent
`AddGeometryColumn(...,0,...)`. `90_post.sql` reprojette d'après `geometry_columns` et
`ST_Transform` échoue sur un SRID inconnu. Le générateur corrige la déclaration dans le dump.
`ilots_complete` déclare correctement 32638.

**3. ⛔ `90_post.sql` était cassé depuis le 2026-09-06.** Les dumps GDAL déclarent la colonne en
2D mais y écrivent des géométries **3D** — toute la livraison du 6 septembre, à 100 % des lignes.
L'`ALTER` échouait sur « Geometry has Z dimension but column does not », et comme le `DO`
s'arrête à la première erreur, **aucune table du lot n'avait été reprojetée**. La panne est restée
invisible parce que les scripts de reprise transformaient eux-mêmes leurs géométries. Corrigé par
`ST_Force2D`, et les 23 tables concernées sont passées en 4326.

### `ilots_complet` — la pièce utile

6 932 îlots **codifiés** (`code_ilot`, `quartier_ville`, `commune_ville`, `lettre_ilot`), là où
`ilots_src` (3 701) n'avait aucun code. Répartition : BALBALA 4 010, BOULAOS 2 692, RAS DIKA 230.

Confronté à `public."Blocs"` (7 115) :

| | |
|---|---:|
| Codes communs | **5 055** |
| dont géométrie **identique** au bit près | **4 972** |
| dont géométrie différente (écart d'aire moyen : 0,0 m²) | 83 |
| Codes **nouveaux** | **1 877** — dont 1 786 à Balbala |
| Blocs absents de la livraison | 2 060 — soit les 1 994 des trois villes secondaires, hors périmètre, + 66 |

La livraison **ne réécrit donc pas le référentiel, elle l'étend** : mêmes géométries pour ce qui
existe, +1 877 îlots là où Balbala est sous-couvert.

Onze `quartier_ville` sont inconnus du référentiel, mais **sept ne sont que des variantes
d'écriture** — `CHEICK MOUSSA`/`Cheik Moussa`, `WAHLADABA S.`/`Wahladaba Sud`, `LOT. HAYABLEH`/
`HAYABLEH`, `Einguela 1` et `2`/`Einguela`, `CITE C OUSMAN`/`Cité Cheikh Osman`, `BALBALA Q5`.
Les quatre autres sont des `SANS NOM (IDnn)`, 27 îlots au total. **Aucun quartier réellement
nouveau.**

### ⛔ Les quatre couches d'équipements sont inutilisables en l'état

Deux défauts rédhibitoires, indépendants l'un de l'autre.

**Aucun attribut.** `name` et `classify` sont **vides sur les 219 lignes**. Ces couches ne portent
que des empreintes de bâtiment ; leur seule sémantique est le nom du fichier. Impossible de
nommer une mosquée ou un hôtel à partir de là.

**Géoréférencement faux d'environ 97,5 km.** Interprétées en UTM 38N — la projection de toutes
les autres couches du lot — elles tombent à **lon 42,17–42,27**, en plein désert, alors que
Djibouti-ville est à **43,07–43,19**. Zéro des 219 empreintes n'intersecte une parcelle ou un bloc.

Ce n'est pas une erreur de projection : l'étendue a la bonne taille (0,097° × 0,087° contre
0,100° × 0,074° pour la ville) et la latitude est juste. C'est une **translation en longitude**,
et aucune projection standard ne l'explique — ni UTM 37N, ni un décalage de false easting rond.

Un calage empirique par balayage donne un optimum à **dx = +97 500 m, dy = +250 m**, qui place
110 des 165 mosquées dans un bloc. Le signal est réel (les blocs ne couvrent que 16,9 km² sur les
97,8 km² de la ville, donc le hasard donnerait ~17 %), mais **67 % n'est pas un recalage
certifiable**. Ce décalage n'a pas été appliqué : corriger une géométrie par une constante devinée
introduirait une erreur silencieuse dans le référentiel.

> **À demander à l'expert SIG** : le système de coordonnées source des quatre fichiers
> d'équipements, et une réexport avec `name`/`classify` renseignés.

### Comparaison avec les POI OpenStreetMap du 2026-09-06

`nour.poi_osm` couvre les mêmes thèmes, avec des noms, et correctement géoréférencé :

| Thème | SIG 2026-09-08 | OSM 2026-09-06 |
|---|---:|---:|
| Lieux de culte | 165 (sans nom) | 176 |
| Hébergement | 29 (sans nom) | 63 |
| Finance / banques | 20 (sans nom) | 24 |
| Administration / poste | 5 (sans nom) | 94 |

Tant que la livraison SIG n'est pas corrigée, **OSM reste la seule source exploitable** pour ces
équipements.
