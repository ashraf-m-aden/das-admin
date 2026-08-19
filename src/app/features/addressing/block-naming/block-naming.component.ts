import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AddressingFacade } from '../../../core/addressing/store/addressing.facade';
import { BlockToName } from '../../../core/addressing/models/addressing.models';

type NameForm = FormGroup<{ name: FormControl<string> }>;

/**
 * Nommage direct par un admin — les blocs avec une suggestion terrain en attente n'apparaissent
 * pas ici, ils se traitent dans la file de validation unifiée (`/verification`).
 */
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
  protected readonly errorMessageKey$ = this.facade.blockActionErrorMessageKey$;

  protected readonly filterForm = this.fb.nonNullable.group({ search: [''], onlyUnnamed: [true] });

  protected readonly nameForms = new Map<string, NameForm>();

  ngOnInit(): void {
    this.facade.loadBlocksToName();
    this.filterForm.valueChanges.subscribe((v) =>
      this.facade.setBlockFilters({ search: v.search ?? '', onlyUnnamed: v.onlyUnnamed ?? true }),
    );
    this.facade.blocks$.subscribe((blocks) => {
      this.nameForms.clear();
      for (const b of blocks) {
        this.nameForms.set(b.id, this.fb.nonNullable.group({ name: ['', [Validators.required]] }));
      }
    });
  }

  nameFormFor(id: string): NameForm { return this.nameForms.get(id)!; }
  isSaving$(id: string) { return this.facade.isSavingBlock$(id); }

  submitDirectName(block: BlockToName): void {
    if (block.number === null) return; // garde-fou : bouton masqué côté template, cf. blocks.missingNumberHint
    const form = this.nameFormFor(block.id);
    if (form.invalid) { form.markAllAsTouched(); return; }
    this.facade.setBlockName(block.id, {
      code: block.code, name: form.getRawValue().name, number: block.number, boundaryWkt: block.boundaryWkt,
    });
  }
}
