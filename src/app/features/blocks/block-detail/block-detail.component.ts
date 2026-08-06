import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private facade = inject(BlocksFacade);

  protected readonly block$ = this.facade.selected$;
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly errorMessageKey$ = this.facade.detailErrorMessageKey$;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.facade.loadDetail(id);
  }

  ngOnDestroy(): void {
    this.facade.clearDetail();
  }
}
