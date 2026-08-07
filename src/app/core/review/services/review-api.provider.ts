import { Provider, inject } from '@angular/core';
import { ReviewApiPort } from './review-api.port';
import { ReviewApiService } from './review-api.service';
import { MockReviewApiService } from './mock-review-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideReviewApi(): Provider {
  return {
    provide: ReviewApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockReviewApiService) : inject(ReviewApiService);
    },
  };
}
