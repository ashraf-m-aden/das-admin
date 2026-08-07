import { UUID, RoadTypeCode } from '../../models/das.models';

export interface CreateRoadTypePayload {
  code: RoadTypeCode;
  labelFr: string;
  isPoint: boolean;
}

export type MapImportTargetType = 'administrative_units' | 'blocks';

export interface ImportMapDataPayload {
  targetType: MapImportTargetType;
  /** Requis si targetType === 'blocks' (zone cible de l'import) */
  adminUnitId: UUID | null;
  file: File;
}

export interface ImportMapDataResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}
