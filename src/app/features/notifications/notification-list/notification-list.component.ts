import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { NotificationsFacade } from '../../../core/notifications/store/notifications.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { Notification } from '../../../core/notifications/models/notifications.models';

@Component({
  selector: 'das-notification-list',
  standalone: true,
  imports: [AsyncPipe, TranslocoModule, DasDatePipe],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
})
export class NotificationListComponent implements OnInit {
  private facade = inject(NotificationsFacade);

  protected readonly items$ = this.facade.items$;
  protected readonly isLoading$ = this.facade.isLoading$;
  protected readonly unreadCount$ = this.facade.unreadCount$;

  ngOnInit(): void {
    this.facade.load();
  }

  open(notification: Notification): void {
    if (!notification.readAt) {
      this.facade.markAsRead(notification.id);
    }
    // Pas de navigation vers l'entité liée pour l'instant (routes blocks/:id,
    // review, etc. existent déjà si on veut brancher ça plus tard).
  }

  markAllAsRead(): void {
    this.facade.markAllAsRead();
  }
}
