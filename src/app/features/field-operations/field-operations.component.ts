import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldOpsFacade } from '../../core/fieldops/store/fieldops.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { CampaignStatus } from '../../core/models/das.models';

@Component({
  selector: 'das-field-operations',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './field-operations.component.html',
  styleUrl: './field-operations.component.scss',
})
export class FieldOperationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  protected facade = inject(FieldOpsFacade);

  protected readonly campaigns$ = this.facade.campaigns$;
  protected readonly isLoading$ = this.facade.isCampaignsLoading$;
  protected readonly createErrorMessageKey$ = this.facade.createCampaignErrorMessageKey$;

  protected readonly statuses: CampaignStatus[] = ['Planned', 'InProgress', 'Closed'];

  protected readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    deadline: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.facade.loadCampaigns();
  }

  filterStatus(status: CampaignStatus | null): void {
    this.facade.setCampaignFilters({ status });
  }

  createCampaign(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.facade.createCampaign(this.createForm.getRawValue());
    this.createForm.reset({ name: '', deadline: '' });
  }

  statusBadgeClass(status: CampaignStatus): string {
    return `das-badge das-badge--${status.toLowerCase()}`;
  }
}
