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
 * Livraison SIG du 2026-08-27 — matière PREMIÈRE, pas du référentiel.
 *
 * Ces 2 224 îlots couvrent Hayableh, PK12, Cité Hodan et Balbala, c'est-à-dire des zones où
 * `Quartiers` n'a aucune entrée et `Blocs` aucun bloc : le référentiel s'arrête au Quartier 7.
 * Les afficher sert à voir CE QUI RESTE À REPRENDRE, pas de la donnée validée — d'où le contour
 * seul, sans aplat, qui les distingue des blocs du référentiel.
 *
 * Masqués par défaut : ils débordent très largement du périmètre de travail actuel.
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
 */
export const SIG_VOIRIE_BASEMAP_GROUP: BasemapLayerGroup = {
  id: 'sig-voirie',
  labelKey: 'map.basemap.sigVoirie',
  styleLayerIds: ['sig-voirie-bitumee', 'sig-voirie-non-bitumee', 'sig-voirie-extension'],
  visible: false,
};
