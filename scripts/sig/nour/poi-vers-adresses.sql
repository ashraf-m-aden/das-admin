-- Bâtiments remarquables OSM : catégorie versée dans `Adresses`, et couche de tuiles pour la carte.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/nour/poi-vers-adresses.sql
--
-- Prérequis : `poi-osm.sql` chargé (961 POI dans `nour.poi_osm`).
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.**
--
-- ---------------------------------------------------------------------------------------------
-- DEUX SORTIES, PARCE QUE LES POI NE TIENNENT PAS TOUS DANS LE RÉFÉRENTIEL
-- ---------------------------------------------------------------------------------------------
-- Mesuré le 2026-09-06 : sur 961 POI, **343 tombent dans une parcelle** — mais dans seulement
-- **227 parcelles distinctes**, plusieurs POI partageant la même. Les 618 autres sont hors de
-- toute emprise saisie. Deux sorties donc, et pas une :
--
--   1. `Adresses."PoiCategorie"` pour les 227 : l'adresse sait ce qu'elle abrite. C'est du
--      référentiel, exploitable en liste, en filtre et dans le tiroir de détail.
--   2. `public.poi_tiles` pour les 961 : une couche d'affichage, pour que la carte montre aussi
--      l'hôpital qui n'a pas encore de parcelle.
--
-- ⚠️ **La vue est dans `public`, pas dans `nour`.** Le rôle `martin_ro` n'a AUCUN accès à `nour`
-- (révoqué volontairement par `00_schema.sql`), donc une source de tuiles n'y est pas lisible.
-- Une vue `public` appartenant à `postgres` lit `nour` avec les droits de son propriétaire :
-- Martin sert la couche sans que le schéma de travail soit exposé.
--
-- ---------------------------------------------------------------------------------------------
-- LA CATÉGORIE EST UN VOCABULAIRE FERMÉ
-- ---------------------------------------------------------------------------------------------
-- Onze valeurs, fixées à l'extraction (`poi-osm-extraire.py`) : sante, education, culte,
-- administration, hebergement, commerce, transport, securite, finance, sport, culture.
--
-- Le front associe une icône à chacune. **Toute valeur nouvelle serait stockée sans icône**, et
-- donc invisible sur la carte — c'est la même règle que `Streets."Type"` avec les filtres du
-- style. Ajouter une catégorie, c'est toucher aux deux bouts : ici et dans `map-style.json`.
--
-- ⚠️ **ODbL** : ces données viennent d'OpenStreetMap. L'attribution portée par la source
-- `contourNational` couvre déjà l'affichage ; toute rediffusion doit la mentionner.

-- Une seule catégorie par adresse. Quand plusieurs POI tombent dans la même parcelle — un
-- dispensaire dans l'enceinte d'une école, par exemple — on retient le plus proche du centre,
-- faute d'un critère métier pour arbitrer. Le rapport compte ces cas.
CREATE TEMP TABLE apparie AS
SELECT DISTINCT ON (a."Id")
       a."Id" AS adresse_id, p.categorie, p.sous_categorie, p.nom AS nom_poi,
       (SELECT count(*) FROM nour.poi_osm p2 WHERE ST_Contains(a."Boundary", p2.geom)) AS poi_dans_la_parcelle
FROM public."Adresses" a
JOIN nour.poi_osm p ON ST_Contains(a."Boundary", p.geom)
ORDER BY a."Id", ST_Distance(p.geom, ST_PointOnSurface(a."Boundary"));

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'poi par categorie', p.categorie,
       count(*) || ' POI, ' || count(p.nom) || ' nommes, ' ||
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM apparie a WHERE a.categorie = p.categorie)) || ' rattachables'
FROM nour.poi_osm p GROUP BY p.categorie;

INSERT INTO rapport
SELECT 2, 'bilan', 'rattachement',
       (SELECT count(*) FROM nour.poi_osm) || ' POI, ' ||
       (SELECT count(*) FROM apparie) || ' adresses concernees, ' ||
       ((SELECT count(*) FROM nour.poi_osm) - (SELECT count(*) FROM apparie)) || ' hors parcelle (couche seule)';

INSERT INTO rapport
SELECT 2, 'bilan', 'parcelles a plusieurs POI',
       count(*) || ' adresses contiennent plusieurs POI — le plus proche du centre est retenu'
FROM apparie WHERE poi_dans_la_parcelle > 1;

-- Seules les écritures qui suivent sont dans la transaction.
BEGIN;

-- Colonne AJOUTÉE au référentiel. `IF NOT EXISTS` : le script se rejoue après un nouvel import
-- OSM sans qu'il faille se souvenir de son état.
ALTER TABLE public."Adresses" ADD COLUMN IF NOT EXISTS "PoiCategorie" varchar(30);
ALTER TABLE public."Adresses" ADD COLUMN IF NOT EXISTS "PoiNom" varchar(200);

-- Remise à NULL d'abord : un POI supprimé d'OSM doit disparaître d'ici aussi, sinon la
-- catégorie survit à sa source et plus rien ne le signale.
UPDATE public."Adresses" SET "PoiCategorie" = NULL, "PoiNom" = NULL
WHERE "PoiCategorie" IS NOT NULL;

UPDATE public."Adresses" a
SET "PoiCategorie" = ap.categorie, "PoiNom" = ap.nom_poi
FROM apparie ap WHERE ap.adresse_id = a."Id";

-- La vue de tuiles expose la catégorie : c'est par elle que la carte colore et iconifie, sans
-- passer par l'API. Même mécanique que `workflowStage`.
CREATE OR REPLACE VIEW public.adresses_tiles AS
SELECT a."Id", a."Numero", a."Boundary", a."Location", a."BlocId",
       b."QuartierId", q."ZoneId", q."CommuneId", q."CityId",
       CASE a."PublicationStatus"
         WHEN 'Published' THEN 'published'
         WHEN 'Approved'  THEN 'approved'
         ELSE COALESCE(sv.stage, 'registered')
       END AS "workflowStage",
       a."CloseId",
       a."PoiCategorie", a."PoiNom"
FROM "Adresses" a
JOIN "Blocs" b ON b."Id" = a."BlocId"
JOIN "Quartiers" q ON q."Id" = b."QuartierId"
LEFT JOIN LATERAL (
  SELECT CASE sv_1."Status"
           WHEN 'Validated' THEN 'verified'
           WHEN 'Submitted' THEN 'surveyed'
           WHEN 'Draft'     THEN 'surveyed'
           ELSE 'registered'
         END AS stage
  FROM "Surveys" sv_1 WHERE sv_1."AdresseId" = a."Id"
  ORDER BY sv_1."CapturedAtUtc" DESC LIMIT 1) sv ON true;

-- Couche des 961 POI, y compris ceux sans parcelle. `Fid` en clé : Martin exige un identifiant
-- entier pour `promoteId`, et le couple (osm_type, osm_id) n'en est pas un.
CREATE OR REPLACE VIEW public.poi_tiles AS
SELECT row_number() OVER (ORDER BY p.osm_type, p.osm_id) AS "Fid",
       p.nom AS "Nom", p.categorie AS "Categorie", p.sous_categorie AS "SousCategorie",
       p.geom AS "Location"
FROM nour.poi_osm p;

GRANT SELECT ON public.poi_tiles TO martin_ro;

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 3, 'apres ecriture', cat, n || ' adresses'
FROM (SELECT coalesce("PoiCategorie", '(sans POI)') AS cat, count(*) AS n
      FROM public."Adresses" GROUP BY 1) x;

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
