import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthFacade } from '../store/auth.facade';

export const authGuard: CanActivateFn = (route, state) => {
  const facade = inject(AuthFacade);
  const router = inject(Router);

  return facade.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) =>
      isAuthenticated ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
    ),
  );
};

export const roleGuard = (allowedRoles: Array<'admin' | 'supervisor' | 'surveyor'>): CanActivateFn => {
  return () => {
    const facade = inject(AuthFacade);
    const router = inject(Router);

    return facade.role$.pipe(
      take(1),
      map((role) => (role && allowedRoles.includes(role) ? true : router.createUrlTree(['/dashboard']))),
    );
  };
};
