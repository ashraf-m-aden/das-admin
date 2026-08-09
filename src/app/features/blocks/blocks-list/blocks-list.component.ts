import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BlockListItem } from '../../../core/blocks/models/blocks.models';
import { BlockStatus } from '../../../core/models/das.models';

const STATUS_COLOR: Record<BlockStatus, string> = {
  approved: '#16a34a', in_progress: '#d97706', submitted: '#7c3aed',
  assigned: '#2563eb', not_assigned: '#9aa3b5', needs_redo: '#dc2626',
};

@Component({
  selector: 'das-blocks-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, PageHeaderComponent],
  templateUrl: './blocks-list.component.html',
  styleUrl: './blocks-list.component.scss',
})
export class BlocksListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(BlocksFacade);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as BlockListItem[] });
  protected readonly isLoading$ = this.facade.isListLoading$;

  protected readonly statuses: BlockStatus[] = [
    'not_assigned', 'assigned', 'in_progress', 'submitted', 'approved', 'needs_redo',
  ];

  protected readonly filterForm = this.fb.group({
    search: [''],
    status: [null as BlockStatus | null],
  });

  protected readonly totalCount = computed(() => this.items().length);
  protected readonly approvedCount = computed(() => this.items().filter((b) => b.status === 'approved').length);
  protected readonly globalProgress = computed(() => {
    const total = this.items().length;
    return total === 0 ? 0 : Math.round((this.approvedCount() / total) * 100);
  });

  protected readonly distribution = computed(() => {
    const list = this.items();
    const total = list.length || 1;
    return this.statuses
      .map((status) => {
        const count = list.filter((b) => b.status === status).length;
        return { status, count, color: STATUS_COLOR[status], percent: Math.round((count / total) * 100) };
      })
      .filter((d) => d.count > 0);
  });

  ngOnInit(): void {
    this.facade.load();
    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setFilters({ search: value.search ?? '', status: value.status ?? null });
    });
  }

  setStatusFilter(status: BlockStatus | null): void {
    this.filterForm.patchValue({ status });
  }

  progressPercent(b: BlockListItem): number {
    return b.lotsTotal === 0 ? 0 : Math.round((b.lotsCompleted / b.lotsTotal) * 100);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  statusBadgeClass(status: BlockStatus): string { return `das-badge das-badge--${status.replace('_', '-')}`; }
  statusLabelKey(status: BlockStatus): string { return `status.block.${status}`; }
}
