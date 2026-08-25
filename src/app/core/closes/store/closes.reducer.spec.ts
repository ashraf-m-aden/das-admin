import { closesFeature } from './closes.reducer';
import { ClosesActions } from './closes.actions';
import { initialClosesState } from './closes.state';
import { selectBlocOwner, selectTakenNumbers } from './closes.selectors';
import { Close } from '../models/closes.models';
import { Block } from '../../models/das.models';

const reduce = closesFeature.reducer;

const close = (id: string, number: number, blocIds: string[]): Close => ({
  id, quartierId: 'q1', quartierNom: 'Quartier 7', quartierCode: 'Q7',
  streetId: `street-${id}`, streetCode: 'STR-1', streetName: null,
  number, code: `CL-0${number}`, label: String(number),
  blocs: blocIds.map((b) => ({ id: b, code: `CODE-${b}`, name: null, number: 1 })),
  adresseCount: 0, boundaryWkt: null,
});

/** `closeId` est ce qui relie un bloc à sa close — c'est lui que `selectBlocOwner` lit. */
const bloc = (id: string, closeId: string | null = null): Block => ({
  id, code: `CODE-${id}`, name: null, number: 1, quartierId: 'q1', closeId, boundaryWkt: null,
});

describe('closesFeature reducer', () => {
  it('vide closes ET blocs au changement de quartier — garder les anciens afficherait des blocs hors quartier', () => {
    const state = {
      ...initialClosesState,
      quartierId: 'q1',
      closes: [close('c1', 1, ['b1'])],
      blocs: [bloc('b1')],
      saveErrorMessageKey: 'closes.errorNumberUsed',
    };

    const next = reduce(state, ClosesActions.selectQuartier({ quartierId: 'q2' }));

    expect(next.quartierId).toBe('q2');
    expect(next.closes).toEqual([]);
    expect(next.blocs).toEqual([]);
    expect(next.saveErrorMessageKey).toBeNull();
  });

  it('incrémente saveTick sur succès — c\'est ce qui referme le formulaire', () => {
    const next = reduce({ ...initialClosesState, isSaving: true }, ClosesActions.saveCloseSuccess());

    expect(next.isSaving).toBe(false);
    expect(next.saveTick).toBe(1);
  });

  it('n\'incrémente PAS saveTick sur échec — le formulaire doit rester ouvert avec la saisie', () => {
    const next = reduce(
      { ...initialClosesState, isSaving: true },
      ClosesActions.saveCloseFailure({ errorMessageKey: 'closes.errorNumberUsed' }),
    );

    expect(next.isSaving).toBe(false);
    expect(next.saveTick).toBe(0);
    expect(next.saveErrorMessageKey).toBe('closes.errorNumberUsed');
  });

  it('efface l\'erreur précédente quand une nouvelle écriture démarre', () => {
    const state = { ...initialClosesState, saveErrorMessageKey: 'closes.errorNumeroCollision' };

    const next = reduce(state, ClosesActions.saveClose({
      id: null,
      payload: { quartierId: 'q1', streetId: 's1', number: 2, code: 'CL-02', boundaryWkt: null },
    }));

    expect(next.isSaving).toBe(true);
    expect(next.saveErrorMessageKey).toBeNull();
  });
});

describe('closes selectors', () => {
  it('selectBlocOwner lit Bloc.closeId — la source de vérité du rattachement', () => {
    const blocs = [bloc('b1', 'c1'), bloc('b2', 'c1'), bloc('b3', 'c2'), bloc('b4', null)];
    const closes = [close('c1', 1, ['b1', 'b2']), close('c2', 2, ['b3'])];

    const owner = selectBlocOwner.projector(blocs, closes);

    expect(owner.get('b1')?.id).toBe('c1');
    expect(owner.get('b2')?.id).toBe('c1');
    expect(owner.get('b3')?.id).toBe('c2');
    expect(owner.get('b4')).toBeUndefined();
  });

  it('selectTakenNumbers indexe les numéros déjà pris dans le quartier', () => {
    const taken = selectTakenNumbers.projector([close('c1', 1, []), close('c2', 7, [])]);

    expect(taken.get(1)?.id).toBe('c1');
    expect(taken.get(7)?.id).toBe('c2');
    expect(taken.get(2)).toBeUndefined();
  });
});
