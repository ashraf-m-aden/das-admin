import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { ReviewItem } from '../../../core/review/models/review.models';
import { RedoSubmissionType } from '../../../core/models/das.models';

@Component({
  selector: 'das-verification-queue',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './verification-queue.component.html',
  styleUrl: './verification-queue.component.scss',
})
export class VerificationQueueComponent implements OnInit {
  private fb = inject(FormBuilder);
  protected facade = inject(ReviewFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly decisionError$ = this.facade.decisionErrorMessageKey$;

  protected readonly typeFilter = signal<RedoSubmissionType | null>(null);
  protected readonly rejectingId = signal<string | null>(null);
  protected readonly expandedPhotosId = signal<string | null>(null);

  protected readonly rejectForm = this.fb.nonNullable.group({ reason: [''] });

  ngOnInit(): void {
    this.facade.load();
  }

  filterType(type: RedoSubmissionType | null): void {
    this.typeFilter.set(type);
    this.facade.setFilters({ submissionType: type });
  }

  validate(item: ReviewItem): void {
    this.facade.validate(item.id);
  }

  approveSuggestion(item: ReviewItem): void {
    if (item.submissionType === 'property') return;
    this.facade.approveSuggestion(item.id, item.submissionType);
  }

  startReject(item: ReviewItem): void {
    this.rejectForm.reset({ reason: '' });
    this.rejectingId.set(item.id);
  }
  cancelReject(): void {
    this.rejectingId.set(null);
  }

  confirmReject(item: ReviewItem): void {
    const reason = this.rejectForm.getRawValue().reason.trim();
    this.facade.reject(item.id, item.submissionType, reason);
    this.rejectingId.set(null);
  }

  requestCorrection(item: ReviewItem): void {
    this.facade.requestCorrection(item.id);
  }

  togglePhotos(item: ReviewItem): void {
    if (this.expandedPhotosId() === item.id) {
      this.expandedPhotosId.set(null);
      return;
    }
    this.expandedPhotosId.set(item.id);
    this.facade.loadPhotos(item.id);
  }

  typeLabelKey(t: RedoSubmissionType): string {
    return `verification.type.${t}`;
  }

  notSurveyableReasonKey(reason: string): string {
    return `verification.notSurveyableReason.${reason.toLowerCase()}`;
  }
}
