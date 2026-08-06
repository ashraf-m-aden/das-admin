import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { UUID, UserRole, UserStatus } from '../../../core/models/das.models';

@Component({
  selector: 'das-staff-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasDatePipe],
  templateUrl: './staff-list.component.html',
  styleUrl: './staff-list.component.scss',
})
export class StaffListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(StaffFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly lastCreatedTemporaryPassword$ = this.facade.lastCreatedTemporaryPassword$;

  protected readonly roles: UserRole[] = ['admin', 'supervisor', 'surveyor'];
  protected readonly statuses: UserStatus[] = ['active', 'suspended', 'inactive'];

  protected readonly filterForm = this.fb.group({
    search: [''],
    role: [null as UserRole | null],
    status: [null as UserStatus | null],
  });

  ngOnInit(): void {
    this.facade.load();

    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setFilters({
        search: value.search ?? '',
        role: value.role ?? null,
        status: value.status ?? null,
      });
    });
  }

  toggleEnabled(id: UUID, currentlyEnabled: boolean): void {
    this.facade.setEnabled(id, !currentlyEnabled);
  }

  resetPassword(id: UUID): void {
    this.facade.resetPassword(id);
  }

  dismissTemporaryPassword(): void {
    this.facade.clearTemporaryPassword();
  }
}
