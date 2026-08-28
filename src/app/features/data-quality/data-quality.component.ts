import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { DataQualityFacade } from '../../core/dataquality/store/dataquality.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { DasPagerComponent } from '../../core/ui/pager/das-pager.component';
import { SuspiciousSurveyItem } from '../../core/dataquality/models/dataquality.models';

/** Critère de tri de la file suspecte. */
type DqSort = 'recent' | 'distance' | 'photos';

@Component({
  selector: 'das-data-quality',
  standalone: true,
  imports: [RouterLink, TranslocoModule, PageHeaderComponent, DasDatePipe, DasPagerComponent],
  templateUrl: './data-quality.component.html',
  styleUrl: './data-quality.component.scss',
})
export class DataQualityComponent implements OnInit {
  protected facade = inject(DataQualityFacade);

  /**
   * Filtre par NATURE du signal, pas par texte du motif : les motifs arrivent en phrases
   * rédigées côté back (« Position GPS simulée… »), non traduites et non stables. On filtre
   * donc sur les champs structurés du relevé, qui, eux, ont un sens durable.
   */
  protected readonly onlyMock = signal(false);
  protected readonly onlyFar = signal(false);
  protected readonly onlyNoPhoto = signal(false);

  protected readonly sort = signal<DqSort>('recent');

  /** Relevé dont on saisit le motif d'écartement. Un seul à la fois. */
  protected readonly dismissingId = signal<string | null>(null);
  protected readonly dismissReason = signal('');

  /** Le motif part dans une décision tracée : cinq caractères, comme le rejet d'un relevé. */
  protected readonly canDismiss = computed(() => this.dismissReason().trim().length >= 5);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly filtered = computed(() => {
    let rows = this.facade.surveys();
    if (this.onlyMock()) rows = rows.filter((s) => s.isMockLocation);
    // « Loin » = au-delà du seuil que le back applique et renvoie désormais. Le recopier
    // faisait afficher « > 100 m » quel que soit le seuil réellement utilisé.
    if (this.onlyFar()) {
      const seuil = this.facade.suspiciousDistanceM();
      rows = rows.filter((s) => (s.distanceFromAddressM ?? 0) > seuil);
    }
    if (this.onlyNoPhoto()) rows = rows.filter((s) => s.photoCount === 0);
    return this.trier(rows);
  });

  private trier(rows: SuspiciousSurveyItem[]): SuspiciousSurveyItem[] {
    const copie = [...rows];
    switch (this.sort()) {
      case 'distance':
        return copie.sort((a, b) => (b.distanceFromAddressM ?? -1) - (a.distanceFromAddressM ?? -1));
      case 'photos':
        return copie.sort((a, b) => a.photoCount - b.photoCount);
      default:
        return copie.sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc));
    }
  }

  protected readonly paged = computed(() => {
    const debut = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(debut, debut + this.pageSize());
  });

  /** Distingue « rien de suspect » de « rien ne passe ce filtre ». */
  protected readonly isFiltered = computed(() =>
    this.onlyMock() || this.onlyFar() || this.onlyNoPhoto());

  ngOnInit(): void { this.facade.load(); }

  startDismiss(surveyId: string): void {
    this.dismissingId.set(surveyId);
    this.dismissReason.set('');
  }
  cancelDismiss(): void { this.dismissingId.set(null); }
  confirmDismiss(surveyId: string): void {
    if (!this.canDismiss()) return;
    this.facade.dismiss(surveyId, this.dismissReason().trim());
    this.dismissingId.set(null);
  }

  /** Bascule l'affichage des relevés écartés — ils ne sont pas effacés, seulement sortis de la file. */
  toggleDismissed(): void {
    this.page.set(1);
    this.facade.load(!this.facade.includeDismissed());
  }

  toggleMock(): void { this.onlyMock.update((v) => !v); this.page.set(1); }
  toggleFar(): void { this.onlyFar.update((v) => !v); this.page.set(1); }
  toggleNoPhoto(): void { this.onlyNoPhoto.update((v) => !v); this.page.set(1); }
  setSort(value: string): void { this.sort.set(value as DqSort); this.page.set(1); }
  clearFilters(): void {
    this.onlyMock.set(false); this.onlyFar.set(false); this.onlyNoPhoto.set(false);
    this.page.set(1);
  }

  goToPage(p: number): void { this.page.set(p); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }

  notSurveyableReasonKey(reason: string): string {
    return `verification.notSurveyableReason.${reason.toLowerCase()}`;
  }
}
