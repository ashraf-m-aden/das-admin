import { Routes } from '@angular/router';

export const staffRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./staff-list/staff-list.component').then((m) => m.StaffListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./staff-form/staff-form.component').then((m) => m.StaffFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./staff-form/staff-form.component').then((m) => m.StaffFormComponent),
  },
];
