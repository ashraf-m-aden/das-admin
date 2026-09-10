import { UUID } from '../../models/das.models';

/**
 * Une clé d'accès au référentiel PUBLIC — carte, tuiles et recherche — délivrée à un consommateur
 * externe.
 *
 * ⚠️ **`secret` n'est renseigné qu'à la création.** Le back ne stocke que le préfixe et une
 * empreinte SHA-256 : la clé en clair n'existe qu'une fois, dans la réponse de `POST`. Elle ne
 * peut pas être relue — une clé perdue se révoque et se remplace.
 */
export interface CleApi {
  id: UUID;
  /** À qui la clé est délivrée. */
  consommateur: string;
  /** Les premiers caractères, en clair : ils identifient la clé sans la révéler. */
  prefixe: string;
  createdAtUtc: string;
  revokedAtUtc: string | null;
  /** Écrit au plus une fois par heure côté back — pas à chaque tuile demandée. */
  lastUsedAtUtc: string | null;
  estActive: boolean;
  /**
   * Les villes que la clé peut consulter.
   *
   * ⚠️ **Liste vide = tout le pays**, et c'est le cas courant. Ne pas lire un tableau vide comme
   * « aucun accès » : la restriction est l'exception, réservée à un partenaire dont l'accord ne
   * porte que sur une partie du territoire.
   */
  villes: VilleAutorisee[];
  /** Uniquement dans la réponse de création. `null` ou absent partout ailleurs. */
  secret?: string | null;
}

/** Une ville ouverte à une clé. Le nom vient du back, pour l'affichage. */
export interface VilleAutorisee {
  id: UUID;
  nom: string;
}

export interface CreerCleApiPayload {
  consommateur: string;
  /**
   * Les villes ouvertes à la clé. Omis ou vide = tout le pays.
   *
   * ⚠️ **Fixé à la délivrance et jamais modifiable.** Élargir la portée d'une clé déjà en
   * circulation rendrait impossible de dire, après coup, ce qui a été servi à qui. Changer de
   * portée = révoquer et redélivrer.
   */
  villesAutorisees?: UUID[];
}
