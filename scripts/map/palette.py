"""Palette du fond de carte DAS, calquée sur le rendu Google Maps clair.

Une seule source de vérité : `commercial-style.json` (vitrine) et les couches de
fond de `map-style.json` (admin) sont générés à partir d'ici, pour qu'un
changement de teinte ne parte pas en divergence entre les deux fichiers.
"""

C = {
    "water": "#a8d3f0",        # mer et plans d'eau
    "land": "#f7f6f3",         # terre émergée
    "urban": "#f2f0ec",        # tache urbaine (villes)
    "block": "#ebe8e2",        # îlots bâtis
    "block_line": "#e0dcd4",
    "parcel": "#e4e0d8",       # parcelles (texture "bâtiments" au zoom fort)
    "parcel_line": "#d8d2c8",
    "road_fill": "#ffffff",
    "road_case": "#cfd4da",
    "road_case_soft": "#e3e6ea",
    "trunk_fill": "#fbd97e",   # réseau principal, ambre Google
    "trunk_case": "#e9bc55",
    "track_fill": "#f0eae1",   # pistes
    "track_case": "#ded5c8",
    "boundary": "#cfd4da",
    "coast": "#8fb8d8",
    "label": "#5f6368",        # gris texte Google
    "label_strong": "#3c4043",
    "label_soft": "#80868b",
    "halo": "#ffffff",
}

POI_COLORS = {
    "education": "#4285f4",
    "sante": "#ea4335",
    "culte": "#8e6ff0",
    "administration": "#5f6368",
    "commerce": "#fbbc04",
    "transport": "#34a853",
    "securite": "#1a73e8",
    "finance": "#0f9d58",
    "hebergement": "#e8710a",
    "sport": "#188038",
    "culture": "#d01884",
}

# Codes postaux : le seul endroit du fond vitrine où l'on sort du gris Google.
# C'est délibéré — sur cette carte, le code postal EST le produit, pas une
# annotation. Le bleu est celui du logo D.A.S (`carte-publique.component.scss`).
POSTCODE = {
    "code": "#123c86",          # le code lui-même, au zoom de quartier
    "watermark": "#123c86",     # le préfixe ville en filigrane, au dézoom
    "pending_text": "#a4763a",  # « code à venir » — ambre, ni rouge ni gris
    "selection": "#123c86",
}

GLYPHS = "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf"
# Piles de polices composites. MapLibre concatène le tableau avec des virgules
# pour former `{fontstack}` : le CDN sert alors le premier glyphe trouvé, police
# par police. C'est ce qui rend l'arabe possible sans changer le rendu latin.
#
# Mesuré sur le CDN le 2026-09-09, plage arabe U+0600–06FF (`1536-1791.pbf`) :
#   Open Sans Regular ............  52 octets → AUCUN glyphe arabe
#   Open Sans Bold ...............  49 octets → AUCUN glyphe arabe
#   Noto Sans Regular ............  52 349 octets → couverture complète
#   Noto Sans Bold ...............  404, la police n'existe pas ici
#
# D'où le gras composé `Open Sans Bold` + `Noto Sans Regular` : gras en latin,
# romain en arabe. Il n'existe pas de gras arabe sur ce CDN ; mieux vaut un
# arabe lisible en romain qu'un rang de carrés vides.
FONT_REGULAR = ["Open Sans Regular", "Noto Sans Regular"]
FONT_BOLD = ["Open Sans Bold", "Noto Sans Regular"]
TILES = "__TILES_BASE_URL__"
BOUNDS = [41.70, 10.85, 43.50, 12.80]
