import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { NotificationsActions } from './notifications.actions';
import { notificationsFeature } from './notifications.reducer';
import { selectIsNotificationsLoading, selectUnreadCount } from './notifications.selectors';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class NotificationsFacade {
  private store = inject(Store);

  items$ = this.store.select(notificationsFeature.selectItems);
  isLoading$ = this.store.select(selectIsNotificationsLoading);
  errorMessageKey$ = this.store.select(notificationsFeature.selectListErrorMessageKey);
  unreadCount$ = this.store.select(selectUnreadCount);

  load(): void {
    this.store.dispatch(NotificationsActions.loadList());
  }

  markAsRead(id: UUID): void {
    this.store.dispatch(NotificationsActions.markAsRead({ id }));
  }

  markAllAsRead(): void {
    this.store.dispatch(NotificationsActions.markAllAsRead());
  }
}
