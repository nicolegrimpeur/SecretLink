import {Routes} from '@angular/router';
import {authGuard, guestGuard} from "./shared/auth-guard";

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      // --- Public ---
      // Toute route ajoutée ici doit l'être aussi dans client/nginx/nginx.conf,
      // qui renvoie un vrai 404 pour les autres URL
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/home/home.page').then(m => m.HomePage),
      },
      {
        path: 'redeem/:token',
        title: 'Ouvrir un secret',
        loadComponent: () =>
          import('./pages/redeem/redeem.page').then(m => m.RedeemPage),
      },
      {
        path: 'auth',
        title: 'Connexion',
        data: {description: 'Connectez-vous ou créez un compte SecretLink pour gérer vos liens à usage unique.'},
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/auth/auth.page').then(m => m.AuthPage)
      },
      {
        path: 'legal',
        title: 'Mentions légales',
        data: {description: 'Mentions légales : éditeur du site et hébergement.'},
        loadComponent: () => import('./pages/legal/legal.page').then( m => m.LegalPage)
      },
      {
        path: 'privacy',
        title: 'Politique de confidentialité',
        data: {description: 'Données collectées, durée de conservation et droits des utilisateurs.'},
        loadComponent: () => import('./pages/privacy/privacy.page').then( m => m.PrivacyPage)
      },

      // --- Protégé ---
      {
        path: '',
        canActivateChild: [authGuard],
        children: [
          {
            path: 'dashboard',
            title: 'Tableau de bord',
            loadComponent: () =>
              import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
          },
          {
            path: 'links',
            title: 'Mes liens',
            loadComponent: () =>
              import('./pages/links/links.page').then(m => m.LinksPage),
          },
          {
            path: 'account',
            title: 'Mon compte',
            loadComponent: () =>
              import('./pages/account/account.page').then(m => m.AccountPage),
          },
        ],
      },

      {
        path: '**',
        title: 'Page introuvable',
        loadComponent: () => import('./pages/not-found/not-found.page').then(m => m.NotFoundPage)
      },
    ]
  },
];
