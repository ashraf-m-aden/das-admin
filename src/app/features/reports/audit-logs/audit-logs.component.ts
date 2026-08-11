import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AuditFacade } from '../../../core/audit/store/audit.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { AuditAction } from '../../../core/audit/models/audit.models';

const ACTION_COLOR: Record<AuditAction, string> = {
  created: '#2563eb', updated: '#d97706', approved: '#16a34a', rejected: '#dc2626', published: '#7c3aed', deleted: '#6b7280', login: '#0d9488',
};

@Component({
  selector: 'das-audit-logs',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss',
})
export class AuditLogsComponent implements OnInit {
  private fb = inject(FormBuilder);
  protected facade = inject(AuditFacade);

  protected readonly actions: AuditAction[] = ['created', 'updated', 'approved', 'rejected', 'published', 'login'];
  protected readonly filterForm = this.fb.group({ search: [''], action: [null as AuditAction | null] });

  ngOnInit(): void {
    this.reload();
    this.filterForm.valueChanges.subscribe(() => this.reload());
  }

  private reload(): void {
    const v = this.filterForm.getRawValue();
    this.facade.load({ search: v.search ?? '', action: v.action ?? null });
  }

  actionColor(a: AuditAction): string { return ACTION_COLOR[a]; }
  actionLabelKey(a: AuditAction): string { return `audit.action.${a}`; }
}
