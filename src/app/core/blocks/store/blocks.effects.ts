import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, exhaustMap, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { BlocksActions } from './blocks.actions';
import { blocksFeature } from './blocks.reducer';
import { BlocksApiPort } from '../services/blocks-api.port';

@Injectable()
export class BlocksEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private blocksApi = inject(BlocksApiPort);

  loadBlocks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BlocksActions.loadBlocks),
      withLatestFrom(this.store.select(blocksFeature.selectFilters)),
      exhaustMap(([, filters]) =>
        this.blocksApi.list(filters).pipe(
          map((items) => BlocksActions.loadBlocksSuccess({ items })),
          catchError(() => of(BlocksActions.loadBlocksFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(ofType(BlocksActions.setFilters), debounceTime(300), map(() => BlocksActions.loadBlocks())),
  );

  loadBlockDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BlocksActions.loadBlockDetail),
      exhaustMap(({ id }) =>
        this.blocksApi.getById(id).pipe(
          map((block) => BlocksActions.loadBlockDetailSuccess({ block })),
          catchError(() => of(BlocksActions.loadBlockDetailFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  updateBlock$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BlocksActions.updateBlock),
      mergeMap(({ id, payload }) =>
        this.blocksApi.update(id, payload).pipe(
          map((block) => BlocksActions.updateBlockSuccess({ block })),
          catchError(() => of(BlocksActions.updateBlockFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
