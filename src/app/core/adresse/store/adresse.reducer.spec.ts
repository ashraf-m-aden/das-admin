import { adresseFeature } from './adresse.reducer';
import { AdresseActions } from './adresse.actions';
import { initialAdresseState } from './adresse.state';

const reduce = adresseFeature.reducer;

describe('adresseFeature reducer', () => {
  it('setFilters remet la page à 1 et vide la sélection en cours', () => {
    const withSelection = { ...initialAdresseState, page: 4, selectedIds: ['a', 'b'] };

    const next = reduce(withSelection, AdresseActions.setFilters({ filters: { search: 'ADDR-1' } }));

    expect(next.page).toBe(1);
    expect(next.selectedIds).toEqual([]);
    expect(next.filters.search).toBe('ADDR-1');
  });

  it('setFilters fusionne les filtres sans écraser les autres champs', () => {
    const withStatus = { ...initialAdresseState, filters: { ...initialAdresseState.filters, status: 'verified' as const } };

    const next = reduce(withStatus, AdresseActions.setFilters({ filters: { search: 'x' } }));

    expect(next.filters.status).toBe('verified');
    expect(next.filters.search).toBe('x');
  });

  it('mutationSuccess vide la sélection et arrête isMutating', () => {
    const mutating = { ...initialAdresseState, isMutating: true, selectedIds: ['a', 'b'] };

    const next = reduce(mutating, AdresseActions.mutationSuccess());

    expect(next.isMutating).toBe(false);
    expect(next.selectedIds).toEqual([]);
  });

  it('mutationFailure arrête isMutating sans toucher à la sélection', () => {
    const mutating = { ...initialAdresseState, isMutating: true, selectedIds: ['a'] };

    const next = reduce(mutating, AdresseActions.mutationFailure({ errorMessageKey: 'common.error' }));

    expect(next.isMutating).toBe(false);
    expect(next.selectedIds).toEqual(['a']);
  });

  it('approveSelected et bulkUpdate déclenchent isMutating', () => {
    expect(reduce(initialAdresseState, AdresseActions.approveSelected()).isMutating).toBe(true);
    expect(
      reduce(initialAdresseState, AdresseActions.bulkUpdate({ payload: { ids: ['a'], stage: 'Published' } })).isMutating,
    ).toBe(true);
  });
});
