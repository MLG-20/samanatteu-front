import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { Role } from '../core/modeles';
import { AuthService, PAGE_PAR_ROLE } from './auth.service';

/**
 * Un GUARD décide si on a le droit d'entrer sur une route.
 * ≈ la règle `.requestMatchers("/admin/**").hasRole("ADMIN")` de SecurityConfig,
 * mais côté écran. Ce n'est PAS la sécurité (le backend refuse de toute façon
 * avec 403) : c'est le confort, on n'affiche pas une page vide d'erreurs.
 *
 * Il renvoie : true (on entre), ou un UrlTree (= « va plutôt là »).
 *
 * roleGuard('ADMIN') est une FABRIQUE : une fonction qui fabrique le guard
 * pour un rôle donné (≈ une méthode statique qui renvoie un Predicate).
 */
export function roleGuard(role: Role): CanActivateFn {
  return (_route, etat) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // restaurerSession : après F5 le signal est vide → on rappelle /auth/me.
    return auth.restaurerSession().pipe(
      map((moi) => {
        if (!moi) {
          // Pas connecté : à la connexion, en retenant où il voulait aller.
          return router.createUrlTree(['/connexion'], { queryParams: { retour: etat.url } });
        }
        // Connecté mais mauvais rôle : chez lui.
        return moi.role === role ? true : router.createUrlTree([PAGE_PAR_ROLE[moi.role]]);
      }),
    );
  };
}

// Sur les pages publiques (connexion, inscription) : déjà connecté → son tableau de bord.
export const inviteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .restaurerSession()
    .pipe(map((moi) => (moi ? router.createUrlTree([PAGE_PAR_ROLE[moi.role]]) : true)));
};
