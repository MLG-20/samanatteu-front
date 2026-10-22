import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Le client HTTP d'Angular. C'est lui qui sait parler au réseau.
    // withInterceptors : la liste des intercepteurs, dans l'ordre. Le nôtre
    // ajoute le token JWT à chaque requête. Sans cette ligne, inject(HttpClient)
    // échoue.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
