import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DiscoveriesActions } from './discoveries.actions';
import { discoveriesFeature } from './discoveries.reducer';
import { selectCounts, selectIsListLoading, selectSelectedReport } from './discoveries.selectors';
import { UUID } from '../../models/das.models';
import { DiscoveryStatus } from '../models/discoveries.models';

@Injectable({ providedIn: 'root' })
export class DiscoveriesFacade {
  private store = inject(Store);

  reports$ = this.store.select(discoveriesFeature.selectReports);
  campaigns$ = this.store.select(discoveriesFeature.selectCampaigns);
  campaignId$ = this.store.select(discoveriesFeature.selectCampaignId);
  status$ = this.store.select(discoveriesFeature.selectStatus);
  selectedId$ = this.store.select(discoveriesFeature.selectSelectedId);
  selectedReport$ = this.store.select(selectSelectedReport);
  counts$ = this.store.select(selectCounts);
  isListLoading$ = this.store.select(selectIsListLoading);
  isReviewing$ = this.store.select(discoveriesFeature.selectIsReviewing);
  isExporting$ = this.store.select(discoveriesFeature.selectIsExporting);
  errorMessageKey$ = this.store.select(discoveriesFeature.selectErrorMessageKey);
  reviewTick$ = this.store.select(discoveriesFeature.selectReviewTick);

  /** Premier chargement. Les filtres par défaut (campagne `null`, statut `Pending`) sont déjà dans l'état initial. */
  load(): void { this.store.dispatch(DiscoveriesActions.loadList()); }

  setCampaign(campaignId: UUID | null): void {
    this.store.dispatch(DiscoveriesActions.setCampaignFilter({ campaignId }));
  }

  setStatus(status: DiscoveryStatus | null): void {
    this.store.dispatch(DiscoveriesActions.setStatusFilter({ status }));
  }

  select(id: UUID | null): void { this.store.dispatch(DiscoveriesActions.selectReport({ id })); }

  /** Retient le signalement pour digitalisation — ne crée AUCUNE adresse. */
  accept(id: UUID): void { this.store.dispatch(DiscoveriesActions.accept({ id })); }

  /** Motif obligatoire côté back : l'appelant doit avoir vérifié qu'il n'est pas vide. */
  reject(id: UUID, rejectionReason: string): void {
    this.store.dispatch(DiscoveriesActions.reject({ id, rejectionReason }));
  }

  /** Télécharge la FeatureCollection à remettre à l'expert GIS. */
  export(): void { this.store.dispatch(DiscoveriesActions.export()); }
}
