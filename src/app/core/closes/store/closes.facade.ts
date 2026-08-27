import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import {
  selectBlocOwner, selectCanApplyPlan, selectEffectivePlan, selectIsListLoading,
  selectPlanIssues, selectTakenNumbers,
} from './closes.selectors';
import { UUID } from '../../models/das.models';
import { CreateClosePayload } from '../models/closes.models';

@Injectable({ providedIn: 'root' })
export class ClosesFacade {
  private store = inject(Store);

  closes$ = this.store.select(closesFeature.selectCloses);
  blocs$ = this.store.select(closesFeature.selectBlocs);
  streets$ = this.store.select(closesFeature.selectStreets);
  quartierId$ = this.store.select(closesFeature.selectQuartierId);
  isListLoading$ = this.store.select(selectIsListLoading);
  isSaving$ = this.store.select(closesFeature.selectIsSaving);
  errorMessageKey$ = this.store.select(closesFeature.selectSaveErrorMessageKey);
  saveTick$ = this.store.select(closesFeature.selectSaveTick);

  /** Plan de numérotation en cours de validation, corrections manuelles incluses. */
  plan$ = this.store.select(selectEffectivePlan);
  planIssues$ = this.store.select(selectPlanIssues);
  canApplyPlan$ = this.store.select(selectCanApplyPlan);
  isPreviewing$ = this.store.select(closesFeature.selectIsPreviewing);

  blocOwner$ = this.store.select(selectBlocOwner);
  takenNumbers$ = this.store.select(selectTakenNumbers);

  loadStreets(): void { this.store.dispatch(ClosesActions.loadStreets()); }

  selectQuartier(quartierId: UUID | null): void {
    this.store.dispatch(ClosesActions.selectQuartier({ quartierId }));
  }

  /** `id === null` → création. En modification, `quartierId` est ignoré (non modifiable côté back). */
  save(id: UUID | null, payload: CreateClosePayload): void {
    this.store.dispatch(ClosesActions.saveClose({ id, payload }));
  }

  remove(id: UUID): void {
    this.store.dispatch(ClosesActions.removeClose({ id }));
  }

  /** Demande l'aperçu de numérotation — n'écrit rien. `blocIds` vide = proposition pour la close telle qu'elle est. */
  previewNumbering(closeId: UUID, blocIds: UUID[], reverse = false): void {
    this.store.dispatch(ClosesActions.previewNumbering({ closeId, blocIds, reverse }));
  }

  editPlannedNumero(adresseId: UUID, numero: number): void {
    this.store.dispatch(ClosesActions.editPlannedNumero({ adresseId, numero }));
  }

  discardPlan(): void { this.store.dispatch(ClosesActions.discardPlan()); }

  /** Rattachement : endpoint dédié, jamais un champ de `PATCH`. Porte les 3 gardes côté back. */
  attachBlocs(closeId: UUID, blocIds: UUID[]): void {
    this.store.dispatch(ClosesActions.attachBlocs({ closeId, blocIds }));
  }

  detachBloc(closeId: UUID, blocId: UUID): void {
    this.store.dispatch(ClosesActions.detachBloc({ closeId, blocId }));
  }
}
