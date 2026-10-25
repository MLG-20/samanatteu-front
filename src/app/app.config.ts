import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Chaque nouvelle page s'ouvre en haut (et non au niveau de défilement de la précédente).
      // anchorScrolling : un lien vers « /#offre » descend jusqu'à la section
      // (les liens du footer, depuis n'importe quelle page publique).
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Fondu doux entre deux pages (API « View Transitions » du navigateur ;
      // sans effet, et sans erreur, là où elle n'existe pas).
      withViewTransitions(),
    ),
    // Le client HTTP d'Angular. C'est lui qui sait parler au réseau.
    // withInterceptors : la liste des intercepteurs, dans l'ordre. Le nôtre
    // ajoute le token JWT à chaque requête (et le renouvelle sur 401). Sans
    // cette ligne, inject(HttpClient) échoue.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
