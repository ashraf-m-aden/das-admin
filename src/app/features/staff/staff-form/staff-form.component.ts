import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { UserRole } from '../../../core/models/das.models';

@Component({
  selector: 'das-staff-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './staff-form.component.html',
  styleUrl: './staff-form.component.scss',
})
export class StaffFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(StaffFacade);
  private route = inject(ActivatedRoute);

  protected readonly isSaving$ = this.facade.isFormSaving$;
  protected readonly errorMessageKey$ = this.facade.formErrorMessageKey$;
  protected readonly roles: UserRole[] = ['admin', 'supervisor', 'surveyor'];

  /** null tant qu'on est en création, sinon l'id de l'agent en cours d'édition */
  protected editingId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['surveyor' as UserRole, [Validators.required]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.editingId = id;
    this.form.controls.login.disable(); // le login n'est pas modifiable après création

    // La liste doit déjà être en mémoire (on vient de /staff) ; sinon on la charge.
    this.facade.load();
    this.facade.getById$(id).subscribe((member) => {
      if (!member) return;
      this.form.patchValue({
        login: member.login,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone ?? '',
        role: member.role,
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { login, firstName, lastName, email, phone, role } = this.form.getRawValue();

    if (this.editingId) {
      this.facade.update(this.editingId, { firstName, lastName, email, phone: phone || null, role });
    } else {
      this.facade.create({ login, firstName, lastName, email, phone: phone || null, role });
    }
  }
}
