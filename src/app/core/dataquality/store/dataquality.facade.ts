import { Injectable, computed, inject, signal } from '@angular/core';
import { DataQualityApiPort } from '../services/dataquality-api.port';
import { SuspiciousSurveysData } from '../models/dataquality.models';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class DataQualityFacade {
  private api = inject(DataQualityApiPort);

  private readonly _data = signal<SuspiciousSurveysData | null>(null);
  private readonly _loading = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly surveys = computed(() => this._data()?.surveys ?? []);
  readonly pushedAfterCloseByAgent = computed(() => this._data()?.pushedAfterCloseByAgent ?? []);
  /** Seuil appliqué par le back — l'écran ne doit pas en inventer un. */
  readonly suspiciousDistanceM = computed(() => this._data()?.suspiciousDistanceM ?? 100);

  /**
   * Le seuil, ou `null` tant que le serveur ne l'a pas dit.
   *
   * Distinct de `suspiciousDistanceM`, qui replie sur 100 : ce repli convient à l'écran
   * anti-fraude, qui affiche de toute façon une liste déjà filtrée par le serveur. Ailleurs il
   * mentirait — annoncer « seuil 100 m » alors que le back applique 150 est pire que ne rien
   * annoncer, parce que l'opérateur en tire une conclusion sur un relevé précis.
   */
  readonly knownThresholdM = computed(() => this._data()?.suspiciousDistanceM ?? null);

  /**
   * Charge une seule fois, pour les écrans qui n'ont besoin QUE du seuil (file de validation,
   * relevés d'une campagne). Sans le garde, chaque ouverture de fiche relancerait la requête
   * anti-fraude complète pour en extraire un nombre.
   */
  ensureThresholdLoaded(): void {
    if (this._data() === null && !this._loading()) {
      this.load();
    }
  }

  /** Inclure les écartés est un choix d'écran, pas un état durable : il repart à faux au rechargement. */
  private readonly _includeDismissed = signal(false);
  readonly includeDismissed = this._includeDismissed.asReadonly();

  private readonly _dismissingId = signal<UUID | null>(null);
  readonly dismissingId = this._dismissingId.asReadonly();

  load(includeDismissed = this._includeDismissed()): void {
    this._includeDismissed.set(includeDismissed);
    this._loading.set(true);
    this.api.load(includeDismissed).subscribe({
      next: (d) => { this._data.set(d); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }

  /**
   * Écarte les signaux d'un relevé, puis RECHARGE : la liste doit refléter la décision, et
   * retirer la ligne localement mentirait sur ce que le serveur a réellement enregistré.
   */
  dismiss(surveyId: UUID, reason: string): void {
    this._dismissingId.set(surveyId);
    this.api.dismissSuspicion(surveyId, reason).subscribe({
      next: () => { this._dismissingId.set(null); this.load(); },
      error: () => this._dismissingId.set(null),
    });
  }
}
