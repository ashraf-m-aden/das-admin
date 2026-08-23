import { Injectable, computed, inject, signal } from '@angular/core';
import { ClosesApiPort } from '../services/closes-api.port';
import { BlocksApiPort } from '../../blocks/services/blocks-api.port';
import { Close, SaveClosePayload } from '../models/closes.models';
import { Block, UUID } from '../../models/das.models';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';

/** Lit `err.error.code` (HttpErrorResponse réel) ou `err.code` (throwError direct du mock). */
function errorCode(err: unknown): string | undefined {
  const e = err as { error?: { code?: string }; code?: string } | null | undefined;
  return e?.error?.code ?? e?.code;
}

const ERROR_KEY_BY_CODE: Record<string, string> = {
  'Closes.NumberAlreadyUsed': 'closes.errorNumberUsed',
  'Closes.BlocAlreadyAssigned': 'closes.errorBlocTaken',
};

@Injectable({ providedIn: 'root' })
export class ClosesFacade {
  private api = inject(ClosesApiPort);
  private blocksApi = inject(BlocksApiPort);

  private readonly _closes = signal<Close[]>([]);
  private readonly _blocs = signal<Block[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _errorMessageKey = signal<string | null>(null);

  readonly closes = this._closes.asReadonly();
  readonly blocs = this._blocs.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly errorMessageKey = this._errorMessageKey.asReadonly();

  /** Blocs déjà pris par une autre close — grisés dans le sélecteur (un bloc n'appartient qu'à UNE close). */
  readonly blocOwner = computed(() => {
    const owner = new Map<UUID, Close>();
    for (const c of this._closes()) {
      for (const b of c.blocIds) owner.set(b, c);
    }
    return owner;
  });

  load(quartierId: UUID | null, search = ''): void {
    this._loading.set(true);
    this._errorMessageKey.set(null);
    this.api.list({ quartierId, search }).subscribe({
      next: (closes) => { this._closes.set(closes); this._loading.set(false); },
      error: () => { this._loading.set(false); this._errorMessageKey.set('common.error'); },
    });
  }

  /** Blocs candidats du quartier — source du sélecteur et de la mise en évidence carte. */
  loadBlocs(quartierId: UUID | null): void {
    if (!quartierId) { this._blocs.set([]); return; }
    this.blocksApi.list({ ...EMPTY_HIERARCHY_SELECTION, quartierId }).subscribe({
      next: (blocs) => this._blocs.set(blocs),
      error: () => this._blocs.set([]),
    });
  }

  save(id: UUID | null, payload: SaveClosePayload, onDone: () => void): void {
    this._saving.set(true);
    this._errorMessageKey.set(null);
    const request$ = id ? this.api.update(id, payload) : this.api.create(payload);
    request$.subscribe({
      next: () => {
        this._saving.set(false);
        this.load(payload.quartierId);
        onDone();
      },
      error: (err) => {
        this._saving.set(false);
        this._errorMessageKey.set(ERROR_KEY_BY_CODE[errorCode(err) ?? ''] ?? 'common.error');
      },
    });
  }

  remove(id: UUID, quartierId: UUID | null): void {
    this._saving.set(true);
    this.api.remove(id).subscribe({
      next: () => { this._saving.set(false); this.load(quartierId); },
      error: () => { this._saving.set(false); this._errorMessageKey.set('common.error'); },
    });
  }
}
