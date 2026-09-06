# -*- coding: utf-8 -*-
"""Reecrit les dumps GDAL de l'expert SIG (schema public) vers le schema 'nour'."""
import os, re, sys

SRC = r"C:\Users\Ashraf\Downloads"
OUT = r"D:\projet\angular project\das\sig-nour"

# (fichier source, table dans le dump, table cible dans nour, ordre)
MAP = [
    ("FRONTIERE.sql",      "frontiere",      "frontiere",             10),
    ("ContourRDD.sql",     "contourrdd",     "contour_rdd",           11),
    ("LAKE.sql",           "lake",           "lacs",                  12),
    ("BANQUISEL.sql",      "banquisel",      "banquise_sel",          13),
    ("FORETS.sql",         "forets",         "forets",                14),
    ("OUEDPRINCIPAUX.sql", "ouedprincipaux", "oueds_principaux",      15),
    ("ROUTES1.sql",        "routes1",        "routes_1",              16),
    ("ROUTES2.sql",        "routes2",        "routes_2",              17),
    ("PISTES1.sql",        "pistes1",        "pistes_1",              18),
    ("PISTES2.sql",        "pistes2",        "pistes_2",              19),
    ("CHEMINFER.sql",      "cheminfer",      "chemin_fer",            20),
    ("VILLE.sql",          "ville",          "villes_pt",             21),
    ("VILLAGE.sql",        "village",        "villages_pt",           22),
    ("POSTADMINST.sql",    "postadminst",    "postes_administratifs", 23),
    ("VILLE (1).sql",      "ville",          "quartiers_ville_pg",    30),
    ("ILOTS.sql",          "ilots",          "ilots_src",             31),
    ("Parcels.sql",        "parcels",        "parcelles_src",         32),

    # --- Livraison du 2026-09-06 : trois villes secondaires ---------------------------------
    # Six familles x trois villes. Le suffixe du fichier ne dit PAS la ville : l'appariement
    # ci-dessous a ete etabli en mesurant l'emprise de chaque table apres chargement.
    #   a = Ali Sabieh    b = Tadjourah    c = Dikhil
    # Trois fichiers creent tous "public"."batiment_dur", trois autres "public"."piste" et deux
    # "public"."route" : charges tels quels dans le meme schema, chacun DETRUIT le precedent.
    # C'est la meme collision que les deux VILLE.sql d'aout.
    ("Batiment_Dur.sql",             "batiment_dur",               "bat_dur_a",    40),
    ("Batiment_Dur (1).sql",         "batiment_dur",               "bat_dur_b",    41),
    ("Batiment_Dur (2).sql",         "batiment_dur",               "bat_dur_c",    42),
    ("Batiment_Legers.sql",          "batiment_legers",            "bat_legers_a", 43),
    ("Batiment_Legers (1).sql",      "batiment_legers",            "bat_legers_b", 44),
    ("Batiment_Legers (2).sql",      "batiment_legers",            "bat_legers_c", 45),
    ("Batiment_equip_socio.sql",     "batiment_equip_socio",       "bat_socio_a",  46),
    ("batiment_equip_socio (1).sql", "batiment_equip_socio",       "bat_socio_b",  47),
    ("Batiment_socio_collec.sql",    "batiment_socio_collec",      "bat_socio_c",  48),
    ("Batiment_indust_tourism.sql",  "batiment_indust_tourism",    "bat_indus_a",  49),
    ("batiment_industrie_tourism.sql","batiment_industrie_tourism","bat_indus_b",  50),
    ("Batiment_indus_tourism.sql",   "batiment_indus_tourism",     "bat_indus_c",  51),
    ("Route.sql",                    "route",                      "route_a",      52),
    ("Route (1).sql",                "route",                      "route_b",      53),
    ("ROUTE_TAJ.sql",                "route_taj",                  "route_taj",    54),
    ("Piste.sql",                    "piste",                      "piste_a",      55),
    ("Piste (1).sql",                "piste",                      "piste_b",      56),
    ("Piste (2).sql",                "piste",                      "piste_c",      57),
]

def rewrite(path, old, new):
    with open(path, "rb") as f:
        data = f.read()
    o, n = old.encode(), new.encode()
    data = data.replace(b'"public"."%s"' % o, b'"nour"."%s"' % n)
    data = data.replace(b"'public','%s'" % o, b"'nour','%s'" % n)
    data = data.replace(b'"%s_pk"' % o, b'"%s_pk"' % n)
    data = data.replace(b'"%s_wkb_geometry_geom_idx"' % o, b'"%s_wkb_geometry_geom_idx"' % n)

    # Les dumps declarent des types plus etroits que leurs propres valeurs :
    # ContourRDD.area est NUMERIC(13,11) (max 99.99...) pour des surfaces a
    # 2040.83 -> "numeric field overflow" au chargement. On relache la precision
    # sur les ADD COLUMN, comme le faisaient deja les dumps codifies d'aout.
    # Les valeurs sont conservees telles quelles.
    data = re.sub(rb'(ADD COLUMN "[^"]+" NUMERIC)\(\d+,\d+\)', rb'\1', data)
    data = re.sub(rb'(ADD COLUMN "[^"]+" VARCHAR)\(\d+\)', rb'\1', data)
    return data

os.makedirs(OUT, exist_ok=True)
for fname, old, new, idx in MAP:
    src = os.path.join(SRC, fname)
    if not os.path.exists(src):
        print("MANQUANT:", src); continue
    data = rewrite(src, old, new)
    # controle : plus aucune reference a public
    leftovers = re.findall(rb'"public"\."\w+"|\'public\',\'\w+\'', data)
    dst = os.path.join(OUT, "%02d_%s.sql" % (idx, new))
    with open(dst, "wb") as f:
        f.write(data)
    print("%-24s -> %-26s %8d INSERT  residus_public=%d" %
          (fname, os.path.basename(dst), data.count(b"INSERT INTO"), len(leftovers)))
