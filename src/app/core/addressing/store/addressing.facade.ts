import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AddressingActions } from './addressing.actions';
import { addressingFeature } from './addressing.reducer';
import {
  selectIsBlocksLoading,
  selectIsPropertiesLoading,
  selectIsSavingBlock,
  selectIsSavingProperty,
  selectIsSavingStreet,
  selectIsStreetsLoading,
} from './addressing.selectors';
import { UUID } from '../../models/das.models';
import {
  AssignBlockNamePayload,
  AssignHouseNumberPayload,
  AssignStreetNamePayload,
  BlockNamingQuery,
  PropertyNumberingQuery,
  StreetNamingQuery,
} from '../models/addressing.models';

@Injectable({ providedIn: 'root' })
export class AddressingFacade {
  private store = inject(Store);

  blocks$ = this.store.select(addressingFeature.selectBlocks);
  blockFilters$ = this.store.select(addressingFeature.selectBlockFilters);
  isBlocksLoading$ = this.store.select(selectIsBlocksLoading);
  blocksErrorMessageKey$ = this.store.select(addressingFeature.selectBlocksErrorMessageKey);
  blockSaveErrorMessageKey$ = this.store.select(addressingFeature.selectBlockSaveErrorMessageKey);

  streets$ = this.store.select(addressingFeature.selectStreets);
  streetFilters$ = this.store.select(addressingFeature.selectStreetFilters);
  isStreetsLoading$ = this.store.select(selectIsStreetsLoading);
  streetsErrorMessageKey$ = this.store.select(addressingFeature.selectStreetsErrorMessageKey);
  streetSaveErrorMessageKey$ = this.store.select(addressingFeature.selectStreetSaveErrorMessageKey);

  properties$ = this.store.select(addressingFeature.selectProperties);
  isPropertiesLoading$ = this.store.select(selectIsPropertiesLoading);
  propertiesErrorMessageKey$ = this.store.select(addressingFeature.selectPropertiesErrorMessageKey);
  propertySaveErrorMessageKey$ = this.store.select(addressingFeature.selectPropertySaveErrorMessageKey);

  loadBlocksToName(): void {
    this.store.dispatch(AddressingActions.loadBlocksToName());
  }
  setBlockFilters(filters: Partial<BlockNamingQuery>): void {
    this.store.dispatch(AddressingActions.setBlockFilters({ filters }));
  }
  isSavingBlock$(id: UUID) {
    return this.store.select(selectIsSavingBlock(id));
  }
  assignBlockName(id: UUID, payload: AssignBlockNamePayload): void {
    this.store.dispatch(AddressingActions.assignBlockName({ id, payload }));
  }

  loadStreetsToName(): void {
    this.store.dispatch(AddressingActions.loadStreetsToName());
  }
  setStreetFilters(filters: Partial<StreetNamingQuery>): void {
    this.store.dispatch(AddressingActions.setStreetFilters({ filters }));
  }
  isSavingStreet$(id: UUID) {
    return this.store.select(selectIsSavingStreet(id));
  }
  assignStreetName(id: UUID, payload: AssignStreetNamePayload): void {
    this.store.dispatch(AddressingActions.assignStreetName({ id, payload }));
  }

  loadPropertiesToNumber(query: PropertyNumberingQuery): void {
    this.store.dispatch(AddressingActions.loadPropertiesToNumber({ query }));
  }
  isSavingProperty$(id: UUID) {
    return this.store.select(selectIsSavingProperty(id));
  }
  assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): void {
    this.store.dispatch(AddressingActions.assignHouseNumber({ id, payload }));
  }
}
