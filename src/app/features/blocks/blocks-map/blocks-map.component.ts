import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../../core/ui/map/map.models';
import { BlockListItem } from '../../../core/blocks/models/blocks.models';
import { BlockStatus } from '../../../core/models/das.models';

const STATUS_COLORS: Record<BlockStatus, string> = {
  not_assigned: '#9aa3b5', assigned: '#2563eb', in_progress: '#d97706',
  submitted: '#7c3aed', approved: '#16a34a', needs_redo: '#dc2626',
};

@Component({
  selector: 'das-blocks-map',
  standalone: true,
  imports: [RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './blocks-map.component.html',
  styleUrl: './blocks-map.component.scss',
})
export class BlocksMapComponent implements OnInit {
  private facade = inject(BlocksFacade);
  private router = inject(Router);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as BlockListItem[] });

  protected readonly legend: BlockStatus[] = [
    'approved', 'in_progress', 'submitted', 'assigned', 'not_assigned', 'needs_redo',
  ];

  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.items()
      .filter((b) => b.geom)          // ← ne garde que ceux avec géométrie
  .map((b) => ({
      id: b.id, layerId: 'blocks', geometry: b.geom, color: STATUS_COLORS[b.status], label: b.code,
    })),
  );
  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'blocks', labelKey: 'nav.blocks', type: 'fill', visible: true },
  ];

  ngOnInit(): void { this.facade.load(); }

  onSelect(id: string): void { this.router.navigate(['/blocks', id]); }

  legendColor(status: BlockStatus): string { return STATUS_COLORS[status]; }
  statusLabelKey(status: BlockStatus): string { return `status.block.${status}`; }
}
