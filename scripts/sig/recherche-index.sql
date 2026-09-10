-- Index de recherche du référentiel — `public.recherche_index`.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/recherche-index.sql
--
-- ---------------------------------------------------------------------------------------------
-- POURQUOI UNE VUE MATÉRIALISÉE
-- ---------------------------------------------------------------------------------------------
-- La carte publique cherchait dans les tuiles déjà rendues (`querySourceFeatures`), donc dans la
-- seule emprise visible : chercher « Ambouli » depuis Balbala ne rendait rien. Une recherche qui
-- porte sur tout le référentiel doit venir du serveur.
--
-- Matérialisée et non simple : la recherche s'exécute à chaque frappe. Une vue ordinaire
-- rejouerait à chaque fois l'UNION de six tables — dont `Adresses`, 36 163 lignes — et le
-- `similarity()` ne pourrait s'appuyer sur aucun index. Ici l'index GIN trigramme porte sur une
-- table réelle, et la réponse tient en quelques millisecondes.
--
-- ⚠️ **Elle ne se rafraîchit pas toute seule.** Après un import ou une campagne de nommage :
--
--     REFRESH MATERIALIZED VIEW CONCURRENTLY public.recherche_index;
--
-- `CONCURRENTLY` exige l'index unique sur `cle`, créé plus bas : sans lui la vue est verrouillée
-- pendant tout le rafraîchissement et la recherche tombe.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUI ENTRE, ET CE QUI N'ENTRE PAS
-- ---------------------------------------------------------------------------------------------
-- Villes, quartiers, rues NOMMÉES, lieux remarquables NOMMÉS, et les parcelles qui abritent un
-- lieu identifié. Volontairement PAS les 36 163 parcelles : un numéro seul (« 12 ») n'est pas un
-- terme de recherche, il n'a de sens qu'avec sa rue — et la close, qui portera ce lien, n'est pas
-- encore généralisée. À rouvrir quand les closes existeront.
--
-- Les 3 881 rues sans nom sont écartées : leur code (`OSM-W101529382`) n'est pas un terme qu'un
-- usager tape. Elles restent visibles sur la carte, simplement pas dans la recherche.

DROP MATERIALIZED VIEW IF EXISTS public.recherche_index CASCADE;

CREATE MATERIALIZED VIEW public.recherche_index AS
SELECT *, upper(unaccent(libelle)) AS normalise FROM (
SELECT
  'ville:'  || c."Id"::text                       AS cle,
  'ville'                                          AS genre,
  c."Name"                                         AS libelle,
  NULL::text                                       AS complement,
  ST_PointOnSurface(c."Boundary")                  AS point,
  1                                                AS rang_genre
FROM public."Cities" c WHERE c."Boundary" IS NOT NULL

UNION ALL
-- Depuis `quartiers_tiles` et non `Quartiers` : le code postal est DÉRIVÉ dans la vue
-- (`City."Code"` + `Quartier."AreaNumber"`) et n'existe pas comme colonne. On le lit, on ne le
-- recompose pas — CLAUDE.md §9.
SELECT 'quartier:' || q."Id"::text, 'quartier', q."Nom",
       nullif(btrim(coalesce(q."CityName", '') || coalesce(' · ' || q."Postcode", '')), ''),
       ST_PointOnSurface(q."Boundary"), 2
FROM public.quartiers_tiles q
WHERE q."Boundary" IS NOT NULL

UNION ALL
SELECT 'lieu:' || p."Fid"::text, 'lieu', p."Nom",
       coalesce(p."SousCategorie", p."Categorie"), p."Location", 3
FROM public.poi_sites_tiles p WHERE p."Nom" IS NOT NULL

UNION ALL
SELECT 'rue:' || s."Id"::text, 'rue', s."Name", s."Type"::text,
       ST_PointOnSurface(s."Boundary"), 4
FROM public."Streets" s
WHERE s."Name" IS NOT NULL AND btrim(s."Name") <> '' AND s."Boundary" IS NOT NULL

UNION ALL
SELECT 'adresse:' || a."Id"::text, 'adresse', a."PoiNom",
       'N° ' || a."Numero"::text, ST_PointOnSurface(a."Boundary"), 5
FROM public."Adresses" a
WHERE a."PoiNom" IS NOT NULL AND a."Boundary" IS NOT NULL
) AS tout;

-- Unique : exigé par REFRESH ... CONCURRENTLY.
CREATE UNIQUE INDEX recherche_index_cle ON public.recherche_index (cle);

-- ⚠️ L'index porte sur la COLONNE `normalise`, jamais sur `upper(unaccent(libelle))` :
-- `unaccent()` est déclarée STABLE et non IMMUTABLE, et Postgres refuse toute fonction non
-- immuable dans une expression d'index — « functions in index expression must be marked
-- IMMUTABLE ». Stocker la forme normalisée contourne la règle sans la tordre : elle est calculée
-- une fois, au rafraîchissement.
--
-- Sans normalisation, chercher « ecole » ne trouverait pas « École ». La requête doit donc, elle
-- aussi, comparer sur `normalise` — pas sur `libelle`.
CREATE INDEX recherche_index_trgm
  ON public.recherche_index USING GIN (normalise gin_trgm_ops);

CREATE INDEX recherche_index_point ON public.recherche_index USING GIST (point);

GRANT SELECT ON public.recherche_index TO martin_ro;

ANALYZE public.recherche_index;

SELECT genre, count(*) AS entrees FROM public.recherche_index GROUP BY genre ORDER BY 2 DESC;
