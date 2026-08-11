import { Observable } from 'rxjs';
import { FieldOpsData } from '../models/fieldops.models';

export abstract class FieldOpsApiPort {
  abstract load(): Observable<FieldOpsData>;
}
