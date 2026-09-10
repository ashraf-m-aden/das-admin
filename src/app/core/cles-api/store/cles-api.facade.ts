import { Injectable, computed, inject, signal } from '@angular/core';
import { ClesApiPort } from '../services/cles-api.port';
import { HierarchyApiPort } from '../../hierarchy/services/hierarchy-api.port';
import { UUID } from '../../models/das.models';
import { CleApi } from '../models/cles-api.models';

/**
 * Façade de l'écran des clés d'accès public.
 *
 * <b>Sans NgRx, et c'est délibéré.</b> Le reste du dépôt passe par le store parce que ses écrans
 * partagent de l'état — la hiérarchie sélectionnée, un plan relu, une carte pilotée depuis une
 * liste. Ici rien n'est partagé : trois appels et une liste, consommés par un seul composant.
 * Monter un feature, des actions, un reducer et des effets pour cela ajouterait quatre fichiers
 * sans rien rendre.
 *
 * La règle qui compte est respectée : le composant n'injecte pas `Store`, il passe par une façade
 * (CLAUDE.md §3).
 */
@Injectable({ providedIn: 'root' })
export class ClesApiFacade {
  private readonly api = inject(ClesApiPort);

  /**
   * Les villes proposées à la délivrance viennent de la cascade hiérarchique, pas d'un port
   * dédié : `GET /api/cities` est déjà là, déjà bascullable mock/réel. Un second port pour la
   * même route donnerait deux vérités à tenir d'accord.
   */
  private readonly hierarchie = inject(HierarchyApiPort);

  private readonly _cles = signal<CleApi[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  /**
   * Le secret de la dernière clé créée. ⚠️ Vit en MÉMOIRE seulement, et disparaît au premier
   * rechargement : le back ne peut pas le redonner. C'est ce qui oblige l'écran à le montrer
   * tout de suite.
   */
  private readonly _secret = signal<CleApi | null>(null);

  /** Les villes du pays, pour le choix de la portée. Chargées une fois. */
  private readonly _villes = signal<{ id: UUID; nom: string }[]>([]);

  readonly cles = this._cles.asReadonly();
  readonly villes = this._villes.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();
  readonly secret = this._secret.asReadonly();

  readonly actives = computed(() => this._cles().filter((c) => c.estActive).length);

  chargerVilles(): void {
    if (this._villes().length > 0) return;
    this.hierarchie.cities().subscribe({
      next: (villes) => this._villes.set(villes.map((v) => ({ id: v.id, nom: v.name }))),
      // Silencieux à dessein : sans la liste, le sélecteur reste vide et la clé se délivre sur
      // tout le pays — le défaut correct. Bloquer la délivrance parce qu'un choix FACULTATIF
      // n'a pas pu être chargé serait pire que ne pas l'offrir.
      error: () => this._villes.set([]),
    });
  }

  charger(): void {
    this._chargement.set(true);
    this._erreur.set(null);
    this.api.list().subscribe({
      next: (cles) => {
        this._cles.set(cles);
        this._chargement.set(false);
      },
      error: () => {
        this._erreur.set('clesApi.erreurChargement');
        this._chargement.set(false);
      },
    });
  }

  /** @param villes Vide = tout le pays. Voir `CreerCleApiPayload.villesAutorisees`. */
  creer(consommateur: string, villes: UUID[] = []): void {
    this._erreur.set(null);
    this.api.creer({ consommateur, villesAutorisees: villes }).subscribe({
      next: (cle) => {
        this._secret.set(cle);
        this.charger();
      },
      error: () => this._erreur.set('clesApi.erreurCreation'),
    });
  }

  revoquer(id: UUID): void {
    this._erreur.set(null);
    this.api.revoquer(id).subscribe({
      next: () => this.charger(),
      error: () => this._erreur.set('clesApi.erreurRevocation'),
    });
  }

  /** Referme le bandeau du secret. Une fois fermé, il n'est plus récupérable. */
  oublierSecret(): void {
    this._secret.set(null);
  }
}
