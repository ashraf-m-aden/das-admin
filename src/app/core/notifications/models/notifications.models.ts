import { UUID, ISODateTime } from '../../models/das.models';

/**
 * Notifications 100% générées côté serveur, déclenchées par des événements
 * de travail — jamais composées manuellement par un utilisateur (pas de
 * messagerie interne, décision actée). Le frontend ne fait qu'afficher et
 * marquer comme lu.
 */
export type NotificationType =
  | 'task_completed'
  | 'block_submitted'
  | 'property_approved'
  | 'property_needs_redo'
  | 'redo_resolved';

export type NotificationRelatedEntityType = 'task' | 'block' | 'property' | 'redo_request';

export interface Notification {
  id: UUID;
  type: NotificationType;
  /** Clé de traduction (ex: 'notifications.task_completed') — le libellé final est composé avec messageParams */
  messageKey: string;
  messageParams: Record<string, string | number>;
  relatedEntityType: NotificationRelatedEntityType;
  relatedEntityId: UUID;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}
