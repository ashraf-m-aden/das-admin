import { Observable } from 'rxjs';
import { Integration, IntegrationsData } from '../models/integrations.models';

export abstract class IntegrationsApiPort {
  abstract load(): Observable<IntegrationsData>;
  abstract toggle(id: string, connect: boolean): Observable<Integration>;
}
