import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home/home').then((m) => m.Home),
  },
  {
    path: 'lost',
    loadComponent: () =>
      import('./features/posts/lost/lost').then((m) => m.Lost),
  },
  {
    path: 'found',
    loadComponent: () =>
      import('./features/posts/found/found').then((m) => m.Found),
  },
  {
    path: 'posts/:id',
    loadComponent: () =>
      import('./features/posts/detail/detail').then((m) => m.Detail),
  },
  {
    path: 'post-item',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/posts/post-item/post-item').then((m) => m.PostItem),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile/profile').then((m) => m.Profile),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/settings/settings').then((m) => m.Settings),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found/not-found').then((m) => m.NotFound),
  },
];