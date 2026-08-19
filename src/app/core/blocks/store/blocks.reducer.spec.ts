import { blocksFeature } from './blocks.reducer';
import { BlocksActions } from './blocks.actions';
import { initialBlocksState } from './blocks.state';
import { Block } from '../../models/das.models';

const reduce = blocksFeature.reducer;

const bloc = (id: string, name: string | null): Block => ({
  id, code: `CODE-${id}`, name, number: 1, quartierId: 'q1', boundaryWkt: null,
});

describe('blocksFeature reducer — updateBlockSuccess', () => {
  it('remplace le bloc modifié dans items[] sans toucher aux autres', () => {
    const state = { ...initialBlocksState, items: [bloc('a', null), bloc('b', null)] };
    const updated = bloc('a', 'Avenue Nasser');

    const next = reduce(state, BlocksActions.updateBlockSuccess({ block: updated }));

    expect(next.items.find((b) => b.id === 'a')?.name).toBe('Avenue Nasser');
    expect(next.items.find((b) => b.id === 'b')?.name).toBeNull();
  });

  it('met aussi à jour `selected` si c\'est le bloc modifié', () => {
    const state = { ...initialBlocksState, items: [bloc('a', null)], selected: bloc('a', null) };
    const updated = bloc('a', 'Avenue Nasser');

    const next = reduce(state, BlocksActions.updateBlockSuccess({ block: updated }));

    expect(next.selected?.name).toBe('Avenue Nasser');
  });

  it('ne touche pas `selected` si un AUTRE bloc a été modifié', () => {
    const state = { ...initialBlocksState, items: [bloc('a', null), bloc('b', null)], selected: bloc('b', null) };
    const updated = bloc('a', 'Avenue Nasser');

    const next = reduce(state, BlocksActions.updateBlockSuccess({ block: updated }));

    expect(next.selected?.name).toBeNull();
  });

  it('arrête isUpdating après succès comme après échec', () => {
    const updating = { ...initialBlocksState, isUpdating: true };

    expect(reduce(updating, BlocksActions.updateBlockSuccess({ block: bloc('a', 'x') })).isUpdating).toBe(false);
    expect(reduce(updating, BlocksActions.updateBlockFailure({ errorMessageKey: 'common.error' })).isUpdating).toBe(false);
  });
});
