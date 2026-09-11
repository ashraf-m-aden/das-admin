import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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

  protected readonly villes = this.facade.villes;

  protected readonly consommateur = signal('');

  /** Ce qui vient d'être copié. Deux boutons voisins : un seul drapeau les ferait clignoter ensemble. */
  protected readonly copie = signal<'secret' | 'lien' | null>(null);

  /**
   * Le lien de remise à usage unique, composé sur l'origine COURANTE.
   *
   * ⚠️ C'est délibérément le front qui le compose. Le back ne connaît pas l'URL publique sous
   * laquelle on le joint — derrière nginx, en local, ou depuis un tunnel — et la lui faire
   * deviner produirait des liens morts que seul le destinataire découvrirait.
   *
   * `null` quand le back n'a pas de clé de chiffrement configurée : la remise est alors
   * désactivée et l'écran se rabat sur le seul affichage du secret, comme avant.
   */
  protected readonly lienRemise = computed(() => {
    const jeton = this.secret()?.remiseJeton;
    return jeton ? `${window.location.origin}/api/cles-api/remise/${jeton}` : null;
  });

  /**
   * Les villes cochées pour la prochaine clé. **Vide = tout le pays**, et c'est le défaut : on
   * ne restreint que sur décision explicite.
   */
  protected readonly portee = signal<UUID[]>([]);

  protected readonly restreinte = computed(() => this.portee().length > 0);

  ngOnInit(): void {
    this.facade.charger();
    this.facade.chargerVilles();
  }

  protected basculerVille(id: UUID): void {
    this.portee.update((choisies) =>
      choisies.includes(id) ? choisies.filter((v) => v !== id) : [...choisies, id],
    );
  }

  protected estChoisie(id: UUID): boolean {
    return this.portee().includes(id);
  }

  /** Revient au défaut : tout le pays. */
  protected toutLePays(): void {
    this.portee.set([]);
  }

  protected creer(): void {
    const nom = this.consommateur().trim();
    if (nom.length < 2) return;
    this.facade.creer(nom, this.portee());
    this.consommateur.set('');
    this.portee.set([]);
  }

  /**
   * Révocation confirmée. C'est une action qui coupe un consommateur en production — et la clé
   * n'est pas récupérable ensuite, il faudra en délivrer une nouvelle.
   */
  protected revoquer(id: UUID, nom: string): void {
    if (!window.confirm(this.transloco.translate('clesApi.revoquerConfirm', { nom }))) return;
    this.facade.revoquer(id);
  }

  protected async copier(valeur: string, quoi: 'secret' | 'lien'): Promise<void> {
    try {
      await navigator.clipboard.writeText(valeur);
      this.copie.set(quoi);
      setTimeout(() => this.copie.set(null), 2000);
    } catch {
      // Le presse-papiers peut être refusé (page non sécurisée, permission). La valeur reste
      // sélectionnable à la main : on ne bloque rien, on n'affiche simplement pas la confirmation.
    }
  }

  protected fermerSecret(): void {
    this.facade.oublierSecret();
  }
}
