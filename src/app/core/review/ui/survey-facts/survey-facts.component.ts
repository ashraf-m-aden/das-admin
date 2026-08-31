import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DasMapComponent } from '../../../ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../../ui/map/map.models';
import { wktPoint } from '../../../ui/map/wkt.util';
import { OccupationCatalogItem } from '../../../reference/models/reference.models';
import { ReviewPhoto } from '../../models/review.models';
import { UUID } from '../../../models/das.models';

/**
 * Ce qu'un agent a effectivement relevé, présenté à l'identique partout où on doit en juger.
 *
 * Extrait de la file de validation le 2026-08-31 : le contenu factuel d'un relevé — occupation,
 * comptages, qualité GPS, photos, écart de position — était rendu là et NULLE PART AILLEURS.
 * Un relevé en brouillon, jamais soumis, n'était donc visible d'aucun écran : on en connaissait
 * le nombre, jamais la teneur.
 *
 * Composant PRÉSENTATIONNEL : aucune facade, aucun store. Les photos et les catalogues lui sont
 * passés, et il demande le chargement des photos par un `output`. C'est ce qui lui permet de
 * servir la file de validation comme le détail de campagne, qui n'ont ni le même store ni les
 * mêmes droits.
 */
export interface SurveyFacts {
  id: UUID;
  outcome: 'Surveyed' | 'NotSurveyable';
  notSurveyableReason: string | null;
  name: string | null;
  typeOccupationId: UUID | null;
  etatOccupationId: UUID | null;
  floorCount: number;
  apartmentCount: number;
  shopCount: number;
  wheelchairAccessible: boolean;
  gpsAccuracyM: number | null;
  distanceFromAddressM: number | null;
  isMockLocation: boolean;
  photoCount: number;
  gpsCaptureWkt: string | null;
  adresseLocationWkt: string | null;
}

@Component({
  selector: 'das-survey-facts',
  standalone: true,
  imports: [TranslocoModule, DasMapComponent],
  templateUrl: './survey-facts.component.html',
  styleUrl: './survey-facts.component.scss',
})
export class SurveyFactsComponent {
  private transloco = inject(TranslocoService);

  readonly survey = input.required<SurveyFacts>();
  readonly typeOccupations = input<OccupationCatalogItem[]>([]);
  readonly etatOccupations = input<OccupationCatalogItem[]>([]);

  /** Photos déjà rapportées. Vide tant que l'hôte ne les a pas chargées. */
  /**
   * Seuil d'écart au-delà duquel le back signale le relevé (`Survey:SuspiciousDistanceM`),
   * ou `null` s'il n'est pas connu.
   *
   * ENTRÉE et non lecture directe : ce composant reste présentationnel, et surtout le seuil
   * n'est **pas arbitré** (50 à 200 m selon les discussions). Le coder en dur ici mentirait au
   * premier ajustement serveur — d'où `null` tant que le serveur ne l'a pas dit, plutôt qu'une
   * valeur de repli sur laquelle l'opérateur tirerait une conclusion.
   */
  readonly suspiciousDistanceM = input<number | null>(null);

  readonly photos = input<ReviewPhoto[]>([]);
  readonly photosLoading = input(false);
  readonly photosOpen = input(false);
  readonly mapOpen = input(false);

  readonly togglePhotos = output<UUID>();
  readonly toggleMap = output<UUID>();
  readonly openPhoto = output<string>();

  private readonly typeMap = computed(() => new Map(this.typeOccupations().map((o) => [o.id, o.nom])));
  private readonly etatMap = computed(() => new Map(this.etatOccupations().map((o) => [o.id, o.nom])));

  /** Repli sur l'id quand le catalogue ne connaît pas la valeur : illisible, mais citable en support. */
  protected readonly typeLabel = computed(() => {
    const id = this.survey().typeOccupationId;
    return id ? (this.typeMap().get(id) ?? id) : null;
  });

  protected readonly etatLabel = computed(() => {
    const id = this.survey().etatOccupationId;
    return id ? (this.etatMap().get(id) ?? id) : null;
  });

  /**
   * L'écart dépasse-t-il le seuil ? `false` tant que le seuil est inconnu : sans référence,
   * un nombre de mètres ne se juge pas, et le teinter en rouge serait un verdict inventé.
   */
  protected readonly distanceIsFar = computed(() => {
    const seuil = this.suspiciousDistanceM();
    const ecart = this.survey().distanceFromAddressM;
    return seuil !== null && ecart !== null && ecart > seuil;
  });

  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'survey-gap', labelKey: 'verification.mapLayer', type: 'point', visible: true, showLabels: true },
  ];

  protected readonly hasGeometry = computed(() => {
    const s = this.survey();
    return !!s.gpsCaptureWkt || !!s.adresseLocationWkt;
  });

  /**
   * Le libellé dit ce que la carte montre VRAIMENT.
   *
   * « Voir l'écart » suppose deux points. Quand le back n'en renvoie qu'un — capture sans
   * position de parcelle, ou l'inverse — il n'y a pas d'écart à regarder, et promettre un écart
   * pour afficher un point isolé fait chercher une information absente.
   */
  protected readonly mapButtonKey = computed(() => {
    const s = this.survey();
    if (s.gpsCaptureWkt && s.adresseLocationWkt) return 'verification.viewMap';
    return s.gpsCaptureWkt ? 'verification.viewMapCaptureOnly' : 'verification.viewMapParcelOnly';
  });

  /**
   * Deux points et rien d'autre : où la parcelle est censée être, et où l'agent a capturé.
   * C'est ce qui transforme « 22 m d'écart » en fait vérifiable — de l'autre côté de la rue,
   * ou dans le bâtiment voisin, ce n'est pas la même décision.
   */
  protected readonly mapFeatures = computed<MapFeature[]>(() => {
    const s = this.survey();
    const features: MapFeature[] = [];

    const parcelle = s.adresseLocationWkt ? wktPoint(s.adresseLocationWkt) : null;
    if (parcelle) {
      features.push({
        id: `${s.id}-adresse`, layerId: 'survey-gap', geometry: parcelle, color: '#2563eb',
        label: this.transloco.translate('verification.mapParcel'), selectable: false,
      });
    }

    const capture = s.gpsCaptureWkt ? wktPoint(s.gpsCaptureWkt) : null;
    if (capture) {
      features.push({
        id: `${s.id}-capture`, layerId: 'survey-gap', geometry: capture,
        color: s.isMockLocation ? '#dc2626' : '#d97706',
        label: this.transloco.translate('verification.mapCapture'), selectable: false,
      });
    }

    return features;
  });

  notSurveyableReasonKey(reason: string): string {
    return `verification.notSurveyableReason.${reason.toLowerCase()}`;
  }
}
