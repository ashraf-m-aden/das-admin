import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { RoadType } from '../../models/das.models';
import { CreateRoadTypePayload, ImportMapDataPayload, ImportMapDataResult } from '../models/settings.models';

export const SettingsActions = createActionGroup({
  source: 'Settings',
  events: {
    'Load Road Types': emptyProps(),
    'Load Road Types Success': props<{ items: RoadType[] }>(),
    'Load Road Types Failure': props<{ errorMessageKey: string }>(),

    'Create Road Type': props<{ payload: CreateRoadTypePayload }>(),
    'Create Road Type Success': props<{ item: RoadType }>(),
    'Create Road Type Failure': props<{ errorMessageKey: string }>(),

    'Import Map Data': props<{ payload: ImportMapDataPayload }>(),
    'Import Map Data Success': props<{ result: ImportMapDataResult }>(),
    'Import Map Data Failure': props<{ errorMessageKey: string }>(),
    'Reset Import': emptyProps(),
  },
});
