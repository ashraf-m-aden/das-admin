import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { ReviewItem, RejectReasonPreset } from '../../../core/review/models/review.models';
import { RedoSubmissionType, SubmissionStatus } from '../../../core/models/das.models';

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  draft: '#9aa3b5',
  submitted: '#7c3aed',
  approved: '#16a34a',
  needs_redo: '#dc2626',
};

@Component({
  selector: 'das-review-queue',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './review-queue.component.html',
  styleUrl: './review-queue.component.scss',
})
export class ReviewQueueComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ReviewFacade);

  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as ReviewItem[] });
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly errorMessageKey$ = this.facade.decisionErrorMessageKey$;

  protected readonly selectedId = signal<string | null>(null);
  protected readonly rejectOpen = signal(false);

  protected readonly typeFilter = signal<RedoSubmissionType | null>(null);
  protected readonly presets: RejectReasonPreset[] = ['photo_retake', 'gps_recheck', 'other'];

  protected readonly rejectForm = this.fb.nonNullable.group({
    preset: ['photo_retake' as RejectReasonPreset, [Validators.required]],
    reason: ['', [Validators.required]],
  });

protected readonly selected = computed<ReviewItem | null>(() => {
    const id = this.selectedId();
    return this.items().find((i) => i.id === id) ?? this.items()[0] ?? null;
  });
  ngOnInit(): void {
    this.facade.load();
  }

  setTypeFilter(type: RedoSubmissionType | null): void {
    this.typeFilter.set(type);
    this.facade.setFilters({ submissionType: type });
  }

  select(item: ReviewItem): void {
    this.selectedId.set(item.id);
    this.rejectOpen.set(false);
  }

  isDeciding$(id: string) {
    return this.facade.isDeciding$(id);
  }

  approve(item: ReviewItem): void {
    this.facade.approve(item.id, item.submissionType);
  }

  openReject(): void {
    this.rejectOpen.set(true);
  }

  cancelReject(): void {
    this.rejectOpen.set(false);
  }

  confirmReject(item: ReviewItem): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    this.facade.reject(item.id, item.submissionType, this.rejectForm.getRawValue());
    this.rejectOpen.set(false);
    this.rejectForm.reset({ preset: 'photo_retake', reason: '' });
  }

  statusColor(status: SubmissionStatus): string {
    return STATUS_COLOR[status];
  }

  statusLabelKey(status: SubmissionStatus): string {
    return `status.submission.${status}`;
  }
}
