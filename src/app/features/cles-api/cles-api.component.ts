import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ClesApiFacade } from '../../core/cles-api/store/cles-api.facade';
import { UUID } from '../../core/models/das.models';

/**
 * Gestion des clés d'accès au référentiel PUBLIC — carte, tuiles et recherche.
 *
 * <b>Ce que l'écran doit rendre évident.</b> Une clé délivrée ouvre le référentiel à un tiers, et
 * son secret n'apparaît qu'une fois. D'où le bandeau qui le met en avant, l'avertissement
 * explicite qu'il ne reviendra pas, et une confirmation avant toute révocation — révoquer coupe
 * un consommateur en production.
 */
@Component({
  selector: 'das-cles-api',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslocoModule],
  templateUrl: './cles-api.component.html',
  styleUrl: './cles-api.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClesApiComponent implements OnInit {
  private readonly facade = inject(ClesApiFacade);
  private readonly transloco = inject(TranslocoService);

  protected readonly cles = this.facade.cles;
  protected readonly chargement = this.facade.chargement;
  protected readonly erreur = this.facade.erreur;
  protected readonly secret = this.facade.secret;
  protected readonly actives = this.facade.actives;

  protected readonly consommateur = signal('');
  protected readonly copie = signal(false);

  ngOnInit(): void {
    this.facade.charger();
  }

  protected creer(): void {
    const nom = this.consommateur().trim();
    if (nom.length < 2) return;
    this.facade.creer(nom);
    this.consommateur.set('');
  }

  /**
   * Révocation confirmée. C'est une action qui coupe un consommateur en production — et la clé
   * n'est pas récupérable ensuite, il faudra en délivrer une nouvelle.
   */
  protected revoquer(id: UUID, nom: string): void {
    if (!window.confirm(this.transloco.translate('clesApi.revoquerConfirm', { nom }))) return;
    this.facade.revoquer(id);
  }

  protected async copier(valeur: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(valeur);
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 2000);
    } catch {
      // Le presse-papiers peut être refusé (page non sécurisée, permission). Le secret reste
      // sélectionnable à la main : on ne bloque rien, on n'affiche simplement pas la confirmation.
    }
  }

  protected fermerSecret(): void {
    this.facade.oublierSecret();
  }
}
