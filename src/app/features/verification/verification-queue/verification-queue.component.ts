import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { ReviewItem, RejectReasonPreset } from '../../../core/review/models/review.models';
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
  private facade = inject(ReviewFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly decisionError$ = this.facade.decisionErrorMessageKey$;

  protected readonly typeFilter = signal<RedoSubmissionType | null>(null);
  protected readonly rejectingId = signal<string | null>(null);

  protected readonly rejectForm = this.fb.nonNullable.group({
    preset: ['photo_retake' as RejectReasonPreset],
    reason: [''],
  });

  ngOnInit(): void { this.facade.load(); }

  filterType(type: RedoSubmissionType | null): void {
    this.typeFilter.set(type);
    this.facade.setFilters({ submissionType: type });
  }

  approve(item: ReviewItem): void { this.facade.approve(item.id, item.submissionType); }

  startReject(item: ReviewItem): void {
    this.rejectForm.reset({ preset: 'photo_retake', reason: '' });
    this.rejectingId.set(item.id);
  }
  cancelReject(): void { this.rejectingId.set(null); }

  confirmReject(item: ReviewItem): void {
    const v = this.rejectForm.getRawValue();
    this.facade.reject(item.id, item.submissionType, { preset: v.preset, reason: v.reason.trim() });
    this.rejectingId.set(null);
  }

 requestResurvey(item: ReviewItem): void { this.facade.requestResurvey(item.id, item.submissionType); }

  scoreColor(score: number | null): string {
    if (score === null) return '#9aa3b5';
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#d97706';
    return '#dc2626';
  }
  typeLabelKey(t: RedoSubmissionType): string { return `verification.type.${t}`; }
}
