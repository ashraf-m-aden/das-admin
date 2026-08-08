import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthFacade } from '../../../core/auth/store/auth.facade';
import { AppConfigService } from '../../../core/config/app-config.service';

@Component({
  selector: 'das-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule, AsyncPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private facade = inject(AuthFacade);
  private config = inject(AppConfigService);

  protected readonly showPassword = signal(false);
  protected readonly isLoading$ = this.facade.isLoading$;
  protected readonly errorMessageKey$ = this.facade.errorMessageKey$;
  protected readonly isMockMode = this.config.get('useMockApi');

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.facade.login(this.form.getRawValue());
  }
}
