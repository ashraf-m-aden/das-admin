import { Component, inject, signal } from '@angular/core';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AuthFacade } from '../../auth/store/auth.facade';

@Component({
  selector: 'das-topbar',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule,UpperCasePipe],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private authFacade = inject(AuthFacade);
  private transloco = inject(TranslocoService);
  private router = inject(Router);

  protected readonly fullName$ = this.authFacade.fullName$;
  protected readonly roles$ = this.authFacade.roles$;

  protected readonly activeLang = signal(this.transloco.getActiveLang());

  protected readonly initials$ = this.authFacade.fullName$.pipe(
    map((name) => {
      const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
    }),
  );

  private readonly langs = this.transloco
    .getAvailableLangs()
    .map((l) => (typeof l === 'string' ? l : l.id));

  toggleLang(): void {
    if (this.langs.length < 2) return;
    const idx = this.langs.indexOf(this.transloco.getActiveLang());
    const next = this.langs[(idx + 1) % this.langs.length];
    this.transloco.setActiveLang(next);
    this.activeLang.set(next);
  }

  logout(): void {
    this.authFacade.logout();
  }

  /** Renvoie vers la liste des adresses avec le terme en filtre `search` — seule entité réellement filtrable par texte à ce jour. */
  search(term: string): void {
    const q = term.trim();
    if (!q) return;
    this.router.navigate(['/adresse'], { queryParams: { search: q } });
  }
}
