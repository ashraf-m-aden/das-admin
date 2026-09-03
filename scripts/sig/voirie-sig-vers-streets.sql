-- Reprise des cinq tables de voirie SIG dans `Streets`.
--
--   Dans pgAdmin : ouvrir ce fichier et l'exécuter tel quel.
--   En ligne de commande : psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/voirie-sig-vers-streets.sql
--
-- SQL pur, aucune commande psql (`\set`, `\echo`, `\copy`) : pgAdmin les rejette avec
-- `ERROR: syntax error at or near "\"`. Contrairement à la reprise OSM, aucune donnée n'est
-- embarquée — les cinq tables sont déjà en base.
--
-- ⚠️ **ESSAI À BLANC : remplacer le `COMMIT;` final par `ROLLBACK;`.** Le rapport s'affiche
-- quand même, rien n'est écrit.
--
-- ---------------------------------------------------------------------------------------------
-- CE QUI EST REPRIS, ET CE QUI NE L'EST PAS
-- ---------------------------------------------------------------------------------------------
-- État au 2026-09-02, après la reprise OSM (`Streets` à 403 lignes) :
--
--   | Table                           | tronçons | déjà couverts | à ajouter | voies |  km |
--   |---------------------------------|---------:|--------------:|----------:|------:|----:|
--   | voierie_tertiaire_non_bitumee   |    1 303 |           362 |       941 |   208 | 117 |
--   | voierie_tertiaire_bitumee       |       78 |            21 |        57 |    23 |  17 |
--   | voierie_extension               |       20 |             0 |        20 |     6 | 106 |
--   | voierie_secondaire              |       84 |            67 |        17 |    15 |  11 |
--   | route_principaux                |       23 |            19 |         4 |     4 |   4 |
--   |                                 |          |               |   **1039**| **256**|**255**|
--
-- **Le réseau NOMMÉ est déjà repris** : sur 352 tronçons nommés, 10 seulement échappent à la
-- couverture. La fusion du 2026-08-27 puis l'import OSM les ont absorbés. Ce qui reste est donc
-- du non-nommé à 99 %.
--
-- ---------------------------------------------------------------------------------------------
-- LA RUE SANS NOM EST UNE RUE
-- ---------------------------------------------------------------------------------------------
-- Décision d'Ashraf le 2026-09-02, qui REMPLACE la position antérieure du dépôt (« une rue sans
-- nom n'a pas d'identité dans Streets », commentaire de `basemap-groups.ts`) : l'absence de nom
-- n'exclut pas. Le schéma le permettait déjà — `Streets."Name"` est nullable — et le front le
-- gère : `closes.component.html` affiche une pastille « rue sans nom » et un style dédié.
--
-- Conséquence directe : le dédoublonnage ne peut plus s'appuyer sur le nom pour l'essentiel du
-- lot. Il est donc **géométrique** (§ `couverture`), et c'est le seul garde-fou. Le nom reste
-- utilisé quand il existe, en second test.
--
-- ---------------------------------------------------------------------------------------------
-- REGROUPEMENT DES TRONÇONS
-- ---------------------------------------------------------------------------------------------
-- Le SIG découpe une voie à chaque changement d'attribut : 941 tronçons de tertiaire non bitumée
-- font 124 m en moyenne. Insérés tels quels, ils donneraient 941 « rues » de la longueur d'un
-- immeuble. `ST_ClusterDBSCAN` rassemble ceux qui se touchent (1 m) : 1 039 tronçons → 256 voies,
-- 500 m de moyenne.
--
-- Le regroupement est fait PAR TABLE : une piste et un boulevard qui se croisent ne doivent pas
-- fusionner en une seule voie.
--
-- ---------------------------------------------------------------------------------------------
-- TYPE : un vocabulaire FERMÉ
-- ---------------------------------------------------------------------------------------------
-- Piste, Avenue, Rue, Impasse, Boulevard, Route — les seules valeurs que les filtres de
-- `map-style.json` savent dessiner. Une voie d'un autre type serait en base et invisible.
--
-- Le type vient du NOM DE LA TABLE, pas de la colonne `type_revet` : celle-ci est vide sur les
-- 1 303 tronçons de tertiaire non bitumée et sur 57 des 84 secondaires. S'y fier aurait produit
-- un type par défaut sur presque tout le lot.
--
-- ⚠️ Les `Piste` n'apparaissent qu'à partir du **zoom 12** (couche `streets-track`). 208 des 256
-- voies en sont : à l'échelle du pays, ce lot restera invisible. Ce n'est pas un bug d'import.

-- ⚠️ Rien n'est écrit avant le `BEGIN` : tout ce qui suit ne crée que des tables TEMPORAIRES,
-- effacées à la déconnexion. Elles sont créées HORS transaction — créées dedans, un `ROLLBACK`
-- d'essai à blanc les emporterait et la restitution finale échouerait.

CREATE TEMP TABLE sig AS
SELECT 'route_principaux' AS src, 'RP' AS abbrev, 'Route'::varchar(20) AS type_street,
       ogc_fid, nom, ST_Transform(wkb_geometry, 32638) AS g
FROM public.route_principaux
UNION ALL SELECT 'voierie_secondaire', 'VS', 'Boulevard', ogc_fid, nom, ST_Transform(wkb_geometry, 32638)
FROM public.voierie_secondaire
UNION ALL SELECT 'voierie_extension', 'VE', 'Route', ogc_fid, NULL, ST_Transform(wkb_geometry, 32638)
FROM public.voierie_extension
UNION ALL SELECT 'voierie_tertiaire_bitumee', 'VTB', 'Rue', ogc_fid, NULL, ST_Transform(wkb_geometry, 32638)
FROM public.voierie_tertiaire_bitumee
UNION ALL SELECT 'voierie_tertiaire_non_bitumee', 'VTNB', 'Piste', ogc_fid, nom, ST_Transform(wkb_geometry, 32638)
FROM public.voierie_tertiaire_non_bitumee;

-- Découpage sur le contour national, comme pour la reprise OSM : un tronçon de
-- `voierie_extension` (7 km) sort du pays. Sans cela, de la route étrangère entrerait au
-- référentiel NATIONAL. Ce script dépend donc de `contour_national` : l'appliquer avant
-- `contour-national-insert.sql` ne filtrerait rien.
UPDATE sig SET g = ST_CollectionExtract(
  ST_Intersection(g, ST_Transform((SELECT geom FROM public.contour_national LIMIT 1), 32638)), 2);
DELETE FROM sig WHERE g IS NULL OR ST_IsEmpty(g) OR ST_Length(g) < 10;
CREATE INDEX ON sig USING GIST (g);

CREATE TEMP TABLE rues AS
SELECT "Id", "Name", ST_Transform("Boundary", 32638) AS g
FROM public."Streets" WHERE "Boundary" IS NOT NULL;
CREATE INDEX ON rues USING GIST (g);

-- Dédoublonnage géométrique : quelle part du tronçon SIG longe déjà une rue du référentiel, à
-- 20 m près ? Au-delà de 70 %, la voie est considérée comme déjà présente. Mêmes seuils que
-- pour la reprise OSM — les garder identiques permet de comparer les deux lots.
CREATE TEMP TABLE couverture AS
SELECT s.src, s.ogc_fid,
       coalesce(ST_Length(ST_Intersection(s.g,
         (SELECT ST_Union(ST_Buffer(r.g, 20)) FROM rues r WHERE ST_DWithin(r.g, s.g, 20)))), 0)
         / NULLIF(ST_Length(s.g), 0) AS part
FROM sig s;

-- Regroupement des tronçons contigus, table par table.
CREATE TEMP TABLE grappes AS
SELECT s.src, s.abbrev, s.type_street, s.nom, s.ogc_fid, s.g,
       ST_ClusterDBSCAN(s.g, 1, 1) OVER (PARTITION BY s.src) AS grappe
FROM sig s JOIN couverture c ON c.src = s.src AND c.ogc_fid = s.ogc_fid
WHERE c.part <= 0.7;

-- Une ligne par voie. Le nom retenu est le plus fréquent de la grappe — sur une voie coupée en
-- 12, une saisie isolée ne doit pas l'emporter ; `NULL` si aucun tronçon n'est nommé.
CREATE TEMP TABLE voies AS
SELECT abbrev, type_street,
       -- Le numéro est le PLUS PETIT `ogc_fid` de la grappe, pas un rang de comptage. Un rang
       -- se décale dès qu'une voie apparaît ou disparaît en amont : au lot SIG suivant, les
       -- codes désigneraient d'autres voies, et le filet anti-collision écarterait en silence
       -- des voies légitimes. `ogc_fid` est stable et remonte à la ligne source d'origine.
       min(ogc_fid) AS numero,
       (SELECT g2.nom FROM grappes g2
         WHERE g2.src = g.src AND g2.grappe = g.grappe AND g2.nom IS NOT NULL
         GROUP BY g2.nom ORDER BY count(*) DESC, g2.nom LIMIT 1) AS nom,
       ST_Multi(ST_LineMerge(ST_Union(ST_Transform(g.g, 4326)))) AS geom
FROM grappes g
GROUP BY src, abbrev, type_street, grappe;

-- Second garde-fou, sur le NOM cette fois : une voie nommée dont le nom existe déjà au
-- référentiel n'est pas insérée, même si sa géométrie ne recouvre pas l'existante. Concerne une
-- poignée de cas, mais c'est le doublon le plus visible à l'écran.
CREATE TEMP TABLE a_inserer AS
SELECT v.*, 'SIG-' || v.abbrev || '-' || lpad(v.numero::text, 5, '0') AS code
FROM voies v
WHERE v.nom IS NULL
   OR NOT EXISTS (SELECT 1 FROM public."Streets" s
                  WHERE upper(btrim(s."Name")) = upper(btrim(v.nom)));

CREATE TEMP TABLE rapport(ordre int, section text, detail text, valeur text);

INSERT INTO rapport
SELECT 1, 'bilan', 'troncons SIG (dans le pays)', count(*)::text FROM sig
UNION ALL SELECT 2, 'bilan', 'deja couverts par Streets', count(*)::text FROM couverture WHERE part > 0.7
UNION ALL SELECT 3, 'bilan', 'voies apres regroupement', count(*)::text FROM voies
UNION ALL SELECT 4, 'bilan', '  dont nommees', count(*)::text FROM voies WHERE nom IS NOT NULL
UNION ALL SELECT 5, 'bilan', 'ecartees car nom deja au referentiel', (count(*) - (SELECT count(*) FROM a_inserer))::text FROM voies
UNION ALL SELECT 6, 'bilan', 'A INSERER', count(*)::text FROM a_inserer;

INSERT INTO rapport
SELECT 7, 'par type', type_street, count(*) || ' voies, ' || round(sum(ST_Length(geom::geography))/1000) || ' km'
FROM a_inserer GROUP BY type_street;

-- Seules les écritures qui suivent sont dans la transaction.
BEGIN;

INSERT INTO public."Streets" ("Id", "Code", "Name", "Type", "Boundary")
SELECT gen_random_uuid(), a.code, a.nom, a.type_street, a.geom
FROM a_inserer a
-- Filet : un `Code` déjà pris ferait échouer tout le lot.
WHERE NOT EXISTS (SELECT 1 FROM public."Streets" s WHERE s."Code" = a.code);

-- Remplacer par ROLLBACK pour un essai à blanc.
COMMIT;

INSERT INTO rapport
SELECT 8, 'Streets apres ecriture', "Type", count(*) || ' lignes, ' || count("Boundary") || ' avec geometrie'
FROM public."Streets" GROUP BY "Type";

SELECT section, detail, valeur FROM rapport ORDER BY ordre, detail;
