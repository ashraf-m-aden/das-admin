import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AuthFacade } from '../../auth/store/auth.facade';
import { NotificationsFacade } from '../../notifications/store/notifications.facade';
import { UserRole } from '../../models/das.models';

interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
  allowedRoles?: UserRole[];
}

@Component({
  selector: 'das-sidebar',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, TranslocoModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private authFacade = inject(AuthFacade);
  private notificationsFacade = inject(NotificationsFacade);
  private transloco = inject(TranslocoService);

  private readonly storageKey = 'das.sidebar.collapsed';
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly activeLang = signal(this.transloco.getActiveLang());

  private readonly langs = this.transloco
    .getAvailableLangs()
    .map((l) => (typeof l === 'string' ? l : l.id));

  protected readonly fullName$ = this.authFacade.fullName$;
  protected readonly roles$ = this.authFacade.roles$;
  protected readonly unreadCount$ = this.notificationsFacade.unreadCount$;

  protected readonly initials$ = this.authFacade.fullName$.pipe(
    map((name) => {
      const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
    }),
  );

  protected readonly navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/dashboard', icon: 'ti-layout-dashboard' },
    { labelKey: 'nav.blocks', path: '/blocks', icon: 'ti-map-2' },
    { labelKey: 'nav.addressing', path: '/addressing', icon: 'ti-signpost', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { labelKey: 'nav.review', path: '/review', icon: 'ti-checkup-list', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { labelKey: 'nav.staff', path: '/staff', icon: 'ti-users', allowedRoles: ['Admin'] },
    { labelKey: 'nav.clients', path: '/clients', icon: 'ti-briefcase', allowedRoles: ['Admin'] },
    { labelKey: 'nav.settings', path: '/settings', icon: 'ti-settings', allowedRoles: ['Admin'] },
  ];

  isVisible(item: NavItem, roles: UserRole[]): boolean {
    return !item.allowedRoles || item.allowedRoles.some((r) => roles.includes(r));
  }

  toggle(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(this.storageKey, next ? '1' : '0');
    } catch {
      /* stockage indisponible : on garde l'état en mémoire uniquement */
    }
  }

  toggleLang(): void {
    if (this.langs.length < 2) return;
    const current = this.transloco.getActiveLang();
    const idx = this.langs.indexOf(current);
    const next = this.langs[(idx + 1) % this.langs.length];
    this.transloco.setActiveLang(next);
    this.activeLang.set(next);
  }

  langLabel(code: string): string {
    const labels: Record<string, string> = { fr: 'Français', en: 'English' };
    return labels[code] ?? code.toUpperCase();
  }

  logout(): void {
    this.authFacade.logout();
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(this.storageKey) === '1';
    } catch {
      return false;
    }
  }
}
