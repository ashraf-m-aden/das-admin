import { BlockNamingQuery, BlockToName, PropertyToNumber, StreetNamingQuery, StreetToName } from '../models/addressing.models';

export type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AddressingState {
  blocks: BlockToName[];
  blocksStatus: ListStatus;
  blocksErrorMessageKey: string | null;
  blockFilters: BlockNamingQuery;
  savingBlockId: string | null;
  blockActionErrorMessageKey: string | null;

  streets: StreetToName[];
  streetsStatus: ListStatus;
  streetsErrorMessageKey: string | null;
  streetFilters: StreetNamingQuery;
  savingStreetId: string | null;
  streetActionErrorMessageKey: string | null;

  properties: PropertyToNumber[];
  propertiesStatus: ListStatus;
  propertiesErrorMessageKey: string | null;
  savingPropertyId: string | null;
  propertySaveErrorMessageKey: string | null;
}

export const initialAddressingState: AddressingState = {
  blocks: [],
  blocksStatus: 'idle',
  blocksErrorMessageKey: null,
  blockFilters: { search: '', onlyUnnamed: true },
  savingBlockId: null,
  blockActionErrorMessageKey: null,

  streets: [],
  streetsStatus: 'idle',
  streetsErrorMessageKey: null,
  streetFilters: { search: '', onlyUnnamed: true },
  savingStreetId: null,
  streetActionErrorMessageKey: null,

  properties: [],
  propertiesStatus: 'idle',
  propertiesErrorMessageKey: null,
  savingPropertyId: null,
  propertySaveErrorMessageKey: null,
};
