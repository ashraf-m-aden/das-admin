import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldOpsFacade } from '../../core/fieldops/store/fieldops.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { Campaign, CampaignStatus } from '../../core/models/das.models';
import { DasPagerComponent } from '../../core/ui/pager/das-pager.component';
import { daysUntilDeadline, isDeadlinePassed } from '../../core/i18n/djibouti-date.util';

@Component({
  selector: 'das-field-operations',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasDatePipe, PageHeaderComponent, DasPagerComponent],
  templateUrl: './field-operations.component.html',
  styleUrl: './field-operations.component.scss',
})
export class FieldOperationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  protected facade = inject(FieldOpsFacade);

  protected readonly campaigns$ = this.facade.campaigns$;
  protected readonly isLoading$ = this.facade.isCampaignsLoading$;
  protected readonly createErrorMessageKey = toSignal(this.facade.createCampaignErrorMessageKey$, { initialValue: null });
  private readonly createTick = toSignal(this.facade.createTick$, { initialValue: 0 });

  /**
   * La campagne déjà en préparation, quand c'est elle qui bloque la création.
   *
   * Le back refuse par `Campaigns.PlannedAlreadyExists` — une seule campagne peut être en
   * préparation à la fois — mais son message ne dit pas LAQUELLE. Le front, lui, a la liste :
   * autant la nommer et y conduire, plutôt que de laisser chercher.
   */
  protected readonly blockingPlanned = computed(() =>
    this.createErrorMessageKey() === 'fieldops.errorPlannedAlreadyExists'
      ? this.campaigns().find((c) => c.status === 'Planned') ?? null
      : null);

  protected readonly statuses: CampaignStatus[] = ['Planned', 'InProgress', 'Closed'];

  protected readonly campaigns = toSignal(this.facade.campaigns$, { initialValue: [] as Campaign[] });

  /** Statut filtré. Sans etat visible, on ne sait plus sur quoi on filtre. */
  protected readonly statusFilter = signal<CampaignStatus | null>(null);

  /** Formulaire de creation replie par defaut : il precedait la liste en permanence. */
  protected readonly showCreateForm = signal(false);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly pagedCampaigns = computed(() => {
    const debut = (this.page() - 1) * this.pageSize();
    return this.campaigns().slice(debut, debut + this.pageSize());
  });

  /**
   * Une campagne est en retard quand sa date limite est passee ET qu'elle n'est pas cloturee :
   * une campagne close a depasse sa date limite sans que ce soit un probleme.
   */
  isLate(c: Campaign): boolean {
    return c.status !== 'Closed' && isDeadlinePassed(c.deadline);
  }

  /** Jours restants — negatif si depasse. Sert a distinguer « demain » de « dans trois mois ». */
  daysLeft(c: Campaign): number | null {
    return c.status === 'Closed' ? null : daysUntilDeadline(c.deadline);
  }

  toggleCreateForm(): void { this.showCreateForm.update((v) => !v); }
  goToPage(p: number): void { this.page.set(p); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }

  protected readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    deadline: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.facade.loadCampaigns();
  }

  filterStatus(status: CampaignStatus | null): void {
    this.statusFilter.set(status);
    // Tout changement de filtre ramene en page 1 : rester en page 3 d'une liste reduite
    // afficherait un vide qu'on prendrait pour une absence de resultat.
    this.page.set(1);
    this.facade.setCampaignFilters({ status });
  }

  /** Vide le formulaire au SUCCÈS seulement — sur refus, la saisie doit rester corrigeable. */
  private readonly resetOnSuccess = effect(() => {
    if (this.createTick() > 0) this.createForm.reset({ name: '', deadline: '' });
  });

  createCampaign(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    // Pas de remise à zéro ici : `createCampaign` est asynchrone, et vider le formulaire tout de
    // suite effaçait la saisie même quand le back refusait — un 409 « une campagne est déjà en
    // préparation » faisait perdre le nom et la date qu'on venait de taper.
    this.facade.createCampaign(this.createForm.getRawValue());
    this.showCreateForm.set(false);
  }

  statusBadgeClass(status: CampaignStatus): string {
    return `das-badge das-badge--${status.toLowerCase()}`;
  }
}
