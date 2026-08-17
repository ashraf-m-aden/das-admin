import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { RegistryFacade } from '../../../core/registry/store/registry.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../../core/ui/map/map.models';
import { AddressDetailDrawerComponent } from '../address-detail-drawer/address-detail-drawer.component';
import { AddressListItem, WORKFLOW_STAGES } from '../../../core/registry/models/registry.models';
import { AddressWorkflowStage } from '../../../core/models/das.models';

const STAGE_COLORS: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

@Component({
  selector: 'das-registry-map',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent, AddressDetailDrawerComponent],
  templateUrl: './registry-map-component.html',
  styleUrl: './registry-map-component.scss',
})
export class RegistryMapComponent implements OnInit {
  private facade = inject(RegistryFacade);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as AddressListItem[] });
  protected readonly detailOpenId$ = this.facade.detailOpenId$;

  protected readonly legend: AddressWorkflowStage[] = WORKFLOW_STAGES;

  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.items()
      .filter((a) => a.geom)
      .map((a) => ({
        id: a.id, layerId: 'registry', geometry: a.geom,
        color: STAGE_COLORS[a.workflowStage], label: a.addressCode,
      })),
  );

  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'registry', labelKey: 'nav.registry', type: 'fill', visible: true },
  ];

  /** Contours cadastraux du style de base, pilotables via le panneau des couches. */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    { id: 'ilots', labelKey: 'map.basemap.ilots', styleLayerIds: ['ilots-fill', 'ilots-line'], visible: true },
    { id: 'parcelles', labelKey: 'map.basemap.parcelles', styleLayerIds: ['parcelles-fill', 'parcelles-line'], visible: false },
  ];

  ngOnInit(): void { this.facade.init(); }

  onSelect(id: string): void { this.facade.openDetail(id); }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLORS[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
