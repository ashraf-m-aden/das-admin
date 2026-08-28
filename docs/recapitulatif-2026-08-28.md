# Récapitulatif du 2026-08-28 — en langage clair

> **À qui ça s'adresse.** À quelqu'un qui n'a pas suivi le détail technique : chef de projet,
> nouvel arrivant, ou soi-même dans trois mois. Les autres documents de `docs/` sont des
> spécifications ; celui-ci explique **ce qui a été fait et pourquoi**, sans jargon.
>
> Il couvre deux dépôts : `das-admin` (l'interface d'administration) et `dasApi` (le serveur et
> sa base de données), ainsi que des écritures directes en base.

---

## En bref

| # | Sujet | En une phrase |
|---|---|---|
| 1 | Plan de numérotation | Le classeur Excel des codes postaux a été confronté à la base : 58 quartiers numérotés |
| 2 | Zones | 9 zones créées puis renommées ; chaque quartier peut y être rattaché depuis l'écran |
| 3 | Emprises manquantes | 63 quartiers n'avaient pas de contour ; récupérés depuis le SIG |
| 4 | Voirie SIG | 32 rues fusionnées dans le référentiel ; 942 tronçons restent à traiter |
| 5 | Îlots SIG | Fausse alerte : ils étaient déjà repris depuis longtemps |
| 6 | Couches carte | Les couches Zones et Codes postaux existaient mais étaient **invisibles** |
| 7 | Mode démo | Il chargeait une autre carte, donc aucune couche ne fonctionnait |
| 8 | Écran campagne | Refondu : carte à gauche, sélection des blocs à la souris |
| 9 | Tableau de bord | La carte prend la moitié, l'avancement est à côté |
| 10 | Écran utilisateurs | La recherche et le filtre par rôle **ne filtraient rien** |
| 11 | File de vérification | On validait des relevés sans savoir lesquels ni de qui |
| 12 | Qualité des données | Un constat sans issue : on voyait un problème sans pouvoir agir |

---

# Partie A — Les codes postaux et les zones

## 1. Le classeur Excel et la base ne parlaient pas de la même ville

Un classeur `DAS_Djibouti_City_Postcodes.xlsx` proposait 76 quartiers avec des codes du genre
`77HE101`. La base, elle, en contenait 74. On aurait pu croire à la même liste avec des fautes
d'orthographe. **Ce n'était pas le cas** : ce sont deux découpages différents de la ville.

- Le plan a **un** `Gabode`. La base en a **cinq** (`Gabode 1` à `Gabode 5`).
- Le plan a **un** `Wadajir`. La base a `Wadagir`, `Cité Wadagir 1` et `Cité Wadagir 2`.
- 24 quartiers du plan n'existent nulle part dans la base.
- 24 quartiers de la base sont absents du plan.

Une reprise automatique était donc impossible : sur 76 lignes, 24 n'avaient rien à mettre à jour.

Autre point : le format `77HE101` est **abandonné**. Le contrat ne stocke qu'un numéro de
quartier (`areaNumber`, de 1 à 999) et le serveur calcule le code postal tout seul :
`code de la ville` + `numéro du quartier`, donc `77` + `101` = **`77101`**.

## 2. Ce qui a été appliqué en base

En deux passes, avec sauvegarde avant écriture et répétition à blanc à chaque fois :

- **58 quartiers numérotés** sur les 84 de Djibouti-ville.
- **10 quartiers créés** depuis les données SIG, avec leur contour géographique.
- Les rapprochements de noms ont été faits à la main, jamais devinés automatiquement.

Un cas mérite d'être connu : **`Quartier 7` occupait le numéro 101**, celui que le plan donne à
`Héron`, et il porte **2 564 adresses**. Le lui retirer aurait fait perdre leur code postal à
2 564 adresses au profit des 192 de Héron. On a donc déplacé `Quartier 7` sur son numéro du plan
(310), ce qui a libéré 101 proprement.

Cinq lignes restent volontairement de côté, parce qu'elles ne relèvent pas d'une lecture de nom
mais d'une décision de territoire — par exemple `Brise de mer`, que le plan rattache à Boulaos
alors que la base la place à Ras Dika. Elles sont listées dans
`scripts/postcodes/reprise-a-arbitrer.csv`.

## 3. Les zones

9 zones ont été créées, puis renommées à la demande :

| Code | Nom | Commune |
|---|---|---|
| Z1 | Ras-Dika | Ras Dika |
| Z2 | Boulaos 1 | Boulaos |
| Z3 | Boulaos 2 | Boulaos |
| Z4 | Boulaos 3 | Boulaos |
| Z5 | Balbala 1 | Balbala |
| Z6 | Balbala 2 | Balbala |
| Z9 | Aires spéciales | Boulaos **et** Balbala |
| ZC | Zone Centre | Boulaos |

> **À retenir.** Le nom ne dit plus dans quelle tranche de numéros on est — « Boulaos 1 »
> contient les numéros 2xx. C'est le **code** qui le porte : Z2 = 2xx, Z5 = 5xx.

« Aires spéciales » existe **deux fois**, une par commune. Ce n'est pas un doublon : une zone
est une partie d'une commune, donc le Port sec (Boulaos) et le Cimetière (Balbala) ne peuvent
pas partager la même.

Le renommage s'est fait **en deux temps**. La base interdit deux zones du même nom dans une
commune ; or renommer « Boulaos 3 » en « Boulaos 2 » pendant qu'une autre s'appelle encore
« Boulaos 2 » viole cette règle. On passe donc par des noms temporaires, puis par les vrais.

## 4. Une colonne « Zone » dans l'écran des codes postaux

Chaque quartier a maintenant une liste déroulante pour choisir sa zone. Deux garde-fous :

- **Seules les zones de la commune du quartier** sont proposées. Le serveur refuse le reste ;
  autant ne pas proposer un geste qui échouera.
- Un quartier **sans commune** ne peut rejoindre aucune zone. La cellule le dit
  (« commune manquante ») au lieu d'afficher un menu vide, qu'on prendrait pour une panne.

Le choix s'applique immédiatement, sans confirmation : c'est réversible d'un geste, il suffit de
reprendre la valeur précédente.

---

# Partie B — Les cartes

## 5. Les emprises manquantes

Avant : **13 quartiers sur 84** avaient un contour géographique. Toute carte construite sur les
quartiers était donc vide aux trois quarts, et quatre zones sur huit totalement invisibles.

63 contours ont été récupérés depuis les données SIG (`delimitations_quartiers`), par
correspondance **exacte** de nom après normalisation — pas de rapprochement approximatif, qui
aurait pu rattacher un contour au mauvais quartier sans que rien ne le signale.

**Résultat : 76 quartiers sur 84.** Toutes les zones ont désormais une géométrie.

## 6. Les couches SIG : une fausse alerte et un vrai chantier

Deux couches s'appelaient « à reprendre » sur les cartes.

**Les îlots : c'était faux.** Les 2 224 îlots de la livraison SIG sont **déjà** dans la base,
au bloc près par quartier (Hayableh 1068 = 1068, PK12 540 = 540), et les blocs portent même le
code d'îlot du SIG. Seuls 37 ne correspondent à aucun bloc — et en les mesurant, ce sont des
**échardes de géométrie** : 6,6 m² au maximum, 0,3 m² en moyenne, contre 1 505 m² pour un îlot
normal. Rien de réel ne manquait. Le libellé a été corrigé en « Îlots SIG (livraison brute) ».

**La voirie : c'était vrai.** Sur 1 401 tronçons, 32 rues ont pu être fusionnées proprement dans
le référentiel (`Streets` passe de 160 à 192). Il reste **942 tronçons**, soit 202 km. Trois
raisons distinctes bloquent le reste :

1. **890 tronçons n'ont pas de nom.** Une rue sans nom n'a pas d'identité : les créer produirait
   890 lignes indistinguables. Il faut un relevé terrain.
2. **24 noms nouveaux** correspondent à des tronçons **séparés** que la base ne sait pas stocker
   dans une seule ligne. Les créer un par un recréerait le doublon qu'on cherche à éviter.
   Débloquer ça demande une modification du schéma côté serveur.
3. **67 noms** désignent une rue **déjà présente**. Rien à créer.

Un piège trouvé en chemin : les noms du SIG sont bruités. `AVENUE10`, `AVENUE 10` et
`AVENUE  10` sont **la même rue**. Sans normalisation, on aurait créé 17 rues en double.

## 7. Les couches Zones et Codes postaux : elles marchaient, mais on ne les voyait pas

Deux nouvelles couches ont été ajoutées sur **toutes** les cartes de l'application. Au début,
cocher la case ne semblait rien faire.

Un banc de test isolé a montré que tout fonctionnait : 89 entités chargées, aucune erreur. Le
problème était ailleurs — **dans une tuile de carte, une valeur vide est absente**. Un quartier
sans zone n'a donc pas d'attribut « zone », et retombait sur un gris très clair affiché à 18 %
d'opacité : littéralement invisible sur fond clair.

Corrections : opacité montée à 35 %, contours épaissis, et surtout le gris « pas de donnée » est
devenu un **gris franc**. L'absence de zone doit se voir autant qu'une zone.

## 8. Le mode démo chargeait une autre carte

En mode démo (`useMockApi`), l'application chargeait un fond de carte externe **à la place** du
style maison. Conséquence : **aucune** couche du panneau ne fonctionnait — ni les blocs, ni les
closes, ni les adresses, ni les rues. Les cases s'affichaient, se cochaient, et ne pilotaient rien.

Le mode démo porte sur les **données métier**, pas sur les cartes, qui viennent d'un service
séparé. Le style maison est maintenant chargé dans les deux modes.

> **Un point à connaître.** Le fichier `public/config.json` du dépôt pointe les cartes sur
> `http://localhost:3000`, qui n'écoute pas. Le service réellement actif est derrière nginx, sur
> `http://localhost/tiles`. Une carte vide vient souvent de là, pas d'un bug.

---

# Partie C — Les écrans

## 9. Opérations terrain : la date limite ne disait pas qu'elle était dépassée

Une date limite qui ne signale pas son dépassement ne sert à rien. Les campagnes en retard sont
maintenant surlignées, avec un badge « En retard de N j », et « J-N » quand il reste moins d'une
semaine.

> **Attention au piège.** Une date limite est à **minuit heure de Djibouti (UTC+3)**. La comparer
> naïvement en heure universelle déclare une campagne en retard trois heures trop tôt — et le
> soir, un jour trop tôt. Le calcul est isolé dans un seul fichier prévu pour ça.

Le formulaire de création est aussi passé derrière un bouton (il occupait le haut de l'écran en
permanence), les onglets montrent enfin lequel est actif, et la liste est paginée.

## 10. Écran d'une campagne : refondu

Avant, on affectait des blocs en cochant une **longue liste de codes** du genre
`BOULAOS-Q7-A`, à côté d'une carte qui servait seulement à regarder.

Maintenant :

- L'**avancement** est remonté tout en haut.
- La **carte occupe la moitié gauche**, le panneau d'affectation la moitié droite. Les deux
  moitiés forment un seul geste : on filtre, on clique les blocs sur la carte, on choisit l'agent.
- **On sélectionne les blocs à la souris.** Un bloc déjà affecté n'est pas sélectionnable :
  le cliquer le met en évidence, ce qui répond à la question qu'on se pose en le cliquant.
- La sélection courante s'affiche en **pastilles retirables**.
- Chaque bloc affecté a un bouton **« Voir »** qui zoome dessus.

Un détail qui compte : les blocs **sans contour** n'apparaissent pas sur la carte. Supprimer la
liste les aurait rendus **inatteignables**. Ils sont donc regroupés à part, dans un dépliant.

## 11. Tableau de bord : la carte prend la moitié

La carte occupait toute la largeur sur 520 px de haut, ce qui repoussait sous la ligne de
flottaison tout ce qui dit **où en est** le travail. Elle prend maintenant la moitié gauche, et
l'**avancement du traitement** est à côté, en entonnoir vertical : chaque étape avec son nom,
sa barre, son compte et sa part.

La légende sous la carte a été supprimée : elle répétait exactement ce que l'entonnoir affiche
juste à côté, en moins bien.

## 12. Écran utilisateurs : la recherche ne cherchait pas

**Deux bugs, invisibles parce qu'ils ne produisaient aucune erreur.**

1. Le code qui recharge la liste demandait au serveur un filtre **vide, écrit en dur**. Changer
   le rôle ou taper une recherche mettait bien l'état à jour, mais rien ne rechargeait avec.
   La liste répondait — complète. Ni la recherche ni le rôle n'ont donc jamais filtré.
2. La recherche envoyait une requête **à chaque frappe**, sans temporisation.

Corrigés tous les deux. Ajouts : filtre par rôle, compteur, réinitialisation, **confirmation
avant de suspendre un compte** (c'était un clic sec à côté du bouton d'édition des rôles),
affichage du mot de passe à la saisie, et un message « aucun résultat » distinct de
« aucun utilisateur ».

## 13. File de vérification : on validait à l'aveugle

C'était le défaut le plus grave. La fiche d'un relevé à valider ou rejeter affichait une date et
des chiffres — **ni l'adresse, ni l'agent**. Le serveur n'envoyait que des identifiants
techniques.

Ce qui a changé :

- **L'identité s'affiche** : `12, rue de la Mosquée, Quartier 7 Djibouti`, son code d'adresse, et
  `Idriss Agent · 28 août 2026 à 08:51`.
- **Le motif de rejet est obligatoire** (5 caractères minimum). Un rejet renvoie l'adresse au
  début du parcours, et ce motif est le **seul message que l'agent recevra**.
- **Les photos s'agrandissent** en plein écran. La photo *est* la preuve ; la juger en vignette
  n'avait pas de sens.
- **Une carte de l'écart** montre deux points : où est la parcelle, et où l'agent a capturé.
  « 22 m d'écart » ne se vérifie pas sans voir où — de l'autre côté de la rue ou dans le bâtiment
  voisin, ce n'est pas la même décision.
- Le bandeau « relevés en souffrance » **mène au relevé** au lieu de l'annoncer sans y donner
  accès. Et s'il n'y est plus, l'écran le **dit** au lieu de ne rien faire.
- Tri **« les plus anciens d'abord »** : c'est le tri de travail, celui qui vide la file sans y
  laisser des relevés oubliés.
- **Validation groupée** avec confirmation.

> **Pourquoi pas de rejet groupé.** Le motif part tel quel à l'agent et doit dire ce qu'**il**
> doit corriger. Un motif unique appliqué à dix relevés de plusieurs agents ne dit rien à
> personne. Rejeter reste une décision une par une.

## 14. Qualité des données : un constat sans issue

L'écran anti-fraude montrait des relevés suspects et **ne permettait rien**. Pas de lien, pas
d'action. Pire : les motifs arrivaient en **phrases françaises écrites par le serveur**, donc
l'écran en anglais affichait du français.

Ce qui a changé :

- **L'identité** du relevé s'affiche, comme dans la file de vérification.
- Les motifs sont **traduits** : le serveur envoie un code (`too_far`) et des valeurs
  (`distance: 138`, `threshold: 100`), l'application écrit la phrase dans la bonne langue.
- Le **seuil** vient du serveur. Le filtre affichait « > 100 m » quel que soit le seuil
  réellement appliqué.
- Chaque ligne **mène au relevé** dans la file de vérification.
- **Bouton « Écarter »** — voir ci-dessous.
- Filtres, tri et pagination.

---

# Partie D — Ce qui a changé côté serveur

On a modifié `dasApi` parce que trois choses ne pouvaient pas se régler côté interface.

## 15. Le relevé porte enfin son identité

`SurveyResponse` renvoie maintenant le nom de l'agent, le libellé de la parcelle, son code
d'adresse, son quartier et sa position.

Deux précautions :

- **Une seule requête** pour toute une liste, pas une par ligne.
- Le libellé est composé au **seul endroit où la règle est écrite**, celui qu'utilise déjà
  l'écran des adresses. Le recopier aurait fait diverger le libellé d'une même parcelle d'un
  écran à l'autre.
- Ces champs sont **vides sur les réponses d'écriture** (création, rejet) : l'appelant connaît
  déjà son contexte, et six jointures à chaque écriture n'apporteraient rien.

## 16. Les motifs de fraude deviennent des codes

Six codes remplacent les phrases : `mock_location`, `too_far`, `clock_ahead`, `late_sync`,
`pushed_after_close`, `captured_late`. Les valeurs partent **en nombres non formatés** — le
serveur ne connaît pas la langue de l'utilisateur, ni son séparateur décimal.

C'est une **rupture de contrat** assumée : l'interface a été mise à jour dans la même passe.

## 17. « Écarter » un signal : l'état qui manquait

Sans lui, la file anti-fraude était **sans issue**. Un relevé examiné et jugé normal — un écart
GPS expliqué par un bâtiment en fond de parcelle, par exemple — y revenait à chaque chargement,
indéfiniment. La file ne diminuait jamais, donc elle cessait d'être lue.

Trois colonnes ont été ajoutées à la table des relevés (migration appliquée en base), plus un
endpoint dédié, avec :

- **motif obligatoire** — écarter un signal de fraude sans dire pourquoi n'est pas traçable ;
- **refus sur son propre relevé** — on ne se blanchit pas soi-même ;
- **une seule décision** : la première fait foi, on ne réécrit pas celle d'un collègue.

Les relevés écartés sortent de la file mais **restent consultables** : un classement sans suite
doit pouvoir être relu et contesté.

> **Distinction importante.** Écarter le **signal** n'est pas valider le **relevé**. Ce sont deux
> décisions, sur deux écrans. Un relevé écarté de la file anti-fraude reste à trancher
> normalement dans la file de vérification.

---

# Partie E — Ce qu'il reste

**42 lignes à arbitrer** au total dans `scripts/postcodes/reprise-a-arbitrer.csv`, réparties en
quatre motifs :

| Motif | Nb | Ce que ça veut dire |
|---|---|---|
| `hors-plan` | 24 | Quartiers qui existent en base mais que le classeur ignore. Ils attendent un numéro. |
| `absent-du-referentiel` | 14 | Lignes du classeur sans quartier correspondant, ni en base ni dans le SIG à l'identique |
| `proximite-douteuse` | 3 | Rapprochements ambigus : deux lignes du plan visent le même quartier, ou le plan en compte un là où la base en compte cinq |
| `ecarte-decision` | 1 | `Brise de mer` : le plan la met à Boulaos, la base à Ras Dika. C'est un déplacement de commune, pas une graphie. |

Et sur les autres sujets :

| Sujet | Ce qui bloque |
|---|---|
| 942 tronçons de voirie | 890 sans nom (relevé terrain nécessaire) ; 24 noms nouveaux demandent une modification du schéma ; le reste désigne des rues déjà présentes |
| `Streets` contient 17 doublons | Antérieurs à ce travail ; les fusionner est destructif et n'a pas été tenté |
| `Zone Centre` est vide | `Quartier 7` en est parti ; la zone n'a pas été supprimée |

**À faire pour que tout ceci soit visible en production :** l'image du conteneur `das-admin` doit
être **reconstruite et redéployée**, et la vue de tuiles `quartiers_tiles` doit être recopiée
dans `dasApi/scripts/creer-vues-tiles.sql` — sinon une reconstruction de la base la perd, et les
deux nouvelles couches deviennent muettes **sans erreur**.

---

## Où sont les fichiers

| Dossier | Contenu |
|---|---|
| `scripts/postcodes/` | Référentiel JSON, concordance, SQL de reprise, sauvegardes avant écriture |
| `scripts/sig/` | Requêtes de contrôle des îlots et de la voirie, fusion, vue de tuiles |
| `docs/` | Ce récapitulatif et les documents précédents |

Chaque script SQL est **rejouable sans effet double** et porte en commentaire ce qu'il fait et
pourquoi. Les sauvegardes des tables touchées, prises juste avant écriture, sont à côté.
