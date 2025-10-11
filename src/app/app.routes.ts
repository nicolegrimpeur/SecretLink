import {Routes} from '@angular/router';
import {authGuard} from "./shared/auth-guard";

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      { path: 'login',  loadComponent: () => import('./pages/auth/login/login.page').then(m => m.LoginPage) },
      { path: 'signup', loadComponent: () => import('./pages/auth/signup/signup.page').then(m => m.SignupPage) },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  },
  {
    path: 'redeem/:token',
    loadComponent: () => import('./pages/redeem/redeem.page').then( m => m.RedeemPage)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'links',
        loadComponent: () => import('./pages/links/links.page').then( m => m.LinksPage)
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/account/account.page').then(m => m.AccountPage)
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ]
  },
  { path: '**', redirectTo: '' },
];
