# Récapitulatif du 2026-08-25 — en langage clair

> **À qui ça s'adresse.** À quelqu'un qui n'a pas suivi le détail technique : chef de projet,
> nouvel arrivant, ou soi-même dans trois mois. Les autres documents de `docs/` sont des
> spécifications ; celui-ci explique **ce qui a été fait et pourquoi**, sans jargon.
>
> Il couvre deux dépôts : `das-admin` (l'interface d'administration) et `dasApi` (le serveur et
> sa base de données).

---

## En bref

| # | Sujet | En une phrase |
|---|---|---|
| 1 | Messages d'erreur | L'appli disait « une erreur est survenue » pour tout ; elle dit maintenant ce qui ne va pas |
| 2 | Codes d'erreur faux | On avait deviné 9 noms d'erreurs, 6 étaient faux — corrigés en lisant le serveur |
| 3 | Mode démo | Le simulateur inventait ses propres règles ; remis en accord avec le vrai serveur |
| 4 | Écran « Paramètres » | Supprimé : il promettait deux fonctions qui n'existent pas |
| 5 | Colonne « Rue » | Réapparue dans la liste des adresses et dans la fiche |
| 6 | Blocs déjà pris | Ils s'affichent désormais grisés au lieu de disparaître |
| 7 | Signalements de terrain | Nouvel écran complet, il n'y en avait aucun |
| 8 | Routes OpenStreetMap | Quatre scripts pour récupérer les rues de Djibouti et voir ce qui manque — 11 770 routes, 1131 nommées |
| 9 | Cartes / `CloseId` | Le problème était déjà réglé dans la base ; il reste à redémarrer Martin |

---

# Partie A — Ce qui a changé dans l'application

## 1. L'appli disait « une erreur est survenue » pour tout

**Le problème.** Quand le serveur refusait une action, il expliquait pourquoi — « cette campagne
n'a pas encore démarré », « vous ne pouvez pas valider votre propre relevé », « affectez au moins
un bloc avant de démarrer ». L'application jetait l'explication et affichait un message
passe-partout. L'utilisateur voyait un mur, sans savoir que le déblocage tenait souvent à un
seul clic.

**Ce qui a été fait.** Les vrais messages sont branchés sur trois écrans : **campagnes**,
**validation des relevés**, **closes**. Le serveur produit **83 explications** différentes ;
l'application en utilisait 3, elle en utilise maintenant une trentaine — celles qui changent
quelque chose pour l'utilisateur.

Exemples de ce qui s'affiche désormais à la place de « une erreur est survenue » :

- « Une autre campagne est déjà en cours. Clôturez-la d'abord. »
- « Vous ne pouvez pas statuer sur votre propre relevé. »
- « Affectez au moins un bloc avant de démarrer la campagne. »
- « Ce signalement a déjà été traité. Rechargez la liste. »

**Au passage.** Le bout de code qui lit ces explications était recopié à trois endroits. Il est
maintenant à un seul (`core/http/error-code.ts`).

## 2. On avait deviné des noms d'erreurs, et on avait faux

Sur l'écran des closes, l'application guettait 9 codes d'erreur du serveur. **Six sur neuf
n'existaient pas** : écrits de mémoire, avec les mots dans le mauvais ordre — `CodeAlreadyUsed`
au lieu de `CodeAlreadyExists`, `FrozenAddressCode` au lieu de `AddressCodeFrozen`.

Conséquence : cinq messages, traduits en français **et** en anglais, présents dans les fichiers,
**que personne ne pouvait jamais voir**. Une faute de frappe dans un code d'erreur ne se voit
pas — elle retombe silencieusement sur le message générique.

Corrigés en relisant le code source du serveur, ligne par ligne. Le plus important des six est
celui du refus le plus fréquent : quand on rattache un deuxième bloc à une close, les numéros de
maison entrent en collision (chaque bloc numérote à partir de 1). C'est **la** situation
quotidienne tant que la renumérotation n'a pas eu lieu, et elle tombait dans « une erreur est
survenue ».

## 3. Les fausses données mentaient

L'application a un **mode démo** qui simule le serveur, pour développer et faire des
démonstrations sans lui. Sauf que ce simulateur inventait ses propres règles, sans rapport avec
les vraies. On croyait tester, on ne testait rien.

Trois exemples corrigés :

| Le simulateur faisait | Le vrai serveur fait |
|---|---|
| Supprimait une close même avec des blocs rattachés | Refuse tant qu'il reste un bloc |
| Refusait de déplacer un bloc d'une close à l'autre | L'autorise (c'est un transfert) |
| Renvoyait des codes d'erreur inventés (`not_found`, `conflict`) | Renvoie des codes précis |

Le simulateur des campagnes à lui seul levait **16 erreurs** avec des codes qui n'existent nulle
part côté serveur.

## 4. L'écran « Paramètres » a été supprimé

Il proposait deux choses : gérer des types de route, et importer des fonds de carte. Aucune des
deux n'existe côté serveur, et l'import de carte depuis l'interface est **explicitement interdit
par les règles du projet** (les données géographiques entrent par des scripts, pas par le
navigateur).

Un écran qui promet des fonctions inexistantes est pire que pas d'écran : il fait perdre du temps
et laisse croire à une panne. **21 fichiers supprimés**, plus l'entrée de menu, la route d'accès
et les traductions.

## 5. La colonne « Rue » est revenue

Le serveur ne savait pas relier une adresse à une rue — on avait donc retiré la colonne « Rue »
de la liste des adresses.

Depuis que la **close** existe (la portion d'une rue à l'intérieur d'un quartier), le serveur
sait le faire et envoie l'information. On ne l'affichait nulle part. La colonne est remise dans
la liste, la ligne est remise dans la fiche de détail, avec le code de la close.

Trois cas peuvent apparaître, et ils sont maintenant distincts à l'écran :

- la rue a un nom → « Avenue Nasser » ;
- la rue n'a pas encore de nom → « close 3 » (le repli du serveur) ;
- la parcelle n'appartient à aucune close → un tiret franc, **jamais** un faux repli.

## 6. Un bloc déjà pris s'affiche au lieu de disparaître

**Avant.** Sur l'écran des closes, un bloc appartenant déjà à une autre close **disparaissait**
de la liste de sélection. L'utilisateur ne pouvait pas distinguer « ce bloc n'existe pas dans ce
quartier » de « ce bloc est déjà ailleurs ».

**Maintenant.** Il apparaît, grisé, non cochable, avec le nom de la close qui le détient — donc
on sait où aller le détacher.

À noter : le serveur accepterait le déplacement direct d'une close à l'autre. On ne l'expose pas,
parce que tant que la renumérotation par close n'a pas eu lieu, ce déplacement partirait presque
toujours en erreur. Le détachement explicite reste le chemin lisible.

## 7. Nouvel écran : les signalements de terrain

**Le besoin.** Un agent sur le terrain voit une maison qui n'est sur aucun plan. Avant, il
n'avait aucun moyen de le signaler. Le serveur a livré ce canal ; côté administration, **il
n'existait aucun écran** pour traiter ce qui remonte.

**Ce qui a été fait.** Un écran de tri complet :

- la liste des signalements, filtrable par campagne et par statut ;
- leur **position sur la carte**, en couleur selon le statut ;
- deux décisions : **Retenir** ou **Écarter** ;
- le motif est **obligatoire** pour écarter — sans lui, l'agent refera le même signalement à la
  campagne suivante ;
- un bouton d'**export** du fichier à remettre au géomètre.

**Le point à retenir : retenir un signalement ne crée pas d'adresse.** Ça met un point dans une
file que le géomètre traitera ; c'est lui qui dessinera le contour de la parcelle. L'écran
l'affiche noir sur blanc, pour que personne n'attende une adresse qui n'arrivera pas.

Deux détails que l'écran rend visibles :

- **le délai entre la capture et la réception** — un agent peut travailler des jours sans réseau,
  un écart de 48 h est normal, pas une anomalie ;
- **la précision GPS** du relevé, quand l'appareil l'a fournie.

L'écran est ouvert au Superviseur en **lecture seule** : trier demande le rôle Gestionnaire. Les
boutons sont masqués plutôt que refusés au clic.

---

# Partie B — Les cartes : le point `CloseId`

## Le problème

Filtrer les adresses par close **vidait la carte**. C'était volontaire du côté de l'interface :
l'alternative aurait été d'afficher tout le quartier pendant que la liste montre une seule close,
c'est-à-dire une carte et une liste qui se contredisent — le pire des deux mondes, et impossible
à déboguer.

## La réponse

Martin, le service qui fabrique les fonds de carte, fonctionne **sans fichier de configuration**.
Il regarde directement dans la base de données ce qu'il peut publier. Ce n'était donc pas un
ticket « configurer Martin », mais **une modification de la base**.

Et cette modification **est déjà faite** : la vue `adresses_tiles` contient bien la colonne
`CloseId`, avec la bonne orthographe (majuscules comprises — Martin y est sensible).

## Ce qu'il reste à faire

**Redémarrer Martin.** Il lit la liste des colonnes une seule fois, au démarrage, et la garde en
mémoire. Une vue modifiée pendant qu'il tourne n'est pas prise en compte.

```bash
docker restart martin
```

**Vérifier**, sans deviner : ouvrir `http://localhost:3000/adresses_tiles` dans un navigateur.
Martin y liste les champs qu'il publie. Si `CloseId` apparaît, c'est bon.

`blocs_tiles` n'a **pas** besoin de cette colonne : l'écran des closes filtre les blocs par
quartier et récupère leur appartenance par l'API, pas par la carte.

## Un fichier à ignorer

`db/vector_tile_functions.sql`, dans le dépôt `das-admin`, **décrit un schéma qui n'existe plus**
(tables `blocks`, `properties`, `administrative_units`). Il induit en erreur quiconque le lit
pour comprendre comment les cartes sont construites. Les vraies définitions vivent dans la base.
À supprimer ou à marquer comme périmé.

---

# Partie C — Les routes OpenStreetMap

## Le principe

**On met les données OSM dans un coin séparé de la base, on regarde ce qu'elles apprennent, et
rien n'entre dans le référentiel sans décision explicite.**

Quatre scripts, dans `dasApi/scripts/osm/` — c'est du travail de base de données, pas de
l'interface.

## Script 1 — `01-osm-schema.sql` : préparer le rangement

À lancer **une seule fois**. Il crée trois choses.

**Un espace séparé, appelé `osm`.** Un dossier à part dans la base, à côté des vraies tables
(`Adresses`, `Blocs`, `Quartiers`). Rien de ce qui est dedans ne fait autorité.

**Une table `osm.roads`** — une ligne par route :

| Colonne | Contenu | Exemple |
|---|---|---|
| `osm_id` | le numéro de la route dans OSM | `24851037` |
| `highway` | son type, en vocabulaire OSM | `residential` |
| `name` | son nom principal | `Avenue Nasser` |
| `name_fr` / `name_ar` | ses noms français et arabe s'ils existent | souvent remplis à Djibouti |
| `geom` | le tracé sur la carte | une ligne |

**Deux index** — deux façons de chercher vite :

- l'un par **position** : « quelles routes touchent ce quartier ? » ;
- l'autre par **ressemblance de nom**. Celui-là compte : il permet de rapprocher `Av. Nasser` et
  `Avenue Nasser`, que la recherche exacte compterait comme deux rues différentes.

Plus une petite table qui note **quand** l'import a été fait et **combien** de routes il contient.

## Script 2 — `fetch-osm-roads.py` : aller chercher les données

Il interroge **Overpass**, le service public d'OSM qui répond à des questions du type « donne-moi
toutes les routes de Djibouti ». Le pays est petit : la réponse arrive en une ou deux minutes.

Il **écarte** au passage les trottoirs, escaliers, sentiers et pistes cyclables — ils ne portent
jamais de numéro de maison et gonfleraient la table sans rien apporter.

Puis, pour chaque route restante, il écrit une ligne dans un fichier `osm-roads.sql`.

**Pourquoi un fichier plutôt qu'une écriture directe en base ?** Trois raisons :

1. aucune bibliothèque Python supplémentaire à installer — comme les autres scripts du dépôt ;
2. on peut **ouvrir le fichier et le lire** avant de le jouer ;
3. si le chargement échoue, on rejoue le fichier, on ne relance pas la requête.

**C'est rejouable.** Le mois prochain, on relance : les routes déjà connues sont mises à jour (un
nom a pu changer dans OSM), les nouvelles s'ajoutent. Rien n'est dupliqué — c'est le numéro OSM
qui sert de clé.

Deux options utiles :

- `--bbox 11.50,43.10,11.62,43.20` → seulement Djibouti-ville, pour tester vite ;
- `--named-only` → seulement les routes qui portent un nom.

## Script 3 — `02-street-candidates.sql` : comparer avec le référentiel

Le plus intéressant. Il ne modifie rien : il crée des **vues**, c'est-à-dire des questions
préenregistrées qu'on peut poser quand on veut.

### Il découpe

Une route OSM traverse souvent plusieurs quartiers. Le script la coupe aux limites de chaque
quartier, parce que c'est exactement la définition d'une **close** : la portion d'une rue à
l'intérieur d'un quartier. Une avenue qui traverse trois quartiers donne trois lignes.

Les bouts de moins de 20 mètres sont ignorés — c'est une route qui frôle une limite
administrative, pas une voie du quartier.

### Il traduit le vocabulaire

OSM dit `residential`, `primary`, `track`. Le référentiel dit `Rue`, `Boulevard`, `Piste` :

| OSM | Référentiel |
|---|---|
| `residential`, `unclassified`, `living_street` | Rue |
| `secondary` | Avenue |
| `primary` | Boulevard |
| `motorway`, `trunk`, `tertiary` | Route |
| `track` | Piste |
| `service` | Impasse |

### Il compare

Pour chaque route nommée, il cherche dans les `Streets` existantes une rue au nom ressemblant.
Deux cas :

- **il en trouve une** → la rue est déjà connue, rien à faire ;
- **il n'en trouve aucune** → **cette rue existe sur le terrain et manque dans la base.**

C'est ça, la file de travail. On la consulte avec deux requêtes :

```sql
-- Combien de rues manquent, quartier par quartier ?
SELECT quartier_nom,
       count(*) FILTER (WHERE street_proche_id IS NULL) AS inconnues,
       count(*) AS total
FROM osm.street_candidates
GROUP BY quartier_nom
ORDER BY inconnues DESC;

-- Les 30 plus longues rues manquantes — celles qui structurent le quartier
SELECT quartier_nom, nom_propose, round(longueur_m) AS metres
FROM osm.street_candidates
WHERE street_proche_id IS NULL
ORDER BY longueur_m DESC
LIMIT 30;
```

## Remplir vraiment le référentiel

Tout à la fin du script 3, un `INSERT` est écrit **en commentaire**. Le décommenter crée une
`Street` dans le référentiel pour chaque rue manquante de plus de 50 m, avec son nom, son type et
son tracé.

Chaque rue créée porte un code `OSM-24851037` : on sait d'où elle vient, et on peut les retrouver
ou les supprimer toutes d'un coup.

Il est en commentaire pour que ce soit un geste conscient, pas un effet de bord. **Conseil
pratique : regarder les deux requêtes ci-dessus d'abord** — ça évite d'importer 400 rues quand
40 comptent.

## Script 4 — `03-diagnostic.sql` : quand rien ne sort

Ajouté après coup, parce que le premier essai réel a produit une table `osm.roads` bien remplie
et **des vues vides**. Sept requêtes, chacune éliminant une hypothèse. Les deux causes réelles :

**1. Les quartiers n'ont pas de contour.** C'est le cas le plus probable ici : le référentiel a
été alimenté par reprise cadastre **au niveau des blocs et des parcelles**, pas des contours
administratifs. La première version de la vue exigeait ce contour — sans lui, elle ne renvoyait
rien, sans message d'erreur.

Le correctif : quand le contour du quartier manque, son emprise est **reconstituée à partir de
ses blocs**. Avec un détail qui compte — on prend l'**enveloppe convexe** des blocs, pas leur
union. L'union a des trous : les rues, justement, qui passent *entre* les blocs. Découper les
routes sur une union les ferait presque toutes disparaître.

**2. Latitude et longitude inversées.** PostGIS stocke `(X = longitude, Y = latitude)`. Une
géométrie construite en `(lat lon)` se retrouve au large de la Somalie : elle ne croise plus
rien, sans erreur ni avertissement. La requête 4 du diagnostic affiche côte à côte l'étendue des
trois sources — elles doivent toutes tourner autour de **longitude 43, latitude 11**.

## Deux pièges rencontrés en vrai

**Overpass coupe le flux sans le dire.** Une requête « tout Djibouti d'un coup » dépasse ses
limites : il répond `200`, commence à envoyer, puis ferme la connexion à ~6 Mo. Comme le `200`
est déjà parti, ça ne remonte pas en erreur HTTP mais en flux tronqué — un message qui ne
ressemble pas du tout à sa cause.

Le script demande donc la zone **par morceaux** et découpe automatiquement un morceau qui casse.
Il distingue trois refus, qui ne se soignent pas pareil : *trop gros* (→ découper), *quota
atteint* (→ attendre), *serveur en panne* (→ attendre, surtout pas découper — les morceaux
échouent pareil et on assomme le serveur pour rien).

**Le découpage est sans perte**, vérifié avant de s'appuyer dessus : Overpass sélectionne les
routes qui *touchent* la zone et renvoie leur géométrie **entière**. Sur un test à
Djibouti-ville, 48 des 1006 routes renvoyées débordaient de la zone demandée. Une route à cheval
sur deux morceaux arrive complète dans les deux, et la fusion par numéro OSM la garde une seule
fois.

Si une zone reste inaccessible, le script la **liste en fin d'exécution** avec la commande pour
la rattraper — enfouie dans le journal, elle produirait un référentiel troué sans que personne
ne le sache.

## L'enchaînement complet

```bash
cd dasApi/scripts/osm

psql "$DAS_CONNECTION" -f 01-osm-schema.sql     # une seule fois
python fetch-osm-roads.py                        # quelques minutes
psql "$DAS_CONNECTION" -f osm-roads.sql          # le chargement
psql "$DAS_CONNECTION" -f 02-street-candidates.sql

psql "$DAS_CONNECTION" -f 03-diagnostic.sql      # si les vues sortent vides

# puis les deux requêtes de consultation
```

**Volumes constatés le 2026-08-25** (extraction réelle, tout le pays) : 11 770 routes
récupérées, 10 906 conservées après filtrage des trottoirs et sentiers, dont **1131 nommées**.
Djibouti-ville seule en concentre environ la moitié.

## Deux choses à savoir

**Martin publiera `osm.roads` en tuiles.** La table a un tracé géographique, et Martin
auto-découvre : elle deviendra une source de fonds de carte au prochain redémarrage, sans
configuration. C'est utile si on veut afficher les routes OSM en fond ; autant le savoir plutôt
que le découvrir.

**Licence.** Les données OSM sont sous ODbL. **Décision prise le 2026-08-25 : publication sans
attribution**, les noms et attributs étant destinés à être modifiés. Le `REVOKE` préparé en fin
de `01-osm-schema.sql` reste donc en commentaire, et rien n'est à changer dans les scripts.

---

# Partie D — Ce qui reste à faire

| Quoi | Chez qui | Bloque quoi |
|---|---|---|
| Redémarrer Martin | Infra | Le filtre par close sur la carte |
| Migration « un numéro de maison unique par close » | Serveur | La garantie en base (aujourd'hui tenue par le code seul) |
| Créer les closes du Quartier 7, renuméroter les 2 512 parcelles | Reprise de données | Tout le reste de l'adressage |
| Renseigner le code des villes et le numéro des quartiers | Reprise de données | Aucun code d'adresse n'est calculable sans eux |
| 5 écrans encore en démo | **Décision produit** | Notifications, rapports, audit, clients, intégrations |

## La fenêtre qui se referme

Le point le plus important, et il n'est pas technique : il y a aujourd'hui **zéro code d'adresse
figé** et **zéro relevé validé** en base. Changer le format des codes, poser les contraintes et
renuméroter ne coûtent donc **rien**.

Au premier relevé validé définitivement, chaque code posé l'est **pour toujours**, et le coût
devient une reprise de données impossible à faire proprement. L'ordre des tâches ci-dessus n'est
pas une préférence : c'est cette contrainte-là.

---

---

# Partie E — Les 6 demandes suivantes (✅ LIVRÉES)

> Demandes formulées le 2026-08-25, décisions prises le même jour, **tout est implémenté**.
> Les scripts SQL, eux, produisent une SIMULATION : leur écriture reste en commentaire, à
> décommenter après relecture.
>
> **Décisions retenues** — A : numérotation **séquentielle** · B : code **`Q7-03`** ·
> C : **oui**, un bouton dans le panneau des couches · D : **suppression complète** du niveau bloc.

## Vue d'ensemble

| # | Demande | Où | Dépend de |
|---|---|---|---|
| 1 | Renuméroter les parcelles par close | SQL | Décision A + tracés de rue (import OSM) |
| 2 | Renommer les blocs selon leur position | SQL | Rien |
| 3 | Code et numéro de close auto-générés | Front | Décision B |
| 4 | Survol de la liste des rues → surbrillance carte | Front + style | Vue `streets_tiles` servie |
| 5 | Couche « rues » sur toutes les cartes | Front | Décision C |
| 6 | Closes dans les filtres, blocs retirés | Front | Décision D |

**Ordre recommandé : 2 → 6 → 5 → 3 → 4 → 1.** Le 2 est autonome et améliore tout de suite la
lecture de la carte ; le 1 est le plus lourd et dépend de l'import OSM.

---

## 1. Renuméroter les parcelles par close

### Le vrai problème n'est pas celui qu'on croit

Le message « deux parcelles porteraient le même numéro » apparaît au **rattachement**. On
pourrait croire qu'il suffit de renuméroter la close — mais la close est vide au moment du
refus : les numéros en cause appartiennent aux parcelles du bloc **entrant**, qui n'ont pas
encore de close.

L'ordre est donc contraint, et contre-intuitif :

1. décider quels blocs iront dans quelle close, **avant** toute écriture ;
2. renuméroter les parcelles de ces blocs en les traitant **comme si** la close existait déjà ;
3. rattacher — le rattachement passe alors sans conflit.

Un script qui renumérote « une close » ne peut pas exister : il renumérote **un regroupement
prévu**.

### Sur quoi ordonner les numéros

Un numéro d'adresse court le long d'une voie. Il faut donc projeter chaque parcelle sur une
ligne et trier par `ST_LineLocatePoint` :

- **idéal** : le tracé de la rue de la close (`Street.Boundary`) — il vient de l'import OSM ;
- **repli** : l'axe principal des blocs du regroupement (`ST_LongestLine` sur l'enveloppe
  convexe). Ordre plausible, mais qui ne suit pas la vraie voie.

C'est ici que le chantier OSM devient bloquant : **sans tracé de rue, la numérotation est
arbitraire**. Et un numéro posé puis figé ne se reprend plus.

### 🔸 Décision A — la convention de numérotation

| Option | Ce que ça donne | Remarque |
|---|---|---|
| **Séquentiel** | 1, 2, 3, 4… le long de la voie | Simple, mais ne dit pas de quel côté est le n° 12 |
| **Pair / impair** | impairs d'un côté, pairs de l'autre | Convention française et britannique ; **exige** le tracé de la rue pour déterminer le côté (`ST_Azimuth` + produit vectoriel) |

Je recommande **pair/impair**, avec repli séquentiel quand la rue n'a pas de tracé. C'est la
convention que le mot « close » implique, et elle se perd si on ne la pose pas dès la première
numérotation.

### Ce que le script contiendra

`dasApi/scripts/db/renumerotation-close.sql`

- une **vue de simulation** `ancien → nouveau`, à relire **avant** toute écriture : une
  renumérotation ne se rejoue pas une fois des codes figés ;
- l'`UPDATE` en **deux passes** (numéros négatifs temporaires, puis valeurs finales).
  Aujourd'hui l'index unique `(CloseId, Numero)` n'existe pas encore, donc une passe suffirait —
  mais la migration 2 le posera, et un script à une passe se mettrait alors à échouer ;
- **exclusion des parcelles à code figé** (`AddressCode IS NOT NULL`). Zéro aujourd'hui, mais
  c'est la garde qui empêche le script de devenir destructeur plus tard ;
- un compte-rendu : combien renumérotées, combien inchangées, combien écartées.

---

## 2. Renommer les blocs selon leur position

### Pourquoi c'est possible aujourd'hui, et pas la semaine dernière

Le code d'adresse est passé à 4 segments le 2026-08-23 : **le bloc en est sorti**. Renommer un
bloc ne touche donc plus aucun identifiant d'adresse. Avant cette date, le même script aurait
cassé chaque code émis.

Les autres consommateurs référencent le bloc par son `Id`, jamais par son code : campagnes
(`CampaignBloc`), tuiles (`promoteId: "Id"`), affectations. Le renommage est sûr.

### Le piège technique

`Blocs` porte **deux** index uniques : `(QuartierId, Code)` et `(QuartierId, Number)`. Renommer
en place crée des collisions transitoires — le bloc qui devient `AB` heurte celui qui s'appelle
encore `AB`. Le script fera donc **deux passes** : valeurs temporaires, puis valeurs finales.

### L'ordre spatial

Un simple tri par latitude puis longitude produit un saut en fin de rangée : le dernier bloc à
l'est est suivi du premier à l'ouest de la rangée suivante. J'utiliserai un parcours **en
serpentin** (boustrophédon) — rangées par bandes de latitude, direction alternée à chaque
rangée. `AA` et `AB` sont alors toujours voisins sur le terrain.

Codes en base 26 : `AA`, `AB`, … `AZ`, `BA`, … soit 676 combinaisons pour 309 blocs.
`Bloc.Number` reçoit le même rang, pour que code et numéro restent cohérents.

`dasApi/scripts/db/renommage-blocs-position.sql`, avec la même vue de simulation qu'au point 1.

---

## 3. Code et numéro de close auto-générés

Le back **exige** les deux champs (`CreateCloseRequest` : `Number` entre 1 et 999, `Code` non
vide). Rien à changer côté serveur : c'est le front qui doit les calculer.

- **`number`** : le plus petit entier libre ≥ 1 dans le quartier. Le store le sait déjà
  (`selectTakenNumbers`), c'est quelques lignes.
- **`code`** : à dériver.

### 🔸 Décision B — le format du code

| Option | Exemple | Remarque |
|---|---|---|
| `{CodeQuartier}-{n}` | `Q7-03` | Lisible, stable, indépendant de la rue |
| `{CodeQuartier}-{CodeRue}` | `Q7-STR-0003` | Traçable jusqu'à la rue, mais long et redondant |
| Numéro seul | `03` | Unique dans le quartier, donc suffisant — mais ambigu hors contexte |

Je recommande la première. Les deux champs disparaissent du formulaire, mais les valeurs
calculées restent **affichées en lecture seule** avant l'enregistrement : l'opérateur doit voir
ce qu'il crée.

### Le cas qu'il ne faut pas oublier

Deux opérateurs qui créent une close en même temps calculent le même numéro : le second reçoit
un 409 `Closes.NumberAlreadyUsed`. Il verrait alors un message d'erreur portant sur un champ
qu'il ne contrôle plus — incompréhensible. Je prévois **un recalcul et une seule nouvelle
tentative automatique** sur ce code précis, le message d'erreur ne servant qu'en dernier
recours.

---

## 4. Survol de la liste des rues → surbrillance sur la carte

### L'obstacle

La liste des rues est un `<select>` HTML. **Un `<option>` ne reçoit pas d'événement de survol**
de façon fiable : c'est un contrôle rendu par le système d'exploitation, pas par la page. Aucun
`(mouseenter)` n'y fonctionnera de manière portable.

Il faut donc remplacer le `<select>` par une **liste personnalisée** : un champ de recherche et
des lignes survolables. Trois gains au passage — la recherche par nom (indispensable dès que les
rues d'OSM seront importées, il y en aura des centaines), l'affichage du type de voie, et le
survol demandé.

Contrainte à ne pas perdre : l'accessibilité clavier (flèches, Entrée, Échap,
`aria-activedescendant`). Un `<select>` l'offre gratuitement ; une liste maison doit la
réimplémenter.

### Le reste de la chaîne

1. **`map-style.json`** : les couches `streets-*` doivent lire `feature-state.colorOverride`,
   comme `blocs-fill` et `adresses-fill` le font déjà. Leur peinture est aujourd'hui fixe.
2. **`closes.component`** : déclarer un `TileLayerBinding` sur la source `streets` et alimenter
   `tileFeatureStates` depuis la ligne survolée.
3. Le `promoteId: "Id"` est déjà en place sur la source `streets` : l'id de feature **est** l'id
   de la rue, aucune résolution à faire.

⚠️ Prérequis : la vue `streets_tiles` créée et Martin redémarré, sinon il n'y a rien à surligner.

---

## 5. Couche « rues » sur toutes les cartes

### Une clarification d'abord

Depuis le remplacement du fond CARTO, les couches `streets-*` font partie du **style de base** :
elles sont donc **déjà dessinées sur les 9 cartes** de l'application. Si tu ne les vois pas, ce
n'est pas qu'elles manquent — c'est que `Streets` n'a pas encore de tracés.

### 🔸 Décision C — que veut dire « ajouter la couche »

| Lecture | Ce que je fais |
|---|---|
| **A. Pouvoir l'afficher/masquer** | Une entrée « Rues » dans le panneau des couches des 9 écrans |
| **B. Elle n'apparaît pas du tout** | Alors c'est la donnée : voir le point 1 et l'import OSM |
| **C. Les rendre cliquables** | En plus de A : `TileLayerBinding`, sélection, popup au clic |

Je pars sur **A**, en déclarant le groupe **une seule fois** dans une constante partagée plutôt
que de le recopier dans 9 composants — trois écrans déclarent déjà leur `basemapLayers` à la
main et la divergence a commencé.

---

## 6. Closes dans les filtres, blocs retirés

### Pourquoi tu ne vois pas les closes

Le select des closes existe, mais il est **masqué quand le quartier n'en a aucune** — ce qui est
le cas partout aujourd'hui. C'était un choix délibéré (ne pas montrer un filtre inutilisable) et
il se retourne contre nous : impossible de distinguer « ce filtre n'existe pas » de « il n'y a
rien à filtrer ».

Correction : **toujours afficher le select**, désactivé, avec « Aucune close dans ce quartier »
quand il est vide. Un filtre vide qui se montre est plus honnête qu'un filtre qui disparaît.

### Retirer les blocs

Le niveau bloc n'est activé que sur un écran : `adresse-list`, via `[showBloc]="true"`.

### 🔸 Décision D — jusqu'où retirer

| Option | Portée | Conséquence |
|---|---|---|
| **Masquer** | Retirer `showBloc` de la cascade | 30 secondes, mais `blocId` reste partout, mort |
| **Retirer vraiment** | Supprimer le niveau de `HierarchySelection`, `AdresseFilters`, du filtre tuile `BlocId` et du chargement des blocs de la cascade | ~1 h, 6 fichiers, supprime du code mort |

Je recommande la **suppression complète**. Un champ mort dans un modèle de filtre est exactement
ce qui fait qu'on rajoute un jour un filtre bloc « puisqu'il est déjà là ».

À noter : l'écran des closes continue d'utiliser les blocs — ce sont ses **données**, pas un
filtre. Il n'est pas concerné.

---

## Les 4 décisions, en résumé

| | Question | Décision retenue |
|---|---|---|
| **A** | Numérotation : séquentielle ou pair/impair ? | **Séquentielle** le long de la voie. Le pair/impair aurait exigé un tracé de rue fiable sur toutes les closes, ce que la couverture OSM ne garantit pas |
| **B** | Format du code de close ? | **`Q7-03`** — code quartier + numéro sur deux chiffres |
| **C** | « Couche street partout » = toggle dans le panneau ? | **Oui**, déclaré une seule fois dans `core/ui/map/basemap-groups.ts` |
| **D** | Blocs : masquer ou supprimer du modèle ? | **Supprimer** — y compris le lien « voir les parcelles » de la fiche bloc, qui filtrait par bloc |

## Ce qui a changé, fichier par fichier

| Demande | Livré |
|---|---|
| 2 · blocs par position | `dasApi/scripts/db/renommage-blocs-position.sql` — serpentin, codes base 26, deux passes |
| 6 · filtres | Select des closes toujours visible ; niveau bloc supprimé de la cascade, de `HierarchySelection`, d'`AdresseFilters` et du filtre tuile |
| 5 · couche rues | `core/ui/map/basemap-groups.ts` ; panneau des couches activé sur 4 cartes de travail supplémentaires |
| 3 · code auto | `closes.component` calcule numéro et code ; les deux champs quittent le formulaire, la valeur reste affichée avant l'enregistrement |
| 4 · survol | Liste maison à la place du `<select>`, avec recherche ; couches `streets-*` réactives au `feature-state` |
| 1 · renumérotation | `dasApi/scripts/db/renumerotation-close.sql` + table de plan `osm.close_plan` |

## Ce que je ne ferai pas sans redemander

- **Lancer une renumérotation en base.** Le script produira d'abord une simulation ; c'est toi
  qui déclencheras l'écriture après relecture.
- **Créer des closes depuis un script SQL.** Le numéro de close entre dans le code d'adresse ;
  la création reste un geste de l'interface, tracé et validé.

---

## Annexe — où regarder dans le code

| Sujet | Fichier |
|---|---|
| Lecture des messages d'erreur du serveur | `das-admin/src/app/core/http/error-code.ts` |
| Quels écrans sont branchés au vrai serveur | `das-admin/src/app/core/config/backend-readiness.ts` |
| Écran des signalements | `das-admin/src/app/features/discoveries/` |
| Scripts OpenStreetMap | `dasApi/scripts/osm/` (README + 4 scripts) |
| Liste des problèmes connus du recensement | `das-admin/docs/failles-recensement.md` |
| Conception de l'adressage (fait autorité) | `dasApi/docs/plans/adressage-close.md` |
