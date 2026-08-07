import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { BlockToName } from '../../../core/addressing/models/addressing.models';

type BlockNameForm = FormGroup<{
  name: FormControl<string>;
}>;

@Component({
  selector: 'das-block-naming',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule],
  templateUrl: './block-naming.component.html',
  styleUrl: './block-naming.component.scss',
})
export class BlockNamingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(AddressingFacade);

  protected readonly blocks$ = this.facade.blocks$;
  protected readonly isLoading$ = this.facade.isBlocksLoading$;
  protected readonly errorMessageKey$ = this.facade.blockSaveErrorMessageKey$;

  protected readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    onlyUnnamed: [true],
  });

  protected readonly forms = new Map<string, BlockNameForm>();

  ngOnInit(): void {
    this.facade.loadBlocksToName();

    this.filterForm.valueChanges.subscribe((value) => {
      this.facade.setBlockFilters({ search: value.search ?? '', onlyUnnamed: value.onlyUnnamed ?? true });
    });

    this.facade.blocks$.subscribe((blocks) => this.rebuildForms(blocks));
  }

  private buildForm(block: BlockToName): BlockNameForm {
    return this.fb.nonNullable.group({
      name: [block.name ?? block.suggestedName ?? '', [Validators.required]],
    });
  }

  private rebuildForms(blocks: BlockToName[]): void {
    this.forms.clear();
    for (const block of blocks) {
      this.forms.set(block.id, this.buildForm(block));
    }
  }

  formFor(id: string): BlockNameForm {
    return this.forms.get(id)!;
  }

  isSaving$(id: string) {
    return this.facade.isSavingBlock$(id);
  }

  confirm(block: BlockToName): void {
    const form = this.formFor(block.id);
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.facade.assignBlockName(block.id, { name: form.getRawValue().name });
  }
}
