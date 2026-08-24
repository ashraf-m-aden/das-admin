import { TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of } from 'rxjs';
import { HierarchyFacade } from './hierarchy.facade';
import { HierarchyApiPort } from '../services/hierarchy-api.port';
import { HierarchyNode } from '../models/hierarchy.models';

const node = (id: string): HierarchyNode => ({ id, level: 'quartier', code: id, name: id, parentId: null });

/**
 * Verrouille le fix hiérarchie de cette session : le select Quartier se débloque sur `cityId`
 * seul (pas `zoneId`), et `communeId`/`zoneId` ne partent au back que s'ils sont choisis.
 */
describe('HierarchyFacade — reloadQuartiers', () => {
  let facade: HierarchyFacade;
  let quartiersSpy: Mock;

  beforeEach(() => {
    quartiersSpy = vi.fn().mockReturnValue(of([node('q1')]));
    const api: HierarchyApiPort = {
      cities: vi.fn().mockReturnValue(of([])),
      communes: vi.fn().mockReturnValue(of([])),
      zones: vi.fn().mockReturnValue(of([])),
      quartiers: quartiersSpy,
      closes: vi.fn().mockReturnValue(of([])),
      blocs: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({ providers: [{ provide: HierarchyApiPort, useValue: api }] });
    facade = TestBed.inject(HierarchyFacade);
  });

  it('charge les quartiers avec cityId seul quand aucune commune/zone n\'est choisie', () => {
    facade.selectCity('city-1');

    expect(quartiersSpy).toHaveBeenCalledWith('city-1', null, null);
    expect(facade.quartiers()).toEqual([node('q1')]);
  });

  it('ajoute communeId aux quartiers dès qu\'une commune est choisie', () => {
    facade.selectCity('city-1');
    facade.selectCommune('commune-1');

    expect(quartiersSpy).toHaveBeenCalledWith('city-1', 'commune-1', null);
  });

  it('ajoute zoneId aux quartiers dès qu\'une zone est choisie', () => {
    facade.selectCity('city-1');
    facade.selectCommune('commune-1');
    facade.selectZone('zone-1');

    expect(quartiersSpy).toHaveBeenCalledWith('city-1', 'commune-1', 'zone-1');
  });

  it('revient à cityId seul quand la commune repasse à "tous"', () => {
    facade.selectCity('city-1');
    facade.selectCommune('commune-1');
    facade.selectCommune(null);

    expect(quartiersSpy).toHaveBeenCalledWith('city-1', null, null);
  });

  it('ne charge aucun quartier tant qu\'aucune ville n\'est choisie', () => {
    facade.selectCity(null);

    expect(quartiersSpy).not.toHaveBeenCalled();
    expect(facade.quartiers()).toEqual([]);
  });
});
