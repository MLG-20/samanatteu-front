import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

// Les routes d'authentification : on ne tente JAMAIS de rafraîchir sur elles
// (un 401 au login = mauvais mot de passe, pas un token périmé).
const ROUTES_AUTH = ['/auth/login', '/auth/refresh', '/auth/mot-de-passe-oublie', '/auth/reinitialiser-mot-de-passe'];

function avecToken(requete: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  // Clone : on ne modifie pas la requête d'origine (elle est immuable ici).
  // clone() + setHeaders = le "withHeaders" de fetch, version Angular.
  return token ? requete.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : requete;
}

/**
 * Un intercepteur HTTP s'exécute sur CHAQUE requête avant qu'elle parte.
 * C'est le crochet idéal pour ajouter le token : on ne le passe jamais
 * à la main dans les appels (un oubli = un 401).
 *
 * Deuxième rôle : le token d'accès ne vit que 15 minutes. Quand le backend
 * répond 401, on échange le refresh token (7 jours) contre un neuf, puis on
 * REJOUE la requête, sans que l'utilisateur voie quoi que ce soit.
 * ≈ un filtre Spring qui, sur 401, ferait un retry après renouvellement.
 */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const estRouteAuth = ROUTES_AUTH.some((route) => requete.url.startsWith(route));

  return suivant(avecToken(requete, estRouteAuth ? null : auth.accessToken)).pipe(
    catchError((erreur: unknown) => {
      const peutRafraichir =
        erreur instanceof HttpErrorResponse && erreur.status === 401 && !estRouteAuth && !!auth.refreshToken;
      if (!peutRafraichir) {
        return throwError(() => erreur);
      }
      return auth.rafraichir().pipe(
        // Nouveau token obtenu : on rejoue la requête d'origine avec lui.
        switchMap((tokens) => suivant(avecToken(requete, tokens.accessToken))),
        // Refresh refusé (7 jours passés, déconnexion ailleurs) : retour à la connexion.
        catchError((echec: unknown) => {
          auth.logout();
          router.navigate(['/connexion'], { queryParams: { expiree: 1 } });
          return throwError(() => echec);
        }),
      );
    }),
  );
};
