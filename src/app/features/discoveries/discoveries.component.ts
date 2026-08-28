import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DiscoveriesFacade } from '../../core/discoveries/store/discoveries.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { BasemapLayerGroup, DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { wktPoint } from '../../core/ui/map/wkt.util';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { DiscoveryReport, DiscoveryStatus } from '../../core/discoveries/models/discoveries.models';
import { UUID, UserRole } from '../../core/models/das.models';
import {
  STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
} from '../../core/ui/map/basemap-groups';

/**
 * Trier un signalement demande `discoveries.review`, seedée pour `Gestionnaire` (Admin par
 * bypass). Le `Superviseur` a `discoveries.view` et **pas** `review` : il voit la file, il ne
 * décide pas. On masque les actions plutôt que de laisser des boutons qui finissent en 403.
 */
const CAN_REVIEW_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

/** Couleurs de statut. Overlay GeoJSON : la coloration est résolue ici, pas dans le style (§4 : le style ne connaît que les tuiles). */
const STATUS_COLOR: Record<DiscoveryStatus, string> = {
  Pending: '#f59e0b',
  Accepted: '#16a34a',
  Rejected: '#9aa3b5',
};

const POINTS_LAYER: MapLayerConfig = {
  id: 'discoveries', labelKey: 'nav.discoveries', type: 'point', visible: true,
};

@Component({
  selector: 'das-discoveries',
  standalone: true,
  imports: [AsyncPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent, DasDatePipe],
  templateUrl: './discoveries.component.html',
  styleUrl: './discoveries.component.scss',
})
export class DiscoveriesComponent implements OnInit {

  /**
   * Voirie et contours du style de base, pilotables depuis le panneau des couches. Le panneau
   * a été activé sur cette carte le 2026-08-25 : depuis le retrait du fond CARTO, la voirie est
   * la seule référence de terrain, et il faut pouvoir la masquer pour lire les contours dessous.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
  ];
  private facade = inject(DiscoveriesFacade);
  private authFacade = inject(AuthFacade);

  protected readonly isListLoading$ = this.facade.isListLoading$;
  protected readonly isReviewing$ = this.facade.isReviewing$;
  protected readonly isExporting$ = this.facade.isExporting$;
  protected readonly errorMessageKey$ = this.facade.errorMessageKey$;

  protected readonly reports = toSignal(this.facade.reports$, { initialValue: [] as DiscoveryReport[] });
  protected readonly campaigns = toSignal(this.facade.campaigns$, { initialValue: [] as { id: UUID; label: string }[] });
  protected readonly campaignId = toSignal(this.facade.campaignId$, { initialValue: null as UUID | null });
  protected readonly status = toSignal(this.facade.status$, { initialValue: 'Pending' as DiscoveryStatus | null });
  protected readonly selectedId = toSignal(this.facade.selectedId$, { initialValue: null as UUID | null });
  protected readonly selected = toSignal(this.facade.selectedReport$, { initialValue: null as DiscoveryReport | null });
  protected readonly counts = toSignal(this.facade.counts$, { initialValue: { pending: 0, accepted: 0, rejected: 0 } });
  private readonly reviewTick = toSignal(this.facade.reviewTick$, { initialValue: 0 });

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canReview = computed(() => this.roles().some((r) => CAN_REVIEW_ROLES.includes(r)));

  /** État local du formulaire de motif — il meurt avec l'écran, rien à faire dans le store. */
  protected readonly rejecting = signal<UUID | null>(null);
  protected readonly rejectionReason = signal('');

  protected readonly statuses: (DiscoveryStatus | null)[] = [null, 'Pending', 'Accepted', 'Rejected'];
  protected readonly mapLayers: MapLayerConfig[] = [POINTS_LAYER];

  constructor() {
    // Referme le formulaire de motif UNIQUEMENT sur décision réussie : sur un 409
    // (`AlreadyReviewed`) il reste ouvert avec le motif saisi, qui resservira ailleurs.
    effect(() => {
      this.reviewTick();
      this.rejecting.set(null);
      this.rejectionReason.set('');
    });
  }

  ngOnInit(): void { this.facade.load(); }

  /**
   * Un signalement dont le WKT est illisible est **écarté de la carte, pas de la liste** : il
   * reste triable (le commentaire et l'agent suffisent souvent à décider), mais on ne lui
   * invente pas une position. `wktPoint` est strict pour cette raison.
   */
  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.reports().flatMap((r) => {
      const geometry = wktPoint(r.locationWkt);
      if (!geometry) return [];
      return [{
        id: r.id,
        layerId: POINTS_LAYER.id,
        geometry,
        color: STATUS_COLOR[r.status],
        label: r.comment ?? r.agentFullName,
      }];
    }),
  );

  /** Cadrage sur le signalement sélectionné — un point, donc une emprise dégénérée que la carte élargit. */
  protected readonly mapFitBbox = computed<[number, number, number, number] | null>(() => {
    const r = this.selected();
    const p = r ? wktPoint(r.locationWkt) : null;
    if (!p) return null;
    const [lng, lat] = p.coordinates;
    return [lng, lat, lng, lat];
  });

  protected readonly canConfirmReject = computed(() => this.rejectionReason().trim().length > 0);

  setCampaign(value: string): void { this.facade.setCampaign(value || null); }

  setStatus(value: string): void { this.facade.setStatus((value || null) as DiscoveryStatus | null); }

  select(id: UUID): void {
    this.facade.select(this.selectedId() === id ? null : id);
  }

  accept(r: DiscoveryReport): void { this.facade.accept(r.id); }

  startReject(r: DiscoveryReport): void {
    this.rejecting.set(r.id);
    this.rejectionReason.set('');
  }

  cancelReject(): void {
    this.rejecting.set(null);
    this.rejectionReason.set('');
  }

  confirmReject(): void {
    const id = this.rejecting();
    if (!id || !this.canConfirmReject()) return;
    this.facade.reject(id, this.rejectionReason().trim());
  }

  exportGeoJson(): void { this.facade.export(); }

  protected statusColor(s: DiscoveryStatus): string { return STATUS_COLOR[s]; }

  protected statusLabelKey(s: DiscoveryStatus): string { return `discoveries.status.${s}`; }

  /**
   * Délai entre la capture sur le terrain et la réception serveur, en heures. C'est la mesure du
   * travail hors ligne : un écart de plusieurs jours est normal (faille `A4`), pas une anomalie.
   * Retourne `null` sous une heure — afficher « 0 h » ferait croire à une donnée manquante.
   */
  protected offlineHours(r: DiscoveryReport): number | null {
    const h = Math.round((Date.parse(r.createdAtUtc) - Date.parse(r.capturedAtUtc)) / 3600_000);
    return h >= 1 ? h : null;
  }
}
