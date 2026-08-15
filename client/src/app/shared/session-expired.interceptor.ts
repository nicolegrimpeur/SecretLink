import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, throwError} from 'rxjs';
import {AuthService} from '../core/auth';
import {ToastService} from './services/toast';

/**
 * Codes 401 qui ne traduisent PAS une session morte et ne doivent donc pas
 * déconnecter l'utilisateur (ex. une faute de frappe sur le mot de passe actuel).
 */
const NON_SESSION_401_CODES = ['INVALID_CURRENT_PASSWORD'];

/**
 * Déconnecte le front quand le serveur rejette une session qu'il croyait valide.
 *
 * Cas visé : le changement de mot de passe invalide toutes les sessions antérieures.
 * Sans ça, les autres appareils gardent une UI « connectée » dont chaque appel échoue
 * en silence.
 *
 * La condition `auth.user !== null` est ce qui protège les pages publiques : un
 * visiteur anonyme sur /redeem/:token ou le `me()` d'amorçage reçoivent aussi un 401,
 * et ne doivent surtout pas être redirigés vers l'écran de connexion.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const code = error.error?.error?.code;
      const sessionRejected =
        error.status === 401 &&
        auth.user !== null &&
        // Un appel porteur d'un PAT échoue sur le token, pas sur la session du navigateur.
        !req.headers.has('Authorization') &&
        !NON_SESSION_401_CODES.includes(code);

      if (sessionRejected) {
        auth.clearLocalSession();
        toast.toastMsg('Votre session a expiré, veuillez vous reconnecter.', 4000).then();
        router.navigateByUrl('/auth').then();
      }

      // Rethrow: les pages gardent leur propre gestion d'erreur.
      return throwError(() => error);
    }),
  );
};
