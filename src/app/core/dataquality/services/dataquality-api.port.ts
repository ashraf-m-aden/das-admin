import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { SuspiciousSurveysData } from '../models/dataquality.models';

/** File de contrôle anti-fraude — ne couvre que `/api/surveys/suspicious`, aucune règle configurable côté back. */
export abstract class DataQualityApiPort {
  /** `includeDismissed` : les relevés écartés restent consultables, ils ne sont pas effacés. */
  abstract load(includeDismissed: boolean): Observable<SuspiciousSurveysData>;
  /** `POST /api/surveys/{id}/dismiss-suspicion` — motif obligatoire côté back (5 caractères). */
  abstract dismissSuspicion(surveyId: UUID, reason: string): Observable<void>;
}
