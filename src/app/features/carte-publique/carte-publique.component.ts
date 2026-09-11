import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone,
  OnDestroy, OnInit, inject, signal, viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import type { MapMouseEvent, PointLike, StyleSpecification } from 'maplibre-gl';
import { MapStyleService } from '../../core/map/map-style.service';
import { AppConfigService } from '../../core/config/app-config.service';

/** Ce que renvoie `GET /api/public/search`. */
interface ResultatApi {
  cle: string;
  genre: string;
  libelle: string;
  complement: string | null;
  longitude: number;
  latitude: number;
}

/** Une entrée de la liste de résultats, prête à afficher. */
export interface Resultat {
  genre: 'adresse' | 'lieu' | 'quartier';
  titre: string;
  sousTitre: string | null;
  lngLat: [number, number];
}

/** Ce que le clic a désigné. Le plus précis l'emporte : POI > adresse > bloc > rue. */
export type DetailCarte =
  | { kind: 'poi'; nom: string | null; categorie: string | null; sousCategorie: string | null; batiments: number }
  | { kind: 'adresse'; numero: string | null; stage: string | null; poiNom: string | null; poiCategorie: string | null }
  | { kind: 'bloc'; code: string | null; nom: string | null }
  | { kind: 'rue'; nom: string | null; code: string | null; type: string | null };

/** Le quartier sous le clic : il porte le code postal, donc l'adresse postale. */
export interface ContexteQuartier {
  readonly id: string;
  readonly nom: string;
  readonly postcode: string | null;
  readonly ville: string;
}

/** Doit rester identique à `HACHURE` dans `scripts/map/basemap_layers.py`. */
const IMAGE_HACHURE = 'das-hachure-code-a-venir';

const SOURCE_QUARTIERS = 'quartiers';
const SOURCE_LAYER_QUARTIERS = 'quartiers_tiles';
const COUCHE_QUARTIERS = 'quartiers-fill';
const COUCHE_POI = 'poi-dot';
const COUCHE_PARCELLES = 'parcels-ground';
const COUCHE_BLOCS = 'blocs-ground';
const COUCHES_RUES = ['road-major', 'road-mid', 'road-minor', 'road-track'];

/** Greffon de mise en forme arabe, servi en local — pas depuis un CDN tiers. */
const GREFFON_RTL = 'assets/mapbox-gl-rtl-text.js';

/**
 * La CARTE PUBLIQUE du référentiel — `/carte`, hors du shell et sans authentification.
 *
 * <b>Pourquoi un composant à part et non `das-map`.</b> `das-map` sert l'administration :
 * panneau de couches, liaisons de tuiles, feature-state pilotés depuis le store, recadrage sur
 * des sélections métier. Rien de cela n'a de sens ici, où l'on veut le comportement d'un grand
 * public — chercher, cliquer, lire. Les deux partagent ce qui compte : `MapStyleService`.
 *
 * Paramètres d'URL, tous facultatifs et tous validés — une URL bricolée à la main rend le
 * cadrage par défaut, jamais une carte vide :
 *   `lat`, `lng`, `z`  cadrage initial
 *   `marker=lng,lat`   épingle (répétable)
 *   `label=…`          libellé de la première épingle
 *   `embed=1`          masque l'en-tête (intégration en iframe)
 *
 * ⚠️ <b>C'est le contrat d'ouverture depuis un consommateur externe.</b> La Plateforme 1 de La
 * Poste construit exactement ces paramètres dans `openInDasViewer()`. Les noms et la forme de
 * `marker` — « longitude,latitude », l'ordre de MapLibre et non celui de lat/lng — viennent de
 * là et ne changent pas sans prévenir l'autre dépôt.
 *
 * ---------------------------------------------------------------------------
 * LE CODE POSTAL EST LE SUJET DE CETTE CARTE
 * ---------------------------------------------------------------------------
 * Trois mécanismes nourris par la seule colonne `Postcode` de `quartiers_tiles` : le filigrane
 * `77` au dézoom puis `77003` au zoom (la grammaire du code pilote l'affichage, cf.
 * `_postcode_label()` dans `scripts/map/basemap_layers.py`), la hachure des quartiers sans code,
 * et le panneau de détail ci-dessous qui met le code en forme d'adresse postale.
 *
 * ---------------------------------------------------------------------------
 * TROIS LANGUES, DONC TROIS STYLES
 * ---------------------------------------------------------------------------
 * Les libellés du fond (sous-catégories de lieux, « code à venir ») sont traduits À LA
 * GÉNÉRATION : `MapStyleService.getCommercialStyle(lang)` choisit le fichier.
 *
 * L'arabe demande deux choses de plus, sans lesquelles il s'affiche en carrés vides ou à
 * l'envers : une police qui le couvre (`Noto Sans Regular`, cf. `palette.py`) et le greffon de
 * mise en forme bidirectionnelle, chargé ici.
 */
@Component({
  selector: 'das-carte-publique',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule],
  templateUrl: './carte-publique.component.html',
  styleUrl: './carte-publique.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartePubliqueComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly mapStyle = inject(MapStyleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly zone = inject(NgZone);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private readonly frappe = new Subject<string>();

  private map?: maplibregl.Map;
  private repere?: maplibregl.Marker;
  /** Quartier dont le `feature-state.selection` est posé, pour le retirer proprement. */
  private idSelection: string | null = null;
  /** Couches réellement présentes dans le style : `queryRenderedFeatures` lève sur une inconnue. */
  private couchesPresentes = new Set<string>();

  protected readonly embed = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly zoom = signal(12);
  protected readonly titre = signal('Djibouti');
  protected readonly detail = signal<DetailCarte | null>(null);
  protected readonly quartier = signal<ContexteQuartier | null>(null);
  protected readonly position = signal<[number, number] | null>(null);
  protected readonly copie = signal(false);
  protected readonly rtl = signal(false);
  protected readonly recherche = signal('');
  protected readonly resultats = signal<Resultat[]>([]);

  ngOnInit(): void {
    const vue = this.vueDemandee();
    this.embed.set(vue.embed);
    this.zoom.set(vue.zoom);
    if (vue.label) {
      this.titre.set(vue.label);
    }

    this.appliquerSensDeLecture(this.transloco.getActiveLang());
    this.chargerGreffonRtl();
    this.brancherRecherche();

    this.mapStyle.getCommercialStyle(this.transloco.getActiveLang()).subscribe({
      next: (style) => this.creerCarte(style, vue),
      error: () => this.erreur.set(this.transloco.translate('carte.erreur')),
    });

    // Changer de langue rejoue le style : les libellés du fond sont figés dedans.
    const abonnement = this.transloco.langChanges$.subscribe((lang) => {
      this.appliquerSensDeLecture(lang);
      if (!this.map) {
        return;
      }
      this.mapStyle.getCommercialStyle(lang).subscribe({
        next: (style) => {
          this.map?.setStyle(style);
          // `setStyle` repart d'un style neuf : la sélection et les images ajoutées à la
          // volée sont perdues, il faut les reposer.
          this.idSelection = null;
          const q = this.quartier();
          if (q && this.map) {
            this.poserSelection(this.map, q.id);
          }
        },
        error: () => this.erreur.set(this.transloco.translate('carte.erreur')),
      });
    });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ─── Cadrage demandé par l'URL ──────────────────────────────────────────────────────────────

  private vueDemandee(): {
    centre: [number, number];
    zoom: number;
    marqueurs: [number, number][];
    label: string | null;
    embed: boolean;
  } {
    const p = this.route.snapshot.queryParamMap;

    const nombre = (v: string | null): number | null => {
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const lat = nombre(p.get('lat'));
    const lng = nombre(p.get('lng'));
    const centre: [number, number] = lat !== null && lng !== null ? [lng, lat] : [43.145, 11.588];

    // Le zoom est borné à ce que le style couvre : au-delà de 19 les tuiles n'existent plus et
    // la carte se vide, ce qui se lit comme une panne.
    const z = nombre(p.get('z'));
    const zoom = z === null ? 12 : Math.min(Math.max(z, 6), 19);

    // `marker` vaut « longitude,latitude » — l'ordre de MapLibre, pas celui de lat/lng.
    const marqueurs = p
      .getAll('marker')
      .map((valeur) => valeur.split(',').map(Number))
      .filter((c) => c.length === 2 && c.every(Number.isFinite)) as [number, number][];

    const label = p.get('label')?.trim() || null;
    // Un libellé sans épingle n'aurait rien à désigner : on en pose une au centre.
    if (!marqueurs.length && label) {
      marqueurs.push(centre);
    }

    return { centre, zoom, marqueurs, label, embed: p.get('embed') === '1' };
  }

  // ─── Style et langue ────────────────────────────────────────────────────────────────────────

  /**
   * Sans ce greffon, l'arabe s'affiche lettre à lettre dans le mauvais sens : la mise en forme
   * contextuelle et l'ordre bidirectionnel se font dans le worker de MapLibre, pas dans le
   * navigateur. Il est GLOBAL et ne se pose qu'une fois — le rappeler lève une erreur, d'où le
   * contrôle d'état.
   */
  private chargerGreffonRtl(): void {
    if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') {
      return;
    }
    // `lazy: false` : le greffon doit être là AVANT la première tuile arabe, sinon le premier
    // rendu sort en carrés et n'est pas recalculé.
    maplibregl.setRTLTextPlugin(GREFFON_RTL, false).catch(() => {
      // Un greffon absent dégrade l'arabe, il ne casse pas la carte : on ne remonte pas
      // d'erreur à l'écran pour ça.
    });
  }

  private appliquerSensDeLecture(lang: string): void {
    this.rtl.set(lang === 'ar');
  }

  // ─── Carte ──────────────────────────────────────────────────────────────────────────────────

  private creerCarte(
    style: StyleSpecification,
    vue: { centre: [number, number]; zoom: number; marqueurs: [number, number][]; label: string | null },
  ): void {
    // Hors de la zone Angular : MapLibre émet des dizaines d'événements par seconde au survol et
    // au déplacement, chacun déclencherait un cycle de détection pour rien. Tout retour vers un
    // signal repasse explicitement par `zone.run`.
    this.zone.runOutsideAngular(() => {
      const carte = new maplibregl.Map({
        container: this.host().nativeElement,
        style,
        center: vue.centre,
        zoom: vue.zoom,
        attributionControl: false,
        // Le référentiel s'arrête aux frontières : inutile de laisser dériver l'utilisateur sur
        // un océan vide.
        maxBounds: [[41.0, 10.4], [44.2, 13.3]],
        minZoom: 6,
        maxZoom: 19,
      });
      this.map = carte;

      carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      carte.addControl(
        new maplibregl.GeolocateControl({ trackUserLocation: false, showAccuracyCircle: true }),
        'bottom-right',
      );
      carte.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
      carte.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          // ODbL : les lieux et une partie de la voirie viennent d'OpenStreetMap, l'attribution
          // est obligatoire dès l'affichage.
          customAttribution: 'Référentiel d\'adresses D.A.S — Djibouti · POI © OpenStreetMap',
        }),
        'bottom-right',
      );

      carte.on('zoom', () => this.zone.run(() => this.zoom.set(Math.round(carte.getZoom() * 10) / 10)));
      carte.on('error', (event) => {
        // Une tuile manquante ne doit pas vider l'écran : on informe sans casser.
        this.zone.run(() =>
          this.erreur.set(event.error?.message ?? this.transloco.translate('carte.erreur')),
        );
      });

      // La hachure est peinte à la demande : `fill-pattern` déclenche `styleimagemissing` tant
      // que l'image n'est pas enregistrée. Passer par cet événement plutôt que par `load` évite
      // la course où la couche est rendue avant l'ajout de l'image — MapLibre ne dessine alors
      // rien, sans erreur.
      carte.on('styleimagemissing', (event) => {
        if (event.id === IMAGE_HACHURE) {
          this.ajouterHachure(carte);
        }
      });

      // Le style peut changer (langue) : la liste des couches se relit à chaque chargement.
      carte.on('styledata', () => {
        this.couchesPresentes = new Set(carte.getStyle().layers.map((c) => c.id));
      });

      carte.on('click', (event) => this.surClic(carte, event));
      carte.on('mousemove', (event) => {
        const cible = this.interroger(carte, event.point, [COUCHE_QUARTIERS]);
        carte.getCanvas().style.cursor = cible.length ? 'pointer' : '';
      });

      this.poserMarqueurs(carte, vue.marqueurs, vue.label);
      this.destroyRef.onDestroy(() => carte.remove());
    });
  }

  /**
   * Motif de hachure des quartiers sans code postal, peint sur un canvas.
   *
   * Pas de sprite dans ce style (il ne déclare que `glyphs`), et en ajouter un imposerait un
   * asset externe de plus à servir. 12 px suffisent : le motif est répété par `fill-pattern`, et
   * `pixelRatio: 2` le garde net en haute densité.
   */
  private ajouterHachure(carte: maplibregl.Map): void {
    if (carte.hasImage(IMAGE_HACHURE)) {
      return;
    }
    const taille = 12;
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#f4eee2';
    ctx.fillRect(0, 0, taille, taille);
    ctx.strokeStyle = '#d6c3a0';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'square';
    // Trois segments pour que la diagonale se raccorde d'une tuile à la suivante.
    ctx.beginPath();
    ctx.moveTo(-2, taille + 2);
    ctx.lineTo(taille + 2, -2);
    ctx.moveTo(-2, 2);
    ctx.lineTo(2, -2);
    ctx.moveTo(taille - 2, taille + 2);
    ctx.lineTo(taille + 2, taille - 2);
    ctx.stroke();

    const pixels = ctx.getImageData(0, 0, taille, taille);
    carte.addImage(
      IMAGE_HACHURE,
      { width: taille, height: taille, data: new Uint8Array(pixels.data.buffer) },
      { pixelRatio: 2 },
    );
  }

  /** `queryRenderedFeatures` LÈVE sur une couche absente du style : on filtre d'abord. */
  private interroger(
    carte: maplibregl.Map,
    cible: PointLike | [PointLike, PointLike],
    couches: string[],
  ): maplibregl.MapGeoJSONFeature[] {
    const connues = couches.filter((c) => this.couchesPresentes.has(c));
    return connues.length ? carte.queryRenderedFeatures(cible as never, { layers: connues }) : [];
  }

  // ─── Clic et panneau ────────────────────────────────────────────────────────────────────────

  /**
   * Un clic n'importe où sur la carte ouvre le panneau de détail, à la Google Maps.
   *
   * L'ordre de résolution va du plus précis au plus large : un lieu l'emporte sur la parcelle
   * qui le contient, qui l'emporte sur la rue. Le quartier n'est jamais le sujet — il est le
   * CONTEXTE, celui qui porte le code postal, et il s'affiche donc en plus du reste plutôt qu'à
   * sa place.
   *
   * Les points et les lignes se cliquent mal au pixel près : lieux et rues sont cherchés dans
   * une petite boîte autour du curseur, les surfaces au point exact.
   */
  private surClic(carte: maplibregl.Map, event: MapMouseEvent): void {
    this.resoudre(carte, event.point, [event.lngLat.lng, event.lngLat.lat]);
  }

  private resoudre(carte: maplibregl.Map, p: { x: number; y: number }, lngLat: [number, number]): void {
    const boite = (r: number): [PointLike, PointLike] => [
      [p.x - r, p.y - r],
      [p.x + r, p.y + r],
    ];
    const premier = (cible: PointLike | [PointLike, PointLike], couches: string[]) =>
      this.interroger(carte, cible, couches)[0];

    const poi = premier(boite(9), [COUCHE_POI]);
    const adresse = premier([p.x, p.y], [COUCHE_PARCELLES]);
    const bloc = premier([p.x, p.y], [COUCHE_BLOCS]);
    const rue = premier(boite(6), COUCHES_RUES);
    const quartier = premier([p.x, p.y], [COUCHE_QUARTIERS]);

    let detail: DetailCarte | null = null;
    if (poi) {
      const t = poi.properties ?? {};
      detail = {
        kind: 'poi',
        nom: this.texte(t['Nom']),
        categorie: this.texte(t['Categorie']),
        sousCategorie: this.texte(t['SousCategorie']),
        // `poi_sites_tiles` REGROUPE les bâtiments d'un même lieu : le compte dit combien de
        // bâtiments se cachent derrière la pastille (72 pour l'Université de Djibouti).
        batiments: Number(t['Batiments'] ?? 1),
      };
    } else if (adresse) {
      const t = adresse.properties ?? {};
      detail = {
        kind: 'adresse',
        numero: this.texte(t['Numero']),
        stage: this.texte(t['workflowStage']),
        poiNom: this.texte(t['PoiNom']),
        poiCategorie: this.texte(t['PoiCategorie']),
      };
    } else if (bloc) {
      const t = bloc.properties ?? {};
      detail = { kind: 'bloc', code: this.texte(t['Code']), nom: this.texte(t['Name']) };
    } else if (rue) {
      const t = rue.properties ?? {};
      detail = {
        kind: 'rue',
        nom: this.texte(t['Name']),
        code: this.texte(t['Code']),
        type: this.texte(t['Type']),
      };
    }

    const contexte: ContexteQuartier | null = quartier
      ? (() => {
          const t = quartier.properties ?? {};
          return {
            id: String(quartier.id ?? t['Id'] ?? ''),
            nom: this.texte(t['Nom']) ?? this.transloco.translate('carte.lieuSansNom'),
            // `Postcode` est calculé par la vue `quartiers_tiles` ; il est absent de la tuile
            // quand la ville n'a pas de `Code` ou le quartier pas d'`AreaNumber`.
            postcode: this.texte(t['Postcode']),
            ville: this.texte(t['CityName']) ?? 'Djibouti',
          };
        })()
      : null;

    this.poserSelection(carte, contexte?.id || null);

    this.zone.run(() => {
      this.detail.set(detail);
      this.quartier.set(contexte);
      this.position.set(detail || contexte ? lngLat : null);
      this.copie.set(false);
      this.resultats.set([]);
    });
  }

  private poserSelection(carte: maplibregl.Map, id: string | null): void {
    const cible = { source: SOURCE_QUARTIERS, sourceLayer: SOURCE_LAYER_QUARTIERS };
    if (this.idSelection) {
      carte.setFeatureState({ ...cible, id: this.idSelection }, { selection: false });
    }
    this.idSelection = id;
    if (id) {
      carte.setFeatureState({ ...cible, id }, { selection: true });
    }
  }

  /** Une propriété de tuile vide (`""`) vaut absente : on ne veut pas d'un champ blanc. */
  private texte(valeur: unknown): string | null {
    if (valeur === null || valeur === undefined) {
      return null;
    }
    const nettoye = String(valeur).trim();
    return nettoye.length ? nettoye : null;
  }

  /** Le titre du panneau : le nom s'il existe, sinon ce que la chose EST. */
  protected titrePanneau(d: DetailCarte): string {
    switch (d.kind) {
      case 'poi':
        return d.nom ?? this.libelleSousCategorie(d.sousCategorie);
      case 'adresse':
        return d.numero ? `N° ${d.numero}` : this.transloco.translate('carte.genre.adresse');
      case 'bloc':
        return d.nom ?? d.code ?? this.transloco.translate('carte.genre.bloc');
      case 'rue':
        return d.nom ?? this.transloco.translate('carte.genre.rue');
    }
  }

  protected libelleSousCategorie(valeur: string | null): string {
    if (!valeur) {
      return this.transloco.translate('carte.lieuSansNom');
    }
    return this.traduireOuBrut(`carte.sousCategorie.${valeur}`, valeur);
  }

  protected libelleCategorie(valeur: string | null): string | null {
    return valeur ? this.traduireOuBrut(`carte.categorie.${valeur}`, valeur) : null;
  }

  protected libelleEtape(valeur: string | null): string | null {
    if (!valeur) {
      return null;
    }
    // `workflowStage` arrive en minuscules dans les tuiles, comme partout en lecture.
    return this.traduireOuBrut(`status.stage.${valeur.toLowerCase()}`, valeur);
  }

  /**
   * Le vocabulaire des lieux vient d'OpenStreetMap : il s'enrichit sans nous prévenir. Une
   * valeur sans clé s'affiche BRUTE plutôt que sous forme de clé i18n à l'écran.
   */
  private traduireOuBrut(clef: string, brut: string): string {
    const traduit = this.transloco.translate(clef);
    return traduit === clef ? brut : traduit;
  }

  protected fermerPanneau(): void {
    if (this.map) {
      this.poserSelection(this.map, null);
    }
    this.detail.set(null);
    this.quartier.set(null);
    this.position.set(null);
    this.copie.set(false);
  }

  /**
   * L'adresse mise en forme, telle qu'elle s'écrirait sur un pli. C'est le seul endroit de
   * l'application où le code postal est présenté comme un produit et non comme une colonne —
   * d'où le format sur trois lignes.
   */
  protected adressePostale(q: ContexteQuartier): string {
    const d = this.detail();
    const lignes: string[] = [];
    if (d?.kind === 'poi' && d.nom) {
      lignes.push(d.nom);
    }
    if (d?.kind === 'adresse' && d.numero) {
      lignes.push(`N° ${d.numero}`);
    }
    if (d?.kind === 'rue' && d.nom) {
      lignes.push(d.nom);
    }
    lignes.push(`${this.transloco.translate('carte.genre.quartier')} ${q.nom}`);
    lignes.push(`${q.ville.toUpperCase()}  ${q.postcode ?? ''}`.trim());
    lignes.push(this.transloco.translate('carte.pays'));
    return lignes.join('\n');
  }

  protected async copier(q: ContexteQuartier): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.adressePostale(q));
      this.copie.set(true);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, iframe sans permission) : l'adresse reste
      // lisible à l'écran, on n'affiche pas d'erreur pour ça.
      this.copie.set(false);
    }
  }

  // ─── Recherche ──────────────────────────────────────────────────────────────────────────────

  /**
   * Recherche sur TOUT le référentiel, servie par `GET /api/public/search`.
   *
   * ⚠️ Chercher dans les tuiles rendues (`querySourceFeatures`) ne voit que l'emprise visible :
   * chercher « Ambouli » depuis Balbala ne rendrait rien. L'index serveur
   * (`public.recherche_index`) couvre villes, quartiers, rues nommées, lieux remarquables et
   * parcelles identifiées.
   *
   * `debounceTime` : la recherche part à chaque frappe. Sans lui, taper « boulevard » lance neuf
   * requêtes dont huit sont périmées avant d'arriver. `switchMap` annule la précédente, ce qui
   * évite aussi qu'une réponse lente écrase une réponse récente.
   *
   * ⚠️ <b>La clé publique voyage en paramètre `cle`, pas en en-tête.</b> Le back accepte les
   * deux, et l'en-tête serait plus propre ici — mais la même clé doit servir aux URL de tuiles,
   * que MapLibre construit lui-même et où aucun en-tête ne peut être posé. Une seule forme pour
   * les deux usages évite d'avoir à se demander laquelle s'applique où.
   */
  private brancherRecherche(): void {
    const abonnement = this.frappe
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((terme) => {
          const cle = this.config.get('mapPublicKey');
          return this.http.get<ResultatApi[]>(
            `${this.config.get('apiBaseUrl')}/public/search`,
            { params: cle ? { q: terme, limite: 8, cle } : { q: terme, limite: 8 } },
          );
        }),
      )
      .subscribe({
        next: (resultats) => this.resultats.set(resultats.map((r) => this.depuisApi(r))),
        // Une recherche qui échoue vide la liste sans alerter : l'écran reste utilisable à la
        // souris, et une bannière d'erreur à chaque frappe serait pire que le silence.
        error: () => this.resultats.set([]),
      });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }

  protected chercher(): void {
    const terme = this.recherche().trim();
    if (terme.length < 2) {
      this.resultats.set([]);
      return;
    }
    this.frappe.next(terme);
  }

  private depuisApi(r: ResultatApi): Resultat {
    return {
      genre: r.genre === 'adresse' ? 'adresse' : r.genre === 'lieu' ? 'lieu' : 'quartier',
      titre: r.libelle,
      sousTitre: r.complement,
      lngLat: [r.longitude, r.latitude],
    };
  }

  /**
   * Un résultat choisi se traite comme un clic sur la carte, une fois arrivé : on recadre, puis
   * on relit la tuile sous le point.
   *
   * ⚠️ `idle` et non `moveend` : `moveend` se déclenche dès que l'animation s'arrête, avant que
   * les tuiles du nouveau cadrage soient chargées. `queryRenderedFeatures` rendrait alors du
   * vide, et le panneau s'ouvrirait sans code postal — le contraire de ce que la recherche
   * promet.
   */
  protected allerVers(r: Resultat): void {
    const carte = this.map;
    if (!carte) {
      return;
    }
    this.recherche.set(r.titre);
    this.resultats.set([]);
    this.poserRepere(carte, r.lngLat);
    carte.flyTo({ center: r.lngLat, zoom: Math.max(carte.getZoom(), 17), duration: 800 });
    carte.once('idle', () => this.resoudre(carte, carte.project(r.lngLat), r.lngLat));
  }

  // ─── Épingles ───────────────────────────────────────────────────────────────────────────────

  /** `marker=lng,lat` répétable ; le libellé ne s'attache qu'à la première. */
  private poserMarqueurs(
    carte: maplibregl.Map,
    marqueurs: [number, number][],
    label: string | null,
  ): void {
    marqueurs.forEach((point, index) => {
      const marqueur = new maplibregl.Marker({ color: '#123c86' }).setLngLat(point);
      if (index === 0 && label) {
        marqueur.setPopup(new maplibregl.Popup({ offset: 24, closeButton: false }).setText(label));
      }
      marqueur.addTo(carte);
      if (index === 0 && label) {
        marqueur.togglePopup();
      }
    });
  }

  /** L'épingle de la recherche — une seule à la fois, distincte de celles de l'URL. */
  private poserRepere(carte: maplibregl.Map, lngLat: [number, number]): void {
    this.repere?.remove();
    this.repere = new maplibregl.Marker({ color: '#123c86' }).setLngLat(lngLat).addTo(carte);
  }
}
