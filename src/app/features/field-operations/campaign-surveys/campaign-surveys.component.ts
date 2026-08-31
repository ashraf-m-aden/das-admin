import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { DataQualityFacade } from '../../../core/dataquality/store/dataquality.facade';
import { SurveyFactsComponent } from '../../../core/review/ui/survey-facts/survey-facts.component';
import { SurveyDecisionComponent } from '../../../core/review/ui/survey-decision/survey-decision.component';
import { CampaignSurveyItem, SurveyStatus, ValidationType } from '../../../core/review/models/review.models';
import { OccupationCatalogItem } from '../../../core/reference/models/reference.models';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { DasPagerComponent } from '../../../core/ui/pager/das-pager.component';
import { CampaignProgress, UUID } from '../../../core/models/das.models';

/** Compteurs d'onglets, tels que calculés par le store sur la liste réellement rapatriée. */
interface SurveyCounts {
  all: number;
  Draft: number;
  Submitted: number;
  Validated: number;
  Rejected: number;
}

/**
 * Ce que les agents ont relevé sur une campagne — la contrepartie des compteurs de l'avancement.
 *
 * Le panneau « Avancement » annonçait « 2 brouillons, 5 soumis » sans qu'aucun écran ne
 * permette d'ouvrir ces relevés : la file de validation ne montre que les `Submitted`, et le
 * tiroir d'une adresse suppose qu'on sache déjà LAQUELLE regarder. Un brouillon n'était donc
 * visible nulle part. Ici on part de la campagne, on filtre par statut, et on déplie les faits.
 *
 * **Un seul appel, filtrage front.** `GET /api/surveys?campaignId=` ramène toute la production
 * de la campagne ; les onglets comptent et filtrent cette liste. Le filtre serveur `?status=`
 * existe mais imposerait un appel par onglet ET des compteurs venus d'ailleurs (`progress`),
 * donc la possibilité d'un « Brouillon 2 » au-dessus d'une liste vide, sans rien à l'écran pour
 * trancher entre « l'API ne renvoie rien » et « il n'y a rien ». Ici les deux chiffres sont le
 * même jeu de données.
 *
 * **Lecture seule, volontairement.** Valider ou rejeter reste dans la file de validation
 * (`/verification/:surveyId`, vers laquelle chaque relevé soumis renvoie) : y dupliquer les
 * boutons de décision dupliquerait aussi le motif de rejet obligatoire, la confirmation et les
 * codes d'erreur métier, pour deux implémentations qui divergeraient.
 */
@Component({
  selector: 'das-campaign-surveys',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule, DasDatePipe, DasPagerComponent, SurveyFactsComponent, SurveyDecisionComponent],
  templateUrl: './campaign-surveys.component.html',
  styleUrl: './campaign-surveys.component.scss',
})
export class CampaignSurveysComponent implements OnInit, OnDestroy {
  protected facade = inject(ReviewFacade);
  /**
   * Uniquement pour le SEUIL d'écart. Le charger ici évite que l'écran invente une référence :
   * `Survey:SuspiciousDistanceM` est configurable côté serveur et n'est pas arbitré.
   */
  private dataQuality = inject(DataQualityFacade);
  protected readonly suspiciousDistanceM = this.dataQuality.knownThresholdM;

  readonly campaignId = input.required<UUID>();
  /**
   * Avancement de la campagne. Sert UNIQUEMENT à confronter les chiffres annoncés à ce que
   * l'API renvoie : c'est ce qui transforme une liste vide inexplicable en constat lisible.
   */
  readonly progress = input<CampaignProgress | null>(null);

  protected readonly statuses: SurveyStatus[] = ['Draft', 'Submitted', 'Validated', 'Rejected'];

  protected readonly surveys = toSignal(this.facade.campaignSurveys$, { initialValue: [] as CampaignSurveyItem[] });
  protected readonly counts = toSignal(this.facade.campaignSurveyCounts$, {
    initialValue: { all: 0, Draft: 0, Submitted: 0, Validated: 0, Rejected: 0 } as SurveyCounts,
  });
  /**
   * L'onglet actif est lu DANS LE STORE, pas dans un signal local : l'écran hôte le change
   * aussi (clic sur un compteur de l'avancement). Deux sources se seraient désynchronisées.
   */
  protected readonly status = toSignal(this.facade.campaignSurveyStatus$, { initialValue: null as SurveyStatus | null });
  protected readonly isLoading = toSignal(this.facade.isCampaignSurveysLoading$, { initialValue: false });

  protected readonly typeOccupations = toSignal(this.facade.typeOccupationOptions$, { initialValue: [] as OccupationCatalogItem[] });
  protected readonly etatOccupations = toSignal(this.facade.etatOccupationOptions$, { initialValue: [] as OccupationCatalogItem[] });

  /** Un seul relevé déplié à la fois : le détail est long, deux ouverts se lisent mal. */
  protected readonly expandedId = signal<UUID | null>(null);
  protected readonly photosOpenId = signal<UUID | null>(null);
  /** Une seule carte ouverte : chacune coûte une instance MapLibre. */
  protected readonly mapOpenId = signal<UUID | null>(null);
  protected readonly lightboxUrl = signal<string | null>(null);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly pagedSurveys = computed(() => {
    const debut = (this.page() - 1) * this.pageSize();
    return this.surveys().slice(debut, debut + this.pageSize());
  });

  /**
   * Nombre de relevés que l'avancement annonce, tous statuts. Comparé au total réellement
   * rapatrié pour dire, en une phrase, quand les deux ne concordent pas.
   */
  protected readonly announced = computed(() => {
    const p = this.progress();
    return p ? p.surveysDraft + p.surveysSubmitted + p.surveysValidated + p.surveysRejected : 0;
  });

  /**
   * Pourquoi la liste est vide — quatre cas distincts, quatre messages. Une seule phrase
   * générique (« Aucun relevé ») laissait croire à un écran cassé alors que le cas fréquent
   * est simplement un onglet sans ligne, avec des relevés sous les autres.
   */
  protected readonly emptyReason = computed<'loading' | 'filtered' | 'mismatch' | 'none' | null>(() => {
    if (this.surveys().length) return null;
    if (this.isLoading()) return 'loading';
    if (this.counts().all > 0) return 'filtered';
    return this.announced() > 0 ? 'mismatch' : 'none';
  });

  constructor() {
    /**
     * Remise à zéro accrochée au STATUT, pas au clic d'onglet : le changement de filtre peut
     * aussi venir de l'écran hôte (clic sur un compteur de l'avancement). Rester en page 3 sur
     * un relevé déplié qui n'appartient plus à la liste afficherait un vide inexplicable.
     */
    effect(() => {
      this.status();
      this.page.set(1);
      this.collapse();
    });
  }

  ngOnInit(): void {
    this.dataQuality.ensureThresholdLoaded();
    this.facade.loadCampaignSurveys(this.campaignId());
  }

  /**
   * L'écran se ferme : sans cela, une décision prise plus tard dans la file de vérification
   * relancerait un chargement pour une campagne qu'on ne regarde plus.
   */
  ngOnDestroy(): void {
    this.facade.clearCampaignSurveys();
  }

  // ---- Décisions ------------------------------------------------------------
  //
  // L'écran ne fait que router l'intention vers la facade : le composant de décision porte les
  // règles (motif obligatoire, confirmation du définitif), le store porte l'appel et le
  // rechargement de la liste. Rien de tout cela n'est réécrit ici.

  onValidate(id: UUID, validationType: ValidationType): void {
    this.facade.validate(id, validationType);
  }

  onReject(id: UUID, reason: string): void {
    this.facade.reject(id, 'property', reason);
  }

  onRequestCorrection(id: UUID): void {
    this.facade.requestCorrection(id);
  }

  /** Purement local : la liste est déjà là, changer d'onglet ne rappelle pas l'API. */
  filterStatus(status: SurveyStatus | null): void {
    this.facade.setCampaignSurveyStatus(status);
  }

  reload(): void {
    this.facade.loadCampaignSurveys(this.campaignId());
  }

  toggleDetail(id: UUID): void {
    if (this.expandedId() === id) { this.collapse(); return; }
    this.expandedId.set(id);
    this.photosOpenId.set(null);
    this.mapOpenId.set(null);
  }

  private collapse(): void {
    this.expandedId.set(null);
    this.photosOpenId.set(null);
    this.mapOpenId.set(null);
  }

  togglePhotos(id: UUID): void {
    if (this.photosOpenId() === id) { this.photosOpenId.set(null); return; }
    this.photosOpenId.set(id);
    // Rechargées à chaque ouverture : les URLs de lecture sont signées et expirent.
    this.facade.loadPhotos(id);
  }

  toggleMap(id: UUID): void {
    this.mapOpenId.set(this.mapOpenId() === id ? null : id);
  }

  openPhoto(url: string): void { this.lightboxUrl.set(url); }
  closePhoto(): void { this.lightboxUrl.set(null); }

  goToPage(page: number): void { this.page.set(page); this.collapse(); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(1); this.collapse(); }

  /** Libellé de l'onglet courant, pour le dire dans le message de liste vide. */
  statusLabelKey(): string {
    const s = this.status();
    return s ? `fieldops.survey.${s.toLowerCase()}` : 'fieldops.all';
  }

  /**
   * Pastilles de statut reprises de la palette existante : un brouillon se lit comme un état
   * neutre (rien n'est demandé), un rejet comme le rouge d'un « à refaire ».
   */
  badgeClass(survey: CampaignSurveyItem): string {
    // Un provisoire prend l'ambre du « en cours » et non le vert du validé : il reste une
    // décision en attente, pas un acquis.
    if (survey.status === 'Validated' && survey.validationType === 'Temporary') {
      return 'das-badge das-badge--in-progress';
    }
    const modifier = { Draft: 'not-assigned', Submitted: 'submitted', Validated: 'approved', Rejected: 'needs-redo' }[survey.status];
    return `das-badge das-badge--${modifier}`;
  }
}
