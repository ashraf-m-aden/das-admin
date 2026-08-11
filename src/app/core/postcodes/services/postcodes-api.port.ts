import { Observable } from 'rxjs';
import { AllocatePostcodePayload, PostcodesData, PostcodeRow } from '../models/postcodes.models';

export abstract class PostcodesApiPort {
  abstract load(): Observable<PostcodesData>;
  abstract allocate(payload: AllocatePostcodePayload): Observable<PostcodeRow>;
}
