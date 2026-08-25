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
 * Servie par `closes_tiles`, dont l'emprise est CALCULÉE par union des blocs rattachés :
 * `Closes."Boundary"` n'est jamais renseignée en base. Une close sans bloc n'est donc pas
 * dessinable et n'apparaît pas sur la carte, seulement dans la liste de l'écran /closes.
 *
 * Masquée par défaut : tant que la reprise de données n'a rattaché aucun bloc, la couche est
 * vide, et une case cochée sur une couche vide se lit comme une panne.
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
