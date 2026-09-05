-- =====================================================================
--  D.A.S — controle qualite du schema "nour" + vues de rapprochement
--  Purement en lecture (sauf CREATE VIEW). Rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Inventaire : ce qui a reellement ete charge
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nour.v_inventaire AS
SELECT g.f_table_name                          AS couche,
       g.type                                  AS type_geom,
       g.srid,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM nour.%I', g.f_table_name),
                           false, true, '')))[1]::text::bigint AS nb_lignes
FROM   geometry_columns g
WHERE  g.f_table_schema = 'nour';
COMMENT ON VIEW nour.v_inventaire IS 'Inventaire des couches nour : type, SRID, volumetrie.';

-- ---------------------------------------------------------------------
-- B. Quartiers de Djibouti-ville (couche livree sous le nom "VILLE")
--    91 polygones nommes / 39 anonymes. Communes : BOULAOS, BALBALA, RAS DIKA.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nour.v_quartiers_nommes AS
SELECT ogc_fid,
       btrim(name)                      AS quartier_nom,
       btrim(commune)                   AS commune_nom,
       btrim(region)                    AS region_nom,
       ST_Area(wkb_geometry::geography) AS surface_m2,
       wkb_geometry
FROM   nour.quartiers_ville_pg
WHERE  name IS NOT NULL;
COMMENT ON VIEW nour.v_quartiers_nommes IS
  'Quartiers de Djibouti-ville portant un nom (91/130). Candidat pour geometriser public."Quartiers".';

-- Rapprochement avec le referentiel DAS : quels noms tombent juste ?
-- (adapter le nom/la casse des colonnes de "Quartiers" au schema reel)
-- La vue n'est creee que si public."Quartiers" existe (schema DAS deploye).
DO $$
BEGIN
  IF to_regclass('public."Quartiers"') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW nour.v_quartiers_rapprochement AS
      SELECT s.ogc_fid,
             s.quartier_nom AS nom_sig,
             q."Id"         AS quartier_id_das,
             q."Nom"        AS nom_das,
             CASE WHEN q."Id" IS NULL THEN 'sans correspondance' ELSE 'apparie' END AS statut
      FROM   nour.v_quartiers_nommes s
      LEFT   JOIN public."Quartiers" q
             ON upper(unaccent(btrim(q."Nom"))) = upper(unaccent(s.quartier_nom))
    $v$;
    COMMENT ON VIEW nour.v_quartiers_rapprochement IS
      'Appariement nom SIG <-> public."Quartiers" (insensible casse/accents). '
      'Sert a mesurer le taux de recouvrement avant toute reprise.';
  ELSE
    RAISE NOTICE 'public."Quartiers" absente : v_quartiers_rapprochement non creee.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- B bis. La couche est-elle un doublon de `delimitations_quartiers` ?
--   `delimitations_quartiers` (deja en base, source de scripts/sig/emprises-quartiers.sql)
--   porte elle aussi 91 emprises nommees en 32638 MULTIPOLYGON. Forte presomption de
--   RE-LIVRAISON du meme jeu, avec `nom` renomme en `name`. A trancher par ces requetes.
-- ---------------------------------------------------------------------
DO $$
DECLARE a bigint; b bigint; c bigint;
BEGIN
  IF to_regclass('public.delimitations_quartiers') IS NULL THEN
    RAISE NOTICE 'public.delimitations_quartiers absente : comparaison impossible.';
    RETURN;
  END IF;
  SELECT count(*) INTO a FROM nour.quartiers_ville_pg;
  SELECT count(*) INTO b FROM public.delimitations_quartiers;
  SELECT count(*) INTO c
  FROM   nour.quartiers_ville_pg n
  JOIN   public.delimitations_quartiers d
         ON ST_Equals(n.wkb_geometry, ST_Transform(d.wkb_geometry, 4326));
  RAISE NOTICE 'quartiers_ville_pg = % lignes | delimitations_quartiers = % lignes | geometries identiques = %', a, b, c;
  IF c = a AND a = b THEN
    RAISE NOTICE '=> RE-LIVRAISON a l''identique : rien de nouveau a reprendre cote quartiers.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- C. Ilots bruts : la couche est SALE (doublons de saisie).
--    Voir les variantes a fusionner avant tout usage metier.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nour.v_ilots_libelles AS
SELECT commune, arronddiss, quartier, count(*) AS nb
FROM   nour.ilots_src
GROUP  BY 1,2,3
ORDER  BY nb DESC;
COMMENT ON VIEW nour.v_ilots_libelles IS
  'Variantes de libelles dans ilots_src. Fautes connues : BOUALOS/BOULAOS, DEUEXIEME/DEUXIEME, '
  'TROISIIEME/TROISIEME, QUATIER 1, QUARTIIER 6, CITE STATE/CITE STADE, QUARTIER4/QUARTIER 4, '
  '"Z . I . S." vs "Z . I . S .". 1014 lignes sur 3701 ont commune/quartier a NULL.';

-- Ce que le brut apporte par rapport a la version deja importee.
DO $$
BEGIN
  IF to_regclass('public.ilots_codifies') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW nour.v_ilots_nouveaux AS
      SELECT s.* FROM nour.ilots_src s
      LEFT JOIN public.ilots_codifies c ON c.objectid = s.objectid
      WHERE c.objectid IS NULL
    $v$;
  ELSE
    RAISE NOTICE 'public.ilots_codifies absente : v_ilots_nouveaux non creee.';
  END IF;

  IF to_regclass('public.parcelles_codifiees') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW nour.v_parcelles_nouvelles AS
      SELECT s.* FROM nour.parcelles_src s
      LEFT JOIN public.parcelles_codifiees c ON c.objectid = s.objectid
      WHERE c.objectid IS NULL
    $v$;
  ELSE
    RAISE NOTICE 'public.parcelles_codifiees absente : v_parcelles_nouvelles non creee.';
  END IF;
END $$;
-- v_parcelles_nouvelles : parcelles du dump brut absentes de la version codifiee (2 attendues).
-- v_ilots_nouveaux       : idem cote ilots (1 attendu).

-- ---------------------------------------------------------------------
-- D. Requetes de verification a lancer a la main
-- ---------------------------------------------------------------------
-- SELECT * FROM nour.v_inventaire ORDER BY couche;
-- SELECT statut, count(*) FROM nour.v_quartiers_rapprochement GROUP BY 1;
-- SELECT * FROM nour.v_quartiers_rapprochement WHERE statut = 'sans correspondance' ORDER BY nom_sig;
-- SELECT * FROM nour.v_ilots_libelles;
-- -- doublon quartiers : relire les NOTICE emis par le bloc B bis ci-dessus
-- SELECT count(*) FROM nour.v_ilots_nouveaux;      -- attendu : 1
-- SELECT count(*) FROM nour.v_parcelles_nouvelles; -- attendu : 2
-- -- emprise de chaque couche, pour verifier que la reprojection est bonne :
-- SELECT f_table_name, ST_Extent(wkb_geometry) FROM geometry_columns g,
--        LATERAL (SELECT 1) x WHERE f_table_schema='nour';  -- ou table par table
