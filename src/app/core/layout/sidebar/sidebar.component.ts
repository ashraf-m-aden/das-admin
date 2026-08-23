import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthFacade } from '../../auth/store/auth.facade';
import { UserRole } from '../../models/das.models';

interface NavLink {
  kind: 'link';
  labelKey: string;
  path: string;
  icon: string;
  allowedRoles?: UserRole[];
}
interface NavGroup {
  kind: 'group';
  key: string;
  labelKey: string;
  icon: string;
  allowedRoles?: UserRole[];
  children: { labelKey: string; path: string }[];
}
type NavEntry = NavLink | NavGroup;

@Component({
  selector: 'das-sidebar',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, TranslocoModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private authFacade = inject(AuthFacade);
  protected readonly roles$ = this.authFacade.roles$;

  protected readonly openGroups = signal<Set<string>>(new Set());

  protected readonly entries: NavEntry[] = [
     { kind: 'link', labelKey: 'nav.dashboard', path: '/dashboard', icon: 'ti-layout-dashboard' },
    { kind: 'link', labelKey: 'nav.adresse', path: '/adresse', icon: 'ti-address-book' },
    {
      kind: 'group', key: 'gis', labelKey: 'nav.gis', icon: 'ti-map-2',
      allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'],
      children: [
        { labelKey: 'nav.gisMap', path: '/blocks/map' },
      ],
    },
    { kind: 'link', labelKey: 'nav.closes', path: '/closes', icon: 'ti-vector-triangle', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { kind: 'link', labelKey: 'nav.verification', path: '/verification', icon: 'ti-checkup-list', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { kind: 'link', labelKey: 'nav.fieldOps', path: '/field-operations', icon: 'ti-users-group', allowedRoles: ['Admin', 'Superviseur', 'Gestionnaire'] },
    { kind: 'link', labelKey: 'nav.postcodes', path: '/postcodes', icon: 'ti-mail-code', allowedRoles: ['Admin', 'Gestionnaire'] },
    { kind: 'link', labelKey: 'nav.dataQuality', path: '/data-quality', icon: 'ti-shield-check', allowedRoles: ['Admin', 'Superviseur'] },
    {
      kind: 'group', key: 'reports', labelKey: 'nav.reports', icon: 'ti-chart-bar',
      allowedRoles: ['Admin', 'Gestionnaire'],
      children: [
        { labelKey: 'nav.reportsOverview', path: '/reports' },
        { labelKey: 'nav.auditLogs', path: '/reports/audit' },
      ],
    },
    { kind: 'link', labelKey: 'nav.users', path: '/staff', icon: 'ti-users', allowedRoles: ['Admin'] },
    { kind: 'link', labelKey: 'nav.integrations', path: '/integrations', icon: 'ti-plug', allowedRoles: ['Admin'] },
    { kind: 'link', labelKey: 'nav.settings', path: '/settings', icon: 'ti-settings', allowedRoles: ['Admin'] },
  ];

  isVisible(entry: NavEntry, roles: UserRole[]): boolean {
    return !entry.allowedRoles || entry.allowedRoles.some((r) => roles.includes(r));
  }

  isOpen(key: string): boolean {
    return this.openGroups().has(key);
  }

  toggleGroup(key: string): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
}
