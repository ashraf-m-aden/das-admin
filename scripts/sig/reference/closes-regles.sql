SET statement_timeout='25min';
CREATE TEMP TABLE b AS
SELECT b."Id" AS bloc_id, b."QuartierId" AS qid, ST_Transform(b."Boundary",32638) AS g,
       ST_PointOnSurface(ST_Transform(b."Boundary",32638)) AS pt,
       ST_Area(ST_Transform(b."Boundary",32638)) AS aire,
       (SELECT count(*) FROM public."Adresses" a WHERE a."BlocId"=b."Id") AS parcelles
FROM public."Blocs" b JOIN public."Quartiers" q ON q."Id"=b."QuartierId"
JOIN public."Cities" c ON c."Id"=q."CityId"
WHERE c."Name"='Djibouti' AND b."Boundary" IS NOT NULL;
CREATE INDEX ON b USING GIST (g); CREATE INDEX ON b (qid); ANALYZE b;

CREATE TEMP TABLE rue AS
SELECT s."Id" AS rid, ST_LineMerge(ST_Transform(s."Boundary",32638)) AS g
FROM public."Streets" s WHERE s."Boundary" IS NOT NULL
  AND s."Code" NOT LIKE 'SIG-RT%' AND s."Code" NOT LIKE 'SIG-PI%' AND s."Code" NOT LIKE 'SIG-VE-%'
  AND s."Code" NOT LIKE 'OSM-ROUTE-%' AND s."Code" NOT LIKE 'OSM-PISTE-%';
DELETE FROM rue WHERE ST_GeometryType(g) <> 'ST_LineString';
CREATE INDEX ON rue USING GIST (g); ANALYZE rue;

-- REGLE 2 : desserte par quartier, puis filtre conditionnel.
CREATE TEMP TABLE d AS
SELECT b.qid, p.rid, count(*) AS n
FROM b CROSS JOIN LATERAL (SELECT r.rid FROM rue r ORDER BY b.g <-> r.g LIMIT 1) p
GROUP BY b.qid, p.rid;
CREATE TEMP TABLE medq AS
SELECT qid, percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS med FROM d GROUP BY qid;
CREATE TEMP TABLE gard AS
SELECT d.qid, d.rid FROM d JOIN medq m ON m.qid=d.qid WHERE m.med > 2 OR d.n >= 8;
CREATE INDEX ON gard (qid);

-- REGLE 1 : close = (quartier, rue, cote)
CREATE TEMP TABLE ap AS
SELECT b.*, p.rid,
       CASE WHEN (ST_X(p.p2)-ST_X(p.p1))*(ST_Y(b.pt)-ST_Y(p.p1))
               - (ST_Y(p.p2)-ST_Y(p.p1))*(ST_X(b.pt)-ST_X(p.p1)) >= 0 THEN 'G' ELSE 'D' END AS cote
FROM b CROSS JOIN LATERAL (
  SELECT r.rid,
         ST_LineInterpolatePoint(r.g, greatest(0, ST_LineLocatePoint(r.g,b.pt)-0.02)) AS p1,
         ST_LineInterpolatePoint(r.g, least(1, ST_LineLocatePoint(r.g,b.pt)+0.02)) AS p2
  FROM rue r JOIN gard gk ON gk.rid=r.rid AND gk.qid=b.qid
  ORDER BY b.g <-> r.g LIMIT 1) p;
CREATE TEMP TABLE cle AS SELECT *, qid::text||'|'||rid::text||'|'||cote AS k FROM ap;
CREATE INDEX ON cle (k); CREATE INDEX ON cle USING GIST (g); ANALYZE cle;

-- REGLE 3 : close valide si >= 2 blocs, ou 1 bloc >= 10 000 m2 ET > 8 parcelles.
CREATE TEMP TABLE valide AS
SELECT k FROM cle GROUP BY k
HAVING count(*) >= 2 OR (count(*)=1 AND max(aire) >= 10000 AND max(parcelles) > 8);

-- REGLE 4 : les orphelins se regroupent ENTRE EUX, a moins de 10 m.
CREATE TEMP TABLE orph AS
SELECT c.bloc_id, c.qid, c.g, c.bloc_id::text AS grp FROM cle c WHERE c.k NOT IN (SELECT k FROM valide);
CREATE INDEX ON orph USING GIST (g); CREATE INDEX ON orph (bloc_id);
CREATE TEMP TABLE lien AS
SELECT a.bloc_id AS x, z.bloc_id AS y FROM orph a JOIN orph z
  ON z.qid=a.qid AND z.bloc_id>a.bloc_id AND ST_DWithin(a.g,z.g,10);
CREATE INDEX ON lien (x); CREATE INDEX ON lien (y);
DO $$
DECLARE n int;
BEGIN
  LOOP
    CREATE TEMP TABLE maj AS
    SELECT o.bloc_id, least(o.grp, coalesce(min(v.grp), o.grp)) AS grp FROM orph o
    LEFT JOIN (SELECT x AS a, y AS z FROM lien UNION ALL SELECT y, x FROM lien) e ON e.a=o.bloc_id
    LEFT JOIN orph v ON v.bloc_id=e.z GROUP BY o.bloc_id, o.grp;
    UPDATE orph o SET grp=m.grp FROM maj m WHERE m.bloc_id=o.bloc_id AND m.grp<>o.grp;
    GET DIAGNOSTICS n = ROW_COUNT; DROP TABLE maj; EXIT WHEN n=0;
  END LOOP;
END $$;

\echo '════════ DJIBOUTI — regles figees'
SELECT (SELECT count(*) FROM valide) AS closes_regle_rue,
       (SELECT count(*) FROM (SELECT grp FROM orph GROUP BY grp HAVING count(*)>=2) z) AS closes_rattrapage,
       (SELECT count(*) FROM valide) + (SELECT count(*) FROM (SELECT grp FROM orph GROUP BY grp HAVING count(*)>=2) z) AS total,
       (SELECT count(*) FROM orph WHERE grp IN (SELECT grp FROM orph GROUP BY grp HAVING count(*)=1)) AS non_rattaches,
       (SELECT count(*) FROM b) AS blocs;

COPY (
  WITH par AS (
    SELECT c.qid, count(DISTINCT c.k) FILTER (WHERE c.k IN (SELECT k FROM valide)) AS c_rue,
           count(*) FILTER (WHERE c.k IN (SELECT k FROM valide)) AS b_rue
    FROM cle c GROUP BY c.qid),
  ratt AS (
    SELECT qid, count(*) FILTER (WHERE t.n>=2) AS c_ratt, coalesce(sum(t.n) FILTER (WHERE t.n>=2),0) AS b_ratt,
           coalesce(sum(t.n) FILTER (WHERE t.n=1),0) AS seuls
    FROM (SELECT qid, grp, count(*) AS n FROM orph GROUP BY qid, grp) t GROUP BY qid)
  SELECT q."Nom" AS quartier, q."Code" AS code,
         coalesce(p.c_rue,0)+coalesce(r.c_ratt,0) AS closes_attendues,
         coalesce(p.c_rue,0) AS dont_regle_rue, coalesce(r.c_ratt,0) AS dont_rattrapage,
         (SELECT count(*) FROM b WHERE b.qid=q."Id") AS blocs,
         coalesce(r.seuls,0) AS non_rattaches
  FROM public."Quartiers" q
  LEFT JOIN par p ON p.qid=q."Id" LEFT JOIN ratt r ON r.qid=q."Id"
  WHERE EXISTS (SELECT 1 FROM b WHERE b.qid=q."Id")
  ORDER BY 6 DESC
) TO STDOUT WITH CSV HEADER;
