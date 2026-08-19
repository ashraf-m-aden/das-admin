import { Observable } from 'rxjs';
import { Block, UpdateBlockPayload, UUID } from '../../models/das.models';
import { BlockListQuery } from '../models/blocks.models';

export abstract class BlocksApiPort {
  abstract list(query: BlockListQuery): Observable<Block[]>;
  abstract getById(id: UUID): Observable<Block>;
  /** Lecture-modification-écriture complète — `PATCH /api/blocs/{id}` exige le dossier entier, pas juste le champ changé. */
  abstract update(id: UUID, payload: UpdateBlockPayload): Observable<Block>;
}
