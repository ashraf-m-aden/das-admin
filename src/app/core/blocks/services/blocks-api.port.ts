import { Observable } from 'rxjs';
import { Block, UUID } from '../../models/das.models';
import { BlockListItem, BlockListQuery, BlockWithParcels } from '../models/blocks.models';

export abstract class BlocksApiPort {
  abstract list(query: BlockListQuery): Observable<BlockListItem[]>;
  abstract getById(id: UUID): Observable<BlockWithParcels>;
  abstract assign(id: UUID, userId: UUID): Observable<Block>;
  abstract setName(id: UUID, name: string): Observable<Block>;
}
