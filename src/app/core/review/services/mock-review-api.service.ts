import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ReviewApiPort } from './review-api.port';
import { AdresseSurvey, CampaignSurveyItem, CurrentSurveyItem, ReviewPhoto, StalledSurveyItem, SurveyReviewItem, ValidationType } from '../models/review.models';
import { UUID } from '../../models/das.models';

/**
 * Agent dont les relevés sont, dans le mock, réputés être ceux du superviseur connecté. Il rend
 * `Surveys.SelfReview` atteignable sans back : c'est la faille `B1`, la seule règle de la file
 * de validation qu'un opérateur peut réellement déclencher, et elle serait autrement invisible
 * en `useMockApi`. Le vrai back compare l'auteur du relevé au `reviewerUserId` du jeton.
 */
const SELF_AGENT_ID = 'mock-surveyor-0002';

/** Forme d'erreur métier du mock : `{ code, message }` nu, sans enveloppe `.error` (cf. `core/http/error-code.ts`). */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

@Injectable({ providedIn: 'root' })
export class MockReviewApiService extends ReviewApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  /**
   * UN SEUL jeu de relevés, portant leur statut — et non deux listes (« les soumis » d'un côté,
   * « les autres » de l'autre).
   *
   * Deux listes obligeaient les décisions à SUPPRIMER le relevé pour le faire quitter la file :
   * un relevé validé disparaissait de l'écran de campagne au lieu d'y passer en « Validé ». Le
   * mock affirmait donc le contraire de ce que fait le vrai back, et testait un comportement
   * qui n'existe nulle part.
   */
  private surveys: CampaignSurveyItem[] = [
    {
      submissionType: 'property',
      id: 'survey-0001',
      adresseId: 'addr-12346',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: 'etat-occ-bon',
      name: null,
      floorCount: 1,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: true,
      gpsAccuracyM: 4.2,
      distanceFromAddressM: 1.8,
      photoCount: 3,
      isMockLocation: false,
      status: 'Submitted',
      validationType: null,
      rejectionReason: null,
      agentFullName: 'Idriss Agent',
      adresseLibelle: '12, rue de la Mosquée, Quartier 7 Djibouti',
      addressCode: '77-310-2-12',
      quartierNom: 'Quartier 7',
      gpsCaptureWkt: 'POINT(43.1451 11.5952)',
      adresseLocationWkt: 'POINT(43.1450 11.5951)',
    },
    {
      submissionType: 'property',
      id: 'survey-0002',
      adresseId: 'addr-12351',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-immeuble',
      etatOccupationId: 'etat-occ-degrade',
      name: 'Résidence Al Amine',
      floorCount: 4,
      apartmentCount: 12,
      shopCount: 2,
      wheelchairAccessible: false,
      gpsAccuracyM: 18.7,
      distanceFromAddressM: 22.4,
      photoCount: 1,
      isMockLocation: true,
      status: 'Submitted',
      validationType: null,
      rejectionReason: null,
      agentFullName: 'Warsama Robleh',
      adresseLibelle: '4, close 3, Balbala Ancien Djibouti',
      addressCode: null,
      quartierNom: 'Balbala Ancien',
      // Ecart volontairement visible : c'est le releve signale comme trop eloigne.
      gpsCaptureWkt: 'POINT(43.1102 11.5605)',
      adresseLocationWkt: 'POINT(43.1085 11.5598)',
    },
    {
      submissionType: 'property',
      id: 'survey-0003',
      adresseId: 'addr-12356',
      agentId: 'mock-surveyor-0002',
      capturedAtUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      outcome: 'NotSurveyable',
      notSurveyableReason: 'Demolished',
      typeOccupationId: null,
      etatOccupationId: null,
      name: null,
      floorCount: 0,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: false,
      gpsAccuracyM: 6.1,
      distanceFromAddressM: null,
      photoCount: 0,
      isMockLocation: false,
      status: 'Submitted',
      validationType: null,
      rejectionReason: null,
      agentFullName: 'Idriss Agent',
      adresseLibelle: '7, bloc 2, Einguela Djibouti',
      addressCode: '77-202-2-7',
      quartierNom: 'Einguela',
      gpsCaptureWkt: 'POINT(43.1389 11.5871)',
      adresseLocationWkt: 'POINT(43.1388 11.5872)',
    },
  ];

  private photosBySurveyId: Record<UUID, ReviewPhoto[]> = {
    'survey-0001': [
      { id: 'photo-0001', readUrl: 'https://picsum.photos/seed/photo-0001/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0001/120/92', uploadedAtUtc: new Date().toISOString() },
      { id: 'photo-0002', readUrl: 'https://picsum.photos/seed/photo-0002/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0002/120/92', uploadedAtUtc: new Date().toISOString() },
      { id: 'photo-0003', readUrl: 'https://picsum.photos/seed/photo-0003/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0003/120/92', uploadedAtUtc: new Date().toISOString() },
    ],
    'survey-0002': [
      { id: 'photo-0004', readUrl: 'https://picsum.photos/seed/photo-0004/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0004/120/92', uploadedAtUtc: new Date().toISOString() },
    ],
    'survey-0005': [
      { id: 'photo-0005', readUrl: 'https://picsum.photos/seed/photo-0005/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0005/120/92', uploadedAtUtc: new Date().toISOString() },
      { id: 'photo-0006', readUrl: 'https://picsum.photos/seed/photo-0006/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0006/120/92', uploadedAtUtc: new Date().toISOString() },
    ],
    'survey-0006': [
      { id: 'photo-0007', readUrl: 'https://picsum.photos/seed/photo-0007/400/300', thumbnailUrl: 'https://picsum.photos/seed/photo-0007/120/92', uploadedAtUtc: new Date().toISOString() },
    ],
  };

  constructor() {
    super();
    this.surveys = [...this.surveys, ...this.autresReleves]
      .sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc));
  }

  /** La file de décision, c'est `?status=Submitted` — pas « tout ce qui reste ». */
  override listSubmittedSurveys(): Observable<SurveyReviewItem[]> {
    const file = this.surveys.filter((s) => s.status === 'Submitted');
    return of(file).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /** Applique une décision comme le back : le relevé change d'état, il ne disparaît pas. */
  private decide(id: UUID, patch: Partial<CampaignSurveyItem>): void {
    this.surveys = this.surveys.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }

  /**
   * `validationType` est CONSERVÉ sur le relevé : c'est lui que l'écran de campagne lit pour
   * distinguer un « Validé (provisoire) » d'un définitif. Le gel du `addressCode` et la sortie
   * du périmètre, eux, n'ont pas d'équivalent ici — le mock ne porte ni code ni campagne future.
   */
  override validateSurvey(id: UUID, validationType: ValidationType): Observable<void> {
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.decide(id, { status: 'Validated', validationType });
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override rejectSurvey(id: UUID, rejectionReason: string): Observable<void> {
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.decide(id, { status: 'Rejected', rejectionReason });
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /** Renvoi en correction : le relevé retourne en brouillon chez l'agent, comme côté back. */
  override requestSurveyCorrection(id: UUID): Observable<void> {
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.decide(id, { status: 'Draft' });
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /** Mêmes refus que `SurveyReview.EnsureReviewable`, dans le même ordre : introuvable, puis auto-validation. */
  private ensureReviewable(id: UUID): Observable<never> | null {
    const survey = this.surveys.find((s) => s.id === id);
    if (!survey) return fail('Surveys.NotFound', 'Relevé introuvable.');
    if (survey.agentId === SELF_AGENT_ID) {
      return fail('Surveys.SelfReview', 'Vous ne pouvez pas statuer sur votre propre relevé.');
    }
    return null;
  }

  override getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]> {
    return of(this.photosBySurveyId[id] ?? []).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /**
   * Les relevés soumis servent aussi d'historique par adresse : le mock n'a qu'un jeu de
   * relevés, et en fabriquer un second divergerait du premier au premier changement.
   */
  override listSurveysByAdresse(adresseId: UUID): Observable<AdresseSurvey[]> {
    const rows = this.surveys
      .filter((s) => s.adresseId === adresseId)
      .map((s): AdresseSurvey => ({
        id: s.id, adresseId: s.adresseId, agentId: s.agentId,
        status: s.status, outcome: s.outcome,
        notSurveyableReason: s.notSurveyableReason,
        capturedAtUtc: s.capturedAtUtc, photoCount: s.photoCount,
        rejectionReason: s.rejectionReason, photos: [],
      }))
      .sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc));
    return of(rows).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /**
   * Relevés qui ne sont PAS dans la file de décision : un brouillon en cours de saisie, un
   * validé provisoire, un rejeté. Sans eux, la branche mock ne montrerait que des `Submitted` —
   * or c'est justement le brouillon, invisible de tout écran jusqu'ici, qui a motivé la lecture
   * par campagne. Rangés à part pour la lisibilité, fusionnés dans `surveys` au constructeur.
   */
  private readonly autresReleves: CampaignSurveyItem[] = [
    {
      submissionType: 'property',
      id: 'survey-0004',
      adresseId: 'addr-12370',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: null,
      name: null,
      floorCount: 1,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: false,
      gpsAccuracyM: 9.4,
      distanceFromAddressM: 3.1,
      // Un brouillon sans photo : l'agent n'a pas fini, c'est normal et le composant le dit.
      photoCount: 0,
      isMockLocation: false,
      agentFullName: 'Idriss Agent',
      adresseLibelle: '18, rue 6, Quartier 7 Djibouti',
      addressCode: null,
      quartierNom: 'Quartier 7',
      gpsCaptureWkt: 'POINT(43.1462 11.5961)',
      adresseLocationWkt: 'POINT(43.1460 11.5960)',
      status: 'Draft',
      validationType: null,
      rejectionReason: null,
    },
    {
      submissionType: 'property',
      id: 'survey-0005',
      adresseId: 'addr-12371',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-immeuble',
      etatOccupationId: 'etat-occ-bon',
      name: 'Immeuble Doraleh',
      floorCount: 3,
      apartmentCount: 6,
      shopCount: 1,
      wheelchairAccessible: true,
      gpsAccuracyM: 3.8,
      distanceFromAddressM: 2.2,
      photoCount: 2,
      isMockLocation: false,
      agentFullName: 'Warsama Robleh',
      adresseLibelle: '2, close 1, Balbala Ancien Djibouti',
      addressCode: '77-410-1-2',
      quartierNom: 'Balbala Ancien',
      gpsCaptureWkt: 'POINT(43.1091 11.5610)',
      adresseLocationWkt: 'POINT(43.1090 11.5609)',
      status: 'Validated',
      // Provisoire : c'est le cas que la pastille doit distinguer d'un validé définitif.
      validationType: 'Temporary',
      rejectionReason: null,
    },
    {
      submissionType: 'property',
      id: 'survey-0006',
      adresseId: 'addr-12372',
      agentId: 'mock-surveyor-0002',
      capturedAtUtc: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: 'etat-occ-degrade',
      name: null,
      floorCount: 1,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: false,
      gpsAccuracyM: 41.2,
      distanceFromAddressM: 78.5,
      photoCount: 1,
      isMockLocation: false,
      agentFullName: 'Idriss Agent',
      adresseLibelle: '9, bloc 4, Einguela Djibouti',
      addressCode: null,
      quartierNom: 'Einguela',
      gpsCaptureWkt: 'POINT(43.1401 11.5885)',
      adresseLocationWkt: 'POINT(43.1388 11.5872)',
      status: 'Rejected',
      validationType: null,
      rejectionReason: 'Photo de façade illisible et position relevée à plus de 70 m de la parcelle.',
    },
  ];

  /**
   * `campaignId` est ignoré : le mock n'a qu'une campagne active, et fabriquer un second jeu de
   * relevés pour une seconde campagne les ferait diverger du premier au premier changement.
   */
  override listCampaignSurveys(campaignId: UUID): Observable<CampaignSurveyItem[]> {
    return of([...this.surveys]).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  private stalledSurveys: StalledSurveyItem[] = [
    {
      // Designe un releve REELLEMENT dans la file : sinon la branche mock ne peut pas montrer
      // le saut depuis le bandeau, et on ne verrait que le cas d'echec.
      surveyId: 'survey-0002',
      adresseId: 'addr-12361',
      agentId: 'mock-surveyor-0002',
      agentFullName: 'Warsama Robleh',
      campaignId: 'campaign-0001',
      campaignCode: 'C2026-1',
      capturedAtUtc: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      daysWaiting: 12,
    },
  ];

  private currentSurveys: CurrentSurveyItem[] = [
    {
      id: 'survey-0001',
      adresseId: 'addr-12346',
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: 'etat-occ-bon',
      capturedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'survey-0002',
      adresseId: 'addr-12351',
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-immeuble',
      etatOccupationId: 'etat-occ-degrade',
      capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'survey-0003',
      adresseId: 'addr-12356',
      outcome: 'NotSurveyable',
      notSurveyableReason: 'Demolished',
      typeOccupationId: null,
      etatOccupationId: null,
      capturedAtUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
  ];

  override listStalledSurveys(): Observable<StalledSurveyItem[]> {
    return of(this.stalledSurveys).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override listCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): Observable<CurrentSurveyItem[]> {
    const items = surveyedOnly ? this.currentSurveys.filter((s) => s.outcome === 'Surveyed') : this.currentSurveys;
    return of(items).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }
}
