import { Component, inject, signal } from '@angular/core';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { ToastService } from '../../core/ui/toast/toast.service';

@Component({
  selector: 'das-profile',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, PageHeaderComponent,UpperCasePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthFacade);
  private transloco = inject(TranslocoService);
  private toast = inject(ToastService);

  protected readonly fullName$ = this.auth.fullName$;
  protected readonly roles$ = this.auth.roles$;

  protected readonly langs = this.transloco.getAvailableLangs().map((l) => (typeof l === 'string' ? l : l.id));
  protected readonly activeLang = signal(this.transloco.getActiveLang());
  protected readonly theme = signal<'light' | 'dark'>('light');

  protected readonly infoForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    current: ['', [Validators.required]],
    next: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  constructor() {
    this.fullName$.subscribe((n) => this.infoForm.patchValue({ fullName: n ?? '' }, { emitEvent: false }));
  }

  saveInfo(): void {
    if (this.infoForm.invalid) { this.infoForm.markAllAsTouched(); return; }
    // TODO: brancher sur l'API compte quand elle existera
    this.toast.success('feedback.saved');
  }

  changePassword(): void {
    const v = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    if (v.next !== v.confirm) { this.toast.error('profile.passwordMismatch'); return; }
    // TODO: appel API changement de mot de passe
    this.toast.success('profile.passwordChanged');
    this.passwordForm.reset({ current: '', next: '', confirm: '' });
  }

  setLang(lang: string): void {
    this.transloco.setActiveLang(lang);
    this.activeLang.set(lang);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
    // TODO: appliquer un attribut data-theme au <html> + persister (préférence utilisateur)
  }

  initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
  }
}
