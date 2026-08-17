import { createSelector } from '@ngrx/store';
import { blocksFeature } from './blocks.reducer';
import { BlockGeoJsonProperties, BlockListItem } from '../models/blocks.models';
import { GeoJSONMultiPolygon } from '../../models/das.models';

export const selectIsBlocksListLoading = createSelector(
  blocksFeature.selectListStatus,
  (status) => status === 'loading',
);

export const selectIsBlockDetailLoading = createSelector(
  blocksFeature.selectDetailStatus,
  (status) => status === 'loading',
);

/**
 * Conversion des blocs en FeatureCollection — consommée UNIQUEMENT par
 * blocks-map en mode mock (overlay local). En mode réel, `geom` est absent
 * (géométrie servie par les tuiles Martin) : ces items sont écartés.
 */
export const selectBlocksAsGeoJson = createSelector(blocksFeature.selectItems, (items) => ({
  type: 'FeatureCollection' as const,
  features: items
    .filter((b): b is BlockListItem & { geom: GeoJSONMultiPolygon } => !!b.geom)
    .map((b) => ({
      type: 'Feature' as const,
      geometry: b.geom,
      properties: { id: b.id, code: b.code, status: b.status } satisfies BlockGeoJsonProperties,
    })),
}));
