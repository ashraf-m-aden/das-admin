import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldOpsFacade } from '../../../core/fieldops/store/fieldops.facade';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { StaffMember } from '../../../core/staff/models/staff.models';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { DasPagerComponent } from '../../../core/ui/pager/das-pager.component';
import { Assignment, AssignmentStatus, CampaignBloc, CampaignStatus, UUID } from '../../../core/models/das.models';

/** Une ligne du tableau : un bloc, son titulaire, et les parcelles qui en dépendent. */
interface BlocGroup {
  key: UUID;
  blocId: UUID;
  /** `null` quand le bloc n'est plus affecté à la campagne — on n'a alors ni code ni nom. */
  blocCode: string | null;
  blocName: string | null;
  agentId: UUID | null;
  agentFullName: string | null;
  assignedAtUtc: string | null;
  /** `false` pour le groupe résiduel : ni réaffectation ni retrait n'y ont de sens. */
  isAssigned: boolean;
  assignments: Assignment[];
  toDo: number;
  done: number;
  abandoned: number;
}

/**
 * La feuille de route d'une campagne : UN tableau, groupé par bloc.
 *
 * Il en remplace deux — « Blocs affectés » (une ligne par bloc) et « Feuille de route » (une
 * ligne par parcelle) — qui montraient les deux bouts du même lien sans jamais le dire. Le
 * bloc porte le titulaire, la parcelle en hérite : les empiler à plat obligeait à faire la
 * jointure de tête. Ici la parcelle se lit sous son bloc, en dépliant.
 *
 * Extrait de `campaign-detail` le 2026-08-31. Motif identique à `campaign-progress` et
 * `das-pager` : cet écran cumule les panneaux dans une seule feuille de style, et la fusion
 * des deux tableaux l'a fait franchir le budget de 8 ko — la build de production échouait.
 * Rogner le CSS traitait le symptôme ; sortir le panneau traite la cause.
 *
 * Il lit ses données par la facade, comme tout écran. Seul le cadrage de la carte reste à
 * l'hôte : c'est lui qui la porte, et « Voir » ne fait donc que remonter l'intention.
 */
@Component({
  selector: 'das-campaign-roadmap',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, DasPagerComponent],
  templateUrl: './campaign-roadmap.component.html',
  styleUrl: './campaign-roadmap.component.scss',
})
export class CampaignRoadmapComponent implements OnInit {
  protected facade = inject(FieldOpsFacade);
  private staffFacade = inject(StaffFacade);
  private fb = inject(FormBuilder);

  readonly campaignId = input.required<UUID>();
  readonly campaignStatus = input.required<CampaignStatus>();
  /**
   * Résolveur de couleur fourni par l'écran hôte, pour partager sa palette d'agents. Deux
   * générateurs qui divergent, c'est une légende fausse entre la carte et ce tableau.
   */
  readonly agentColor = input.required<(agentId: string) => string>();
  /** Bloc mis en évidence sur la carte — la carte appartient à l'hôte, pas à ce panneau. */
  readonly focusedBlocId = input<UUID | null>(null);
  readonly focusBloc = output<UUID>();

  protected readonly campaignBlocs = toSignal(this.facade.campaignBlocs$, { initialValue: [] as CampaignBloc[] });
  protected readonly assignments = toSignal(this.facade.assignments$, { initialValue: [] as Assignment[] });

  private readonly staff = toSignal(this.staffFacade.items$, { initialValue: [] as StaffMember[] });
  protected readonly agents = computed(() => this.staff().filter((s) => s.isActive && s.roles.includes('AgentTerrain')));

  protected readonly assignmentStatuses: AssignmentStatus[] = ['ToDo', 'Done', 'Abandoned'];
  protected readonly assignmentStatus = signal<AssignmentStatus | null>(null);
  protected readonly assignmentAgentId = signal<UUID | null>(null);
  protected readonly assignmentPage = signal(1);
  protected readonly assignmentPageSize = signal(25);

  protected readonly reassigningBlocId = signal<UUID | null>(null);
  protected readonly abandoningId = signal<UUID | null>(null);
  /** Un seul bloc déplié à la fois : deux listes de parcelles ouvertes se lisent mal. */
  protected readonly expandedBlocKey = signal<UUID | null>(null);
  /** Transfert en masse replié par défaut : geste rare, il ne doit pas encombrer la liste. */
  protected readonly showTransfer = signal(false);

  protected readonly reassignBlocForm = this.fb.nonNullable.group({ agentId: ['', [Validators.required]] });
  protected readonly abandonForm = this.fb.nonNullable.group({ reason: ['', [Validators.required]] });
  protected readonly transferForm = this.fb.nonNullable.group({
    fromAgentId: ['', [Validators.required]],
    toAgentId: ['', [Validators.required]],
    thisCampaignOnly: [true],
  });

  /** Agents réellement présents dans la feuille de route — filtrer sur un agent absent ne dit rien. */
  protected readonly assignmentAgents = computed(() => {
    const vus = new Map<UUID, string>();
    for (const a of this.assignments()) {
      if (a.agentId) vus.set(a.agentId, a.agentFullName ?? a.agentId);
    }
    return [...vus.entries()].map(([id, name]) => ({ id, name }));
  });

  protected readonly blocGroups = computed<BlocGroup[]>(() => {
    const agentFiltre = this.assignmentAgentId();
    const statut = this.assignmentStatus();

    // Toutes les parcelles du bloc, quel que soit l'onglet : ce sont ELLES qui donnent les
    // trois pastilles. Les compter sur la liste filtrée afficherait « 0 faites » sur un bloc
    // terminé dès qu'on ouvre l'onglet « À faire » — l'avancement dépendrait de l'onglet.
    const toutes = new Map<UUID, Assignment[]>();
    for (const a of this.assignments()) {
      const liste = toutes.get(a.blocId);
      if (liste) liste.push(a); else toutes.set(a.blocId, [a]);
    }

    const restant = new Set(toutes.keys());

    // Le filtre agent doit réduire les BLOCS aussi, pas seulement leurs parcelles : le store
    // ne filtre que les secondes, un bloc d'un autre agent restait donc affiché, vide.
    const groupes: BlocGroup[] = this.campaignBlocs()
      .filter((cb) => !agentFiltre || cb.agentId === agentFiltre)
      .map((cb) => {
        restant.delete(cb.blocId);
        return this.toGroup(cb.blocId, cb.blocCode, cb.blocName, cb.agentId, cb.agentFullName,
          cb.assignedAtUtc, true, toutes.get(cb.blocId) ?? [], statut);
      });

    /**
     * Ce qui reste : des parcelles dont le bloc n'est plus affecté à la campagne. Le back les
     * renvoie délibérément (jointure externe) pour qu'elles ne disparaissent pas des écrans
     * tout en restant comptées dans les agrégats. Elles forment donc un groupe à part, en fin
     * de liste — les taire ici reproduirait exactement le trou qu'il a voulu éviter.
     */
    for (const blocId of restant) {
      const parcelles = toutes.get(blocId)!;
      groupes.push(this.toGroup(blocId, null, null, parcelles[0].agentId, parcelles[0].agentFullName,
        null, false, parcelles, statut));
    }

    // Sous filtre de statut, un bloc sans parcelle correspondante n'a rien à montrer : le
    // garder afficherait une ligne qui se déplie sur du vide.
    return statut ? groupes.filter((g) => g.assignments.length > 0) : groupes;
  });

  /**
   * `assignments` = ce que l'onglet montre au dépliage ; les trois compteurs = le bloc ENTIER.
   * Les deux ne viennent volontairement pas de la même liste.
   */
  private toGroup(
    blocId: UUID, blocCode: string | null, blocName: string | null,
    agentId: UUID | null, agentFullName: string | null,
    assignedAtUtc: string | null, isAssigned: boolean,
    toutesParcelles: Assignment[], statut: AssignmentStatus | null,
  ): BlocGroup {
    return {
      key: blocId, blocId, blocCode, blocName, agentId, agentFullName, assignedAtUtc, isAssigned,
      assignments: statut ? toutesParcelles.filter((a) => a.status === statut) : toutesParcelles,
      toDo: toutesParcelles.filter((a) => a.status === 'ToDo').length,
      done: toutesParcelles.filter((a) => a.status === 'Done').length,
      abandoned: toutesParcelles.filter((a) => a.status === 'Abandoned').length,
    };
  }

  protected readonly pagedBlocGroups = computed(() => {
    const debut = (this.assignmentPage() - 1) * this.assignmentPageSize();
    return this.blocGroups().slice(debut, debut + this.assignmentPageSize());
  });

  ngOnInit(): void {
    this.facade.setAssignmentFilters({ campaignId: this.campaignId(), agentId: null, status: null });
    this.staffFacade.load();
  }

  toggleBlocGroup(key: UUID): void {
    this.expandedBlocKey.set(this.expandedBlocKey() === key ? null : key);
  }

  /**
   * Filtre FRONT depuis le regroupement par bloc. Il partait au serveur ; les compteurs par
   * bloc auraient alors décrit le seul statut affiché — « 0 faites » sur un bloc terminé,
   * parce que la requête n'aurait ramené que les « à faire ».
   */
  filterAssignmentStatus(status: AssignmentStatus | null): void {
    this.assignmentStatus.set(status);
    // Tout changement de filtre ramene en page 1 : rester en page 4 d'une liste qui vient de
    // se reduire a 2 pages afficherait un vide qu'on prendrait pour une absence de resultat.
    this.assignmentPage.set(1);
    this.expandedBlocKey.set(null);
  }

  filterAssignmentAgent(agentId: string): void {
    const id = agentId || null;
    this.assignmentAgentId.set(id);
    this.assignmentPage.set(1);
    this.expandedBlocKey.set(null);
    this.facade.setAssignmentFilters({ agentId: id });
  }

  goToAssignmentPage(page: number): void { this.assignmentPage.set(page); this.expandedBlocKey.set(null); }
  setAssignmentPageSize(size: number): void { this.assignmentPageSize.set(size); this.assignmentPage.set(1); }

  toggleTransfer(): void { this.showTransfer.update((v) => !v); }

  startReassignBloc(blocId: UUID): void {
    this.reassignBlocForm.reset({ agentId: '' });
    this.reassigningBlocId.set(blocId);
  }
  cancelReassignBloc(): void { this.reassigningBlocId.set(null); }
  confirmReassignBloc(blocId: UUID): void {
    if (this.reassignBlocForm.invalid) { this.reassignBlocForm.markAllAsTouched(); return; }
    this.facade.reassignBloc(this.campaignId(), blocId, this.reassignBlocForm.getRawValue().agentId);
    this.reassigningBlocId.set(null);
  }

  startAbandon(id: UUID): void {
    this.abandonForm.reset({ reason: '' });
    this.abandoningId.set(id);
  }
  cancelAbandon(): void { this.abandoningId.set(null); }
  confirmAbandon(id: UUID): void {
    if (this.abandonForm.invalid) { this.abandonForm.markAllAsTouched(); return; }
    this.facade.abandonAssignment(id, this.abandonForm.getRawValue().reason);
    this.abandoningId.set(null);
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) { this.transferForm.markAllAsTouched(); return; }
    const v = this.transferForm.getRawValue();
    this.facade.transferBlocs(v.fromAgentId, v.toAgentId, v.thisCampaignOnly ? this.campaignId() : null);
  }

  statusBadgeClass(status: string): string {
    return `das-badge das-badge--${status.toLowerCase()}`;
  }
}
