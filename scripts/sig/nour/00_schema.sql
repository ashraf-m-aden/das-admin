-- =====================================================================
--  D.A.S — schema "nour" : couches SIG livrees par l'expert le 2026-09-04
--  A executer EN PREMIER. Ne touche a rien dans "public".
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS nour;
COMMENT ON SCHEMA nour IS
  'Couches SIG source (expert SIG). Referentiel de fond de carte, non normalise. '
  'Ne pas y ecrire depuis l''application : schema de reference, alimente par import.';

-- PAS de lecture pour Martin. Decision du 2026-09-04 : `nour` est un schema de
-- travail, pas une source de tuiles. Martin auto-publie tout ce qu'il peut lire
-- (`Auto-publishing tables schemas=...`) : lui donner le SELECT suffit a exposer
-- les 17 couches, ce qu'on ne veut pas. Le front ne doit voir que `public`.
-- Le referentiel se nourrit de `nour` par des scripts (95_, 96_), pas par les tuiles.
--
-- On revoque explicitement, car un GRANT a pu etre pose par une version anterieure
-- de ce fichier.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['martin_ro', 'martin'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA nour REVOKE SELECT ON TABLES FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA nour FROM %I', r);
      EXECUTE format('REVOKE ALL ON SCHEMA nour FROM %I', r);
      RAISE NOTICE 'acces a nour retire a %', r;
    END IF;
  END LOOP;
END $$;
