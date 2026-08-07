import { createSelector } from '@ngrx/store';
import { notificationsFeature } from './notifications.reducer';

export const selectIsNotificationsLoading = createSelector(
  notificationsFeature.selectListStatus,
  (status) => status === 'loading',
);

/** Utilisée pour la pastille dans le header. */
export const selectUnreadCount = createSelector(
  notificationsFeature.selectItems,
  (items) => items.filter((n) => n.readAt === null).length,
);
