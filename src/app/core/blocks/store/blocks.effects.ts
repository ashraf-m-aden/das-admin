import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, exhaustMap, map, of, withLatestFrom } from 'rxjs';
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

  assignBlock$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BlocksActions.assignBlock),
      exhaustMap(({ id, userId }) =>
        this.blocksApi.assign(id, userId).pipe(
          map((block) => BlocksActions.assignBlockSuccess({ block })),
          catchError(() => of(BlocksActions.assignBlockFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  setBlockName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BlocksActions.setBlockName),
      exhaustMap(({ id, name }) =>
        this.blocksApi.setName(id, name).pipe(
          map((block) => BlocksActions.setBlockNameSuccess({ block })),
          catchError(() => of(BlocksActions.setBlockNameFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
