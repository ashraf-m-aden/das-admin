import { Observable } from 'rxjs';
import { SuspiciousSurveysData } from '../models/dataquality.models';

/** File de contrôle anti-fraude — ne couvre que `/api/surveys/suspicious`, aucune règle configurable côté back. */
export abstract class DataQualityApiPort {
  abstract load(): Observable<SuspiciousSurveysData>;
}
