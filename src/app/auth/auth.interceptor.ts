import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * Un intercepteur HTTP s'exécute sur CHAQUE requête avant qu'elle parte.
 * C'est le crochet ideal pour ajouter le token : on ne le passe jamais
 * à la main dans les appels (un oubli = un 401).
 *
 * HttpInterceptorFn = la forme "fonction" (modern Angular). L'ancienne forme
 * était une classe qui implementait HttpInterceptor.
 */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;

  // Pas de token (page de connexion) : on laisse la requête partir telle quelle.
  if (!token) {
    return suivant(requete);
  }

  // Clone : on ne modifie pas la requête d'origine (elle est immuable ici).
  // clone() + set() = le "withHeaders" de fetch, version Angular.
  return suivant(
    requete.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
