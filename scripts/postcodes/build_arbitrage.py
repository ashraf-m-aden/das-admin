# -*- coding: utf-8 -*-
"""
Rassemble tout ce que la reprise du 2026-08-27 n'a PAS applique, avec le motif.

Cinq motifs, du plus simple a trancher au plus lourd :
  conflit-area-number  l'areaNumber vise est deja pris par un quartier charge d'adresses
  alias-a-valider      rapprochement propose a la main, jamais applique sans relecture
  proximite-douteuse   rapprochement lexical approximatif, souvent une collision
  absent-du-referentiel  ligne du plan sans quartier en base ni emprise SIG exacte
  hors-plan            quartier en base que le plan ignore : il lui faut un areaNumber

Ce qui est deja applique n'est pas devine : il est relu dans l'export courant de la base
(quartiers_db.csv). Une liste en dur se perimerait des la passe suivante.

Usage: python scripts/postcodes/build_arbitrage.py <concordance.json> <sig.csv> <quartiers_db.csv> <sortie.csv>
"""
import csv
import difflib
import json
import re
import sys
import unicodedata


def slug(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '', s.lower())


# Motifs d'exclusion, alignes sur EXCLUS de generate_reprise_sql.py.
MOTIFS = {
    207: "le plan rattache Brise de mer a Boulaos, la base a Ras Dika : decision de territoire",
    403: "le plan compte un Gabode, la base cinq (Gabode 1 a 5) : lequel porte 403 ?",
    408: "Fiyetnam -> Vietnam : le SIG place Vietnam a Balbala, le plan met 4xx a Boulaos",
}


def main(concordance_path, sig_path, db_path, out_path):
    conc = json.load(open(concordance_path, encoding='utf-8'))
    sig = {slug(r['nom']): r['nom'] for r in csv.DictReader(open(sig_path, encoding='utf-8'))}
    db = [r for r in csv.DictReader(open(db_path, encoding='utf-8')) if r['ville'] == 'Djibouti']
    appliques = {int(r['AreaNumber']) for r in db if r['AreaNumber']}
    en_base = {r['Nom'] for r in db}

    lignes = []
    for r in conc['concordance']:
        if r['areaNumber'] in appliques:
            continue
        motif, propose, note = '', r['nomBase'], ''
        if r['methode'] in ('normalisation', 'alias'):
            motif = 'ecarte-decision'
            note = MOTIFS.get(r['areaNumber'], 'ecarte de la reprise, motif a documenter')
        elif r['methode'] == 'proximite':
            motif = 'proximite-douteuse'
            note = 'rapprochement lexical approximatif'
        else:
            motif = 'absent-du-referentiel'
            proche = difflib.get_close_matches(slug(r['nomXlsx']), list(sig), n=1, cutoff=0.7)
            propose = sig[proche[0]] if proche else ''
            note = ('graphie proche dans delimitations_quartiers, a confirmer'
                    if proche else 'introuvable en base comme dans le SIG')
        lignes.append({
            'motif': motif, 'areaNumber': r['areaNumber'], 'nomPlan': r['nomXlsx'],
            'zone': r['zoneCle'], 'communePlan': r['communeXlsx'],
            'propositionBase': propose, 'quartierId': r['quartierId'], 'note': note,
        })

    for o in conc['orphelinsEnBase']:
        if o['Nom'] not in en_base:
            continue
        lignes.append({
            'motif': 'hors-plan', 'areaNumber': '', 'nomPlan': '', 'zone': '',
            'communePlan': o['commune'], 'propositionBase': o['Nom'],
            'quartierId': o['Id'],
            'note': 'quartier en base absent du plan : il lui faut un areaNumber',
        })

    ordre = ['ecarte-decision', 'proximite-douteuse', 'absent-du-referentiel', 'hors-plan']
    lignes.sort(key=lambda l: (ordre.index(l['motif']), str(l['areaNumber'])))

    with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(lignes[0]))
        w.writeheader()
        w.writerows(lignes)

    print(f'{len(lignes)} lignes -> {out_path}')
    for m in ordre:
        print(f'  {m:<24} {sum(1 for l in lignes if l["motif"] == m)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
