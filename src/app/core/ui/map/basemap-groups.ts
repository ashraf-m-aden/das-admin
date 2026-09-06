import { BasemapLayerGroup } from './das-map.component';

/**
 * Groupes de couches du STYLE DE BASE (`map-style.json`) proposés au panneau des couches.
 *
 * Déclarés ici une seule fois, et pas dans chaque écran : trois composants recopiaient déjà les
 * mêmes `styleLayerIds` à la main, et une divergence avait commencé. Un id de couche qui change
 * dans le style doit se corriger à UN endroit — sinon la case à cocher devient un bouton qui ne
 * fait rien, ce qui ne lève aucune erreur et ne se voit qu'à l'usage.
 */

/**
 * La voirie du référentiel, servie par la source `streets` (vue `streets_tiles`) depuis le
 * remplacement du fond de carte tiers le 2026-08-25.
 *
 * Les six ids doivent rester synchronisés avec `map-style.json` — `streets-name` compris, sans
 * quoi les libellés de rue resteraient affichés alors qu'on vient de masquer leurs tracés.
 *
 * Visible par défaut : c'est le seul repère de terrain qui reste maintenant que le fond CARTO a
 * disparu. Une carte de parcelles sans voirie n'est plus lisible.
 */
export const STREETS_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'streets',
  labelKey: 'map.basemap.streets',
  styleLayerIds: [
    'streets-track',
    'streets-minor-case', 'streets-minor-fill',
    'streets-major-case', 'streets-major-fill',
    'streets-name',
  ],
  visible: true,
};

/**
 * Les closes — le regroupement d'îlots qui nomme les adresses.
 *
 * Couche RÉPARÉE le 2026-08-27. Elle était inerte pour deux raisons cumulées :
 *   1. la source `closes_tiles` n'existait pas — absente du catalogue Martin alors que
 *      `blocs_tiles`, `streets_tiles` et `adresses_tiles` y étaient. La vue n'avait jamais été
 *      créée en base, et une source Martin qui ne résout pas échoue en SILENCE ;
 *   2. `Closes."Boundary"` n'est jamais renseignée — seuls Create/UpdateCloseHandler l'écrivent,
 *      depuis le `boundaryWkt` du payload, que le front envoie toujours à `null`. Une vue qui se
 *      serait contentée de relire la colonne aurait donc été vide elle aussi.
 *
 * La vue calcule maintenant l'union des blocs rattachés (`dasApi/scripts/creer-vues-tiles.sql`,
 * appliqué). Une close sans bloc reste non dessinable : elle n'apparaît que dans la liste.
 *
 * Le cadrage de l'écran /closes ne dépend de rien de tout cela : il calcule l'union des bbox des
 * blocs côté front (`ClosesComponent.mapFitBbox`).
 *
 * Masquée par défaut : une seule close existe aujourd'hui, et une case cochée sur une couche
 * quasi vide se lit comme une panne.
 */
export const CLOSES_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'closes',
  labelKey: 'map.basemap.closes',
  styleLayerIds: ['closes-fill', 'closes-line', 'closes-label'],
  visible: false,
};

/** Contours des blocs (îlots cadastraux). */
export const BLOCS_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'blocs',
  labelKey: 'nav.blocks',
  styleLayerIds: ['blocs-fill', 'blocs-line'],
  visible: false,
};

/** Contours des parcelles. */
export const ADRESSES_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'adresses',
  labelKey: 'map.basemap.adresses',
  styleLayerIds: ['adresses-fill', 'adresses-line'],
  visible: false,
};

/**
 * Les zones, en aplat de contexte. Servies par la vue `quartiers_tiles` — la zone elle-même
 * n'a pas d'emprise (`Zones."Boundary"` est NULL partout), son dessin est celui de ses
 * quartiers, coloriés par `ZoneCode`.
 *
 * Le coloriage est BAKÉ dans `map-style.json` via un `match` sur `ZoneCode`, jamais en
 * feature-state (CLAUDE.md §4) : c'est une coloration de base, pas un override live.
 *
 * Le `match` porte sur le CODE et non sur le nom : les noms ont été renommés une fois
 * (Boulaos 2 → Boulaos 1…), les codes Z1..Z9 n'ont pas bougé.
 */
export const ZONES_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'zones',
  labelKey: 'map.basemap.zones',
  styleLayerIds: ['zones-fill', 'zones-line', 'zones-label'],
  visible: false,
};

/**
 * Le contour national de Djibouti — le cadre du référentiel, tous écrans confondus.
 *
 * ⚠️ **La donnée n'existe pas encore en base au 2026-09-02.** Aucune table ni vue ne porte la
 * frontière du pays : le référentiel s'arrête aux `Cities` (dont l'emprise est celle de la
 * ville de Djibouti), et la livraison SIG ne couvre que Djibouti-ville et Balbala. La couche
 * est déclarée ici pour que le front soit prêt, mais elle restera MUETTE tant que la source
 * Martin `contour_national` n'est pas publiée — et, comme toute source Martin absente, elle
 * échoue en SILENCE (même piège que `closes_tiles`, cf. CLOSES_BASEMAP_GROUP).
 *
 * Le script d'import et de publication est versionné : `scripts/sig/contour-national.sql`.
 * Il reste à exécuter contre la base — l'import géo ne se fait JAMAIS depuis le front
 * (CLAUDE.md §9).
 *
 * Visible par défaut : c'est un repère de cadre, pas une couche de travail. Le trait est
 * tireté et halo-blanc pour ne jamais se confondre avec une limite de quartier ou de bloc.
 */
export const COUNTRY_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'contour-national',
  labelKey: 'map.basemap.country',
  styleLayerIds: ['contour-national-halo', 'contour-national-line'],
  visible: true,
};

/**
 * Bâtiments remarquables d'OpenStreetMap — hôpitaux, écoles, lieux de culte, administrations,
 * hôtels… 961 relevés le 2026-09-06, servis par la vue `public.poi_tiles`.
 *
 * ⚠️ Cette couche ne rend rien sans les images enregistrées par `poi-icones.ts` : MapLibre
 * cherche un `icon-image` nommé `poi-<categorie>` et, s'il ne le trouve pas, n'affiche RIEN
 * sans lever d'erreur. Les deux fichiers se tiennent — ajouter une catégorie côté SQL sans
 * ajouter son icône la rend invisible.
 *
 * Masquée par défaut : 961 pastilles par-dessus le bâti chargent la carte, et l'écran des
 * adresses sert d'abord à travailler les parcelles. Elle n'apparaît qu'à partir du zoom 12,
 * en dessous les pastilles se recouvrent.
 */
export const POI_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'poi',
  labelKey: 'map.basemap.poi',
  styleLayerIds: ['poi-icone'],
  visible: false,
};

/**
 * Les codes postaux, en contour et étiquette sur l'emprise du quartier.
 *
 * `Postcode` est calculé DANS la vue (`scripts/sig/vue-quartiers-tiles.sql`), pas ici : le
 * front n'a pas le droit de recomposer un code postal (CLAUDE.md §9), et aucune table ne le
 * porte — c'est un dérivé de `City."Code"` et `Quartier."AreaNumber"`.
 *
 * Le contour distingue les quartiers SANS code postal (gris clair) de ceux qui en ont un
 * (ardoise) : sur cet écran comme ailleurs, le vide est une information.
 *
 * 76 quartiers sur 84 sont dessinables, 55 portent un code postal (état du 2026-08-28).
 */
export const POSTCODES_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'postcodes',
  labelKey: 'map.basemap.postcodes',
  styleLayerIds: ['postcodes-line', 'postcodes-label'],
  visible: false,
};

/**
 * Les villes, en contour et étiquette — la seule couche de contexte NATIONAL du panneau.
 *
 * Servie par la vue `cities_tiles` (`scripts/sig/vue-cities-tiles.sql`), qui écarte les villes
 * sans emprise : `Cities."Boundary"` est nullable et l'API crée les villes avec
 * `boundaryWkt: null`.
 *
 * ⚠️ Les emprises sont PROVISOIRES. `Cities` n'avait aucune géométrie jusqu'au 2026-09-04 ;
 * les 6 villes portent depuis le polygone de RÉGION de la livraison SIG, faute d'emprise
 * urbaine (`scripts/sig/nour/95_` et `96_`). Dikhil « fait » 6 633 km², Ali Sabieh 2 040 pour
 * un bourg. Bon pour situer, faux pour mesurer.
 *
 * C'est ce qui dicte le dessin : **contour pointillé, pas d'aplat**. Un fill sur un polygone de
 * région couvrirait tout l'écran dès le zoom 10, sur des écrans qui sont tous cadrés sur
 * Djibouti-ville. L'étiquette s'arrête à `maxzoom: 13` — au-delà, le nom de la ville n'apprend
 * plus rien à quelqu'un qui regarde un bloc.
 *
 * ⚠️ `cities-line` doit rester AU-DESSUS des aplats dans `map-style.json` (juste avant le premier
 * calque `symbol`). Placée après `bg` comme au premier jet, elle passait sous `zones-fill`,
 * `blocs-fill` et `adresses-fill` : le contour était bien chargé, la case cochée, et on ne
 * voyait rien. Une couche de contour peinte sous des aplats ne lève aucune erreur.
 *
 * Le `minzoom: 9` de `streets-major-case` / `streets-major-fill` a été retiré en même temps
 * (2026-09-04) : on dézoome précisément pour voir une emprise de ville, et les grandes artères
 * disparaissaient à ce moment-là. Elles suivent désormais la même plage que ce groupe. Sous le
 * zoom 9 le remplissage blanc est annulé et le casing s'assombrit — blanc sur `#f8f9fa` ne se
 * lit pas.
 *
 * Le contour distingue les villes SANS `Code` (gris clair) de celles qui en ont un (sarcelle) :
 * 4 des 6 villes n'ont pas encore de code postal, et le vide est une information — même parti
 * pris que `postcodes-line`.
 *
 * Masquée par défaut : sur une carte cadrée sur un quartier, un contour de région est du bruit.
 */
export const CITIES_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'cities',
  labelKey: 'map.basemap.cities',
  styleLayerIds: ['cities-line', 'cities-label'],
  visible: false,
};

/* -------------------------------------------------------------------------------------------
 * RETIRÉS DES ÉCRANS le 2026-08-28 — les deux groupes qui suivent ne sont plus proposés dans
 * aucun panneau de couches (tableau de bord, carte des blocs, liste des adresses).
 *
 * Ils restent définis pour deux raisons : leurs couches et leurs sources Martin existent
 * toujours dans `map-style.json` (en `visibility: none`, donc invisibles tant que personne ne
 * les rallume), et le constat ci-dessous a coûté assez cher à établir pour ne pas être effacé.
 * Les remettre = les rajouter au tableau `basemapLayers` de l'écran voulu, rien d'autre.
 *
 * Les clés i18n `map.basemap.sigIlots` / `sigVoirie` sont conservées pour la même raison.
 * ---------------------------------------------------------------------------------------- */

/**
 * Livraison SIG du 2026-08-27 — la matière PREMIÈRE d'où viennent les blocs de Balbala.
 *
 * ⚠️ Cette couche s'appelait « Îlots SIG (à reprendre) », et son commentaire affirmait qu'elle
 * couvrait des zones où `Quartiers` n'avait aucune entrée et `Blocs` aucun bloc. **C'est faux
 * depuis l'import.** Vérifié le 2026-08-27 : les 2 224 îlots sont déjà dans `Blocs`, au bloc
 * près par quartier (Hayableh 1068 = 1068, PK12 540 = 540, Cité Hodan 153 = 153…), et les
 * `Blocs` portent même le `code_ilot` du SIG comme `Code`. Seuls 37 ne sont recouverts par
 * aucun bloc, et ce sont des échardes de géométrie — 6,6 m² au maximum, 0,3 m² en moyenne,
 * contre 1 505 m² de moyenne. Rien de réel ne manque : c'est ce doublon intégral avec la
 * couche `blocs` qui a fait retirer celle-ci du panneau.
 *
 * Requête de contrôle : `scripts/sig/ilots-non-repris.sql`.
 */
export const SIG_ILOTS_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'sig-ilots',
  labelKey: 'map.basemap.sigIlots',
  styleLayerIds: ['sig-ilots-line'],
  visible: false,
};

/**
 * Voirie tertiaire et extensions de la même livraison : 1 401 tronçons, dont 267 nommés.
 *
 * Distincte de STREETS_BASEMAP_GROUP, qui montre la voirie DU RÉFÉRENTIEL (`Streets`). Les deux
 * ne se recouvrent pas : la livraison n'a aucun tronçon en commun avec route_principaux ni
 * voierie_secondaire (vérifié par ST_Equals croisé le 2026-08-27).
 *
 * Contrairement aux îlots, celle-ci reste À REPRENDRE. Fusion partielle appliquée le
 * 2026-08-27 (`scripts/sig/fusion-voirie-streets.sql`) : 32 rues créées, `Streets` passe de
 * 160 à 192. Il reste **942 tronçons sur 1 401**, soit 202 km — dont **890 sans nom**.
 *
 * Le reste ne se fusionne pas mécaniquement, pour trois raisons distinctes :
 *   - 890 tronçons n'ont PAS DE NOM. Une rue sans nom n'a pas d'identité dans `Streets` ;
 *     les créer produirait 890 lignes indistinguables. Il faut un relevé terrain.
 *   - 24 noms nouveaux donnent une MultiLineString (tronçons disjoints) que
 *     `Streets."Boundary"`, typé geometry(LineString,4326), ne peut pas stocker. Les insérer
 *     un tronçon par ligne recréerait le faux différent qu'on cherche à éviter, et changer le
 *     type de la colonne serait une migration du schéma back — hors périmètre de ce dépôt.
 *   - 67 noms SIG désignent une rue DÉJÀ dans `Streets` : rien à créer, seulement une
 *     géométrie plus fine qu'on ne peut pas fusionner tant que la colonne est mono-ligne.
 *
 * ⚠️ `Streets` porte 17 doublons ANTÉRIEURS à tout ça (143 noms pour 160 lignes avant fusion) :
 * `AV ADM BERNARD`, `BLD BONHOURE`… en double. Les dédoublonner suppose de fusionner leurs
 * géométries et de repointer `Closes."StreetId"` et `StreetSuggestions."StreetId"` — destructif,
 * non traité ici.
 *
 * Liste de travail : `scripts/sig/voirie-non-reprise.sql`.
 */
export const SIG_VOIRIE_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'sig-voirie',
  labelKey: 'map.basemap.sigVoirie',
  styleLayerIds: ['sig-voirie-bitumee', 'sig-voirie-non-bitumee', 'sig-voirie-extension'],
  visible: false,
};
