import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthFacade } from '../../auth/store/auth.facade';
import { LanguageSwitcherComponent } from '../../i18n/language-switcher.component';
import { UserRole } from '../../models/das.models';

interface NavItem {
  labelKey: string;
  path: string;
  /** undefined = visible pour tout utilisateur authentifié, quel que soit son rôle */
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

  protected readonly fullName$ = this.authFacade.fullName$;
  protected readonly role$ = this.authFacade.role$;

  protected readonly navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/dashboard' },
    { labelKey: 'nav.blocks', path: '/blocks' },
    { labelKey: 'nav.review', path: '/review', allowedRoles: ['admin', 'supervisor'] },
    { labelKey: 'nav.staff', path: '/staff', allowedRoles: ['admin'] },
    { labelKey: 'nav.clients', path: '/clients', allowedRoles: ['admin'] },
    { labelKey: 'nav.settings', path: '/settings', allowedRoles: ['admin'] },
  ];

  isVisible(item: NavItem, role: UserRole | null): boolean {
    return !item.allowedRoles || (role !== null && item.allowedRoles.includes(role));
  }

  logout(): void {
    this.authFacade.logout();
  }
}
