import { createFeature, createReducer, on } from '@ngrx/store';
import { NotificationsActions } from './notifications.actions';
import { initialNotificationsState } from './notifications.state';

export const notificationsFeature = createFeature({
  name: 'notifications',
  reducer: createReducer(
    initialNotificationsState,

    on(NotificationsActions.loadList, (state) => ({
      ...state,
      listStatus: 'loading' as const,
      listErrorMessageKey: null,
    })),
    on(NotificationsActions.loadListSuccess, (state, { items }) => ({
      ...state,
      items,
      listStatus: 'loaded' as const,
    })),
    on(NotificationsActions.loadListFailure, (state, { errorMessageKey }) => ({
      ...state,
      listStatus: 'error' as const,
      listErrorMessageKey: errorMessageKey,
    })),

    on(NotificationsActions.markAsReadSuccess, (state, { item }) => ({
      ...state,
      items: state.items.map((n) => (n.id === item.id ? item : n)),
    })),

    on(NotificationsActions.markAllAsReadSuccess, (state, { items }) => ({
      ...state,
      items,
    })),

    // Ajout en tête de liste + dédoublonnage défensif (au cas où le push
    // SignalR et un GET /notifications se chevaucheraient au même moment).
    on(NotificationsActions.notificationReceived, (state, { notification }) => {
      const alreadyExists = state.items.some((n) => n.id === notification.id);
      return alreadyExists ? state : { ...state, items: [notification, ...state.items] };
    }),
  ),
});

export const {
  name: notificationsFeatureKey,
  reducer: notificationsReducer,
  selectItems,
  selectListStatus,
  selectListErrorMessageKey,
} = notificationsFeature;
