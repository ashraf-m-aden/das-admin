import { AddressWorkflowStage, AgentProgress, CampaignStatus } from '../../models/das.models';

export interface WorkflowStageCount {
  stage: AddressWorkflowStage;
  count: number;
}

/**
 * Un verrou d'adressage : une condition sans laquelle un code d'adresse ne peut pas exister.
 * `remaining` est ce qui reste à traiter, `total` l'assiette — le rapport dit l'avancement, le
 * reste dit le travail.
 */
export interface CoverageBlocker {
  /** Identifie le verrou ET sa clé i18n (`dashboard.blocker.<key>`). */
  key: 'adressesWithoutClose' | 'blocsWithoutClose' | 'streetsUnnamed' | 'quartiersWithoutArea' | 'citiesWithoutCode';
  remaining: number;
  total: number;
  /** Route vers l'écran qui lève ce verrou — un chiffre qui n'ouvre sur rien ne sert à personne. */
  route: string;
}

/**
 * Couverture d'adressage : la part d'adresses réellement codifiables.
 *
 * C'est le seul indicateur qui bouge dans la phase actuelle du programme. Un `addressCode`
 * (`Ville-Quartier-Bloc-Numéro`) exige une close — donc une rue —, un `AreaNumber` de quartier et
 * un code de ville. Tant que ces verrous tiennent, aucune adresse n'est diffusable, quel que soit
 * le nombre de parcelles en base.
 */
export interface AddressingCoverage {
  totalAdresses: number;
  /** Adresses rattachées à une close, donc pourvues d'une voie. */
  adressesWithClose: number;
  /**
   * Pas de compteur d'adresses au code FIGÉ, faute de contrat : `AdresseFilters` n'offre aucun
   * filtre sur `addressCode`, et `/summary` ne l'expose pas. Il faudrait un champ côté back — le
   * déduire de `workflowBreakdown` serait faux, `verified` ne veut pas dire « code figé ».
   */
  blockers: CoverageBlocker[];
}

/**
 * Ce qui pourrit en silence. Aucun de ces compteurs n'apparaît ailleurs dans l'application, et
 * c'est précisément le problème : une validation provisoire jamais revue reste provisoire
 * indéfiniment, un relevé soumis après clôture n'est jamais tranché.
 */
export interface VerificationDebt {
  /** Validations provisoires qu'aucun relevé définitif n'a remplacées. */
  temporaryAwaitingRecheck: number;
  /** Relevés soumis restés sans décision alors que la campagne est clôturée. */
  stalledSubmissions: number;
  /** Ancienneté du plus vieux relevé en souffrance, en jours. `null` s'il n'y en a aucun. */
  oldestStalledDays: number | null;
}

/** Composé de `GET /api/campaigns?status=InProgress` + `GET /api/campaigns/{id}/progress`. */
export interface ActiveCampaignSummary {
  id: string;
  code: string;
  name: string;
  deadline: string;
  status: CampaignStatus;
  /** Blocs tenus par la campagne — la maille d'affectation. */
  assignedBlocs: number;
  /** Charge : parcelles affectées. Suit une réaffectation, c'est le sens de « ce qu'il reste à faire ». */
  charge: { total: number; done: number; toDo: number; abandoned: number };
  /**
   * Production : relevés réellement capturés. Ne suit JAMAIS une réaffectation.
   * Les deux blocs ne s'additionnent pas et ne doivent jamais être présentés comme un total.
   */
  production: { total: number; draft: number; submitted: number; validated: number; rejected: number };
  /** Refusée tant qu'une affectation est `ToDo` ou qu'un relevé est `Draft`/`Submitted`. */
  canBeClosed: boolean;
  byAgent: AgentProgress[];
}

/**
 * Dashboard v2 (2026-08-27). La v1 mesurait un DÉBIT — publiées du jour, en attente de revue,
 * rejets — dans un système qui n'a pas commencé à produire : quatre de ses six valeurs étaient
 * structurellement à zéro et le resteraient des mois. Elle est remplacée par les indicateurs qui
 * bougent : la couverture d'adressage et la dette de vérification.
 *
 * `publishedToday` est retiré (0 jusqu'à la fin du programme). `duplicatesFlagged` est conservé
 * mais renommé à l'affichage : il compte des relevés REJETÉS, pas des doublons.
 *
 * Aucune série temporelle : aucune route n'en expose, et `history` est toujours vide côté back.
 * Tout graphique d'évolution demanderait un endpoint supplémentaire.
 */
export interface DashboardSummary {
  totalRecords: number;
  pendingReview: number;
  /** Relevés rejetés, à refaire. Le nom vient du back ; ce ne sont PAS des doublons. */
  duplicatesFlagged: number;
  workflowBreakdown: WorkflowStageCount[];
  coverage: AddressingCoverage;
  verificationDebt: VerificationDebt;
  /** `null` entre deux campagnes — état normal, pas une erreur. */
  activeCampaign: ActiveCampaignSummary | null;
}
