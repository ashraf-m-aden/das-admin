import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { ReviewPhoto, SurveyReviewItem } from '../models/review.models';

/** Ne couvre que les relevés (`/api/surveys`) — les suggestions de nom passent par AddressingApiPort. */
export abstract class ReviewApiPort {
  abstract listSubmittedSurveys(): Observable<SurveyReviewItem[]>;
  abstract validateSurvey(id: UUID): Observable<void>;
  abstract rejectSurvey(id: UUID, rejectionReason: string): Observable<void>;
  abstract requestSurveyCorrection(id: UUID): Observable<void>;
  abstract getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]>;
}
