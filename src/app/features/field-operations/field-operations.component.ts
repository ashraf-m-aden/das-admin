import { Component, OnInit, computed, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldOpsFacade } from '../../core/fieldops/store/fieldops.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { FieldTeamStatus, TaskPriority, TaskStatus } from '../../core/models/das.models';

const TEAM_STATUS_COLOR: Record<FieldTeamStatus, string> = { active: '#16a34a', en_route: '#2563eb', idle: '#d97706', offline: '#9aa3b5' };
const PRIORITY_COLOR: Record<TaskPriority, string> = { high: '#dc2626', normal: '#2563eb', low: '#9aa3b5' };

@Component({
  selector: 'das-field-operations',
  standalone: true,
  imports: [TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './field-operations.component.html',
  styleUrl: './field-operations.component.scss',
})
export class FieldOperationsComponent implements OnInit {
  protected facade = inject(FieldOpsFacade);

  protected readonly mapFeatures = computed<MapFeature[]>(() => {
    const d = this.facade.data();
    if (!d) return [];
    const zones: MapFeature[] = d.zones.map((z) => ({ id: z.id, layerId: 'zones', geometry: z.geom, color: '#93c5fd', label: z.name, selectable: false }));
    const teams: MapFeature[] = d.teamLocations.map((t) => ({ id: t.id, layerId: 'teams', geometry: t.location, color: TEAM_STATUS_COLOR[t.status], label: t.name }));
    return [...zones, ...teams];
  });
  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'zones', labelKey: 'fieldops.layerZones', type: 'fill', visible: true },
    { id: 'teams', labelKey: 'fieldops.layerTeams', type: 'point', visible: true },
  ];

  ngOnInit(): void { this.facade.load(); }

  teamStatusColor(s: FieldTeamStatus): string { return TEAM_STATUS_COLOR[s]; }
  priorityColor(p: TaskPriority): string { return PRIORITY_COLOR[p]; }
  columnLabelKey(s: TaskStatus): string { return `fieldops.col.${s}`; }
  priorityLabelKey(p: TaskPriority): string { return `fieldops.priority.${p}`; }
}
