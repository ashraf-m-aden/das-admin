import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { DataQualityData, QualityRuleRow } from '../models/dataquality.models';

export abstract class DataQualityApiPort {
  abstract load(): Observable<DataQualityData>;
  abstract toggleRule(id: UUID, enabled: boolean): Observable<QualityRuleRow>;
  abstract runScan(): Observable<void>;
}
