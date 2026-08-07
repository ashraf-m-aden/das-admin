import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import { Notification } from '../models/notifications.models';

export const NotificationsActions = createActionGroup({
  source: 'Notifications',
  events: {
    'Load List': emptyProps(),
    'Load List Success': props<{ items: Notification[] }>(),
    'Load List Failure': props<{ errorMessageKey: string }>(),

    'Mark As Read': props<{ id: UUID }>(),
    'Mark As Read Success': props<{ item: Notification }>(),
    'Mark As Read Failure': props<{ errorMessageKey: string }>(),

    'Mark All As Read': emptyProps(),
    'Mark All As Read Success': props<{ items: Notification[] }>(),
    'Mark All As Read Failure': props<{ errorMessageKey: string }>(),

    // Poussée par NotificationsHubService dès qu'un message SignalR arrive —
    // jamais dispatchée manuellement par un composant.
    'Notification Received': props<{ notification: Notification }>(),
  },
});
