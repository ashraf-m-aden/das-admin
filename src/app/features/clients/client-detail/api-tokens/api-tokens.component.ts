import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../../core/clients/store/clients.facade';

const AVAILABLE_SCOPES = ['address:lookup', 'address:route', 'address:zone_full'];

@Component({
  selector: 'das-api-tokens',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DatePipe],
  templateUrl: './api-tokens.component.html',
  styleUrl: './api-tokens.component.scss',
})
export class ApiTokensComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ClientsFacade);
  private route = inject(ActivatedRoute);

  protected readonly clientId = this.route.parent!.snapshot.paramMap.get('id')!;
  protected readonly token$ = this.facade.apiToken$;
  protected readonly isLoading$ = this.facade.isApiTokenLoading$;
  protected readonly isSaving$ = this.facade.isSavingToken$;
  protected readonly lastCreatedRawToken$ = this.facade.lastCreatedRawToken$;
  protected readonly errorMessageKey$ = this.facade.apiTokenErrorMessageKey$;
  protected readonly scopes = AVAILABLE_SCOPES;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    scopes: this.fb.nonNullable.control<string[]>([]),
  });

  ngOnInit(): void {
    this.facade.loadApiToken(this.clientId);
  }

  toggleScope(scope: string): void {
    const current = this.form.controls.scopes.value;
    this.form.controls.scopes.setValue(
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );
  }

  /** Génère un nouveau jeton — révoque automatiquement l'ancien (aucune confirmation nécessaire ici, l'ancien n'était de toute façon plus visible). */
  regenerate(): void {
    if (this.form.invalid || this.form.value.scopes?.length === 0) return;
    this.facade.regenerateApiToken(this.clientId, this.form.getRawValue());
    this.form.reset({ name: '', scopes: [] });
  }

  dismissRawToken(): void {
    this.facade.clearLastCreatedToken();
  }

  revoke(): void {
    this.facade.revokeApiToken(this.clientId);
  }
}
