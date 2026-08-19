import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { Block } from '../../../core/models/das.models';

@Component({
  selector: 'das-blocks-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule, PageHeaderComponent, HierarchyCascadeComponent],
  templateUrl: './blocks-list.component.html',
  styleUrl: './blocks-list.component.scss',
})
export class BlocksListComponent implements OnInit {
  private facade = inject(BlocksFacade);

  private readonly items = toSignal(this.facade.items$, { initialValue: [] as Block[] });
  protected readonly isLoading$ = this.facade.isListLoading$;

  /** Filtre texte purement local — l'API ne supporte que `quartierId`, pas de recherche libre. */
  protected readonly search = signal('');

  protected readonly filteredItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((b) => b.code.toLowerCase().includes(q) || (b.name ?? '').toLowerCase().includes(q));
  });

  protected readonly totalCount = computed(() => this.items().length);
  protected readonly unnamedCount = computed(() => this.items().filter((b) => !b.name).length);

  ngOnInit(): void {
    this.facade.load();
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onHierarchy(sel: HierarchySelection): void {
    this.facade.setFilters(sel);
  }
}
