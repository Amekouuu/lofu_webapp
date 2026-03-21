import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

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
    path: '',
    loadComponent: () =>
      import('./layouts/main-shell/main-shell').then((m) => m.MainShell),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home/home').then((m) => m.Home),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/about').then((m) => m.About),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/contact/contact').then((m) => m.Contact),
      },
      {
        path: 'items',
        loadComponent: () =>
          import('./features/items/items').then((m) => m.Items),
      },
      { path: 'lost',  redirectTo: 'items', pathMatch: 'full' },
      { path: 'found', redirectTo: 'items', pathMatch: 'full' },
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
        path: 'messages',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'user/:id',
        loadComponent: () =>
          import('./features/public-profile/public-profile').then((m) => m.PublicProfile),
      },
    ],
  },

  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found/not-found').then((m) => m.NotFound),
  },
];