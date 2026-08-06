-- =============================================================================
-- D.A.S — Fonctions de génération de tuiles vectorielles (MVT) pour Martin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.blocks_tiles(z integer, x integer, y integer)
RETURNS bytea AS $$
  SELECT ST_AsMVT(tile, 'blocks', 4096, 'geom') FROM (
    SELECT
      id, code, status, admin_unit_id, area_m2,
      ST_AsMVTGeom(
        ST_SimplifyPreserveTopology(geom_polygon, GREATEST(0, (13 - z)) * 0.0004),
        ST_TileEnvelope(z, x, y),
        4096, 64, true
      ) AS geom
    FROM blocks
    WHERE geom_polygon && ST_TileEnvelope(z, x, y)
  ) AS tile;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION public.blocks_tiles_for_client(
  z integer, x integer, y integer, client_id uuid
)
RETURNS bytea AS $$
  SELECT ST_AsMVT(tile, 'blocks', 4096, 'geom') FROM (
    SELECT
      b.id, b.code, b.status,
      ST_AsMVTGeom(
        ST_SimplifyPreserveTopology(b.geom_polygon, GREATEST(0, (13 - z)) * 0.0004),
        ST_TileEnvelope(z, x, y),
        4096, 64, true
      ) AS geom
    FROM blocks b
    INNER JOIN client_zone_access cza
      ON cza.zone_id = b.admin_unit_id
     AND cza.client_id = blocks_tiles_for_client.client_id
     AND cza.access_status = 'granted'
    WHERE b.geom_polygon && ST_TileEnvelope(z, x, y)
  ) AS tile;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION public.properties_tiles(z integer, x integer, y integer)
RETURNS bytea AS $$
  SELECT ST_AsMVT(tile, 'properties', 4096, 'geom') FROM (
    SELECT
      id, house_number, property_type, status, address_code,
      ST_AsMVTGeom(geom_point, ST_TileEnvelope(z, x, y), 4096, 64, true) AS geom
    FROM properties
    WHERE geom_point && ST_TileEnvelope(z, x, y)
      AND z >= 15
  ) AS tile;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION public.streets_tiles(z integer, x integer, y integer)
RETURNS bytea AS $$
  SELECT ST_AsMVT(tile, 'streets', 4096, 'geom') FROM (
    SELECT
      s.id, s.name_fr, s.name_ar, rt.code AS road_type_code, rt.is_point,
      ST_AsMVTGeom(s.geom, ST_TileEnvelope(z, x, y), 4096, 64, true) AS geom
    FROM streets s
    JOIN road_types rt ON rt.id = s.road_type_id
    WHERE s.geom && ST_TileEnvelope(z, x, y)
      AND z >= 13
  ) AS tile;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION public.admin_units_tiles(
  z integer, x integer, y integer, level text DEFAULT 'quartier'
)
RETURNS bytea AS $$
  SELECT ST_AsMVT(tile, 'admin_units', 4096, 'geom') FROM (
    SELECT
      id, code, name_fr, name_ar, level_type,
      ST_AsMVTGeom(
        ST_SimplifyPreserveTopology(geom_polygon, GREATEST(0, (13 - z)) * 0.0006),
        ST_TileEnvelope(z, x, y),
        4096, 64, true
      ) AS geom
    FROM administrative_units
    WHERE geom_polygon && ST_TileEnvelope(z, x, y)
      AND level_type = admin_units_tiles.level
  ) AS tile;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Index requis (déjà présents dans le schéma de base — rappel de vérification)
-- CREATE INDEX idx_blocks_geom ON blocks USING GIST (geom_polygon);
-- CREATE INDEX idx_properties_geom ON properties USING GIST (geom_point);
-- CREATE INDEX idx_streets_geom ON streets USING GIST (geom);
-- CREATE INDEX idx_admin_units_geom ON administrative_units USING GIST (geom_polygon);
CREATE INDEX IF NOT EXISTS idx_client_zone_access_lookup
  ON client_zone_access (client_id, zone_id)
  WHERE access_status = 'granted';
