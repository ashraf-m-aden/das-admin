import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { NotificationsFacade } from '../../../core/notifications/store/notifications.facade';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { Notification, NotificationType } from '../../../core/notifications/models/notifications.models';

const ICON: Record<NotificationType, { icon: string; color: string; bg: string }> = {
  task_completed: { icon: 'ti-circle-check', color: '#15803d', bg: '#dcfce7' },
  block_submitted: { icon: 'ti-file-upload', color: '#6d28d9', bg: '#f3e8fd' },
  property_approved: { icon: 'ti-circle-check', color: '#15803d', bg: '#dcfce7' },
  property_needs_redo: { icon: 'ti-rotate', color: '#b91c1c', bg: '#fee2e2' },
  redo_resolved: { icon: 'ti-check', color: '#4338ca', bg: '#e0e7ff' },
};

@Component({
  selector: 'das-notification-list',
  standalone: true,
  imports: [AsyncPipe, TranslocoModule, DasDatePipe, PageHeaderComponent],
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
  }

  markAllAsRead(): void {
    this.facade.markAllAsRead();
  }

  iconFor(type: NotificationType) {
    return ICON[type];
  }
}
