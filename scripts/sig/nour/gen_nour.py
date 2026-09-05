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
