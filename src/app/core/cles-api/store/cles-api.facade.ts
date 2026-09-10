import { Injectable, computed, inject, signal } from '@angular/core';
import { ClesApiPort } from '../services/cles-api.port';
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

  private readonly _cles = signal<CleApi[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  /**
   * Le secret de la dernière clé créée. ⚠️ Vit en MÉMOIRE seulement, et disparaît au premier
   * rechargement : le back ne peut pas le redonner. C'est ce qui oblige l'écran à le montrer
   * tout de suite.
   */
  private readonly _secret = signal<CleApi | null>(null);

  readonly cles = this._cles.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();
  readonly secret = this._secret.asReadonly();

  readonly actives = computed(() => this._cles().filter((c) => c.estActive).length);

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

  creer(consommateur: string): void {
    this._erreur.set(null);
    this.api.creer({ consommateur }).subscribe({
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
