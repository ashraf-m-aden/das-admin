import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../core/clients/store/clients.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { ClientStatus, UUID } from '../../../core/models/das.models';

const STATUS_COLOR: Record<ClientStatus, string> = {
  active: '#16a34a',
  trial: '#d97706',
  suspended: '#9aa3b5',
};

@Component({
  selector: 'das-clients-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, PageHeaderComponent],
  templateUrl: './clients-list.component.html',
  styleUrl: './clients-list.component.scss',
})
export class ClientsListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ClientsFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly lastCreatedTemporaryPassword$ = this.facade.lastCreatedTemporaryPassword$;

  protected readonly statuses: ClientStatus[] = ['trial', 'active', 'suspended'];

  protected readonly filterForm = this.fb.group({
    search: [''],
    status: [null as ClientStatus | null],
  });

  ngOnInit(): void {
    this.facade.load();
    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setFilters({ search: value.search ?? '', status: value.status ?? null });
    });
  }

  toggleEnabled(id: UUID, currentlyEnabled: boolean): void {
    this.facade.setEnabled(id, !currentlyEnabled);
  }

  dismissTemporaryPassword(): void {
    this.facade.clearTemporaryPassword();
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  statusColor(status: ClientStatus): string {
    return STATUS_COLOR[status];
  }

  statusLabelKey(status: ClientStatus): string {
    return `status.client.${status}`;
  }
}
