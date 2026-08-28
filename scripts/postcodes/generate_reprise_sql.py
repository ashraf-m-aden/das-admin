# -*- coding: utf-8 -*-
"""
Genere le SQL de reprise du plan de numerotation de Djibouti-ville.

Le script ne decrit pas une passe, il decrit un ETAT CIBLE : il est rejouable et
converge, que la base ait deja recu une reprise partielle ou non.

Perimetre (arbitrages d'Ashraf, 2026-08-27) :
  - appariements par normalisation stricte ET par alias relu : appliques ;
  - quartiers manquants retrouves dans delimitations_quartiers, graphie exacte ou
    approchante validee : crees avec leur emprise ;
  - EXCLUS porte le reste, avec le motif : ce ne sont pas des lectures de nom mais
    des decisions de territoire ou des ambiguites de decoupage.

Usage: python scripts/postcodes/generate_reprise_sql.py <concordance.json> <sortie.sql>
"""
import json
import sys

VILLE = 'Djibouti'
METHODES = {'normalisation', 'alias'}

# Les zones du plan. "Aires speciales" existe DEUX FOIS, une par commune concernee :
# une zone est une partie d'une commune ("Zones"."CommuneId" NOT NULL), donc le Dry Port
# (Boulaos) et le Cimetiere (Balbala) ne peuvent pas partager la meme.
ZONES = [
    ('Ras-Dika 1',      'Z1', 'RAS DIKA'),
    ('Boulaos 2',       'Z2', 'BOULAOS'),
    ('Boulaos 3',       'Z3', 'BOULAOS'),
    ('Boulaos 4',       'Z4', 'BOULAOS'),
    ('Balbala 5',       'Z5', 'BALBALA'),
    ('Balbala 6',       'Z6', 'BALBALA'),
    ('Aires speciales', 'Z9', 'BOULAOS'),
    ('Aires speciales', 'Z9', 'BALBALA'),
]

ZONE_CODE = {'ras-dika-1': 'Z1', 'boulaos-2': 'Z2', 'boulaos-3': 'Z3', 'boulaos-4': 'Z4',
             'balbala-5': 'Z5', 'balbala-6': 'Z6', 'special-9': 'Z9'}

# Commune de repli, utilisee seulement quand le quartier n'en a pas en base.
# `special-9` n'y figure pas : ses deux quartiers ont deja leur commune, et le plan
# ne se prononce pas sur les aires speciales.
COMMUNE_REPLI = {'ras-dika-1': 'RAS DIKA', 'boulaos-2': 'BOULAOS', 'boulaos-3': 'BOULAOS',
                 'boulaos-4': 'BOULAOS', 'balbala-5': 'BALBALA', 'balbala-6': 'BALBALA'}

# Quartiers absents de "Quartiers" mais presents dans delimitations_quartiers.
# (nom SIG, code, areaNumber, commune, zone). Le nom SIG fait foi : les 74 lignes deja
# en base viennent de la meme source, introduire la graphie du xlsx creerait deux
# conventions. Les 3 premiers sont des graphies exactes, les 7 suivants des graphies
# approchantes relues et validees.
CREATIONS = [
    ('Dôgley',            'DG', 507, 'BALBALA', 'Z5'),
    ('Place Mahadsanid',  'PM', 515, 'BALBALA', 'Z5'),
    ('Shabeley',          'SH', 602, 'BALBALA', 'Z6'),
    ('Cité Doumeira',     'DO', 503, 'BALBALA', 'Z5'),
    ('Warabley',          'WB', 505, 'BALBALA', 'Z5'),
    ('Layableh',          'LY', 506, 'BALBALA', 'Z5'),
    ('Nasib Wanag',       'NW', 514, 'BALBALA', 'Z5'),
    ('Harirad',           'HI', 516, 'BALBALA', 'Z5'),
    ('Cité Gar Gar',      'GG', 601, 'BALBALA', 'Z6'),
    ('Cité Cheikh Osman', 'CQ', 618, 'BALBALA', 'Z6'),  # CO deja pris par Cite Progres
]

# areaNumber ecartes, avec le motif. Aucun ne releve d'une lecture de nom.
EXCLUS = {
    207: "Brise de mer : le plan la rattache a Boulaos, la base a Ras Dika. "
         "Changer la commune d'un quartier est une decision de territoire.",
    311: "Brise de mer 2 : viserait le meme quartier que 207, un quartier ne porte "
         "qu'un areaNumber.",
    403: "Gabode : le plan en compte un, la base cinq (Gabode 1 a 5). Choisir lequel "
         "porte 403 est arbitraire.",
    408: "Fiyetnam -> Vietnam : le SIG place Vietnam a Balbala, le plan met 4xx a Boulaos.",
    616: "Barwaqo 2 : viserait Cite Barwaqo, qui porte deja 509.",
}


def q(s):
    return "'" + s.replace("'", "''") + "'"


def main(concordance_path, out_path):
    conc = json.load(open(concordance_path, encoding='utf-8'))
    maj = [r for r in conc['concordance']
           if r['methode'] in METHODES and r['areaNumber'] not in EXCLUS]

    cibles = []
    for r in maj:
        # La commune en base prime : elle vient du SIG et decrit le territoire reel.
        # Le plan ne sert de repli que pour les quartiers qui n'en ont aucune.
        commune = r['communeBase'] or COMMUNE_REPLI.get(r['zoneCle'])
        if commune is None:
            raise SystemExit(f"{r['nomBase']} : ni commune en base ni repli pour "
                             f"{r['zoneCle']}")
        attendue = COMMUNE_REPLI.get(r['zoneCle'])
        if r['communeBase'] and attendue and r['communeBase'] != attendue:
            raise SystemExit(f"desaccord de commune sur {r['nomBase']} : "
                             f"base={r['communeBase']} plan={attendue} — a mettre dans EXCLUS")
        cibles.append((r['quartierId'], r['areaNumber'], ZONE_CODE[r['zoneCle']],
                       commune, r['nomBase']))

    lignes = []
    w = lignes.append
    w('-- Etat cible du plan de numerotation - Djibouti-ville')
    w('-- Genere par scripts/postcodes/generate_reprise_sql.py, ne pas editer a la main.')
    w(f'-- {len(cibles)} quartiers numerotes, {len(CREATIONS)} crees, {len(ZONES)} zones.')
    w('-- Ecartes : ' + ', '.join(str(a) for a in sorted(EXCLUS)) + ' (voir EXCLUS dans le script).')
    w('')
    w('BEGIN;')
    w("SET LOCAL statement_timeout = '120s';")
    w('')

    w('-- 1. Les zones. Une zone sans quartier est un etat normal (guide 3.2).')
    w('INSERT INTO "Zones" ("Id", "Name", "Code", "CommuneId", "CityId")')
    w('SELECT gen_random_uuid(), v.name, v.code, c."Id", c."CityId"')
    w('FROM (VALUES')
    w(',\n'.join(f'    ({q(n)}, {q(c)}, {q(cm)})' for n, c, cm in ZONES))
    w(') AS v(name, code, commune)')
    w('JOIN "Communes" c ON c."Name" = v.commune')
    w('WHERE NOT EXISTS (')
    w('  SELECT 1 FROM "Zones" z WHERE z."CommuneId" = c."Id" AND z."Code" = v.code')
    w(');')
    w('')

    # Le nom va en commentaire PREFIXE : en suffixe, la virgule de separation tombe
    # derriere le `--` et se retrouve commentee, ce qui casse la liste VALUES.
    largeur = max(len(n) for *_, n in cibles)
    ids = ',\n'.join(f'    /* {n:<{largeur}} */ ({q(i)}::uuid, {a}, {q(zc)}, {q(cm)})'
                     for i, a, zc, cm, n in cibles)

    w('-- 2. Liberation prealable des AreaNumber repris. "IX_Quartiers_CityId_AreaNumber"')
    w('--    est UNIQUE et non differable : sans ce passage a NULL, les permutations')
    w('--    (Quartier 7 101 -> 310 libere 101 pour Heron) echoueraient en collision.')
    w('CREATE TEMP TABLE reprise_cible (')
    w('  quartier_id uuid PRIMARY KEY, area integer, zone_code text, commune text')
    w(') ON COMMIT DROP;')
    w('INSERT INTO reprise_cible (quartier_id, area, zone_code, commune) VALUES')
    w(ids + ';')
    w('')
    w('UPDATE "Quartiers" SET "AreaNumber" = NULL')
    w('WHERE "Id" IN (SELECT quartier_id FROM reprise_cible);')
    w('')

    w('-- 3. AreaNumber + zone. La commune est posee explicitement : une zone sans commune')
    w('--    est refusee par le contrat, et deux quartiers sont en base sans commune.')
    w('UPDATE "Quartiers" q')
    w('SET "AreaNumber" = t.area,')
    w('    "ZoneId"     = z."Id",')
    w('    "CommuneId"  = c."Id"')
    w('FROM reprise_cible t')
    w('JOIN "Communes" c ON c."Name" = t.commune')
    w('JOIN "Zones" z ON z."Code" = t.zone_code AND z."CommuneId" = c."Id"')
    w('WHERE q."Id" = t.quartier_id;')
    w('')

    w('-- 4. Les quartiers manquants retrouves dans le SIG, avec leur emprise.')
    w('--    delimitations_quartiers est en 32638 MULTIPOLYGON, "Quartiers"."Boundary" en')
    w('--    4326 POLYGON : toutes ces emprises sont mono-partie et valides, verifie en amont.')
    w('INSERT INTO "Quartiers" ("Id", "Nom", "Code", "AreaNumber", "CityId", "CommuneId", "ZoneId", "Boundary")')
    w('SELECT gen_random_uuid(), v.nom, v.code, v.area, c."CityId", c."Id", z."Id",')
    w('       ST_Force2D(ST_Transform(ST_GeometryN(d.wkb_geometry, 1), 4326))')
    w('FROM (VALUES')
    w(',\n'.join(f'    ({q(n)}, {q(c)}, {a}, {q(cm)}, {q(zc)})' for n, c, a, cm, zc in CREATIONS))
    w(') AS v(nom, code, area, commune, zone_code)')
    w('JOIN "Communes" c ON c."Name" = v.commune')
    w('JOIN "Zones" z ON z."Code" = v.zone_code AND z."CommuneId" = c."Id"')
    w('JOIN delimitations_quartiers d ON d.nom = v.nom')
    w('WHERE NOT EXISTS (')
    w('  SELECT 1 FROM "Quartiers" x WHERE x."CityId" = c."CityId" AND x."Nom" = v.nom')
    w(');')
    w('')

    w('-- 5. Garde-fous. Toute violation annule la transaction entiere.')
    w('DO $garde$')
    w('DECLARE n integer;')
    w('BEGIN')
    w('  SELECT count(*) INTO n FROM "Quartiers" q')
    w('  JOIN reprise_cible t ON t.quartier_id = q."Id"')
    w('  WHERE q."AreaNumber" IS DISTINCT FROM t.area OR q."ZoneId" IS NULL;')
    w("  IF n <> 0 THEN RAISE EXCEPTION '% quartiers repris non conformes', n; END IF;")
    w('')
    areas = ', '.join(str(a) for _, _, a, _, _ in CREATIONS)
    w(f'  SELECT count(*) INTO n FROM "Quartiers" WHERE "AreaNumber" IN ({areas})')
    w('    AND "CityId" = (SELECT "Id" FROM "Cities" WHERE "Name" = ' + q(VILLE) + ');')
    w(f"  IF n <> {len(CREATIONS)} THEN RAISE EXCEPTION 'creations manquantes : % sur {len(CREATIONS)}', n; END IF;")
    w('')
    w('  SELECT count(*) INTO n FROM (')
    w('    SELECT "CityId", "AreaNumber" FROM "Quartiers"')
    w('    WHERE "AreaNumber" IS NOT NULL')
    w('    GROUP BY 1, 2 HAVING count(*) > 1) s;')
    w("  IF n <> 0 THEN RAISE EXCEPTION 'AreaNumber en doublon dans une ville'; END IF;")
    w('')
    w('  SELECT count(*) INTO n FROM "Quartiers"')
    w('  WHERE "ZoneId" IS NOT NULL AND "CommuneId" IS NULL;')
    w("  IF n <> 0 THEN RAISE EXCEPTION 'quartier avec zone mais sans commune'; END IF;")
    w('')
    w('  SELECT count(*) INTO n FROM "Quartiers" q JOIN "Zones" z ON z."Id" = q."ZoneId"')
    w('  WHERE z."CommuneId" <> q."CommuneId";')
    w("  IF n <> 0 THEN RAISE EXCEPTION 'zone hors de la commune du quartier'; END IF;")
    w('END $garde$;')
    w('')
    w('COMMIT;')
    w('')

    open(out_path, 'w', encoding='utf-8').write('\n'.join(lignes) + '\n')
    print(f'{len(cibles)} numerotes, {len(CREATIONS)} creations, {len(ZONES)} zones -> {out_path}')
    for a in sorted(EXCLUS):
        print(f'  ecarte {a} : {EXCLUS[a].splitlines()[0]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
