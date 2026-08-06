import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { BlockStatus } from '../../../core/models/das.models';

@Component({
  selector: 'das-blocks-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule],
  templateUrl: './blocks-list.component.html',
  styleUrl: './blocks-list.component.scss',
})
export class BlocksListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(BlocksFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;

  protected readonly statuses: BlockStatus[] = [
    'not_assigned',
    'assigned',
    'in_progress',
    'submitted',
    'approved',
    'needs_redo',
  ];

  protected readonly filterForm = this.fb.group({
    search: [''],
    status: [null as BlockStatus | null],
  });

  ngOnInit(): void {
    this.facade.load();

    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setFilters({
        search: value.search ?? '',
        status: value.status ?? null,
      });
    });
  }

  statusBadgeClass(status: BlockStatus): string {
    return `das-badge das-badge--${status.replace('_', '-')}`;
  }
}
