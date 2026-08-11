import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { RegistryFacade } from '../../../core/registry/store/registry.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../../core/ui/map/map.models';
import { AddressDetailDrawerComponent } from '../address-detail-drawer/address-detail-drawer.component';
import { AddressListItem, WORKFLOW_STAGES } from '../../../core/registry/models/registry.models';
import { AddressWorkflowStage } from '../../../core/models/das.models';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

@Component({
  selector: 'das-registry-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent, AddressDetailDrawerComponent, DasMapComponent],
  templateUrl: './registry-list.component.html',
  styleUrl: './registry-list.component.scss',
})
export class RegistryListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(RegistryFacade);

  protected readonly summary$ = this.facade.summary$;
  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as AddressListItem[] });
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly filterOptions$ = this.facade.filterOptions$;
  protected readonly pageInfo$ = this.facade.pageInfo$;
  protected readonly selectedIds = toSignal(this.facade.selectedIds$, { initialValue: [] as string[] });
  protected readonly selectedCount$ = this.facade.selectedCount$;
  protected readonly detailOpenId$ = this.facade.detailOpenId$;
  protected readonly isMutating$ = this.facade.isMutating$;

  protected readonly stages = WORKFLOW_STAGES;

  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.items().map((a) => ({
      id: a.id, layerId: 'parcels', geometry: a.geom,
      color: STAGE_COLOR[a.workflowStage], label: a.addressCode,
    })),
  );
  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'parcels', labelKey: 'registry.layerParcels', type: 'fill', visible: true },
  ];

  protected readonly filterForm = this.fb.group({
    search: [''], postcode: [null as string | null], region: [null as string | null],
    status: [null as AddressWorkflowStage | null], team: [null as string | null],
  });

  protected readonly allOnPageSelected = computed(() => {
    const ids = this.items().map((i) => i.id);
    const sel = this.selectedIds();
    return ids.length > 0 && ids.every((id) => sel.includes(id));
  });

  ngOnInit(): void {
    this.facade.init();
    this.filterForm.valueChanges.subscribe((v) => this.facade.setFilters({
      search: v.search ?? '', postcode: v.postcode ?? null, region: v.region ?? null,
      status: v.status ?? null, team: v.team ?? null,
    }));
  }

  isSelected(id: string): boolean { return this.selectedIds().includes(id); }
  toggle(id: string, ev: Event): void { ev.stopPropagation(); this.facade.toggleSelect(id); }
  toggleAll(): void { this.facade.toggleSelectAll(this.items().map((i) => i.id)); }

  open(id: string): void { this.facade.openDetail(id); }
  approveSelected(): void { this.facade.approveSelected(); }
  changeTeam(team: string): void { if (team) this.facade.changeTeam(team); }
  bulkPublish(): void { this.facade.bulkUpdate({ ids: this.selectedIds(), stage: 'published' }); }
  clearSelection(): void { this.facade.clearSelection(); }

  goToPage(page: number): void { this.facade.setPage(page); }
  changePageSize(size: string): void { this.facade.setPageSize(Number(size)); }

  pagesAround(current: number, count: number): number[] {
    const start = Math.max(1, current - 1);
    const end = Math.min(count, start + 2);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
  typeLabelKey(type: string): string { return `registry.type.${type}`; }
}
