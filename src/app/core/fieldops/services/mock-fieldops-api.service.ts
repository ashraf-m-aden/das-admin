import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { FieldOpsApiPort } from './fieldops-api.port';
import { Assignment, Campaign, CampaignBloc, CampaignProgress, CampaignStatus, UUID } from '../../models/das.models';
import {
  AddCampaignAddressesResult,
  AssignmentQuery,
  CreateCampaignPayload,
  PopulateCampaignResult,
  StartCampaignResult,
  TransferBlocsResult,
} from '../models/fieldops.models';

const AGENTS: Record<UUID, string> = {
  'mock-surveyor-0001': 'Idriss Agent',
  'mock-surveyor-0002': 'Warsama Robleh',
};

const BLOCS: Record<UUID, { code: string; name: string | null }> = {
  'bloc-0001': { code: 'BOULAOS-Q7-A', name: null },
  'bloc-0002': { code: 'BOULAOS-Q7-B', name: null },
  'bloc-0003': { code: 'BOULAOS-Q7-C', name: null },
};

/** WKT de démo (petits carrés autour de Djibouti-ville) — juste pour exercer le cadrage carte en mock. */
const BLOC_BOUNDARIES_WKT: Record<UUID, string> = {
  'bloc-0001': 'POLYGON((43.140 11.590, 43.145 11.590, 43.145 11.595, 43.140 11.595, 43.140 11.590))',
  'bloc-0002': 'POLYGON((43.150 11.575, 43.155 11.575, 43.155 11.580, 43.150 11.580, 43.150 11.575))',
  'bloc-0003': 'POLYGON((43.130 11.600, 43.135 11.600, 43.135 11.605, 43.130 11.605, 43.130 11.600))',
};

/**
 * blocId démo -> parcelles qu'il contient.
 * Les adresses sont choisies pour que leur `workflowStage` (mock adresse : STAGES[i % 5])
 * reste cohérent avec le statut de l'affectation portée dessus : `Done` sur une adresse
 * `verified`, `ToDo`/`Abandoned` sur des adresses `registered`.
 */
const BLOC_ADRESSES: Record<UUID, UUID[]> = {
  'bloc-0001': ['addr-12347', 'addr-12350', 'addr-12355'],
  'bloc-0002': ['addr-12360', 'addr-12365'],
  'bloc-0003': ['addr-12370', 'addr-12375', 'addr-12380'],
};

/**
 * Forme d'erreur métier du mock : `{ code, message }` nu, sans enveloppe `.error`.
 *
 * Les codes reproduisent ceux des handlers `dasApi` (`CreateCampaignHandler`,
 * `StartCampaignHandler`, `AssignBlocHandler`…). Ils étaient auparavant génériques
 * (`not_found` / `conflict`) : aucun ne correspondait à un code réel, donc aucun message
 * d'erreur de cet écran n'était vérifiable sans back.
 */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

@Injectable({ providedIn: 'root' })
export class MockFieldOpsApiService extends FieldOpsApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private campaigns: Campaign[] = [
    {
      id: 'campaign-0001', code: '2608-1', name: 'Recensement Boulaos Q7 — Août 2026', status: 'InProgress',
      deadline: '2026-09-30', allowLateSurveys: false,
      createdAtUtc: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      openedAtUtc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      closedAtUtc: null,
    },
    {
      id: 'campaign-0002', code: '2608-2', name: 'Recensement Balbala — préparation', status: 'Planned',
      deadline: '2026-10-15', allowLateSurveys: false,
      createdAtUtc: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      openedAtUtc: null,
      closedAtUtc: null,
    },
  ];

  private campaignBlocs: CampaignBloc[] = [
    {
      id: 'cb-0001', campaignId: 'campaign-0001', blocId: 'bloc-0001', blocCode: BLOCS['bloc-0001'].code, blocName: BLOCS['bloc-0001'].name,
      agentId: 'mock-surveyor-0001', agentFullName: AGENTS['mock-surveyor-0001'],
      assignedAtUtc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), reassignedAtUtc: null,
    },
    {
      id: 'cb-0002', campaignId: 'campaign-0001', blocId: 'bloc-0002', blocCode: BLOCS['bloc-0002'].code, blocName: BLOCS['bloc-0002'].name,
      agentId: 'mock-surveyor-0002', agentFullName: AGENTS['mock-surveyor-0002'],
      assignedAtUtc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), reassignedAtUtc: null,
    },
  ];

  private assignments: Assignment[] = [
    { id: 'assign-0001', campaignId: 'campaign-0001', adresseId: 'addr-12347', agentId: 'mock-surveyor-0001', agentFullName: AGENTS['mock-surveyor-0001'], status: 'Done', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: null },
    { id: 'assign-0002', campaignId: 'campaign-0001', adresseId: 'addr-12350', agentId: 'mock-surveyor-0001', agentFullName: AGENTS['mock-surveyor-0001'], status: 'ToDo', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: null },
    // Relevé rejeté : l'adresse retombe sur `registered` (cf. §5 CLAUDE.md), pas `surveyed`.
    { id: 'assign-0003', campaignId: 'campaign-0001', adresseId: 'addr-12355', agentId: 'mock-surveyor-0001', agentFullName: AGENTS['mock-surveyor-0001'], status: 'ToDo', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: 'Photo de façade illisible' },
    { id: 'assign-0004', campaignId: 'campaign-0001', adresseId: 'addr-12360', agentId: 'mock-surveyor-0002', agentFullName: AGENTS['mock-surveyor-0002'], status: 'ToDo', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: null },
    { id: 'assign-0005', campaignId: 'campaign-0001', adresseId: 'addr-12365', agentId: 'mock-surveyor-0002', agentFullName: AGENTS['mock-surveyor-0002'], status: 'Abandoned', abandonReason: 'Parcelle démolie, inaccessible', abandonedAtUtc: new Date().toISOString(), lastRejectionReason: null },
  ];

  private nextCampaignSeq = 3;
  private nextCampaignBlocSeq = 3;
  private nextAssignmentSeq = 6;

  // ---- Campagnes -----------------------------------------------------------

  override listCampaigns(status: CampaignStatus | null): Observable<Campaign[]> {
    const items = status ? this.campaigns.filter((c) => c.status === status) : this.campaigns;
    return of(items).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override getCampaign(id: UUID): Observable<Campaign> {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    return of(c).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override createCampaign(payload: CreateCampaignPayload): Observable<Campaign> {
    if (this.campaigns.some((c) => c.status === 'Planned')) {
      return fail('Campaigns.PlannedAlreadyExists', 'Une campagne est déjà en préparation.');
    }
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const campaign: Campaign = {
      id: `campaign-${String(this.nextCampaignSeq++).padStart(4, '0')}`,
      code: `${yymm}-${this.nextCampaignSeq - 2}`,
      name: payload.name, status: 'Planned', deadline: payload.deadline, allowLateSurveys: false,
      createdAtUtc: now.toISOString(), openedAtUtc: null, closedAtUtc: null,
    };
    this.campaigns = [...this.campaigns, campaign];
    return of(campaign).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override updateCampaign(id: UUID, payload: CreateCampaignPayload): Observable<Campaign> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    if (campaign.status === 'Closed') return fail('Campaigns.Closed', 'Campagne clôturée.');
    const updated: Campaign = { ...campaign, name: payload.name, deadline: payload.deadline };
    this.campaigns = this.campaigns.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override getCampaignProgress(id: UUID): Observable<CampaignProgress> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    const items = this.assignments.filter((a) => a.campaignId === id);
    const blocs = this.campaignBlocs.filter((cb) => cb.campaignId === id);

    const byAgentMap = new Map<UUID, { heldBlocs: number; total: number; toDo: number; done: number; abandoned: number }>();
    for (const cb of blocs) {
      const entry = byAgentMap.get(cb.agentId) ?? { heldBlocs: 0, total: 0, toDo: 0, done: 0, abandoned: 0 };
      entry.heldBlocs++;
      byAgentMap.set(cb.agentId, entry);
    }
    for (const a of items) {
      if (!a.agentId) continue;
      const entry = byAgentMap.get(a.agentId) ?? { heldBlocs: 0, total: 0, toDo: 0, done: 0, abandoned: 0 };
      entry.total++;
      if (a.status === 'ToDo') entry.toDo++;
      if (a.status === 'Done') entry.done++;
      if (a.status === 'Abandoned') entry.abandoned++;
      byAgentMap.set(a.agentId, entry);
    }

    const progress: CampaignProgress = {
      campaignId: campaign.id, campaignCode: campaign.code, campaignName: campaign.name, status: campaign.status,
      assignedBlocs: blocs.length,
      totalAssignments: items.length,
      toDo: items.filter((a) => a.status === 'ToDo').length,
      done: items.filter((a) => a.status === 'Done').length,
      abandoned: items.filter((a) => a.status === 'Abandoned').length,
      surveysDraft: 0, surveysSubmitted: 0,
      surveysValidated: items.filter((a) => a.status === 'Done').length,
      surveysRejected: 0,
      temporaryAwaitingRecheck: 0, stalledSubmissions: 0,
      canBeClosed: true,
      byAgent: [...byAgentMap.entries()].map(([agentId, v]) => ({
        agentId, agentFullName: AGENTS[agentId] ?? agentId,
        heldBlocs: v.heldBlocs, total: v.total, toDo: v.toDo, done: v.done, abandoned: v.abandoned,
        surveysCaptured: v.done, surveysValidated: v.done,
      })),
    };
    return of(progress).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  /** Crée les affectations manquantes pour tous les blocs actuellement affectés — partagé par start et populate. */
  private generateMissingAssignments(campaignId: UUID): number {
    const blocs = this.campaignBlocs.filter((cb) => cb.campaignId === campaignId);
    let created = 0;
    const newOnes: Assignment[] = [];
    for (const cb of blocs) {
      for (const adresseId of BLOC_ADRESSES[cb.blocId] ?? []) {
        const exists = this.assignments.some((a) => a.campaignId === campaignId && a.adresseId === adresseId);
        if (exists) continue;
        newOnes.push({
          id: `assign-${String(this.nextAssignmentSeq++).padStart(4, '0')}`,
          campaignId, adresseId, agentId: cb.agentId, agentFullName: cb.agentFullName,
          status: 'ToDo', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: null,
        });
        created++;
      }
    }
    this.assignments = [...this.assignments, ...newOnes];
    return created;
  }

  override startCampaign(id: UUID): Observable<StartCampaignResult> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    if (campaign.status !== 'Planned') return fail('Campaigns.NotPlanned', 'Seule une campagne en préparation peut être démarrée.');
    if (!this.campaignBlocs.some((cb) => cb.campaignId === id)) {
      return fail('Campaigns.NoBlocAssigned', 'Affectez au moins un bloc avant de démarrer.');
    }

    const updated: Campaign = { ...campaign, status: 'InProgress', openedAtUtc: new Date().toISOString() };
    this.campaigns = this.campaigns.map((c) => (c.id === id ? updated : c));
    const generatedAssignments = this.generateMissingAssignments(id);
    return of({ campaign: updated, generatedAssignments }).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override populateCampaign(id: UUID): Observable<PopulateCampaignResult> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    if (campaign.status === 'Planned') return fail('Campaigns.NotInProgress', 'La feuille de route se génère au démarrage.');

    const createdAssignments = this.generateMissingAssignments(id);
    const totalAssignments = this.assignments.filter((a) => a.campaignId === id).length;
    return of({ campaignId: id, createdAssignments, totalAssignments }).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override addCampaignAddresses(id: UUID, adresseIds: UUID[]): Observable<AddCampaignAddressesResult> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');

    const blocByAdresse = new Map<UUID, UUID>();
    for (const [blocId, adresses] of Object.entries(BLOC_ADRESSES)) for (const a of adresses) blocByAdresse.set(a, blocId);
    const assignedBlocIds = new Set(this.campaignBlocs.filter((cb) => cb.campaignId === id).map((cb) => cb.blocId));

    const result: AddCampaignAddressesResult = { campaignId: id, added: 0, alreadyPresent: [], notFound: [], rejectedUnassignedBloc: [] };
    const newOnes: Assignment[] = [];
    for (const adresseId of adresseIds) {
      const blocId = blocByAdresse.get(adresseId);
      if (!blocId) { result.notFound.push(adresseId); continue; }
      if (this.assignments.some((a) => a.campaignId === id && a.adresseId === adresseId)) { result.alreadyPresent.push(adresseId); continue; }
      if (!assignedBlocIds.has(blocId)) { result.rejectedUnassignedBloc.push(adresseId); continue; }
      const cb = this.campaignBlocs.find((c) => c.campaignId === id && c.blocId === blocId)!;
      newOnes.push({
        id: `assign-${String(this.nextAssignmentSeq++).padStart(4, '0')}`,
        campaignId: id, adresseId, agentId: cb.agentId, agentFullName: cb.agentFullName,
        status: 'ToDo', abandonReason: null, abandonedAtUtc: null, lastRejectionReason: null,
      });
      result.added++;
    }
    this.assignments = [...this.assignments, ...newOnes];
    return of(result).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override extendCampaign(id: UUID): Observable<Campaign> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    if (campaign.status === 'Planned') return fail('Campaigns.NotStarted', "Cette campagne n'a pas démarré.");
    const updated: Campaign = campaign.status === 'Closed' ? { ...campaign, status: 'InProgress', closedAtUtc: null } : campaign;
    this.campaigns = this.campaigns.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override closeCampaign(id: UUID): Observable<Campaign> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return fail('Campaigns.NotFound', 'Campagne introuvable.');
    if (campaign.status === 'Closed') return fail('Campaigns.AlreadyClosed', 'Cette campagne est déjà clôturée.');
    if (campaign.status === 'Planned') return fail('Campaigns.NotStarted', "Cette campagne n'a pas démarré.");
    const updated: Campaign = { ...campaign, status: 'Closed', closedAtUtc: new Date().toISOString() };
    this.campaigns = this.campaigns.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  // ---- Blocs de campagne -----------------------------------------------------

  override listCampaignBlocs(campaignId: UUID, agentId: UUID | null): Observable<CampaignBloc[]> {
    const items = this.campaignBlocs.filter((cb) => cb.campaignId === campaignId && (!agentId || cb.agentId === agentId));
    return of(items).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override assignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc> {
    if (this.campaignBlocs.some((cb) => cb.campaignId === campaignId && cb.blocId === blocId)) {
      return fail('CampaignBlocs.AlreadyAssigned', 'Ce bloc est déjà affecté sur cette campagne.');
    }
    const meta = BLOCS[blocId] ?? { code: blocId, name: null };
    const created: CampaignBloc = {
      id: `cb-${String(this.nextCampaignBlocSeq++).padStart(4, '0')}`,
      campaignId, blocId, blocCode: meta.code, blocName: meta.name,
      agentId, agentFullName: AGENTS[agentId] ?? agentId,
      assignedAtUtc: new Date().toISOString(), reassignedAtUtc: null,
    };
    this.campaignBlocs = [...this.campaignBlocs, created];
    return of(created).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override reassignBloc(campaignId: UUID, blocId: UUID, agentId: UUID): Observable<CampaignBloc> {
    const existing = this.campaignBlocs.find((cb) => cb.campaignId === campaignId && cb.blocId === blocId);
    if (!existing) return fail('CampaignBlocs.NotFound', "Ce bloc n'est pas affecté sur cette campagne.");
    if (existing.agentId === agentId) return fail('CampaignBlocs.SameAgent', 'Ce bloc est déjà affecté à cet agent.');
    const updated: CampaignBloc = { ...existing, agentId, agentFullName: AGENTS[agentId] ?? agentId, reassignedAtUtc: new Date().toISOString() };
    this.campaignBlocs = this.campaignBlocs.map((cb) => (cb.id === existing.id ? updated : cb));
    // La responsabilité des affectations ToDo bascule immédiatement — les Done/Abandoned restent attribuées à leur auteur.
    this.assignments = this.assignments.map((a) =>
      a.campaignId === campaignId && a.status === 'ToDo' && BLOC_ADRESSES[blocId]?.includes(a.adresseId)
        ? { ...a, agentId, agentFullName: AGENTS[agentId] ?? agentId }
        : a,
    );
    return of(updated).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override transferBlocs(fromAgentId: UUID, toAgentId: UUID, campaignId: UUID | null): Observable<TransferBlocsResult> {
    let transferredCount = 0;
    const closedCampaignIds = new Set(this.campaigns.filter((c) => c.status === 'Closed').map((c) => c.id));
    this.campaignBlocs = this.campaignBlocs.map((cb) => {
      if (cb.agentId !== fromAgentId) return cb;
      if (campaignId && cb.campaignId !== campaignId) return cb;
      if (closedCampaignIds.has(cb.campaignId)) return cb;
      transferredCount++;
      return { ...cb, agentId: toAgentId, agentFullName: AGENTS[toAgentId] ?? toAgentId, reassignedAtUtc: new Date().toISOString() };
    });
    return of({ fromAgentId, toAgentId, transferredCount }).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  // ---- Affectations (feuille de route) ---------------------------------------

  override listAssignments(query: AssignmentQuery): Observable<Assignment[]> {
    const items = this.assignments.filter(
      (a) =>
        (!query.campaignId || a.campaignId === query.campaignId) &&
        (!query.agentId || a.agentId === query.agentId) &&
        (!query.status || a.status === query.status),
    );
    return of(items).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override abandonAssignment(id: UUID, abandonReason: string): Observable<Assignment> {
    const existing = this.assignments.find((a) => a.id === id);
    if (!existing) return fail('Assignments.NotFound', 'Affectation introuvable.');
    if (existing.status !== 'ToDo') return fail('Assignments.NotPending', 'Seule une affectation à faire peut être abandonnée.');
    const updated: Assignment = { ...existing, status: 'Abandoned', abandonReason, abandonedAtUtc: new Date().toISOString() };
    this.assignments = this.assignments.map((a) => (a.id === id ? updated : a));
    return of(updated).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }

  override getBlocBoundaries(blocIds: UUID[]): Observable<Record<UUID, string>> {
    const result: Record<UUID, string> = {};
    for (const id of blocIds) if (BLOC_BOUNDARIES_WKT[id]) result[id] = BLOC_BOUNDARIES_WKT[id];
    return of(result).pipe(delay(MockFieldOpsApiService.SIMULATED_LATENCY_MS));
  }
}
