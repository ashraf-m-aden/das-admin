import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { DataQualityFacade } from '../../../core/dataquality/store/dataquality.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { SurveyDecisionComponent } from '../../../core/review/ui/survey-decision/survey-decision.component';
import { SurveyFactsComponent } from '../../../core/review/ui/survey-facts/survey-facts.component';
import { DasPagerComponent } from '../../../core/ui/pager/das-pager.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { ReviewItem, ValidationType } from '../../../core/review/models/review.models';
import { RedoSubmissionType } from '../../../core/models/das.models';

@Component({
  selector: 'das-verification-queue',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent, DasPagerComponent, SurveyDecisionComponent, SurveyFactsComponent],
  templateUrl: './verification-queue.component.html',
  styleUrl: './verification-queue.component.scss',
})
export class VerificationQueueComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  protected facade = inject(ReviewFacade);
  /** Uniquement pour le SEUIL d'écart — l'écran ne doit pas en inventer un. */
  private dataQuality = inject(DataQualityFacade);
  protected readonly suspiciousDistanceM = this.dataQuality.knownThresholdM;

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly decisionError$ = this.facade.decisionErrorMessageKey$;

  protected readonly typeFilter = signal<RedoSubmissionType | null>(null);
  protected readonly rejectingId = signal<string | null>(null);
  protected readonly expandedPhotosId = signal<string | null>(null);
  protected readonly showStalled = signal(false);

  /**
   * Motif OBLIGATOIRE. Il ne l'était pas — or un rejet fait retomber l'adresse en `registered`
   * (CLAUDE.md §5) et ce motif est le SEUL message que l'agent recevra. Rejeter sans rien dire,
   * c'est renvoyer quelqu'un sur le terrain sans lui dire quoi corriger.
   * 5 caractères minimum : « non » ou « ko » n'est pas un motif.
   */
  protected readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5)]],
  });

  /** Photo ouverte en grand. La photo EST la preuve : la juger en vignette n'a pas de sens. */
  protected readonly lightboxUrl = signal<string | null>(null);

  /** Relevé dont la carte est dépliée. Une seule à la fois : elles coûtent une instance MapLibre. */
  protected readonly mapOpenId = signal<string | null>(null);

  /**
   * Relevé mis en évidence, désigné depuis le bandeau « en souffrance ».
   * Sans ce lien, le bandeau annonçait un problème sans permettre d'aller le traiter.
   */
  protected readonly focusedId = signal<string | null>(null);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as ReviewItem[] });
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  /**
   * Tri de la file. « Les plus anciens d'abord » est le tri de TRAVAIL : c'est celui qui vide
   * la file sans y laisser des relevés oubliés, alors que l'ordre par défaut fait remonter les
   * derniers arrivés et enterre les plus vieux à mesure que la file grossit.
   */
  protected readonly oldestFirst = signal(false);

  private readonly sortedItems = computed(() => {
    const items = this.items();
    if (!this.oldestFirst()) return items;
    return [...items].sort((a, b) => this.waitedSince(a).localeCompare(this.waitedSince(b)));
  });

  /** Date d'attente : capture pour un relevé, proposition pour une suggestion de nom. */
  private waitedSince(item: ReviewItem): string {
    return item.submissionType === 'property' ? item.capturedAtUtc : item.proposedAtUtc;
  }

  toggleOldestFirst(): void { this.oldestFirst.update((v) => !v); this.page.set(1); }

  // ---- Validation groupée ----------------------------------------------------

  /**
   * Sélection pour une validation en lot.
   *
   * ⚠️ **Il n'y a délibérément PAS de rejet groupé.** Le motif de rejet part tel quel à l'agent
   * et doit dire ce qu'IL doit corriger : un motif unique appliqué à dix relevés de plusieurs
   * agents ne dit rien à personne. Rejeter reste donc une décision une par une, avec son motif.
   *
   * La validation groupée, elle, se justifie : elle n'écrit aucun texte et sert le cas réel
   * d'une série de relevés propres du même agent, examinés à la suite.
   */
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected readonly selectableItems = computed(() => this.pagedItems().filter((i) => i.submissionType === 'property'));

  protected readonly allPageSelected = computed(() => {
    const selectables = this.selectableItems();
    return selectables.length > 0 && selectables.every((i) => this.selectedIds().has(i.id));
  });

  isSelected(item: ReviewItem): boolean { return this.selectedIds().has(item.id); }

  toggleSelection(item: ReviewItem): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });
  }

  /** Ne porte que sur la PAGE courante : sélectionner à l'aveugle une file entière n'a pas de sens. */
  toggleSelectPage(): void {
    const selectables = this.selectableItems();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      const toutCoche = selectables.every((i) => next.has(i.id));
      for (const item of selectables) {
        if (toutCoche) next.delete(item.id); else next.add(item.id);
      }
      return next;
    });
  }

  clearSelection(): void { this.selectedIds.set(new Set()); }

  /**
   * Confirmation obligatoire : valider en lot porte sur plusieurs relevés d'un coup.
   *
   * La confirmation demande AUSSI l'issue. Un bouton unique aurait forcément posé un type par
   * défaut, invisible — c'est exactement ce qui gelait le `addressCode` de toute une page.
   */
  protected readonly confirmingBulk = signal(false);
  requestBulkValidate(): void { this.confirmingBulk.set(true); }
  cancelBulkValidate(): void { this.confirmingBulk.set(false); }
  confirmBulkValidate(validationType: ValidationType): void {
    for (const id of this.selectedIds()) this.facade.validate(id, validationType);
    this.clearSelection();
    this.confirmingBulk.set(false);
  }

  protected readonly pagedItems = computed(() => {
    const debut = (this.page() - 1) * this.pageSize();
    return this.sortedItems().slice(debut, debut + this.pageSize());
  });

  protected readonly stalledItems$ = this.facade.stalledItems$;

  /** Relevé demandé par l'URL, en flux : naviguer d'un relevé à l'autre réutilise le composant. */
  private readonly routeSurveyId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('surveyId'))),
    { initialValue: null },
  );

  constructor() {
    /**
     * La file arrive de façon asynchrone : on ne peut pas focaliser au montage, il n'y a
     * encore rien à trouver. Cet effet attend que la liste soit là, puis focalise une seule
     * fois par relevé demandé — sans le garde, il rouvrirait la carte à chaque rechargement,
     * y compris après que l'opérateur l'ait refermée.
     */
    effect(() => {
      const demande = this.routeSurveyId();
      const items = this.items();
      if (!demande || items.length === 0 || this.dejaFocalise === demande) return;
      this.dejaFocalise = demande;
      this.focusSurvey(demande);
    });
  }

  private dejaFocalise: string | null = null;

  ngOnInit(): void {
    this.dataQuality.ensureThresholdLoaded();
    this.facade.load();
    this.facade.loadStalled();
  }

  toggleStalled(): void {
    this.showStalled.set(!this.showStalled());
  }

  filterType(type: RedoSubmissionType | null): void {
    this.typeFilter.set(type);
    this.page.set(1);
    this.facade.setFilters({ submissionType: type });
  }

  goToPage(p: number): void { this.page.set(p); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }

  openPhoto(url: string): void { this.lightboxUrl.set(url); }
  closePhoto(): void { this.lightboxUrl.set(null); }

  toggleMap(item: ReviewItem): void {
    this.mapOpenId.set(this.mapOpenId() === item.id ? null : item.id);
  }

  // `mapFeaturesFor`, `hasGeometry`, `mapLayers` et les libellés d'occupation ont disparu avec
  // la migration vers `das-survey-facts` : ce composant les portait en double.

  /** Relevé en souffrance introuvable dans la file — voir `focusSurvey`. */
  protected readonly notInQueueId = signal<string | null>(null);

  /**
   * Depuis le bandeau : met le relevé en évidence et ouvre sa carte.
   *
   * Le filtre par type est levé d'abord — un relevé masqué par l'onglet courant serait
   * introuvable alors qu'il est bien là. S'il reste absent, on le DIT : un clic qui ne fait
   * rien laisse croire à un bouton cassé, alors que la cause est réelle (relevé déjà tranché
   * par quelqu'un d'autre, ou file rechargée depuis).
   */
  focusSurvey(surveyId: string): void {
    this.notInQueueId.set(null);
    if (this.typeFilter() !== null) this.filterType(null);

    const index = this.items().findIndex((i) => i.id === surveyId);
    if (index < 0) { this.notInQueueId.set(surveyId); return; }

    // Amener la bonne PAGE, sinon la mise en évidence porte sur une carte hors écran.
    this.page.set(Math.floor(index / this.pageSize()) + 1);
    this.focusedId.set(surveyId);
    this.mapOpenId.set(surveyId);
    this.showStalled.set(false);
  }

  /**
   * Les trois issues d'un relevé sont rendues par `das-survey-decision`, partagé avec le détail
   * de campagne : cet écran ne fait plus que router l'intention vers la facade. Le motif de
   * rejet obligatoire et la confirmation du définitif vivent dans le composant, une seule fois.
   */
  onValidate(item: ReviewItem, validationType: ValidationType): void {
    this.facade.validate(item.id, validationType);
  }

  onReject(item: ReviewItem, reason: string): void {
    this.facade.reject(item.id, item.submissionType, reason);
  }

  approveSuggestion(item: ReviewItem): void {
    if (item.submissionType === 'property') return;
    this.facade.approveSuggestion(item.id, item.submissionType);
  }

  startReject(item: ReviewItem): void {
    this.rejectForm.reset({ reason: '' });
    this.rejectingId.set(item.id);
  }
  cancelReject(): void {
    this.rejectingId.set(null);
  }

  confirmReject(item: ReviewItem): void {
    if (this.rejectForm.invalid) { this.rejectForm.markAllAsTouched(); return; }
    const reason = this.rejectForm.getRawValue().reason.trim();
    this.facade.reject(item.id, item.submissionType, reason);
    this.rejectingId.set(null);
  }

  requestCorrection(item: ReviewItem): void {
    this.facade.requestCorrection(item.id);
  }

  togglePhotos(item: ReviewItem): void {
    if (this.expandedPhotosId() === item.id) {
      this.expandedPhotosId.set(null);
      return;
    }
    this.expandedPhotosId.set(item.id);
    this.facade.loadPhotos(item.id);
  }

  typeLabelKey(t: RedoSubmissionType): string {
    return `verification.type.${t}`;
  }

}
