import { RoadType } from '../../models/das.models';
import { ImportMapDataResult } from '../models/settings.models';

export type RoadTypesStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type CreateRoadTypeStatus = 'idle' | 'saving' | 'error';
export type ImportStatus = 'idle' | 'importing' | 'success' | 'error';

export interface SettingsState {
  roadTypes: RoadType[];
  roadTypesStatus: RoadTypesStatus;
  roadTypesErrorMessageKey: string | null;

  createRoadTypeStatus: CreateRoadTypeStatus;
  createRoadTypeErrorMessageKey: string | null;

  importStatus: ImportStatus;
  importResult: ImportMapDataResult | null;
  importErrorMessageKey: string | null;
}

export const initialSettingsState: SettingsState = {
  roadTypes: [],
  roadTypesStatus: 'idle',
  roadTypesErrorMessageKey: null,

  createRoadTypeStatus: 'idle',
  createRoadTypeErrorMessageKey: null,

  importStatus: 'idle',
  importResult: null,
  importErrorMessageKey: null,
};
