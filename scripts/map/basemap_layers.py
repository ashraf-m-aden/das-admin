"""Couches du fond de carte (mer, terre, bâti, voirie, libellés) façon Google.

Consommé par `build_styles.py` SEUL, qui en tire un style PAR LANGUE. Le style
admin est aligné séparément par `patch_admin_style.py`, qui porte ses propres
couches : rien d'ajouté ici ne fuit vers `map-style.json`.
"""
from palette import C, POI_COLORS, POSTCODE, FONT_BOLD, FONT_REGULAR, TILES

# Motif de hachure des quartiers sans code postal. L'image n'est PAS dans un
# sprite : elle est peinte sur un canvas par `carte-publique.component.ts` en
# réponse à `styleimagemissing`. Le nom doit rester identique des deux côtés.
HACHURE = "das-hachure-code-a-venir"


def sources() -> dict:
    """Les CINQ sources que le relais public sert, et pas une de plus.

    ⚠️ `/api/public/tiles/` applique une LISTE BLANCHE côté back : cinq sources y
    sont déclarées, et toute autre rend 404 — la même réponse qu'une source
    inexistante, pour ne pas apprendre au partenaire ce qui existe derrière.
    Une source ajoutée ici sans l'être là-bas ne se signale donc PAS : la couche
    reste simplement vide, et le fond a l'air incomplet sans qu'aucune erreur ne
    le dise.

    Ce qui a été retiré pour tenir dans la liste, et qui demande une ouverture
    back avant de revenir : `contour_national` (terre et trait de côte),
    `cities_tiles`, `route_principaux` et `voierie_secondaire` (réseau structurant
    au dézoom), `blocs_tiles` (îlots). Voir `docs/carte-vitrine.md`.

    `poi_sites_tiles` et non `poi_tiles` : la vue de sites REGROUPE les bâtiments
    d'un même lieu — 961 bâtiments deviennent 560 sites, l'Université de Djibouti
    passe de 72 pastilles à une seule. Le regroupement est fait en base parce que
    MapLibre ne sait agréger que des sources GeoJSON, jamais des tuiles.
    """

    def vec(name, minzoom, maxzoom):
        return {
            "type": "vector",
            "tiles": [f"{TILES}/{name}/{{z}}/{{x}}/{{y}}"],
            "minzoom": minzoom,
            "maxzoom": maxzoom,
        }

    return {
        "citiesLabels": vec("cities_labels_tiles", 4, 14),
        "quartiers": vec("quartiers_tiles", 9, 20) | {"promoteId": "Id"},
        "streets": vec("streets_tiles", 12, 20) | {"promoteId": "Id"},
        "adresses": vec("adresses_tiles", 15, 20) | {"promoteId": "Id"},
        "poi": vec("poi_sites_tiles", 12, 20),
    }


def _line(width_stops):
    return ["interpolate", ["exponential", 1.5], ["zoom"], *width_stops]


def ground() -> list:
    """Terre, tache urbaine, parcelles : le sol sur lequel tout le reste se pose.

    ⚠️ **Pas de mer ici, et c'est une amputation assumée.** Le trait de côte vient
    de `contour_national`, qui n'est pas dans la liste blanche publique : sans lui,
    peindre le fond en bleu couvrirait tout le pays d'eau. Le fond est donc la
    terre, et le golfe de Tadjoura ne se distingue pas du désert. Rendre la mer au
    style vitrine demande d'ouvrir `contour_national` sur `/api/public/tiles/` —
    le style admin, lui, l'a déjà (`patch_admin_style.py`).
    """
    return [
        {"id": "bg-land", "type": "background", "paint": {"background-color": C["land"]}},
        {
            "id": "quartiers-fill",
            "type": "fill",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 9,
            "paint": {"fill-color": C["urban"], "fill-opacity": 0.95},
        },
        # Quartiers SANS code postal : hachurés, jamais laissés vides. Mesuré le
        # 2026-09-09 sur `quartiers_tiles` : 23 des 79 emprises dessinables n'ont pas
        # de code — 21 à Djibouti (`AreaNumber` absent : Gabode 1 à 5, Boulaos, les
        # Cités Wadagir…), plus Dikhil et Tadjourah dont la ville n'a pas de `Code`.
        # Un blanc se lirait comme un bug de rendu chez le partenaire ; une hachure
        # se lit comme une information — le vide est un état, pas un défaut.
        {
            "id": "quartiers-sans-code",
            "type": "fill",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 10,
            "filter": ["!", ["has", "Postcode"]],
            "paint": {"fill-pattern": HACHURE, "fill-opacity": 0.75},
        },
        # Le préfixe ville en filigrane : `77` pour Djibouti, `78` pour Ali Sabieh.
        # C'est la première moitié du code postal (`77` + `003` = `77003`), donc
        # le dézoom montre littéralement la même donnée que le zoom, tronquée.
        # Placé AVANT la voirie pour que les rues passent par-dessus : c'est un
        # filigrane du sol, pas une étiquette.
        {
            "id": "postcode-watermark",
            "type": "symbol",
            "source": "citiesLabels",
            "source-layer": "cities_labels_tiles",
            "minzoom": 8.5,
            "maxzoom": 12.5,
            "filter": ["has", "Code"],
            "layout": {
                "text-field": ["to-string", ["get", "Code"]],
                "text-font": FONT_BOLD,
                "text-size": ["interpolate", ["linear"], ["zoom"], 8.5, 56, 10.5, 120, 12.5, 168],
                "text-letter-spacing": 0.26,
                # Un filigrane ne se dispute pas la place : il ignore le moteur de
                # placement, sinon il disparaît dès qu'un libellé de ville le touche.
                "text-allow-overlap": True,
                "text-ignore-placement": True,
            },
            "paint": {
                "text-color": POSTCODE["watermark"],
                "text-opacity": [
                    "interpolate", ["linear"], ["zoom"],
                    8.5, 0, 9.6, 0.1, 11.4, 0.09, 12.5, 0,
                ],
            },
        },
        # Sélection : réservée au feature-state, comme le veut la règle du dépôt.
        # `promoteId: "Id"` est déclaré sur la source `quartiers`.
        {
            "id": "quartier-selection",
            "type": "fill",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 9,
            "paint": {
                "fill-color": POSTCODE["selection"],
                "fill-opacity": [
                    "case", ["boolean", ["feature-state", "selection"], False], 0.1, 0,
                ],
            },
        },
        # `blocs-ground` (les îlots, z13 → z20) a été retiré : `blocs_tiles` n'est
        # pas servi par le relais public. Entre z13 et z16 le sol reste donc nu
        # jusqu'à ce que les parcelles apparaissent.
        {
            "id": "parcels-ground",
            "type": "fill",
            "source": "adresses",
            "source-layer": "adresses_tiles",
            "minzoom": 16,
            "paint": {
                "fill-color": C["parcel"],
                "fill-outline-color": C["parcel_line"],
                "fill-opacity": ["interpolate", ["linear"], ["zoom"], 16, 0, 17, 0.9],
            },
        },
    ]


MINOR = ["match", ["get", "Type"], ["Rue", "Impasse"], True, False]
MID = ["match", ["get", "Type"], ["Avenue"], True, False]
MAJOR = ["match", ["get", "Type"], ["Boulevard", "Route"], True, False]
TRACK = ["match", ["get", "Type"], ["Piste"], True, False]


def roads() -> list:
    """Voirie en deux passes (contour puis remplissage), hiérarchie Google."""
    return [
        # Pistes : traitillé sable, sous tout le reste.
        {
            "id": "road-track",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 14,
            "filter": TRACK,
            "layout": {"line-cap": "butt", "line-join": "round"},
            "paint": {
                "line-color": C["track_case"],
                "line-dasharray": [2.5, 2],
                "line-width": _line([14, 0.8, 16, 1.6, 18, 3, 20, 6]),
            },
        },
        # Contours (casing)
        {
            "id": "road-minor-case",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 13,
            "filter": MINOR,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_case_soft"],
                "line-width": _line([13, 1.4, 15, 4, 17, 10, 19, 22, 20, 30]),
            },
        },
        {
            "id": "road-mid-case",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 12,
            "filter": MID,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_case"],
                "line-width": _line([12, 1.8, 14, 4.5, 16, 9, 18, 18, 20, 34]),
            },
        },
        {
            "id": "road-major-case",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 12,
            "filter": MAJOR,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_case"],
                "line-width": _line([12, 3, 14, 6, 16, 12, 18, 22, 20, 42]),
            },
        },
        # Remplissages (fill)
        {
            "id": "road-minor",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 13,
            "filter": MINOR,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_fill"],
                "line-width": _line([13, 0.5, 15, 2.4, 17, 7, 19, 17, 20, 24]),
            },
        },
        {
            "id": "road-mid",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 12,
            "filter": MID,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_fill"],
                "line-width": _line([12, 0.9, 14, 2.8, 16, 6.5, 18, 13, 20, 26]),
            },
        },
        {
            "id": "road-major",
            "type": "line",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 12,
            "filter": MAJOR,
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": C["road_fill"],
                "line-width": _line([12, 1.6, 14, 3.8, 16, 9, 18, 17, 20, 34]),
            },
        },
        # ⚠️ Le réseau structurant du dézoom a été RETIRÉ : `route_principaux`
        # (nationales ambrées, z7 → z13) et `voierie_secondaire` (z10 → z14) ne
        # sont pas dans la liste blanche publique. Conséquence visible : sous z12,
        # `streets_tiles` ne rend rien et le pays apparaît sans aucune route. Les
        # rendre demande d'ouvrir ces deux sources sur `/api/public/tiles/`.
        # Limites de quartier : discrètes, comme les limites administratives Google.
        {
            "id": "quartiers-boundary",
            "type": "line",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 11,
            "paint": {
                "line-color": C["boundary"],
                "line-width": 1,
                "line-dasharray": [3, 2],
                "line-opacity": 0.9,
            },
        },
        # Contour du quartier sélectionné : au-dessus du bâti (sinon les îlots
        # le recouvrent au zoom fort), en dessous des libellés.
        {
            "id": "quartier-selection-contour",
            "type": "line",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 9,
            "layout": {"line-join": "round"},
            "paint": {
                "line-color": POSTCODE["selection"],
                "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.4, 14, 2.4],
                "line-opacity": [
                    "case", ["boolean", ["feature-state", "selection"], False], 1, 0,
                ],
            },
        },
    ]


# Libellé de repli quand un POI n'a pas de nom — 553 sur 961, mesuré le 2026-09-09
# sur `poi_tiles`. La carte lit depuis le regroupement `poi_sites_tiles` (560 sites) :
# la proportion d'anonymes n'y a pas été remesurée, mais le manque est le même, le
# regroupement n'invente aucun nom.
# Ces noms n'existent PAS dans OpenStreetMap : sur les 553, 32 seulement portent un
# tag de nom quelconque, et neuf d'entre eux sont des noms communs (`مسجد`, `شرطة`).
# La donnée qui manque n'est donc pas récupérable ; en revanche la sous-catégorie,
# elle, est renseignée à 100 %. On dit ce qu'est le point plutôt que de ne rien dire.
#
# Les valeurs brutes sont sans accent et en minuscules (`poi-osm-extraire.py` les
# écrit ainsi) : illisibles comme libellés de carte. La mise en forme se fait ICI,
# pas en base — la table reste le vocabulaire fermé, la carte porte la typographie.
SOUS_CATEGORIE = {}
SOUS_CATEGORIE["fr"] = {
    "ecole": "École",
    "lieu de culte": "Lieu de culte",
    "universite": "Université",
    "hopital": "Hôpital",
    "hotel": "Hôtel",
    "mosquee": "Mosquée",
    "eglise": "Église",
    "service de l Etat": "Service de l'État",
    "service administratif": "Service administratif",
    "station service": "Station-service",
    "centre commercial": "Centre commercial",
    "police": "Police",
    "batiment public": "Bâtiment public",
    "pharmacie": "Pharmacie",
    "supermarche": "Supermarché",
    "poste": "Poste",
    "marche": "Marché",
    "centre communautaire": "Centre communautaire",
    "pompiers": "Pompiers",
    "banque": "Banque",
    "centre sportif": "Centre sportif",
    "gare routiere": "Gare routière",
    "bibliotheque": "Bibliothèque",
    "organisation non gouvernementale": "ONG",
    "maison d hotes": "Maison d'hôtes",
    "representation diplomatique": "Représentation diplomatique",
    "ambassade": "Ambassade",
    "clinique": "Clinique",
    "maternelle": "École maternelle",
    "grand magasin": "Grand magasin",
    "college": "Collège",
    "mairie": "Mairie",
    "motel": "Motel",
    "dentiste": "Dentiste",
    "tribunal": "Tribunal",
    "aerogare": "Aérogare",
    "stade": "Stade",
    "auberge": "Auberge",
    "prison": "Prison",
    "cabinet medical": "Cabinet médical",
    "musee": "Musée",
}

SOUS_CATEGORIE["en"] = {
    "ecole": "School", "lieu de culte": "Place of worship", "universite": "University",
    "hopital": "Hospital", "hotel": "Hotel", "mosquee": "Mosque", "eglise": "Church",
    "service de l Etat": "Government service", "service administratif": "Administrative office",
    "station service": "Petrol station", "centre commercial": "Shopping centre",
    "police": "Police", "batiment public": "Public building", "pharmacie": "Pharmacy",
    "supermarche": "Supermarket", "poste": "Post office", "marche": "Market",
    "centre communautaire": "Community centre", "pompiers": "Fire station", "banque": "Bank",
    "centre sportif": "Sports centre", "gare routiere": "Bus station", "bibliotheque": "Library",
    "organisation non gouvernementale": "NGO", "maison d hotes": "Guest house",
    "representation diplomatique": "Diplomatic mission", "ambassade": "Embassy",
    "clinique": "Clinic", "maternelle": "Kindergarten", "grand magasin": "Department store",
    "college": "Secondary school", "mairie": "Town hall", "motel": "Motel",
    "dentiste": "Dentist", "tribunal": "Courthouse", "aerogare": "Air terminal",
    "stade": "Stadium", "auberge": "Hostel", "prison": "Prison",
    "cabinet medical": "Doctor's surgery", "musee": "Museum",
}

# Arabe : traduction à faire relire par un locuteur natif. Les glyphes sont
# servis par `Noto Sans Regular` (cf. `palette.py`) ; le sens de lecture est
# géré par le greffon RTL, chargé par `carte-publique.component.ts`.
SOUS_CATEGORIE["ar"] = {
    "ecole": "مدرسة", "lieu de culte": "دار عبادة", "universite": "جامعة",
    "hopital": "مستشفى", "hotel": "فندق", "mosquee": "مسجد", "eglise": "كنيسة",
    "service de l Etat": "مصلحة حكومية", "service administratif": "مصلحة إدارية",
    "station service": "محطة وقود", "centre commercial": "مركز تجاري",
    "police": "شرطة", "batiment public": "مبنى عمومي", "pharmacie": "صيدلية",
    "supermarche": "متجر كبير", "poste": "مكتب بريد", "marche": "سوق",
    "centre communautaire": "مركز اجتماعي", "pompiers": "إطفاء", "banque": "بنك",
    "centre sportif": "مركز رياضي", "gare routiere": "محطة حافلات", "bibliotheque": "مكتبة",
    "organisation non gouvernementale": "منظمة غير حكومية", "maison d hotes": "دار ضيافة",
    "representation diplomatique": "بعثة دبلوماسية", "ambassade": "سفارة",
    "clinique": "عيادة", "maternelle": "روضة أطفال", "grand magasin": "متجر متعدد الأقسام",
    "college": "مدرسة إعدادية", "mairie": "بلدية", "motel": "نُزل",
    "dentiste": "طبيب أسنان", "tribunal": "محكمة", "aerogare": "صالة مطار",
    "stade": "ملعب", "auberge": "بيت شباب", "prison": "سجن",
    "cabinet medical": "عيادة طبية", "musee": "متحف",
}


def _poi_label(lang: str = "fr"):
    """Nom du POI, ou à défaut ce qu'il est.

    Deux paliers, pour que le repli n'encombre pas la carte :

      z15 → z16   les POI NOMMÉS seulement (comportement d'origine) ;
      z16 →       les anonymes reçoivent leur sous-catégorie, en gris plus clair
                  que les vrais noms — un « Mosquée » générique ne doit pas se
                  lire comme le nom d'un lieu.

    `text-optional` reste actif et le placement n'autorise pas le chevauchement :
    là où 239 « École » se disputeraient la place, MapLibre en laisse tomber la
    plus grande partie plutôt que de saturer.
    """
    libelle = ["match", ["get", "SousCategorie"]]
    for brut, propre in SOUS_CATEGORIE[lang].items():
        libelle += [brut, propre]
    # Une sous-catégorie inconnue n'écrit rien — jamais la valeur brute à l'écran.
    libelle.append("")

    nom = ["format", ["get", "Nom"], {}]
    repli = ["format", libelle, {"text-color": C["label_soft"], "font-scale": 0.9}]

    return [
        "step", ["zoom"],
        ["format", ["case", ["has", "Nom"], ["get", "Nom"], ""], {}],
        16, ["case", ["has", "Nom"], nom, repli],
    ]


def poi_color_expression():
    expr = ["match", ["get", "Categorie"]]
    for name, color in POI_COLORS.items():
        expr += [name, color]
    expr.append("#5f6368")
    return expr


# « code à venir », le sous-titre des quartiers sans code. C'est le SEUL texte
# littéral du style : tout le reste vient des attributs de tuile. Il est traduit
# ici, à la génération, comme les sous-catégories de POI — un style par langue.
CODE_A_VENIR = {
    "fr": "code à venir",
    "en": "code pending",
    "ar": "الرمز قيد الإعداد",
}


def _postcode_label(lang: str = "fr"):
    """Libellé de quartier piloté par la grammaire du code postal.

    `77003` = `77` (code ville) + `003` (`AreaNumber` du quartier). La hiérarchie
    est donc DANS la donnée, pas plaquée dessus : il suffit de la laisser se
    déplier avec le zoom.

      z11 → z13   le code seul. Sans code, rien : à cette échelle un nom de
                  quartier sans code n'apporte rien et encombre le placement.
      z13 →       le code en vedette, le nom du quartier en sous-titre. Sans
                  code, l'inverse : le nom, et « code à venir » dessous.

    `text-color` par section de `format` est bien supporté par MapLibre GL JS ;
    c'est ce qui permet au code d'être bleu et au nom gris dans le MÊME libellé,
    donc au même point d'ancrage, sans seconde couche à faire collisionner.
    """
    code_seul = ["case", ["has", "Postcode"], ["get", "Postcode"], ""]

    code_et_nom = [
        "format",
        ["get", "Postcode"], {"font-scale": 1.5, "text-color": POSTCODE["code"]},
        "\n", {},
        ["get", "Nom"], {"font-scale": 0.82, "text-color": C["label_soft"]},
    ]

    nom_et_attente = [
        "format",
        ["get", "Nom"], {"font-scale": 0.95, "text-color": C["label_soft"]},
        "\n", {},
        CODE_A_VENIR[lang], {"font-scale": 0.72, "text-color": POSTCODE["pending_text"]},
    ]

    return [
        "step", ["zoom"],
        code_seul,
        13, ["case", ["has", "Postcode"], code_et_nom, nom_et_attente],
    ]


def labels(with_poi: bool = True, lang: str = "fr") -> list:
    """Libellés : gris Google, halo blanc, hiérarchie ville > quartier > rue > POI."""
    layers = [
        {
            "id": "poi-dot",
            "type": "circle",
            "source": "poi",
            "source-layer": "poi_sites_tiles",
            "minzoom": 14,
            "paint": {
                "circle-color": poi_color_expression(),
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 17, 4.5, 20, 6],
                "circle-stroke-color": C["halo"],
                "circle-stroke-width": 1.2,
            },
        },
        {
            "id": "road-label",
            "type": "symbol",
            "source": "streets",
            "source-layer": "streets_tiles",
            "minzoom": 15,
            "filter": ["all", ["has", "Name"], ["!=", ["get", "Name"], ""]],
            "layout": {
                "symbol-placement": "line-center",
                "text-field": ["get", "Name"],
                "text-font": FONT_REGULAR,
                "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9.5, 18, 12.5],
                "text-letter-spacing": 0.01,
                "text-max-angle": 40,
                "text-padding": 6,
                "text-max-width": 12,
            },
            "paint": {
                "text-color": C["label"],
                "text-halo-color": C["halo"],
                "text-halo-width": 1.4,
            },
        },
        {
            "id": "poi-label",
            "type": "symbol",
            "source": "poi",
            "source-layer": "poi_sites_tiles",
            "minzoom": 15,
            "layout": {
                "text-field": _poi_label(lang),
                "text-font": FONT_REGULAR,
                "text-size": ["interpolate", ["linear"], ["zoom"], 15, 10, 18, 12],
                "text-anchor": "top",
                "text-offset": [0, 0.7],
                "text-max-width": 9,
                "text-optional": True,
                # Un POI qui porte un vrai nom passe avant un repli générique
                # quand les deux se disputent la même place.
                "symbol-sort-key": ["case", ["has", "Nom"], 0, 1],
            },
            "paint": {
                # Les vrais noms en gris de texte ; le repli s'éclaircit lui-même
                # via la couleur de section de `_poi_label()`.
                "text-color": C["label"],
                "text-halo-color": C["halo"],
                "text-halo-width": 1.4,
            },
        },
        # Le libellé de quartier EST le code postal. La bascule à z13 suit la
        # grammaire du code : `77` seul au dézoom (filigrane `postcode-watermark`),
        # puis `77003` seul, puis `77003` + le nom du quartier en sous-titre.
        # On ne montre jamais deux fois la même information à la même échelle.
        {
            "id": "quartier-label",
            "type": "symbol",
            "source": "quartiers",
            "source-layer": "quartiers_tiles",
            "minzoom": 11,
            "layout": {
                "text-field": _postcode_label(lang),
                "text-font": FONT_BOLD,
                "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 13, 10.5, 16, 13],
                "text-transform": "uppercase",
                "text-line-height": 1.35,
                "text-padding": 14,
                "text-letter-spacing": 0.08,
                "text-max-width": 9,
                # Un quartier codé passe avant un quartier sans code quand les deux
                # se disputent la place : c'est le code qu'on vient chercher ici.
                "symbol-sort-key": ["case", ["has", "Postcode"], 0, 1],
            },
            "paint": {
                "text-color": C["label_soft"],
                "text-halo-color": C["halo"],
                "text-halo-width": 1.8,
                # Fondu d'entrée pendant que le filigrane `77` s'efface.
                "text-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12.2, 1],
            },
        },
        {
            "id": "city-label",
            "type": "symbol",
            "source": "citiesLabels",
            "source-layer": "cities_labels_tiles",
            "maxzoom": 13,
            "layout": {
                "text-field": ["get", "Name"],
                "text-font": FONT_BOLD,
                "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 9, 15, 12, 18],
                "text-max-width": 8,
            },
            "paint": {
                "text-color": C["label_strong"],
                "text-halo-color": C["halo"],
                "text-halo-width": 1.8,
            },
        },
    ]
    if not with_poi:
        layers = [l for l in layers if not l["id"].startswith("poi")]
    return layers
