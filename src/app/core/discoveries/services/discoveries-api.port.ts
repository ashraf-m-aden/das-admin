import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { DiscoveryFeatureCollection, DiscoveryQuery, DiscoveryReport } from '../models/discoveries.models';

/**
 * `/api/discoveries` — quatre des cinq routes exposées.
 *
 * **`POST /api/discoveries` n'est volontairement pas ici.** Créer un signalement demande la
 * permission `discoveries.create`, seedée pour le seul rôle `AgentTerrain`, et l'`agentId` vient
 * du jeton : c'est un geste de l'application terrain, pas de l'administration. Le déclarer dans
 * ce port produirait un bouton qui finirait en 403 pour tous les rôles de cet écran.
 */
export abstract class DiscoveriesApiPort {
  abstract list(query: DiscoveryQuery): Observable<DiscoveryReport[]>;

  /** Retient le signalement pour digitalisation. N'écrit rien dans `/api/adresses`. */
  abstract accept(id: UUID): Observable<DiscoveryReport>;

  /** Motif **obligatoire** côté back : sans lui l'agent refera le même signalement à la campagne suivante. */
  abstract reject(id: UUID, rejectionReason: string): Observable<DiscoveryReport>;

  /**
   * FeatureCollection à remettre à l'expert GIS. Par défaut le back n'exporte que les
   * signalements **retenus** — c'est ce qui referme la boucle : sans cet export, stocker les
   * signalements ne servirait à rien.
   */
  abstract exportGeoJson(query: DiscoveryQuery): Observable<DiscoveryFeatureCollection>;
}
