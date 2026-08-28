# -*- coding: utf-8 -*-
"""
Rapproche les 76 lignes du referentiel xlsx des quartiers reellement en base.

Trois etages, du plus sur au moins sur :
  1. cle normalisee identique (accents/casse/ponctuation ignores) ;
  2. alias declare a la main dans ALIAS (une decision humaine, tracee) ;
  3. proximite lexicale (difflib) -> proposition A RELIRE, jamais appliquee telle quelle.

Sort un CSV de relecture et un JSON de concordance. N'ecrit rien en base.

Usage: python scripts/postcodes/match_quartiers.py <reference.json> <quartiers_db.csv> <sortie_prefixe>
"""
import csv
import difflib
import json
import sys
import unicodedata
import re


def slugify(name):
    stripped = unicodedata.normalize('NFKD', name)
    stripped = ''.join(ch for ch in stripped if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]+', '', stripped.lower())


# Correspondances que la normalisation ne peut pas trouver : variantes lexicales,
# translitterations somali/francais, decoupages differents. cle xlsx -> Nom exact en base.
# Chacune est une decision a valider par quelqu'un qui connait le terrain.
ALIAS = {
    'serpent': 'Plateau du Serpent',
    'republic': 'Lotissement de la République',
    'centraldjibouti': 'Centre Commercial et Admnistratif',
    'citesacuudi': 'Cité Saoudienne',
    'elmguella': 'Einguela',
    'q1': 'Quartier 1',
    'q2': 'Quartier 2',
    'q3': 'Quartier 3',
    'q4': 'Quartier 4',
    'q5': 'Quartier 5',
    'q6': 'Quartier 6',
    'q7': 'Quartier 7',
    'brisedemer': 'Brise de mer 1',
    'citefnp': 'Cité F.N.P.',
    'arhiba': "Cité d' Arhiba",
    'makkaalmoukarama': 'Cité Makka al Moukarama',
    'wadajir': 'Wadagir',
    'poudriere': 'Cité Poudrière',
    'palmeraie': 'Palmeraie',
    'gachamaleh': 'Cité Gachamaleh',
    'kartilehq7bis': 'Quartier 7 Bis',
    'stade': 'Cité du Stade',
    'guellehbatal': 'Guelleh Batal',
    'industrialzone': 'Zone Industrielle Sud',
    'ambouli': 'Ambouli',
    'citeprogres': 'Cité Progrès',
    'haramous': 'Haramous',
    'djebel': 'Djebel',
    'aerogare': "Lotissement de l'Aérogare",
    'aviation': "Lotissement de l' Aviation",
    'umasalma': None,
    'doumeira': None,
    'citerawabi': None,
    'warabaley': None,
    'layabley': None,
    'dogley': None,
    'hayabley': 'HAYABLEH',
    'citebarwaqo': 'Cite Barwaqo',
    'balbalaq5': 'BALBALA Q 5',
    'cheikmoussa': 'Cheik Moussa',
    'nassibwanag': None,
    'placemahadsanid': None,
    'hariirad': None,
    'gargar': None,
    'shabeley': None,
    'pk12': 'PK12',
    'hodan': 'CITE HODAN',
    'wahledaba': 'Wahladaba Sud',
    'bahache': 'Bahache',
    'citeluxembourg': 'Cité Luxembourg',
    'quarawil': 'Quarawil',
    'pompage': 'Pompage',
    'bacheaeau': 'BACHE A EAU',
    't3': 'T3',
    'balbalaq11': 'BALBALA Q11',
    'balbalacaadi': 'BALBALA ANCIEN',
    'cemetery': 'Cimetière',
    'dryport': 'DRY PORT',
}


def load_db(path):
    with open(path, encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if r['ville'] == 'Djibouti']


def main(ref_path, db_path, out_prefix):
    ref = json.load(open(ref_path, encoding='utf-8'))
    db = load_db(db_path)

    by_slug = {}
    for r in db:
        by_slug.setdefault(slugify(r['Nom']), []).append(r)
    by_name = {r['Nom']: r for r in db}
    db_slugs = list(by_slug)

    resultats, utilises = [], set()
    for q in ref['quartiers']:
        cle, cand, methode, confiance = q['cle'], None, 'aucune', ''
        if cle in by_slug:
            cand, methode, confiance = by_slug[cle][0], 'normalisation', 'sur'
        elif cle in ALIAS:
            nom = ALIAS[cle]
            if nom is None:
                methode, confiance = 'absent-en-base', 'sur'
            elif nom in by_name:
                cand, methode, confiance = by_name[nom], 'alias', 'sur'
            else:
                methode, confiance = f'alias-introuvable:{nom}', 'erreur'
        if cand is None and methode == 'aucune':
            proches = difflib.get_close_matches(cle, db_slugs, n=1, cutoff=0.72)
            if proches:
                cand, methode, confiance = by_slug[proches[0]][0], 'proximite', 'a-relire'
        if cand is not None:
            utilises.add(cand['Id'])
        resultats.append({
            'nomXlsx': q['nom'], 'areaNumber': q['areaNumber'], 'zoneCle': q['zoneCle'],
            'communeXlsx': q['commune'] or '', 'methode': methode, 'confiance': confiance,
            'quartierId': cand['Id'] if cand else '',
            'nomBase': cand['Nom'] if cand else '',
            'communeBase': cand['commune'] if cand else '',
            'areaNumberActuel': cand['AreaNumber'] if cand else '',
        })

    orphelins = [r for r in db if r['Id'] not in utilises]

    with open(f'{out_prefix}-concordance.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(resultats[0]))
        w.writeheader()
        w.writerows(resultats)
    with open(f'{out_prefix}-orphelins.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['Id', 'Nom', 'Code', 'AreaNumber', 'commune'])
        w.writeheader()
        w.writerows({k: r[k] for k in ['Id', 'Nom', 'Code', 'AreaNumber', 'commune']} for r in orphelins)
    json.dump({'concordance': resultats, 'orphelinsEnBase': orphelins},
              open(f'{out_prefix}-concordance.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    par_methode = {}
    for r in resultats:
        par_methode[r['methode'].split(':')[0]] = par_methode.get(r['methode'].split(':')[0], 0) + 1
    print(f"{len(resultats)} lignes xlsx vs {len(db)} quartiers Djibouti en base")
    for m, n in sorted(par_methode.items(), key=lambda x: -x[1]):
        print(f"  {m:<20} {n}")
    print(f"  orphelins en base    {len(orphelins)}")
    # Une commune divergente est un vrai signal : le plan et le SIG ne sont pas d'accord.
    ecarts = [r for r in resultats if r['communeBase'] and r['communeXlsx']
              and slugify(r['communeBase']) != slugify(r['communeXlsx'])]
    print(f"  desaccords commune   {len(ecarts)}")
    for r in ecarts:
        print(f"      {r['nomXlsx']} : xlsx={r['communeXlsx']} / base={r['communeBase']}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
