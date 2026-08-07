import { createFeature, createReducer, on } from '@ngrx/store';
import { AddressingActions } from './addressing.actions';
import { initialAddressingState } from './addressing.state';

export const addressingFeature = createFeature({
  name: 'addressing',
  reducer: createReducer(
    initialAddressingState,

    // --- Blocs ---
    on(AddressingActions.loadBlocksToName, (state) => ({
      ...state, blocksStatus: 'loading' as const, blocksErrorMessageKey: null,
    })),
    on(AddressingActions.loadBlocksToNameSuccess, (state, { items }) => ({
      ...state, blocks: items, blocksStatus: 'loaded' as const,
    })),
    on(AddressingActions.loadBlocksToNameFailure, (state, { errorMessageKey }) => ({
      ...state, blocksStatus: 'error' as const, blocksErrorMessageKey: errorMessageKey,
    })),
    on(AddressingActions.setBlockFilters, (state, { filters }) => ({
      ...state, blockFilters: { ...state.blockFilters, ...filters },
    })),
    on(AddressingActions.assignBlockName, (state, { id }) => ({
      ...state, savingBlockId: id, blockSaveErrorMessageKey: null,
    })),
    on(AddressingActions.assignBlockNameSuccess, (state, { item }) => ({
      ...state, blocks: state.blocks.map((b) => (b.id === item.id ? item : b)), savingBlockId: null,
    })),
    on(AddressingActions.assignBlockNameFailure, (state, { errorMessageKey }) => ({
      ...state, savingBlockId: null, blockSaveErrorMessageKey: errorMessageKey,
    })),

    // --- Rues ---
    on(AddressingActions.loadStreetsToName, (state) => ({
      ...state, streetsStatus: 'loading' as const, streetsErrorMessageKey: null,
    })),
    on(AddressingActions.loadStreetsToNameSuccess, (state, { items }) => ({
      ...state, streets: items, streetsStatus: 'loaded' as const,
    })),
    on(AddressingActions.loadStreetsToNameFailure, (state, { errorMessageKey }) => ({
      ...state, streetsStatus: 'error' as const, streetsErrorMessageKey: errorMessageKey,
    })),
    on(AddressingActions.setStreetFilters, (state, { filters }) => ({
      ...state, streetFilters: { ...state.streetFilters, ...filters },
    })),
    on(AddressingActions.assignStreetName, (state, { id }) => ({
      ...state, savingStreetId: id, streetSaveErrorMessageKey: null,
    })),
    on(AddressingActions.assignStreetNameSuccess, (state, { item }) => ({
      ...state, streets: state.streets.map((s) => (s.id === item.id ? item : s)), savingStreetId: null,
    })),
    on(AddressingActions.assignStreetNameFailure, (state, { errorMessageKey }) => ({
      ...state, savingStreetId: null, streetSaveErrorMessageKey: errorMessageKey,
    })),

    // --- Propriétés ---
    on(AddressingActions.loadPropertiesToNumber, (state) => ({
      ...state, propertiesStatus: 'loading' as const, propertiesErrorMessageKey: null,
    })),
    on(AddressingActions.loadPropertiesToNumberSuccess, (state, { items }) => ({
      ...state, properties: items, propertiesStatus: 'loaded' as const,
    })),
    on(AddressingActions.loadPropertiesToNumberFailure, (state, { errorMessageKey }) => ({
      ...state, propertiesStatus: 'error' as const, propertiesErrorMessageKey: errorMessageKey,
    })),
    on(AddressingActions.assignHouseNumber, (state, { id }) => ({
      ...state, savingPropertyId: id, propertySaveErrorMessageKey: null,
    })),
    on(AddressingActions.assignHouseNumberSuccess, (state, { item }) => ({
      ...state, properties: state.properties.map((p) => (p.id === item.id ? item : p)), savingPropertyId: null,
    })),
    on(AddressingActions.assignHouseNumberFailure, (state, { errorMessageKey }) => ({
      ...state, savingPropertyId: null, propertySaveErrorMessageKey: errorMessageKey,
    })),
  ),
});

export const {
  name: addressingFeatureKey,
  reducer: addressingReducer,
  selectBlocks, selectBlocksStatus, selectBlocksErrorMessageKey, selectBlockFilters,
  selectSavingBlockId, selectBlockSaveErrorMessageKey,
  selectStreets, selectStreetsStatus, selectStreetsErrorMessageKey, selectStreetFilters,
  selectSavingStreetId, selectStreetSaveErrorMessageKey,
  selectProperties, selectPropertiesStatus, selectPropertiesErrorMessageKey,
  selectSavingPropertyId, selectPropertySaveErrorMessageKey,
} = addressingFeature;
