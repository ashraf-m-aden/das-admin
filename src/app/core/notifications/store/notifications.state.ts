import { Notification } from '../models/notifications.models';

export type NotificationsListStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface NotificationsState {
  items: Notification[];
  listStatus: NotificationsListStatus;
  listErrorMessageKey: string | null;
}

export const initialNotificationsState: NotificationsState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
};
