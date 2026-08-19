# Module de recensement — Campagnes, affectation par bloc et cycle de relevé

> Ce document est un **delta sur l'existant**, pas un schéma indépendant. L'état
> implémenté est décrit dans [`schema-recensement.md`](schema-recensement.md)
> (Campaign → CampaignAssignment → Survey) et le socle géographique dans
> [`recensement-geographie.md`](recensement-geographie.md) (City → Quartier → Bloc →
> Adresse). Ce doc décrit **ce qui change** : la maille d'affectation passe de l'adresse
> au bloc, la fin de campagne devient une frontière de saisie, et le cycle de validation
> gagne la validation provisoire.

> Conventions : PK en `uuid`, géométrie en 4326, PascalCase pour les tables,
> **identifiants anglais pour tout nouveau champ** (cf. CLAUDE.md). Les champs français
> existants (`Nom`, `Adresses`, `Blocs`) ne sont pas renommés rétroactivement, mais on
> n'en crée pas de nouveaux.

---

## Principe d'ensemble

Le recensement se fait par **campagne**. Pour une campagne, on **affecte des blocs à des
agents**, puis on **génère la feuille de route** (les adresses à relever des blocs
affectés). Les agents relèvent sur le terrain ; le superviseur valide.

Ordre des étapes :
1. Créer la campagne.
2. Affecter les blocs aux agents (`CampaignBlocs`).
3. Générer la feuille de route (`CampaignAssignments`) — adresses non abouties des blocs affectés.
4. Le superviseur ajoute les adresses à recontrôler (cas non terminaux qu'il choisit).
5. Relevé terrain par l'agent.
6. Soumission, puis validation / rejet / renvoi en correction par le superviseur.

L'affectation (2) précède la génération (3) : ce sont les blocs affectés qui délimitent
les adresses générées. Un bloc non affecté ne génère aucune adresse.

### Deux principes structurants

**1. L'affectation se fait au niveau du BLOC, pas de l'adresse.** Un agent est responsable
d'un bloc entier pour la campagne. Le responsable d'une adresse se **déduit** de son bloc ;
il n'est plus stocké sur la ligne de feuille de route. Réaffecter un bloc devient un seul
`UPDATE` au lieu d'une réécriture ligne à ligne.

**2. La clôture est une frontière de SAISIE, pas une frontière de TRAITEMENT.** Clôturer
bloque l'agent sur le terrain ; le superviseur continue de vider sa file de validation
après la clôture. Ce qu'il rejette alors ne repart pas vers l'agent — la parcelle est
reprogrammée dans la campagne suivante.

### Note de nomenclature

Une version antérieure de ce doc proposait `Periods` / `PeriodBlocs` / `PeriodAddresses`.
Renommage **écarté** : il n'apporte rien sur le fond et impose de renommer trois tables,
leurs FK, les slices `Features/Recensement/Campaigns` et `Survey.CampaignAssignmentId`.
On garde `Campaign*`. La seule table nouvelle est `CampaignBlocs`.

Tension de nommage assumée : `CampaignAssignment` ne porte plus d'agent, donc
« assignment » y désigne désormais **une tâche de la feuille de route**, pas une
affectation à quelqu'un. L'affectation à un agent, c'est `CampaignBloc`. Renommer
`CampaignAssignment` en `CampaignTask` serait plus juste, mais touche `Survey`, les
endpoints et les permissions — à faire seulement si on renomme pour d'autres raisons.

---

## Décisions à confirmer

Points tranchés **par défaut** pendant l'implémentation, faute d'arbitrage explicite. Tous sont
en production dans le code : ce ne sont pas des questions ouvertes bloquantes, mais des choix
qu'il faut valider ou renverser en connaissance de cause. Numérotés pour servir d'ordre du jour.

### D1 — Au plus une campagne `Planned` à la fois
*Implémenté* : `CreateCampaign` renvoie 409 s'il existe déjà une campagne en préparation.
**Pour** : sans cette borne, cinq campagnes à moitié affectées peuvent traîner sans que
personne sache laquelle est la vraie prochaine. **Contre** : empêche de préparer deux campagnes
en parallèle sur des zones différentes. **Coût du changement** : trivial, une condition à
retirer. Déjà signalé comme « décision par défaut » au §5.5.

### D2 — `CloseCampaign` subsiste comme clôture anticipée
*Implémenté* : l'endpoint existe toujours, mais son garde « refusée tant qu'une affectation est
à traiter » a été **retiré**. Ce garde contredisait le §4.3 — la clôture ne borne pas le travail
du superviseur — et rendait la bascule automatique impossible. **Question** : le modèle
doit-il connaître autre chose que la clôture par échéance ? Si non, supprimer l'endpoint ; le
§4.1 (« clôture ⟺ date limite atteinte et pas de prolongation, pas d'autre condition ») penche
dans ce sens. **Contre la suppression** : « le terrain a fini deux semaines en avance, on
ferme » est un besoin réel, et l'alternative — avancer la `Deadline` — est moins lisible.

### D3 — Une adresse dont le bloc n'est affecté à personne est refusée à l'ajout manuel
*Implémenté* : `AddCampaignAddresses` les écarte et les renvoie dans
`rejectedUnassignedBloc`. **Pour** : une tâche que personne ne peut traiter est un piège, elle
resterait `ToDo` jusqu'à la fin de la campagne. **Contre** : impose au superviseur d'affecter
le bloc d'abord, alors qu'il voulait peut-être préparer la liste puis affecter.
**Alternative** : les créer quand même et se contenter d'avertir.

### D4 — Rejet sur campagne clôturée : la tâche d'origine repasse aussi en `ToDo`
*Implémenté* : en plus du report dans la campagne active, la tâche de la campagne clôturée
revient à `ToDo`. **Pour** : le statut est une dénormalisation de l'état des relevés ; un relevé
rejeté ne vaut pas une tâche `Done`. **Contre** : la campagne clôturée affiche pour toujours
des tâches « à faire » que personne ne fera, ce qui abîme ses statistiques de fin. **Alternative** :
un statut terminal distinct (`Superseded`) pour dire « soldée ailleurs ».

### D5 — `ExtendCampaign` refuse si une autre campagne a démarré entre-temps
*Implémenté*, non prévu au plan. Rouvrir une campagne clôturée réactive le terrain ; sans ce
contrôle, deux campagnes seraient relevables en parallèle et l'invariant du §5.1 tomberait par
la porte de derrière. **À confirmer** : c'est bien le comportement voulu, ou faut-il plutôt
clôturer automatiquement l'autre ?

### D6 — Réaffectation : un seul titulaire précédent conservé
*Implémenté* : `CampaignBloc.PreviousAgentId`. Après **deux** réaffectations sur le même bloc
(A → B → C), A se voit refuser une capture pourtant légitime. Le modèle échoue donc du côté
fermé. **Alternative** : un modèle temporel (une ligne par titulaire, `ValidFrom` / `ValidTo`),
qui alourdit toutes les jointures de déduction de l'agent. **À revoir si** les doubles
réaffectations deviennent courantes.

### D7 — `CampaignAssignment` n'est pas renommé en `CampaignTask`
Voir la note de nomenclature ci-dessus. La tension est réelle depuis que l'entité ne porte plus
d'agent. **Coût du changement** : `Survey.CampaignAssignmentId`, les endpoints
`/api/campaign-assignments`, une migration de renommage.

### D8 — Remontée des affectations existantes : arbitrage à la majorité
*Implémenté* dans la migration `MoveAssignmentToBlocLevel` : si un bloc avait plusieurs agents
sur une même campagne, celui qui portait le plus de parcelles reprend le bloc entier.
**Sans conséquence en dev** (le cas ne s'est pas présenté), mais **à vérifier avant toute
application en production** — la requête de contrôle est en commentaire dans la migration.
La descente (`Down`) supprime les tâches dont le bloc n'est affecté à personne, faute de
pouvoir leur réinventer un responsable.

---

## Table nouvelle

### CampaignBlocs
Affectation d'un bloc à un agent pour une campagne. **Seul endroit** où un agent est
rattaché à un périmètre.

- `Id` uuid PK
- `CampaignId` uuid NOT NULL FK -> Campaigns(Id) ON DELETE CASCADE
- `BlocId` uuid NOT NULL FK -> Blocs(Id) ON DELETE RESTRICT
- `AgentId` uuid NOT NULL FK -> Users(Id)
- `PreviousAgentId` uuid NULL FK -> Users(Id)
- `AssignedAtUtc` timestamptz NOT NULL
- `ReassignedAtUtc` timestamptz NULL, `ReassignedByUserId` uuid NULL
- UNIQUE (`CampaignId`, `BlocId`)
- index sur (`CampaignId`, `AgentId`)

**`PreviousAgentId` — ajouté à l'implémentation (2026-08-11), absent de la conception initiale.**
Sans lui, le test du §8.3 (« capturé avant la bascule ⇒ accepté ») ne peut pas distinguer
l'ancien titulaire d'un agent qui n'a **jamais** eu ce bloc : la seule date de bascule
accepterait n'importe quel `AgentTerrain` antidatant sa capture. Le trou était donc plus large
que la limite déjà documentée sur les doubles réaffectations. Une colonne nullable suffit à le
fermer, et fait basculer la limite restante du côté fermé : après `A → B → C`, A se voit
refuser une capture pourtant légitime, au lieu qu'un tiers passe.

Règles :
- `AgentId` doit référencer un utilisateur **actif portant le rôle `AgentTerrain`** —
  contrôle dans le handler, pas en base.
- `ON DELETE RESTRICT` sur `BlocId` : supprimer un bloc affecté doit échouer
  explicitement, pas effacer silencieusement le travail d'une campagne.

> Hypothèse : **un seul agent par bloc et par campagne**. Si le partage d'un bloc entre
> plusieurs agents devient nécessaire, retirer le UNIQUE et gérer l'affectation plus
> finement — à ne faire que si le besoin est réel.

---

## Tables existantes — ajustements

### Campaigns — champs ajoutés
- `Code` varchar(20) NOT NULL UNIQUE — format **YYMM-i** (ex. `2608-1`), `i` = n-ième
  campagne du mois. YYMM garantit un tri chronologique correct au changement d'année.
- `Deadline` date NOT NULL
- `AllowLateSurveys` bool NOT NULL DEFAULT false — prolonge la **saisie** au-delà de la date limite
- `ExtendedByUserId` uuid NULL, `ExtendedAtUtc` timestamptz NULL — trace de la prolongation

`Status` reste l'enum existant `Planned` / `InProgress` / `Closed`.

**Attribution du `Code`** : `i` est calculé dans la transaction de création, mais ce n'est
**pas** la transaction qui garantit l'unicité — en `READ COMMITTED`, deux créations
concurrentes lisent le même `max(i)`. Ce qui protège réellement, c'est **l'index UNIQUE +
un retry sur violation**.

### CampaignAssignments — champ retiré
- **`AgentId` est supprimé.** Le responsable se déduit par jointure Adresse → Bloc →
  CampaignBlocs.
- `Status` (`ToDo` / `Done` / `Abandoned`) et les champs d'abandon sont **conservés**.
  `Abandoned` reste indispensable : sans issue terminale décidée par un humain, une
  parcelle irréductible laisse une tâche `ToDo` pour toujours.
- Ajouter UNIQUE (`CampaignId`, `AdresseId`) — sans quoi relancer la génération duplique
  toute la feuille de route.

`Status` est une **dénormalisation dérivée** de l'état des `Survey`, maintenue par les
handlers. Elle existe pour lire la feuille de route sans agréger les relevés ; elle n'est
pas une source de vérité concurrente.

### Surveys — champs ajoutés
- `ValidationType` varchar(20) NULL — `Definitive` / `Temporary`, renseigné à la validation
- `IsLate` bool NOT NULL DEFAULT false — capturé après la `Deadline` (voir §4)

Tout le reste de `Survey` est **inchangé et doit le rester**. En particulier ne pas perdre :
- `Outcome` (`Surveyed` / `NotSurveyable`) + `NotSurveyableReason` — la séparation
  « condition du bâtiment » / « résultat de visite » (§3)
- `CreatedAtUtc` (horodatage **serveur**) en plus de `CapturedAtUtc` (horodatage **client**,
  falsifiable) — c'est l'écart entre les deux qui détecte la fraude
- `DistanceFromAddressM`, `GpsAccuracyM`, `IsMockLocation`
- la table `SurveyPhoto` (**N photos par relevé**) — ne pas la remplacer par un `PhotoUrl` unique
- `AgentId` sur le `Survey` : **l'agent qui a effectivement relevé**, un fait historique.
  Il peut différer du titulaire actuel du bloc si celui-ci a été réaffecté en cours de
  campagne. Le titulaire se déduit du bloc, le releveur se lit sur le relevé.

### NotSurveyableReason — valeurs ajoutées
Enum C# (pas une table) — ajout sans migration :
- `VacantLand` — non bâti (terminal)
- `OutOfTime` — pas eu le temps de traiter (non terminal)

### EtatOccupations — **inchangée**
Pas de colonne `IsTerminal`. Voir §3.

---

## Règles métier

### 1. Génération de la feuille de route
Base automatique = **uniquement les parcelles jamais relevées de façon aboutie**, dans les
blocs affectés. Une parcelle « inaccessible » a un relevé mais reste candidate (résultat
non terminal).

Le superviseur **ajoute manuellement** ce qu'il juge utile de recontrôler (rejetées,
validées provisoirement, inaccessibles…). La génération automatique ne réinclut **jamais**
un terminal ni un définitif : l'inclusion de ces cas est toujours un acte explicite.

**La génération est ré-exécutable et idempotente** (UNIQUE + `ON CONFLICT DO NOTHING`).
C'est ce qui répond au cas « adresse créée après la génération » : une parcelle découverte
sur le terrain dans un bloc déjà affecté entre dans la feuille de route au prochain appel,
sans toucher aux lignes existantes ni à leur statut. La feuille de route est figée
*par ligne*, pas figée *en extension*.

**La génération exclut aussi les adresses ayant un relevé `Submitted` non traité.** Comme
la clôture n'oblige plus le superviseur à vider sa file (§4.3), un relevé peut rester en
attente de décision au-delà de la campagne. Sans cette exclusion : la parcelle n'a aucun
relevé validé → elle est reprise dans N+1 → un agent la relève une seconde fois → et le
superviseur valide le premier relevé trois semaines plus tard. Deux relevés valides sur la
même parcelle, et celui qu'on affiche dépend de l'ordre de traitement.

L'exclusion est sûre grâce au report actif (§7) : si le superviseur finit par rejeter, la
parcelle est réinjectée à ce moment-là dans la campagne en cours ; s'il valide, elle est
sortie pour de bon. **La décision du superviseur commande, sans course entre les deux
campagnes.**

> **Contrepartie à surveiller** : une parcelle dont le `Submitted` n'est *jamais* traité ne
> revient plus du tout. Il faut donc un indicateur « relevés en souffrance depuis une
> campagne clôturée », à côté du compteur de provisoires (§6) — sinon des parcelles
> disparaissent silencieusement du périmètre.

### 2. Sortie du périmètre : la liste exhaustive
Deux sorties définitives seulement — *validé pour de bon*, ou *constaté qu'il n'y a rien à
relever*. Tout le reste revient, automatiquement ou sur décision humaine.

| État de la parcelle à la fin de la campagne | Revient automatiquement |
|---|---|
| Jamais relevée (tâche `ToDo`) | **oui** |
| Brouillon jamais soumis (gelé en fin de fenêtre, §4.6) | **oui** |
| Relevé **rejeté** | **oui** — report actif (§7) |
| `NotSurveyable` **non terminal** validé (inaccessible, refusé, pas eu le temps) | **oui** |
| Tâche **abandonnée** par le superviseur | **oui** |
| Relevé **`Submitted` non traité** | non — en attente de décision (§1) |
| Validé **`Temporary`** | non — **ajout manuel** du superviseur |
| Validé **`Definitive`** | non |
| `NotSurveyable` **terminal** validé (démoli, introuvable, non bâti) | non |

Un `Abandoned` est une décision **de campagne** : il solde la tâche et débloque les
statistiques, mais ne sort **pas** la parcelle du périmètre des campagnes suivantes.
Abandonner n'est pas constater.

### 3. Terminalité : sur l'issue de visite, pas sur l'état d'occupation
Une version antérieure proposait un drapeau `IsTerminal` sur `EtatOccupations`. **Écarté.**
Cette table décrit la *condition d'un bâtiment observé* ; y injecter les *issues de visite*
(absent, inaccessible, démoli) refusionne deux natures que le schéma actuel a déjà séparées.

La terminalité se lit sur `NotSurveyableReason`, un enum C# — donc un `switch`, sans
migration ni ligne de catalogue à maintenir :

| Raison | Terminal | Sens |
|---|---|---|
| `Demolished` | oui | le bâtiment n'existe plus |
| `NotFound` | oui | l'adresse ne correspond à rien sur le terrain |
| `VacantLand` | oui | parcelle non bâtie |
| `Inaccessible` | non | à repasser |
| `Refused` | non | à repasser |
| `OutOfTime` | non | à repasser |

Un relevé `Outcome = Surveyed` n'est **jamais** terminal par sa raison — il l'est par sa
validation `Definitive`. Les deux dimensions restent indépendantes.

### 4. Fin de campagne : clôture, prolongation, fenêtre de remontée

#### 4.1 Quand la campagne se clôture
```
Clôture  ⟺  Deadline atteinte  ET  AllowLateSurveys = false
```

Pas d'autre condition. En particulier **pas** « aucun relevé en attente de validation » :
la clôture n'interrompt pas le travail du superviseur (§4.3), donc un relevé `Submitted`
au moment de la clôture n'est jamais orphelin.

Le statut est **stocké**, avec bascule automatique quand la condition est réunie — aucun
clic requis. Il n'est pas calculé à la volée : il faut un `ClosedAtUtc` réel pour horodater
la campagne et ancrer la fenêtre de remontée (§4.4).

`AllowLateSurveys = true` **rouvre la saisie** — c'est la soupape pour donner du temps
supplémentaire sur le terrain. Toute prolongation est tracée (`ExtendedByUserId` /
`ExtendedAtUtc`), sinon personne ne saura qui a prolongé ni quand.

#### 4.2 Ce que la clôture bloque
La clôture bloque **l'agent en saisie** : plus de nouveau relevé, plus de modification,
plus de soumission — sous réserve de la fenêtre de remontée (§4.4).

#### 4.3 Ce que la clôture ne bloque pas
Le superviseur continue de traiter sa file. Mais ses issues se réduisent à **deux** :

- **Valider** (`Definitive` ou `Temporary`)
- **Rejeter** → la parcelle est reprogrammée dans la campagne suivante

**`RequestCorrection` est refusé sur une campagne clôturée** (`409`), pas seulement
déconseillé : renvoyer un relevé à corriger à un agent bloqué en saisie l'envoie dans un
mur. Et l'agent devra de toute façon retourner physiquement sur la parcelle — conserver sa
saisie n'a plus d'intérêt une fois la campagne finie. Le renvoi en correction sert à
corriger *sans redéplacement*, un usage qui n'existe qu'en cours de campagne.

> **Conséquence : `Temporary` devient nécessaire, pas confortable.** Sans renvoi en
> correction, le superviseur face à « données globalement bonnes mais un doute » n'aurait
> plus que le rejet — donc un trou de couverture jusqu'à la campagne suivante.
> `Validated + Temporary` est la sortie de ce cas : livrable immédiatement, marqué à revoir.

**La file de validation devient multi-campagnes** (N clôturée + N+1 en cours). Elle a
besoin d'un filtre par campagne, pas d'une file implicite « la campagne courante ».

#### 4.4 Les deux horloges
Deux tests indépendants, qui ne mesurent pas la même chose :

| | Ce qu'on compare | Ce que ça juge |
|---|---|---|
| **Test 1** | `CapturedAtUtc` vs `Deadline` | **le travail** — le relevé a-t-il été fait dans les temps ? |
| **Test 2** | arrivée serveur vs `ClosedAtUtc` + `SyncWindowHours` | **la livraison** — jusqu'à quand accepte-t-on de le recevoir ? |

Après clôture, une écriture par l'agent est acceptée **si et seulement si les deux passent** :

```
CapturedAtUtc  <=  Deadline (23:59:59, heure de Djibouti)
ET  arrivée serveur  <=  ClosedAtUtc + SyncWindowHours
```

Sinon `409`, avec un message qui **distingue les deux cas** — « relevé postérieur à la date
limite » et « fenêtre de remontée expirée » ne se corrigent pas de la même manière.

Le test 1 porte sur le terrain, le test 2 sur le réseau : on ne juge pas la qualité du
travail sur la qualité de la connexion, mais on ne laisse pas la campagne ouverte en
écriture indéfiniment.

> **Piège de fuseau.** `Deadline` est une `date`, `CapturedAtUtc` un instant UTC. La
> frontière est 23:59:59 **heure de Djibouti** (UTC+3, pas de changement d'heure), soit
> **20:59:59 UTC** le jour de la limite. Comparer naïvement à minuit UTC ampute la journée
> de trois heures et refuse le travail de fin d'après-midi — le jour même de la date
> limite, celui où il y en a le plus.

#### 4.5 `SyncWindowHours` — défaut 72 h
Valeur configurable, défaut **72 h**. Ce n'est pas un chiffre de confort : c'est le plus
petit qui absorbe un week-end djiboutien. Semaine ouvrée dimanche → jeudi, week-end
vendredi–samedi. Une date limite le jeudi soir — le cas le plus naturel — laisse un agent
sans réseau jusqu'au dimanche matin, soit ~56 h.

- 24 h : expire vendredi soir → travail du jeudi perdu
- 48 h : expire samedi soir, en plein week-end → perdu aussi
- 72 h : expire dimanche soir → l'agent a sa matinée de reprise

Réduire cette valeur obligerait à interdire les dates limites en fin de semaine, une
contrainte bien plus pénible qu'un paramètre.

**À ne pas confondre avec `AllowLateSurveys`** : la prolongation rouvre la **saisie**
(relever de nouvelles parcelles après la limite) ; la fenêtre n'autorise que la
**remontée** de ce qui était déjà fait avant.

Ce que la fenêtre coûte, ce n'est pas de la donnée — un relevé arrivé trop tard n'est pas
perdu, l'adresse revient dans la campagne suivante. C'est de la **surface de fraude** :
72 h pendant lesquelles on peut fabriquer des relevés antidatés. D'où §4.7.

#### 4.6 Les brouillons
Pas de règle spéciale à la clôture : pendant la fenêtre, l'agent peut encore pousser **et
soumettre** ce qu'il a capturé avant la limite. Le gel intervient **à la fermeture de la
fenêtre** — tout ce qui est encore `Draft` est alors figé pour l'audit, et l'adresse repart
dans la campagne suivante. Pas d'auto-soumission : valider une saisie à moitié remplie est
pire que de la perdre.

#### 4.7 La fenêtre est la faille à surveiller
Le scénario d'abus est direct : ne rien relever, puis pousser 40 relevés après la clôture
en antidatant `CapturedAtUtc` au dernier jour. Le signal habituel
(`CreatedAtUtc − CapturedAtUtc`) ne suffit pas ici : pendant la fenêtre, **tous** les
relevés ont un gros écart par construction.

Donc : tout ce qui arrive pendant la fenêtre part automatiquement dans la file des relevés
à revoir, et le contrôle porte sur le **volume par agent**, pas sur l'écart individuel.

#### 4.8 Effet sur `IsLate`
Un relevé capturé après la limite ne peut plus exister que si l'extension était active.
`IsLate` cesse donc d'être un filtre d'entrée dans la file du superviseur (il n'y a plus
rien à filtrer) et redevient une **étiquette informative** : « capturé pendant la
prolongation ». Il reste figé à la réception, jamais recalculé — sinon déplacer la date
limite réécrirait rétroactivement le statut des relevés déjà reçus.

### 5. Sérialisation des campagnes

#### 5.1 L'invariant à tenir
> **Une parcelle ne doit jamais être relevable simultanément dans deux campagnes.**

Sinon deux agents relèvent la même parcelle en parallèle, on obtient deux `Survey`
concurrents, et « quel est l'état courant de cette adresse ? » n'a plus de réponse unique.

Une parcelle n'est relevable que si **trois conditions** sont réunies : sa campagne est
`InProgress`, son bloc est affecté, la feuille de route est générée. Deux garde-fous
tiennent l'invariant :
- `UNIQUE (CampaignId, BlocId)` → dans **une** campagne, un bloc n'a qu'un agent ;
- la sérialisation → il n'y a jamais **deux** campagnes ouvertes, donc jamais deux
  affectations concurrentes du même bloc.

Le second n'est nécessaire que parce que le premier ne voit pas au-delà de sa campagne.

#### 5.2 Le verrou porte sur le démarrage
**On ne peut pas démarrer une campagne (`Planned → InProgress`) tant qu'une autre est
`InProgress`.** Le verrou n'est **pas** sur la création.

Ce qu'une campagne `Planned` autorise :

| État | Affecter des blocs | Générer la feuille de route | L'agent peut relever |
|---|---|---|---|
| `Planned` | **oui** | non | non |
| `InProgress` | oui | oui | **oui** |
| `Closed` | non | non | non (sauf fenêtre de remontée) |

Une campagne `Planned` n'est qu'un **brouillon de répartition** — « ce bloc ira à cet
agent ». Rien n'est visible côté terrain, aucune tâche n'existe, elle ne peut donc pas
violer l'invariant. Le danger n'apparaît pas quand la campagne *existe*, mais quand elle
*ouvre le terrain* : c'est là que le contrôle doit se trouver.

**Ce que le verrou sur la création coûterait** : affecter les blocs d'une campagne, c'est
répartir des centaines de blocs entre les agents, vérifier qu'aucun quartier n'est oublié,
tenir compte des congés. Ça prend des jours. Interdire la création tant que N tourne
repousse toute cette préparation après la clôture — donc une période morte pendant laquelle
**les agents de terrain n'ont rien à faire**, à attendre que la répartition soit finie.
Avec le verrou sur le démarrage, N+1 se prépare pendant la dernière semaine de N et démarre
le lendemain de la clôture : zéro jour d'inactivité terrain.

#### 5.3 Pas de génération en `Planned`
La génération sélectionne les adresses « non abouties ». Tant que le superviseur valide
encore les relevés de N, **cette liste bouge** : une adresse candidate ce matin peut être
validée `Definitive` cet après-midi. Générer en `Planned` produirait des tâches fantômes
sur des parcelles déjà terminées.

La génération se déclenche donc **au démarrage**, jamais avant — et peut être relancée
autant que nécessaire ensuite pour rattraper les rejets tardifs de N.

#### 5.4 Contrôles au passage `Planned → InProgress`
1. Aucune autre campagne `InProgress` → sinon `409`
2. Au moins un bloc affecté — démarrer une campagne vide n'a pas de sens
3. Tous les `AgentId` affectés référencent encore des utilisateurs **actifs** avec le rôle
   `AgentTerrain` — à revérifier ici, car un agent peut avoir été désactivé entre la
   préparation et le démarrage
4. Puis génération de la feuille de route

Le point 3 est la contrepartie de la préparation anticipée : plus l'écart entre préparation
et démarrage est grand, plus la répartition peut avoir vieilli.

#### 5.5 Au plus une campagne `Planned`
En plus d'au plus une `InProgress`. Sans cette borne, rien n'empêche cinq campagnes
`Planned` à moitié affectées de traîner, sans que personne sache laquelle est la vraie
prochaine. On garde ainsi la lisibilité du verrou sur la création, sans en payer la période
morte.

> **Décision par défaut, à confirmer** — voir **D1** dans « Décisions à confirmer ».

---

Une campagne `Closed` ne bloque pas le démarrage de la suivante, même s'il reste des
relevés à valider — c'est tout l'intérêt du §4.3.

> Ceci remplace la décision antérieure « deux campagnes peuvent se chevaucher sur des
> quartiers différents » (commentaire de `Campaign.cs`) : ce chevauchement n'a jamais été
> protégé et ouvrait plus de problèmes qu'il n'en résolvait.

### 6. Validation
Quatre issues à un relevé soumis (trois seulement après clôture, cf. §4.3) :

- **Rejected** : données refusées, à refaire. En campagne ouverte, la tâche repasse `ToDo`.
  En campagne clôturée, la parcelle est reprogrammée (§7). La saisie n'est pas réutilisée.
- **RequestCorrection** : le relevé repasse `Draft`, **la saisie est conservée** et l'agent
  la corrige sans redéplacement. C'est le cas courant (photo floue, compte d'étages
  douteux) ; le rejet est le cas dur. **Interdit après clôture.**
- **Validated + Definitive** : parcelle terminée, exclue des générations suivantes.
- **Validated + Temporary** : accepté provisoirement, **utilisable pour la livraison**,
  à revérifier. La parcelle n'est **pas** réincluse automatiquement ; le superviseur
  l'ajoute volontairement. Le relevé temporaire reste utilisé jusqu'à ce qu'un nouveau le
  remplace — pas de trou de couverture.

**Le superviseur ne valide jamais son propre relevé.** Contrôle porté par le handler et non
par une policy, pour que le bypass Admin ne l'annule pas (règle existante, maintenue).

**Suivi des provisoires.** Un `Temporary` jamais revu reste temporaire indéfiniment et le
drapeau ne sert plus à rien. Il faut donc un filtre `validationType=Temporary` sur la liste
des relevés et un compteur de provisoires en attente dans `GetCampaignProgress`. Sans cette
file, ne pas implémenter `Temporary` du tout.

### 7. Rejet en campagne clôturée → report
Rejeter un relevé d'une campagne clôturée **insère directement la tâche dans la campagne
active**. Si aucune campagne n'est active, l'adresse reste simplement candidate à la
prochaine génération.

L'insertion directe est nécessaire parce que la campagne suivante peut **déjà** avoir été
générée au moment du rejet : dans ce cas l'adresse ne serait dans aucune feuille de route,
et il faudrait relancer la génération à la main. L'insertion isolée est sans risque, la
feuille de route étant idempotente (UNIQUE + `ON CONFLICT DO NOTHING`).

**Le motif de rejet doit suivre l'adresse.** Sinon l'agent rouvre la tâche sans savoir ce
qui clochait, refait le même relevé à l'identique et se fait rejeter une seconde fois.
Pas de colonne nouvelle : la tâche affiche le dernier relevé rejeté de l'adresse et son
`RejectionReason`, par requête sur `Surveys` filtrée par `AdresseId`. C'est une exigence
d'écran, notée ici pour qu'elle ne se perde pas à l'implémentation.

### 8. Réaffectation d'un bloc en cours de campagne

La règle « une parcelle, un seul releveur » vaut **à un instant donné**, pas sur toute la
durée de la campagne. Agent malade, démission, mutation, compte désactivé, rééquilibrage
de charge : sur une campagne de plusieurs semaines, la réaffectation arrivera. S'interdire
de réaffecter pour préserver une lecture stricte de la règle serait intenable sur le terrain.

Une réaffectation, c'est **un seul `UPDATE`** sur `CampaignBlocs.AgentId` (+ trace
`ReassignedAtUtc` / `ReassignedByUserId`).

| | Effet |
|---|---|
| Responsabilité des parcelles du bloc | bascule **immédiatement** sur B — c'est déduit, pas stocké |
| `Survey.AgentId` des relevés déjà faits par A | **inchangé** — A les a faits, c'est un fait |
| Relevés de A déjà `Submitted` | restent dans la file, validés normalement, attribués à A |
| Relevé de A rejeté après la réaffectation | la tâche repasse `ToDo` → c'est **B** qui y retournera |

Le dernier point est cohérent : le rejet ne renvoie pas vers *l'auteur*, il renvoie vers
*le responsable actuel du périmètre*.

#### 8.1 Filtre d'écriture ≠ filtre de lecture
C'est le piège d'implémentation principal. Une implémentation naïve utiliserait la même
jointure pour les deux, et A verrait disparaître de son téléphone tout le travail qu'il a
fait sur le bloc.

- **Écriture** (« puis-je relever ici ? ») → `CampaignBlocs.AgentId = moi`, évalué **au
  moment de l'écriture**, jamais figé à la création de la tâche
- **Lecture de ses propres relevés** → `Survey.AgentId = moi`

A perd le droit d'écrire sur le bloc, mais garde la vue sur ce qu'il y a fait.

#### 8.2 Les statistiques par agent se comptent sur `Survey.AgentId`
« Combien de parcelles X a-t-il relevées » passe par les relevés, **jamais** par la
jointure sur le bloc. Sinon une réaffectation réécrit rétroactivement la productivité de
tout le monde : B hérite des chiffres de A, et A tombe à zéro sur ce bloc. Pour évaluer des
agents de terrain, c'est disqualifiant.

#### 8.3 Cas offline : on juge sur le moment du terrain
A est hors réseau quand la réaffectation a lieu, continue de relever des parcelles qui ne
sont plus les siennes, puis synchronise. Même principe que la date limite (§4.4) — le
moment du terrain décide, pas celui du réseau :

```
CapturedAtUtc  <   ReassignedAtUtc   ->  accepte  (le travail etait legitime quand il a ete fait)
CapturedAtUtc  >=  ReassignedAtUtc   ->  refuse   (409, bloc reaffecte)
```

Aucune règle nouvelle : c'est le test 1 du §4.4 appliqué à une autre frontière.

#### 8.4 Les brouillons de A
**A peut soumettre ce qu'il a capturé avant la réaffectation ; tout ce qui est capturé
après est refusé.** C'est la règle §8.3, rien de plus.

Le transfert du brouillon à B est **écarté** : B soumettrait sous son nom des observations
qu'il n'a pas faites, ce qui détruit la traçabilité et la valeur anti-fraude de
`Survey.AgentId`. Un relevé doit être signé par celui qui a physiquement observé. Si A ne
soumet pas, le brouillon est gelé pour l'audit et B relève à neuf.

#### 8.5 Réaffectation interdite sur une campagne `Closed`
Sans objet — personne ne peut plus écrire.

### 9. RBAC
Aucune permission nouvelle. Répartition sur le catalogue existant :

| Action | Permission | Rôle |
|---|---|---|
| Créer / renommer une campagne, générer la feuille de route | `campaigns.view` + `tasks.assign` | Superviseur, Gestionnaire |
| Affecter / réaffecter un bloc à un agent | `tasks.assign` | Superviseur |
| Démarrer / prolonger une campagne | `tasks.assign` | Superviseur |
| Relever, modifier son brouillon | `tasks.view_own` | AgentTerrain (sur ses blocs uniquement) |
| Soumettre | `tasks.submit_for_validation` | AgentTerrain |
| Valider (`Definitive` / `Temporary`) | `tasks.validate` | Superviseur |
| Rejeter, abandonner une tâche | `tasks.reject` | Superviseur |
| Renvoyer en correction (campagne ouverte seulement) | `tasks.request_correction` | Superviseur |
| Supprimer une campagne | `campaigns.delete` | Admin seul |

Le scoping « l'agent ne voit que ses tâches » n'est pas une permission, c'est un filtre
dans les handlers — et **deux filtres distincts**, cf. §8.1 : `CampaignBlocs.AgentId` pour
l'écriture, `Survey.AgentId` pour la lecture de ses propres relevés. La maille bloc rend le
premier plus simple qu'avant (une jointure au lieu d'un champ par ligne).

---

## Requêtes clés

### Responsable d'une adresse (via son bloc)
```sql
SELECT cb."AgentId"
FROM public."CampaignAssignments" ca
JOIN public."Adresses"      a  ON a."Id"  = ca."AdresseId"
JOIN public."CampaignBlocs" cb ON cb."BlocId" = a."BlocId" AND cb."CampaignId" = ca."CampaignId"
WHERE ca."Id" = @campaignAssignmentId;
```

### Génération (adresses non abouties des blocs affectés)
```sql
INSERT INTO public."CampaignAssignments" ("Id","CampaignId","AdresseId","Status")
SELECT gen_random_uuid(), @campaignId, a."Id", 'ToDo'
FROM public."Adresses" a
JOIN public."CampaignBlocs" cb ON cb."BlocId" = a."BlocId" AND cb."CampaignId" = @campaignId
WHERE NOT EXISTS (                                   -- (1) deja abouti
    SELECT 1
    FROM public."Surveys" s
    WHERE s."AdresseId" = a."Id"
      AND s."Status" = 'Validated'                 -- <- un releve rejete n'exclut rien
      AND ( s."ValidationType" = 'Definitive'
            OR ( s."Outcome" = 'NotSurveyable'
                 AND s."NotSurveyableReason" IN ('Demolished','NotFound','VacantLand') ) )
)
AND NOT EXISTS (                                     -- (2) en attente de decision
    SELECT 1
    FROM public."Surveys" s
    WHERE s."AdresseId" = a."Id" AND s."Status" = 'Submitted'
)
ON CONFLICT ("CampaignId", "AdresseId") DO NOTHING;  -- <- rejouable
```

Trois éléments, tous nécessaires :
- **`s."Status" = 'Validated'`** dans (1) : sans ce filtre, un relevé **rejeté** portant un
  résultat terminal (« démoli ») sortait la parcelle du périmètre **définitivement**, alors
  que sa donnée avait été refusée. Bug silencieux et irréversible.
- **Le second `NOT EXISTS`** : exclut les parcelles dont un relevé attend encore la décision
  du superviseur, pour éviter le double relevé décrit au §1.
- **`ON CONFLICT DO NOTHING`** (adossé au UNIQUE) : rend la génération rejouable, condition
  du §1 sur les adresses créées après coup et du §7 sur les reports.

### Provisoires en attente de recontrôle
```sql
SELECT s.*
FROM public."Surveys" s
WHERE s."Status" = 'Validated' AND s."ValidationType" = 'Temporary'
  AND NOT EXISTS (                        -- aucun releve definitif ne l'a remplace depuis
      SELECT 1 FROM public."Surveys" s2
      WHERE s2."AdresseId" = s."AdresseId"
        AND s2."Status" = 'Validated' AND s2."ValidationType" = 'Definitive'
        AND s2."CapturedAtUtc" > s."CapturedAtUtc"
  );
```

### Relevés en souffrance (soumis, campagne clôturée, jamais tranchés)
Contrepartie de l'exclusion du §1 : sans ce suivi, ces parcelles sortent silencieusement
du périmètre.

```sql
SELECT s."Id", s."AdresseId", s."AgentId", s."CapturedAtUtc", c."Code"
FROM public."Surveys" s
JOIN public."CampaignAssignments" ca ON ca."Id" = s."CampaignAssignmentId"
JOIN public."Campaigns" c            ON c."Id"  = ca."CampaignId"
WHERE s."Status" = 'Submitted' AND c."Status" = 'Closed'
ORDER BY s."CapturedAtUtc";
```

### Production par agent (jamais via la jointure sur le bloc)
Cf. §8.2 — passer par `CampaignBlocs` ferait réécrire les chiffres par toute réaffectation.

```sql
SELECT s."AgentId", count(*) FILTER (WHERE s."Status" = 'Validated') AS validated,
                             count(*)                               AS captured
FROM public."Surveys" s
JOIN public."CampaignAssignments" ca ON ca."Id" = s."CampaignAssignmentId"
WHERE ca."CampaignId" = @campaignId
GROUP BY s."AgentId";
```

### Relevés arrivés pendant la fenêtre de remontée (contrôle de volume par agent)
```sql
SELECT s."AgentId", count(*) AS pushed_after_close
FROM public."Surveys" s
JOIN public."CampaignAssignments" ca ON ca."Id" = s."CampaignAssignmentId"
JOIN public."Campaigns" c            ON c."Id"  = ca."CampaignId"
WHERE c."Id" = @campaignId
  AND s."CreatedAtUtc" > c."ClosedAtUtc"
GROUP BY s."AgentId"
ORDER BY pushed_after_close DESC;
```

### Position de livraison (dernier relevé validé, définitif ou provisoire)
```sql
SELECT a."Id", COALESCE(sv."EntryPoint", a."Location") AS delivery_point
FROM public."Adresses" a
LEFT JOIN LATERAL (
    SELECT s."EntryPoint"
    FROM public."Surveys" s
    WHERE s."AdresseId" = a."Id" AND s."Status" = 'Validated'
      AND s."EntryPoint" IS NOT NULL
    ORDER BY s."CapturedAtUtc" DESC
    LIMIT 1
) sv ON true;
```

`a."Location"` est le point intérieur de la parcelle calculé à la création de l'adresse
(`InteriorPoint`, cf. `recensement-geographie.md`) : le fallback est toujours dans la
parcelle, jamais à côté.

---

## État d'implémentation

**Phase 1 (2026-08-11)** — schéma et domaine. Migration
`20260811102745_AddCampaignBlocsAndValidationType` : table `CampaignBlocs`, `Code` /
`Deadline` / `AllowLateSurveys` / `ExtendedBy*` / `CreatedAtUtc` sur `Campaigns`,
`ValidationType` / `IsLate` sur `Surveys`, `NotSurveyableReason.IsTerminal()`,
`Campaign.DeadlineEndUtc()` / `IsWithinDeadline()` / `IsWithinSyncWindow()` /
`ShouldAutoClose()`. Côté slices : `CreateCampaign` (code `YYMM-i` + retry sur collision,
verrou « au plus une Planned ») et `ValidateSurvey` (paramètre `validationType`).

**Phase 2 (2026-08-11)** — bascule de la maille adresse vers la maille bloc. Migration
`20260811142501_MoveAssignmentToBlocLevel` : remontée des affectations existantes vers
`CampaignBlocs` (arbitrage à la majorité si un bloc avait plusieurs agents), suppression de
`CampaignAssignments.AgentId`, ajout de `CampaignBlocs.PreviousAgentId`. Nouvelles slices
`AssignBloc` / `ReassignBloc` / `TransferAgentBlocs` / `GetCampaignBlocs` / `StartCampaign` /
`ExtendCampaign` ; `PopulateCampaign` devient la regénération idempotente ;
`ReassignAssignment` et `TransferAgentAssignments` sont supprimées (remplacées à la maille
bloc). `GetCampaignProgress` sépare désormais la **charge** (déduite du bloc, suit une
réaffectation) de la **production** (sur `Survey.AgentId`, ne la suit jamais, §8.2).

Vérifié de bout en bout contre PostgreSQL : verrou de démarrage, refus d'un agent sans rôle
`AgentTerrain`, refus du second POST sur un bloc déjà affecté, refus de génération en
`Planned`, idempotence de la génération (`createdAssignments: 0`), trace de réaffectation
(`PreviousAgentId` / `ReassignedByUserId`), transfert en masse, scoping agent en lecture.

**Phase 3 (2026-08-11)** — le temps et la fin de campagne. Aucune migration : les colonnes
nécessaires (`ValidationType`, `IsLate`, `Deadline`, `AllowLateSurveys`, `ClosedAtUtc`) datent
de la phase 1.

- Configuration `Recensement:SyncWindowHours` (72) / `Recensement:TimeZone`
  (`Africa/Djibouti`), lue par Infrastructure et fournie à Application sous forme de POCO —
  pas d'`IOptions` dans Application. `RecensementClock` résout le fuseau une fois.
- `SurveyWriteWindow` porte les **deux horloges** du §4.4 et `SurveyWriteGuard` les rejoue sur
  un relevé déjà créé ; branchés sur `CreateSurvey`, `UpdateSurvey` et `SubmitSurvey`. `IsLate`
  est posé à la réception par le verdict de la fenêtre.
- `CampaignAutoCloser` fait la bascule automatique du §4.1. Faute de tâche de fond, il est
  appelé par les lectures de campagne (`GetCampaigns`, `GetCampaignById`, `GetCampaignProgress`,
  `StartCampaign`) et par les écritures de relevé — suffisant, puisqu'on ne peut ni constater ni
  subir une clôture sans passer par l'un de ces deux chemins.
- `RequestSurveyCorrection` refuse (409) sur une campagne clôturée (§4.3).
- `RejectSurvey` applique le report du §7 et renvoie `deferredToCampaignId`.
- `AddCampaignAddresses` (§1) : ajout manuel de parcelles à recontrôler, avec refus explicite
  des adresses dont le bloc n'est affecté à personne — une tâche que nul ne peut traiter est un
  piège, pas une tâche.
- `GetStalledSurveys` (§1, contrepartie), compteurs `temporaryAwaitingRecheck` et
  `stalledSubmissions` dans `GetCampaignProgress` (§6), filtre `validationType` sur
  `GetSurveys`, volume `pushedAfterCloseByAgent` dans `GetSuspiciousSurveys` (§4.7),
  `lastRejectionReason` sur la feuille de route (§7).

Vérifié contre PostgreSQL : bascule automatique à l'échéance (statut et `ClosedAtUtc` réels),
refus 409 du renvoi en correction sur campagne clôturée, liste des relevés en souffrance avec
son ancienneté, compteurs de pilotage, et le report complet du §7 — rejet sur campagne clôturée
→ insertion dans la campagne active → motif de rejet visible sur la nouvelle tâche.

> Les choix tranchés par défaut pendant ces trois phases sont regroupés dans la section
> **« Décisions à confirmer » (D1 à D8)**, en tête de document — dont le sort de `CloseCampaign`
> (**D2**), qui a perdu son garde « refusée tant qu'une affectation est à traiter ».

**Reste à faire** : le gel des brouillons à la fermeture de la fenêtre (§4.6) n'est pas
matérialisé — les brouillons restent simplement inécrivables une fois la fenêtre passée, ce qui
suffit fonctionnellement mais ne les marque pas pour l'audit. `AddSurveyPhoto` ne passe pas
encore par `SurveyWriteGuard`. Enfin, la génération exclut les relevés `Submitted` (§1) mais
rien n'empêche encore un `Temporary` de vieillir indéfiniment : le compteur existe, l'alerte
non.

---

## Impact sur l'existant (à traiter à l'implémentation)

1. **Migration** : créer `CampaignBlocs` ; ajouter `Code` / `Deadline` /
   `AllowLateSurveys` / `ExtendedBy*` sur `Campaigns` ; ajouter `ValidationType` / `IsLate`
   sur `Surveys` ; ajouter UNIQUE (`CampaignId`, `AdresseId`) sur `CampaignAssignments` ;
   **supprimer `CampaignAssignments.AgentId` en dernier**, une fois les affectations
   existantes remontées au bloc (`INSERT INTO CampaignBlocs SELECT DISTINCT ...`).
   ⚠️ Vérifier avant : si une campagne existante a plusieurs agents sur un même bloc, la
   remontée est ambiguë et demande un arbitrage manuel.
2. **Slices touchées** : `PopulateCampaign` (nouvelle requête + idempotence),
   `ReassignAssignment` (devient réaffectation de bloc), `TransferAgentAssignments`
   (devient transfert de blocs), `GetAssignments` (jointure pour le filtre agent),
   `ValidateSurvey` (paramètre `ValidationType`), `RejectSurvey` (report §7),
   `RequestSurveyCorrection` (refus si campagne clôturée), `CreateSurvey` / `UpdateSurvey` /
   `SubmitSurvey` (les deux tests du §4.4 **et** celui du §8.3), `CloseCampaign` (bascule
   automatique), `GetCampaignProgress` (compteur de provisoires + relevés en souffrance),
   `GetSuspiciousSurveys` (volume poussé après clôture).
3. **Nouvelles slices** : `AssignBloc`, `ReassignBloc`, `GetCampaignBlocs`,
   `StartCampaign` (verrou de sérialisation + les 4 contrôles du §5.4), `ExtendCampaign`.
   Attention au §8.1 : le filtre d'écriture et le filtre de lecture ne portent pas sur la
   même table, ne pas factoriser les deux dans un helper commun.
4. **Configuration** : `Recensement:SyncWindowHours` (défaut 72),
   `Recensement:TimeZone` (défaut `Africa/Djibouti`).
5. **À mettre à jour une fois implémenté** : `schema-recensement.md` (qui décrit encore la
   maille adresse) et la section « Notes sur l'état actuel » de `CLAUDE.md`.
