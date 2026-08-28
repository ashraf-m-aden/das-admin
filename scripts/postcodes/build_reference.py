# -*- coding: utf-8 -*-
"""
Transforme DAS_Djibouti_City_Postcodes.xlsx en referentiel JSON exploitable.

Le xlsx porte l'ANCIEN format de code postal (77HE101 : prefixe + lettres + numero).
Le contrat actuel (guide d'integration 3.3) ne stocke QUE `areaNumber` (1..999, unique
dans la ville) ; le back derive `postcode` = City.code + areaNumber -> "77101".
Les lettres du xlsx ne sont donc PAS reprises comme code postal ; elles restent en
`lettresHeritees` a titre documentaire (elles ressemblent au `code` du quartier, mais
c'est le back qui le derive du nom quand on ne l'impose pas).

Usage: python scripts/postcodes/build_reference.py <chemin.xlsx> <sortie.json>
"""
import json
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
RNS = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def read_sheet(path, sheet_name):
    z = zipfile.ZipFile(path)
    shared = []
    try:
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        shared = [''.join(t.text or '' for t in si.iter(NS + 't')) for si in root.findall(NS + 'si')]
    except KeyError:
        pass
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    targets = {r.get('Id'): r.get('Target') for r in rels}
    for sh in wb.find(NS + 'sheets'):
        if sh.get('name') != sheet_name:
            continue
        target = targets[sh.get(RNS + 'id')]
        if not target.startswith('xl/'):
            target = 'xl/' + target.lstrip('/')
        return _rows(ET.fromstring(z.read(target)), shared)
    raise KeyError(sheet_name)


def _col(ref):
    letters = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def _rows(root, shared):
    out = []
    for row in root.iter(NS + 'row'):
        cells, width = {}, 0
        for c in row.findall(NS + 'c'):
            i = _col(c.get('r'))
            width = max(width, i)
            t, v = c.get('t'), c.find(NS + 'v')
            if t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter(NS + 't'))
            elif v is None:
                val = ''
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text
            cells[i] = val
        out.append([cells.get(i, '') for i in range(width + 1)])
    return out


def slugify(name):
    """Cle de rapprochement : sans accent, sans casse, sans ponctuation ni espaces.

    Sert a apparier un nom du xlsx avec un nom en base malgre les variantes
    d'accentuation et de ponctuation. Ne resout PAS les variantes lexicales
    (Sacuudi / Saoudienne) : celles-la se tranchent a la main.
    """
    stripped = unicodedata.normalize('NFKD', name)
    stripped = ''.join(ch for ch in stripped if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]+', '', stripped.lower())


# Les 7 categories de couleur du plan deviennent 7 zones. Le premier chiffre de
# l'areaNumber EST l'identifiant de zone : 1xx Ras-Dika, 2/3/4xx Boulaos, 5/6xx Balbala,
# 9xx aires speciales. La zone 9 n'a pas de commune : une zone etant une partie d'une
# commune (Quartiers.ZoneWithoutCommune), elle ne peut pas exister telle quelle cote
# back -- ces quartiers gardent leur areaNumber mais restent hors zone.
ZONES = {
    'Blue / Ras-Dika':       dict(cle='ras-dika-1', nom='Ras-Dika 1',      code='Z1', commune='Ras-Dika', couleur='Blue',        tranche='1xx'),
    'Yellow / Boulaos':      dict(cle='boulaos-2',  nom='Boulaos 2',       code='Z2', commune='Boulaos',  couleur='Yellow',      tranche='2xx'),
    'Pink-Red / Boulaos':    dict(cle='boulaos-3',  nom='Boulaos 3',       code='Z3', commune='Boulaos',  couleur='Pink-Red',    tranche='3xx'),
    'Dark Red / Boulaos':    dict(cle='boulaos-4',  nom='Boulaos 4',       code='Z4', commune='Boulaos',  couleur='Dark Red',    tranche='4xx'),
    'Light Green / Balbala': dict(cle='balbala-5',  nom='Balbala 5',       code='Z5', commune='Balbala',  couleur='Light Green', tranche='5xx'),
    'Green / Balbala':       dict(cle='balbala-6',  nom='Balbala 6',       code='Z6', commune='Balbala',  couleur='Green',       tranche='6xx'),
    'Special / Grey':        dict(cle='special-9',  nom='Aires speciales', code='Z9', commune=None,       couleur='Grey',        tranche='9xx'),
}

CITY = {'nom': 'Djibouti', 'code': 77}


def build(xlsx_path):
    rows = read_sheet(xlsx_path, 'Postcode Register')
    header, body = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    assert header[:6] == ['Municipality / Zone', 'Map Category', 'Area / Neighbourhood',
                          'Area Letters', 'Area Number', 'Proposed Postcode'], header

    quartiers = []
    for r in body:
        municipalite, categorie, nom, lettres, numero, ancien = (r + [''] * 6)[:6]
        zone = ZONES[categorie.strip()]
        area = int(numero)
        quartiers.append({
            'nom': nom.strip(),
            'cle': slugify(nom),
            'areaNumber': area,
            'postcodeAttendu': f"{CITY['code']}{area}",   # derive par le back, jamais ecrit
            'postcodeHerite': ancien.strip(),             # ancien format, documentaire
            'lettresHeritees': lettres.strip(),
            'municipalite': municipalite.strip(),
            'commune': zone['commune'],
            'zoneCle': zone['cle'],
            'tranche': zone['tranche'],
        })

    numeros = [q['areaNumber'] for q in quartiers]
    doublons = sorted({n for n in numeros if numeros.count(n) > 1})
    cles = [q['cle'] for q in quartiers]
    homonymes = sorted({c for c in cles if cles.count(c) > 1})

    zones = []
    for meta in ZONES.values():
        membres = [q['areaNumber'] for q in quartiers if q['zoneCle'] == meta['cle']]
        zones.append({**meta, 'nbQuartiers': len(membres), 'areaNumbers': sorted(membres)})

    return {
        'source': 'DAS_Djibouti_City_Postcodes.xlsx',
        'note': ("areaNumber est la seule valeur a ecrire en base ; postcode est derive "
                 "par le back (City.code + areaNumber). Le format 77HE101 du xlsx est "
                 "abandonne, conserve en postcodeHerite a titre de trace."),
        'ville': CITY,
        'zones': zones,
        'quartiers': sorted(quartiers, key=lambda q: q['areaNumber']),
        'controles': {
            'nbQuartiers': len(quartiers),
            'areaNumberDoublons': doublons,
            'nomsHomonymes': homonymes,
            'areaNumberHorsPlage': [n for n in numeros if not 1 <= n <= 999],
        },
    }


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    data = build(src)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    c = data['controles']
    print(f"{c['nbQuartiers']} quartiers, {len(data['zones'])} zones -> {dst}")
    print(f"  doublons areaNumber : {c['areaNumberDoublons'] or 'aucun'}")
    print(f"  noms homonymes      : {c['nomsHomonymes'] or 'aucun'}")
    print(f"  hors plage 1..999   : {c['areaNumberHorsPlage'] or 'aucun'}")
