import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../../core/clients/store/clients.facade';

@Component({
  selector: 'das-zone-access',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './zone-access.component.html',
  styleUrl: './zone-access.component.scss',
})
export class ZoneAccessComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ClientsFacade);
  private route = inject(ActivatedRoute);

  protected readonly clientId = this.route.parent!.snapshot.paramMap.get('id')!;
  protected readonly zoneAccess$ = this.facade.zoneAccess$;
  protected readonly isLoading$ = this.facade.isZoneAccessLoading$;
  protected readonly availableZones$ = this.facade.availableZones$;
  protected readonly errorMessageKey$ = this.facade.zoneAccessErrorMessageKey$;

  protected readonly form = this.fb.nonNullable.group({
    zoneId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.facade.loadZoneAccess(this.clientId);
    this.facade.loadAvailableZones();
  }

  grant(): void {
    if (this.form.invalid) return;
    this.facade.grantZoneAccess(this.clientId, { zoneId: this.form.getRawValue().zoneId });
    this.form.reset({ zoneId: '' });
  }

  revoke(zoneAccessId: string): void {
    this.facade.revokeZoneAccess(this.clientId, zoneAccessId);
  }
}
