import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../core/clients/store/clients.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';

@Component({
  selector: 'das-client-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, RouterLink, PageHeaderComponent],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss',
})
export class ClientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ClientsFacade);
  private route = inject(ActivatedRoute);

  protected readonly isSaving$ = this.facade.isFormSaving$;
  protected readonly errorMessageKey$ = this.facade.formErrorMessageKey$;
  protected readonly plans$ = this.facade.plans$;

  protected editingId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    companyName: ['', [Validators.required]],
    contactName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    planId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.facade.loadPlans();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.editingId = id;
    this.form.controls.login.disable();

    this.facade.load();
    this.facade.getById$(id).subscribe((client) => {
      if (!client) return;
      this.form.patchValue({
        login: client.email,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone ?? '',
        planId: client.planId,
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { login, companyName, contactName, email, phone, planId } = this.form.getRawValue();

    if (this.editingId) {
      this.facade.update(this.editingId, { companyName, contactName, email, phone: phone || null, planId });
    } else {
      this.facade.create({ login, companyName, contactName, email, phone: phone || null, planId });
    }
  }
}
