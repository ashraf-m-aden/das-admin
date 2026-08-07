import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { RedoSubmissionType } from '../../../core/models/das.models';
import { RejectReasonPreset, ReviewItem } from '../../../core/review/models/review.models';

const REASON_PRESET_TEXT: Record<RejectReasonPreset, string> = {
  photo_retake: 'Merci de reprendre les photos : cadrage ou luminosité insuffisants.',
  gps_recheck: 'Précision GPS insuffisante — merci de vous repositionner sur place et de renvoyer.',
  other: '',
};

@Component({
  selector: 'das-review-queue',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe],
  templateUrl: './review-queue.component.html',
  styleUrl: './review-queue.component.scss',
})
export class ReviewQueueComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(ReviewFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly decisionErrorMessageKey$ = this.facade.decisionErrorMessageKey$;

  protected readonly openRejectPanelId = signal<string | null>(null);

  protected readonly filterForm = this.fb.group({
    submissionType: [null as RedoSubmissionType | null],
  });

  protected readonly rejectForm = this.fb.nonNullable.group({
    preset: ['photo_retake' as RejectReasonPreset],
    reason: [REASON_PRESET_TEXT['photo_retake']],
  });

  ngOnInit(): void {
    this.facade.load();

    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setFilters({ submissionType: value.submissionType ?? null });
    });
  }

  isDeciding$(id: string) {
    return this.facade.isDeciding$(id);
  }

  approve(item: ReviewItem): void {
    this.facade.approve(item.id, item.submissionType);
  }

  openRejectPanel(item: ReviewItem): void {
    this.openRejectPanelId.set(item.id);
    this.rejectForm.setValue({ preset: 'photo_retake', reason: REASON_PRESET_TEXT['photo_retake'] });
  }

  closeRejectPanel(): void {
    this.openRejectPanelId.set(null);
  }

  onPresetChange(preset: RejectReasonPreset): void {
    this.rejectForm.patchValue({ preset, reason: REASON_PRESET_TEXT[preset] });
  }

  confirmReject(item: ReviewItem): void {
    if (this.rejectForm.invalid || !this.rejectForm.value.reason?.trim()) return;

    this.facade.reject(item.id, item.submissionType, {
      preset: this.rejectForm.getRawValue().preset,
      reason: this.rejectForm.getRawValue().reason,
    });
    this.openRejectPanelId.set(null);
  }
}
