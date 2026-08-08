import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthFacade } from '../../auth/store/auth.facade';
import { NotificationsFacade } from '../../notifications/store/notifications.facade';
import { LanguageSwitcherComponent } from '../../i18n/language-switcher.component';
import { UserRole } from '../../models/das.models';

interface NavItem {
  labelKey: string;
  path: string;
  allowedRoles?: UserRole[];
}

@Component({
  selector: 'das-header',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, TranslocoModule, LanguageSwitcherComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private authFacade = inject(AuthFacade);
  private notificationsFacade = inject(NotificationsFacade);

  protected readonly fullName$ = this.authFacade.fullName$;
  protected readonly roles$ = this.authFacade.roles$;
  protected readonly unreadCount$ = this.notificationsFacade.unreadCount$;

  protected readonly navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/dashboard' },
    { labelKey: 'nav.blocks', path: '/blocks' },
    { labelKey: 'nav.addressing', path: '/addressing', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { labelKey: 'nav.review', path: '/review', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { labelKey: 'nav.staff', path: '/staff', allowedRoles: ['Admin'] },
    { labelKey: 'nav.clients', path: '/clients', allowedRoles: ['Admin'] },
    { labelKey: 'nav.settings', path: '/settings', allowedRoles: ['Admin'] },
  ];

  isVisible(item: NavItem, roles: UserRole[]): boolean {
    return !item.allowedRoles || item.allowedRoles.some((r) => roles.includes(r));
  }

  logout(): void {
    this.authFacade.logout();
  }
}
