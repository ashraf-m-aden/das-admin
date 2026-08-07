import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../core/clients/store/clients.facade';
import { ClientStatus, UUID } from '../../../core/models/das.models';

@Component({
  selector: 'das-clients-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule],
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
}
