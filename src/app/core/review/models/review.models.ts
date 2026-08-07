import { UUID, ISODateTime, RedoSubmissionType, SubmissionStatus } from '../../models/das.models';

export interface ReviewPhoto {
  id: UUID;
  photoType: string;
  s3Key: string;
}

export interface ReviewItem {
  id: UUID;
  submissionType: RedoSubmissionType;
  code: string;
  submittedByName: string;
  submittedAt: ISODateTime;
  status: SubmissionStatus;
  gpsAccuracy: number | null;
  photos: ReviewPhoto[];
  notes: string | null;
}

export interface ReviewQueueQuery {
  submissionType: RedoSubmissionType | null;
}

export type RejectReasonPreset = 'photo_retake' | 'gps_recheck' | 'other';

export interface RejectPayload {
  preset: RejectReasonPreset;
  reason: string;
}
