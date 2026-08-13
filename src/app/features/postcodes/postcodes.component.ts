import { Component, OnInit, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { PostcodesFacade } from '../../core/postcodes/store/postcodes.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { PostcodeStatus } from '../../core/models/das.models';

const STATUS_COLOR: Record<PostcodeStatus, string> = { active: '#16a34a', reserved: '#d97706', retired: '#9aa3b5' };

@Component({
  selector: 'das-postcodes',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './postcodes.component.html',
  styleUrl: './postcodes.component.scss',
})
export class PostcodesComponent implements OnInit {
  private fb = inject(FormBuilder);
  protected facade = inject(PostcodesFacade);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^PC \d{3,5}$/)]],
    adminUnitName: ['', [Validators.required]],
    region: ['', [Validators.required]],
  });

  protected readonly maxMonthly = computed(() => Math.max(1, ...this.facade.monthly().map((m) => m.count)));

  ngOnInit(): void { this.facade.load(); }

  allocate(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.facade.allocate(this.form.getRawValue());
    this.form.reset({ code: '', adminUnitName: '', region: '' });
  }

  barHeight(count: number): number { return Math.round((count / this.maxMonthly()) * 100); }
  statusColor(s: PostcodeStatus): string { return STATUS_COLOR[s]; }
  statusLabelKey(s: PostcodeStatus): string { return `postcodes.status.${s}`; }
}
