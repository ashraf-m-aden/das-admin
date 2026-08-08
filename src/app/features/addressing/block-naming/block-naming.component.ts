import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { BlockToName } from '../../../core/addressing/models/addressing.models';

type NameForm = FormGroup<{ name: FormControl<string> }>;
type RejectForm = FormGroup<{ reason: FormControl<string> }>;

@Component({
  selector: 'das-block-naming',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe],
  templateUrl: './block-naming.component.html',
  styleUrl: './block-naming.component.scss',
})
export class BlockNamingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(AddressingFacade);

  protected readonly blocks$ = this.facade.blocks$;
  protected readonly isLoading$ = this.facade.isBlocksLoading$;
  protected readonly errorMessageKey$ = this.facade.blockActionErrorMessageKey$;

  protected readonly filterForm = this.fb.nonNullable.group({ search: [''], onlyUnnamed: [true] });

  protected readonly nameForms = new Map<string, NameForm>();
  protected readonly rejectForms = new Map<string, RejectForm>();
  /** id du bloc dont le panneau "motif de rejet" est ouvert */
  protected readonly openRejectId = signal<string | null>(null);

  ngOnInit(): void {
    this.facade.loadBlocksToName();
    this.filterForm.valueChanges.subscribe((v) =>
      this.facade.setBlockFilters({ search: v.search ?? '', onlyUnnamed: v.onlyUnnamed ?? true }),
    );
    this.facade.blocks$.subscribe((blocks) => {
      this.nameForms.clear();
      this.rejectForms.clear();
      for (const b of blocks) {
        this.nameForms.set(b.id, this.fb.nonNullable.group({ name: ['', [Validators.required]] }));
        this.rejectForms.set(b.id, this.fb.nonNullable.group({ reason: ['', [Validators.required]] }));
      }
    });
  }

  nameFormFor(id: string): NameForm { return this.nameForms.get(id)!; }
  rejectFormFor(id: string): RejectForm { return this.rejectForms.get(id)!; }
  isSaving$(id: string) { return this.facade.isSavingBlock$(id); }

  submitDirectName(block: BlockToName): void {
    const form = this.nameFormFor(block.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.setBlockName(block.id, form.getRawValue().name);
  }

  approve(block: BlockToName): void {
    if (!block.pendingSuggestion) return;
    this.facade.approveBlockSuggestion(block.id, block.pendingSuggestion.id);
  }

  openReject(id: string): void { this.openRejectId.set(id); }
  closeReject(): void { this.openRejectId.set(null); }

  confirmReject(block: BlockToName): void {
    if (!block.pendingSuggestion) return;
    const form = this.rejectFormFor(block.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.rejectBlockSuggestion(block.id, block.pendingSuggestion.id, form.getRawValue().reason);
    this.openRejectId.set(null);
  }
}
