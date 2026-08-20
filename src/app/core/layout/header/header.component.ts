import { Component, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
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

const ROLE_LABEL: Record<UserRole, string> = {
  Admin: 'Admin', Gestionnaire: 'Gestionnaire', Superviseur: 'Superviseur', AgentTerrain: 'Agent Terrain',
};

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

  private readonly fullNameSig = toSignal(this.fullName$, { initialValue: null as string | null });
  private readonly rolesSig = toSignal(this.roles$, { initialValue: [] as UserRole[] });

  protected readonly initials = computed(() => {
    const name = this.fullNameSig();
    if (!name) return '';
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  });

  protected readonly primaryRoleLabel = computed(() => {
    const role = this.rolesSig()[0];
    return role ? ROLE_LABEL[role] : '';
  });

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
