-- =====================================================================
--  D.A.S — post-traitement du schema "nour"
--  A executer APRES tous les 1x_/2x_/3x_.
--  1. reprojection systematique en 4326 (les dumps sont en 32638 / UTM 38N,
--     sauf chemin_fer deja en 4326) ;
--  2. reparation des geometries invalides ;
--  3. index GIST + statistiques ;
--  4. commentaires de tracabilite.
-- =====================================================================
BEGIN;

-- 1. Reprojection en 4326 (l'ALTER reconstruit l'index GIST tout seul).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT f_table_name AS t, f_geometry_column AS g, type AS gtype, srid
    FROM   geometry_columns
    WHERE  f_table_schema = 'nour' AND srid <> 4326
  LOOP
    RAISE NOTICE 'reprojection nour.% (% -> 4326)', r.t, r.srid;
    EXECUTE format(
      'ALTER TABLE nour.%I ALTER COLUMN %I TYPE geometry(%s,4326) USING ST_Transform(%I,4326)',
      r.t, r.g, r.gtype, r.g);
  END LOOP;
END $$;

-- 2. Geometries invalides -> reparees (ST_MakeValid) puis reforcees en Multi*.
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT f_table_name AS t, f_geometry_column AS g, type AS gtype
    FROM   geometry_columns
    WHERE  f_table_schema = 'nour' AND type LIKE '%POLYGON'
  LOOP
    EXECUTE format('SELECT count(*) FROM nour.%I WHERE NOT ST_IsValid(%I)', r.t, r.g) INTO n;
    IF n > 0 THEN
      RAISE NOTICE 'nour.% : % geometrie(s) invalide(s) reparee(s)', r.t, n;
      EXECUTE format(
        'UPDATE nour.%I SET %I = ST_Multi(ST_CollectionExtract(ST_MakeValid(%I),3)) WHERE NOT ST_IsValid(%I)',
        r.t, r.g, r.g, r.g);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- 3. Statistiques (hors transaction).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'nour' LOOP
    EXECUTE format('ANALYZE nour.%I', r.tablename);
  END LOOP;
END $$;

-- 4. Tracabilite.
COMMENT ON TABLE nour.frontiere             IS 'Frontieres nationales (lignes). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.contour_rdd           IS 'Contour des regions de la RDD (10 polygones). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.lacs                  IS 'Lacs et plans d''eau. Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.banquise_sel          IS 'Banc de sel (lac Assal). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.forets                IS 'Zones boisees / forets. Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.oueds_principaux      IS 'Oueds principaux (hydrographie, 1475 troncons). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.routes_1              IS 'Reseau routier, jeu 1 (73 troncons). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.routes_2              IS 'Reseau routier, jeu 2 (31 troncons). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.pistes_1              IS 'Pistes, jeu 1 (438 troncons). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.pistes_2              IS 'Pistes, jeu 2 (153 troncons). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.chemin_fer            IS 'Voie ferree (2 troncons). Dump livre deja en 4326. Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.villes_pt             IS 'Chefs-lieux (6 points : Ali Sabieh, Dikhil, Djibouti, Tadjourah, Obock, Arta). Fichier source VILLE.sql du lot 16h31.';
COMMENT ON TABLE nour.villages_pt           IS 'Villages (79 points). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.postes_administratifs IS 'Postes administratifs (8 points). Source expert SIG 2026-09-04.';
COMMENT ON TABLE nour.quartiers_ville_pg    IS 'ATTENTION : livre sous le nom VILLE.sql (zip WhatsApp) mais contient les QUARTIERS de Djibouti-ville : 130 polygones, 91 nommes, 39 sans nom. Colonnes name/commune/region.';
COMMENT ON TABLE nour.ilots_src             IS 'Ilots bruts NON codifies (3701). Sur-ensemble de public.ilots_codifies (3700) : memes geometries, sans code_ilot/quartier_ville. Ne remplace pas la version codifiee.';
COMMENT ON TABLE nour.parcelles_src         IS 'Parcelles brutes NON codifiees (28476). Sur-ensemble de public.parcelles_codifiees (28474) : memes geometries, sans code_parcelle/num_parcelle. Ne remplace pas la version codifiee.';
