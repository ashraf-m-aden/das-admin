import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { DasNumberPipe } from '../../../core/i18n/das-locale.pipes';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BlockStatus } from '../../../core/models/das.models';
import { StaffMember } from '../../../core/staff/models/staff.models';

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasNumberPipe, PageHeaderComponent],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private facade = inject(BlocksFacade);
  private staffFacade = inject(StaffFacade);

  private readonly blockId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly block = toSignal(this.facade.selected$);
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly isSavingName$ = this.facade.isSavingName$;
  protected readonly isAssigning$ = this.facade.isAssigning$;

  private readonly staff = toSignal(this.staffFacade.items$, { initialValue: [] as StaffMember[] });

  protected readonly agents = computed(() =>
    this.staff().filter((s) => s.isActive && s.roles.includes('AgentTerrain')),
  );

  protected readonly assignedName = computed(() => {
    const b = this.block();
    if (!b?.assignedUserId) return null;
    return this.staff().find((s) => s.id === b.assignedUserId)?.fullName ?? null;
  });

  protected readonly nameForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  protected readonly assignForm = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
  });

  protected readonly lotsCompleted = computed(() =>
    (this.block()?.lots ?? []).reduce((sum, l) => sum + l.actualUnitCount, 0),
  );
  protected readonly lotsPlanned = computed(() =>
    (this.block()?.lots ?? []).reduce((sum, l) => sum + l.plannedUnitCount, 0),
  );
  protected readonly lotsProgress = computed(() => {
    const planned = this.lotsPlanned();
    return planned === 0 ? 0 : Math.round((this.lotsCompleted() / planned) * 100);
  });

  constructor() {
    effect(() => {
      const b = this.block();
      if (b) {
        this.nameForm.patchValue({ name: b.name ?? '' }, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadDetail(this.blockId);
    this.staffFacade.load();
  }

  ngOnDestroy(): void {
    this.facade.clearDetail();
  }

  saveName(): void {
    if (this.nameForm.invalid) return;
    this.facade.setName(this.blockId, this.nameForm.controls.name.value!.trim());
  }

  assign(): void {
    if (this.assignForm.invalid) return;
    this.facade.assign(this.blockId, this.assignForm.getRawValue().userId);
  }

  hectares(areaM2: number): number { return areaM2 / 10000; }
  statusBadgeClass(status: BlockStatus): string { return `das-badge das-badge--${status.replace('_', '-')}`; }
  statusLabelKey(status: BlockStatus): string { return `status.block.${status}`; }
}
