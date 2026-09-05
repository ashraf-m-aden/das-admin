import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AdresseFacade } from '../../../core/adresse/store/adresse.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../../core/ui/map/map.models';
import { AddressDetailDrawerComponent } from '../address-detail-drawer/address-detail-drawer.component';
import { AddressListItem, WORKFLOW_STAGES } from '../../../core/adresse/models/adresse.models';
import { AddressWorkflowStage } from '../../../core/models/das.models';
import {
  STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
} from '../../../core/ui/map/basemap-groups';

const STAGE_COLORS: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

@Component({
  selector: 'das-adresse-map',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent, AddressDetailDrawerComponent],
  templateUrl: './adresse-map-component.html',
  styleUrl: './adresse-map-component.scss',
})
export class AdresseMapComponent implements OnInit {
  private facade = inject(AdresseFacade);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as AddressListItem[] });
  protected readonly detailOpenId$ = this.facade.detailOpenId$;

  protected readonly legend: AddressWorkflowStage[] = WORKFLOW_STAGES;

  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.items()
      .filter((a) => a.geom)
      .map((a) => ({
        id: a.id, layerId: 'adresse', geometry: a.geom,
        color: STAGE_COLORS[a.workflowStage], label: a.addressCode ?? a.libelle,
      })),
  );

  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'adresse', labelKey: 'nav.adresse', type: 'fill', visible: true },
  ];

  /** Voirie et contours cadastraux du style de base, pilotables via le panneau des couches. */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
  ];
  ngOnInit(): void { this.facade.init(); }

  onSelect(id: string): void { this.facade.openDetail(id); }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLORS[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
