import { Observable } from 'rxjs';
import { Block, UUID } from '../../models/das.models';
import { BlockListQuery, BlockWithLots } from '../models/blocks.models';

export abstract class BlocksApiPort {
  abstract list(query: BlockListQuery): Observable<Block[]>;
  abstract getById(id: UUID): Observable<BlockWithLots>;
  abstract assign(id: UUID, userId: UUID): Observable<Block>;
}
