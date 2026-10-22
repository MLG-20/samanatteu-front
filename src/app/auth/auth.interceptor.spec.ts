import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

// Test de l'intercepteur JWT.
//
// HttpTestingController = l'équivalent de MockMvc côté front : il intercepte
// les requêtes à leur place (aucun vrai appel réseau) et permet de vérifier
// ce qui a été envoyé — les en-têtes comprise.
describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify(); // aucune requête laissée en attente
    localStorage.clear();
  });

  // Règle : une requête AVEC un token porte l'en-tête Authorization.
  it('ajoute le token dans l en-tete Authorization', () => {
    localStorage.setItem('samanatteu.accessToken', 'un-jwt');

    http.get('/tontine').subscribe();

    const requete = controller.expectOne('/tontine');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer un-jwt');
    requete.flush([]);
  });

  // Règle : SANS token (page de connexion), la requête part telle quelle.
  it('laisse partir la requete sans token quand il ny en a pas', () => {
    http.get('/auth/login').subscribe();

    const requete = controller.expectOne('/auth/login');
    expect(requete.request.headers.has('Authorization')).toBe(false);
    requete.flush({});
  });

  // Règle : un token présent mais une route publique -> le token part quand
  // même (c'est sans conséquence : le backend décide de l'ignorer).
  it('ajoute le token a la route publique aussi', () => {
    localStorage.setItem('samanatteu.accessToken', 'un-jwt');

    http.post('/auth/login', {}).subscribe();

    const requete = controller.expectOne('/auth/login');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer un-jwt');
    requete.flush({});
  });
});
