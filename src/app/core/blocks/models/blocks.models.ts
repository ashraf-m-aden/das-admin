import { HierarchySelection } from '../../hierarchy/models/hierarchy.models';

/**
 * Filtre de listing. Seul `quartierId` part réellement vers l'API
 * (`GET /api/blocs?quartierId=`) — les niveaux au-dessus ne servent qu'à faire
 * descendre la cascade jusqu'au quartier ; sans quartier choisi, la liste est
 * globale (309 blocs à ce jour, aucune pagination côté back).
 */
export type BlockListQuery = HierarchySelection;
