import { AddressWorkflowStage, CampaignStatus } from '../../models/das.models';

export interface WorkflowStageCount {
  stage: AddressWorkflowStage;
  count: number;
}

/** Composé de `GET /api/campaigns?status=InProgress` + `GET /api/campaigns/{id}/progress` — aucune route dédiée. */
export interface ActiveCampaignSummary {
  code: string;
  name: string;
  deadline: string;
  status: CampaignStatus;
  /** Charge : blocs/tâches affectés, suit une réaffectation. */
  charge: { total: number; done: number };
  /** Production : relevés réellement capturés, ne suit jamais une réaffectation — les deux ne s'additionnent pas. */
  production: { total: number; draft: number; submitted: number; validated: number; rejected: number };
}

/**
 * Dashboard v1 (docs/plans/contrat-api-dashboard-notifications.md §1.5) — composé de
 * `GET /api/adresses/summary` (dont `workflowBreakdown`, livré le 2026-08-19) et des routes
 * campagnes déjà livrées. Aucune route `/dashboard/summary` : elle n'existe pas côté back et
 * ne le sera pas, les 4 autres blocs du dashboard imaginé initialement (hiérarchie, tendance,
 * activité récente, points carte individuels) sont hors périmètre v1.
 */
export interface DashboardSummary {
  totalRecords: number;
  pendingReview: number;
  duplicatesFlagged: number;
  publishedToday: number;
  workflowBreakdown: WorkflowStageCount[];
  /** `null` entre deux campagnes — état normal, pas une erreur. */
  activeCampaign: ActiveCampaignSummary | null;
}
