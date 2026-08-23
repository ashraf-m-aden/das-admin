import { Provider, inject } from '@angular/core';
import { ReviewApiPort } from './review-api.port';
import { ReviewApiService } from './review-api.service';
import { MockReviewApiService } from './mock-review-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideReviewApi(): Provider {
  return {
    provide: ReviewApiPort,
    useFactory: () => shouldUseMock('review') ? inject(MockReviewApiService) : inject(ReviewApiService),
  };
}
