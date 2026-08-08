import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthFacade } from '../store/auth.facade';
import { UserRole } from '../../models/das.models';

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

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const facade = inject(AuthFacade);
    const router = inject(Router);

    return facade.roles$.pipe(
      take(1),
      map((roles) => (roles.some((r) => allowedRoles.includes(r)) ? true : router.createUrlTree(['/dashboard']))),
    );
  };
};
