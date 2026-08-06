import { createSelector } from '@ngrx/store';
import { blocksFeature } from './blocks.reducer';
import { BlockGeoJsonProperties } from '../models/blocks.models';

export const selectIsBlocksListLoading = createSelector(
  blocksFeature.selectListStatus,
  (status) => status === 'loading',
);

export const selectIsBlockDetailLoading = createSelector(
  blocksFeature.selectDetailStatus,
  (status) => status === 'loading',
);

/**
 * Conversion des blocs du store en FeatureCollection GeoJSON — consommée
 * UNIQUEMENT par blocks-map.component.ts en mode mock (overlay local).
 * En mode réel, la carte ignore complètement cette donnée et lit les
 * tuiles Martin à la place.
 */
export const selectBlocksAsGeoJson = createSelector(blocksFeature.selectItems, (items) => ({
  type: 'FeatureCollection' as const,
  features: items.map((b) => ({
    type: 'Feature' as const,
    geometry: b.geomPolygon,
    properties: { id: b.id, code: b.code, status: b.status } satisfies BlockGeoJsonProperties,
  })),
}));
