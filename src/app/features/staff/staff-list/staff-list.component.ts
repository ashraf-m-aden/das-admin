import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { UserRole } from '../../../core/models/das.models';
import { StaffMember } from '../../../core/staff/models/staff.models';

const ALL_ROLES: UserRole[] = ['Admin', 'Gestionnaire', 'Superviseur', 'AgentTerrain'];

@Component({
  selector: 'das-staff-list',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, PageHeaderComponent],
  templateUrl: './staff-list.component.html',
  styleUrl: './staff-list.component.scss',
})
export class StaffListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(StaffFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isFormSaving$ = this.facade.isFormSaving$;
  protected readonly formErrorMessageKey$ = this.facade.formErrorMessageKey$;
  protected readonly allRoles = ALL_ROLES;

  protected readonly showCreateForm = signal(false);
  protected readonly editingRolesId = signal<string | null>(null);
  protected readonly editingRolesDraft = signal<UserRole[]>([]);

  protected readonly showProductivity = signal(false);
  protected readonly productivity$ = this.facade.productivity$;
  protected readonly isProductivityLoading$ = this.facade.isProductivityLoading$;

  protected readonly filterForm = this.fb.nonNullable.group({ search: [''] });

  protected readonly createForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    roles: this.fb.nonNullable.control<UserRole[]>([]),
  });
initialsOf(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
  }
  roleLabelKey(role: UserRole): string { return `roles.${role}`; }
  ngOnInit(): void {
    this.facade.load();
    this.filterForm.valueChanges.subscribe((v) => this.facade.setFilters(v.search ?? '', null));
  }

  toggleCreateForm(): void {
    this.showCreateForm.set(!this.showCreateForm());
  }

  toggleProductivity(): void {
    const next = !this.showProductivity();
    this.showProductivity.set(next);
    if (next) this.facade.loadProductivity();
  }

  toggleCreateRole(role: UserRole): void {
    const current = this.createForm.controls.roles.value;
    this.createForm.controls.roles.setValue(current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);
  }

  hasCreateRole(role: UserRole): boolean {
    return this.createForm.controls.roles.value.includes(role);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.createForm.value.roles?.length === 0) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.facade.create(this.createForm.getRawValue());
    this.createForm.reset({ fullName: '', username: '', password: '', roles: [] });
    this.showCreateForm.set(false);
  }

  startEditRoles(member: StaffMember): void {
    this.editingRolesId.set(member.id);
    this.editingRolesDraft.set([...member.roles]);
  }

  toggleDraftRole(role: UserRole): void {
    const current = this.editingRolesDraft();
    this.editingRolesDraft.set(current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);
  }

  hasDraftRole(role: UserRole): boolean {
    return this.editingRolesDraft().includes(role);
  }

  saveRoles(member: StaffMember): void {
    this.facade.setRoles(member.id, { roles: this.editingRolesDraft() });
    this.editingRolesId.set(null);
  }

  cancelEditRoles(): void {
    this.editingRolesId.set(null);
  }

  toggleActive(member: StaffMember): void {
    this.facade.setActive(member.id, !member.isActive);
  }
}
