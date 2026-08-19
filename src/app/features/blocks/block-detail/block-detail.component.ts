import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { FilterSpecification } from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../../core/ui/map/das-map.component';
import { TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { wktBounds } from '../../../core/ui/map/wkt.util';

const BLOC_TILE: TileLayerBinding = {
  id: 'bloc', labelKey: 'nav.blocks', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected facade = inject(BlocksFacade);

  private readonly blockId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly block = toSignal(this.facade.selected$);
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly isUpdating$ = this.facade.isUpdating$;
  protected readonly updateErrorMessageKey$ = this.facade.updateErrorMessageKey$;

  protected readonly tileLayers: TileLayerBinding[] = [BLOC_TILE];
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const id = this.block()?.id ?? '___none___';
    return { bloc: ['==', ['get', 'Id'], id] as FilterSpecification };
  });
  protected readonly fitBbox = computed(() => {
    const wkt = this.block()?.boundaryWkt;
    return wkt ? wktBounds(wkt) : null;
  });

  protected readonly nameForm = this.fb.nonNullable.group({
    name: ['', [Validators.minLength(2)]],
  });

  constructor() {
    effect(() => {
      const b = this.block();
      if (b) this.nameForm.patchValue({ name: b.name ?? '' }, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.facade.loadDetail(this.blockId);
  }

  ngOnDestroy(): void {
    this.facade.clearDetail();
  }

  saveName(): void {
    const b = this.block();
    if (!b || this.nameForm.invalid) { this.nameForm.markAllAsTouched(); return; }
    const name = this.nameForm.getRawValue().name.trim();
    if (b.number === null) return; // garde-fou : le back exige Number > 0, un bloc sans numéro ne peut pas être renommé via ce endpoint.
    this.facade.update(b.id, { code: b.code, name: name || null, number: b.number, boundaryWkt: b.boundaryWkt });
  }
}
