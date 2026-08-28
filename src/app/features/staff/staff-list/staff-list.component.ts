import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
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
  private destroyRef = inject(DestroyRef);
  private facade = inject(StaffFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as StaffMember[] });
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

  /** Rôle filtré. Le store le gère déjà — seule l'UI manquait pour s'en servir. */
  protected readonly roleFilter = signal<UserRole | null>(null);

  /** Membre dont on s'apprête à changer l'état actif : suspendre coupe un accès, ça se confirme. */
  protected readonly confirmingActiveId = signal<string | null>(null);

  protected readonly showPassword = signal(false);

  /**
   * Distingue « aucun utilisateur » de « aucun résultat » : sans ça, un filtre trop étroit se
   * lit comme une base vide, et on cherche le problème du mauvais côté.
   */
  protected readonly isFiltered = computed(() =>
    this.roleFilter() !== null || (this.filterForm.getRawValue().search ?? '').trim().length > 0);

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
    // Débounce : sans lui, chaque frappe dispatchait un filtre — et donc un rechargement.
    // `takeUntilDestroyed` referme l'abonnement, qui survivait au composant.
    this.filterForm.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged((a, b) => a.search === b.search), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.facade.setFilters(v.search ?? '', this.roleFilter()));
  }

  filterRole(role: UserRole | null): void {
    this.roleFilter.set(role);
    this.facade.setFilters(this.filterForm.getRawValue().search ?? '', role);
  }

  clearFilters(): void {
    this.roleFilter.set(null);
    this.filterForm.setValue({ search: '' });
    this.facade.setFilters('', null);
  }

  togglePassword(): void { this.showPassword.update((v) => !v); }

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

  /**
   * Suspendre / réactiver passe par une confirmation. Le bouton est à côté de l'édition des
   * rôles, et un clic de trop coupait l'accès d'un agent sans rien demander ni rien signaler.
   */
  requestToggleActive(member: StaffMember): void { this.confirmingActiveId.set(member.id); }
  cancelToggleActive(): void { this.confirmingActiveId.set(null); }
  confirmToggleActive(member: StaffMember): void {
    this.facade.setActive(member.id, !member.isActive);
    this.confirmingActiveId.set(null);
  }
}
