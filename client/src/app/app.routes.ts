import {Routes} from '@angular/router';
import {authGuard} from "./shared/auth-guard";

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      // --- Public ---
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.page').then(m => m.HomePage),
      },
      {
        path: 'redeem/:token',
        loadComponent: () =>
          import('./pages/redeem/redeem.page').then(m => m.RedeemPage),
      },
      {
        path: 'auth',
        loadComponent: () => import('./pages/auth/auth.page').then(m => m.AuthPage)
      },
      {
        path: 'legal',
        loadComponent: () => import('./pages/legal/legal.page').then( m => m.LegalPage)
      },
      {
        path: 'privacy',
        loadComponent: () => import('./pages/privacy/privacy.page').then( m => m.PrivacyPage)
      },

      // --- Protégé ---
      {
        path: '',
        canActivateChild: [authGuard],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
          },
          {
            path: 'links',
            loadComponent: () =>
              import('./pages/links/links.page').then(m => m.LinksPage),
          },
          {
            path: 'account',
            loadComponent: () =>
              import('./pages/account/account.page').then(m => m.AccountPage),
          },
        ],
      },

      { path: '**', redirectTo: '/home' },
    ]
  },
  { path: '**', redirectTo: '/home' },
];
