import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

/**
 * Le seul endroit du front qui parle à l'API.
 *
 * Un SERVICE Angular = une classe qui porte de la logique réutilisable, et que
 * l'on fournit (via `providedIn: 'root'`) à tout le monde. Un composant ne
 * parle JAMAIS directement au réseau : il appelle un service.
 *
 * Pourquoi ? Pour changer l'URL de l'API en un seul endroit, et pour ne pas
 * répéter la même requête dans 5 composants.
 *
 * `inject(HttpClient)` = l'injection de dépendances d'Angular, l'équivalent de
 * votre `@Autowired` : on demande l'objet, Angular nous le donne.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  // inject() au lieu du constructeur : plus court, et ça marche dans un champ.
  private readonly http = inject(HttpClient);

  /**
   * Le nombre de routes de l'API, lu dans sa documentation OpenAPI.
   * Sert surtout de preuve que le front joint bien le backend.
   */
  nombreDeRoutes(): Observable<number> {
    return this.http.get<{ paths: Record<string, unknown> }>('/v3/api-docs').pipe(
      // map : on transforme la réponse en ce dont l'écran a besoin.
      // (comme votre .map() sur un Stream, mais dans la chaîne rxjs)
      map((reponse) => Object.keys(reponse.paths).length),
    );
  }
}
