import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';

// Test de l'intercepteur JWT.
//
// HttpTestingController = l'équivalent de MockMvc côté front : il intercepte
// les requêtes à leur place (aucun vrai appel réseau) et permet de vérifier
// ce qui a été envoyé — les en-têtes comprise.
describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    controller.verify(); // aucune requête laissée en attente
    localStorage.clear();
  });

  function connecter(): void {
    localStorage.setItem('samanatteu.accessToken', 'ancien-jwt');
    localStorage.setItem('samanatteu.refreshToken', 'refresh-7j');
  }

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

  // Règle : le login et le refresh partent SANS token, même s'il en reste un
  // vieux dans le localStorage (il ne prouve rien, et peut être périmé).
  it('n ajoute pas le token au login ni au refresh', () => {
    localStorage.setItem('samanatteu.accessToken', 'un-jwt');

    http.post('/auth/login', {}).subscribe();
    http.post('/auth/refresh', {}).subscribe();

    const login = controller.expectOne('/auth/login');
    const refresh = controller.expectOne('/auth/refresh');
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    login.flush({});
    refresh.flush({});
  });

  // Règle : 401 → refresh → la requête est REJOUÉE avec le nouveau token.
  it('rafraichit le token sur 401 et rejoue la requete', () => {
    connecter();
    let reponse: unknown;

    http.get('/tontine').subscribe((r) => (reponse = r));

    controller.expectOne('/tontine').flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = controller.expectOne('/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-7j' });
    refresh.flush({ accessToken: 'nouveau-jwt', refreshToken: 'nouveau-refresh' });

    const rejouee = controller.expectOne('/tontine');
    expect(rejouee.request.headers.get('Authorization')).toBe('Bearer nouveau-jwt');
    rejouee.flush([{ id: 1 }]);

    expect(reponse).toEqual([{ id: 1 }]);
    expect(localStorage.getItem('samanatteu.accessToken')).toBe('nouveau-jwt');
  });

  // Règle : deux 401 simultanés → UN SEUL appel à /auth/refresh.
  it('ne rafraichit qu une fois pour plusieurs 401 simultanes', () => {
    connecter();

    http.get('/tontine').subscribe();
    http.get('/cycle').subscribe();
    controller.expectOne('/tontine').flush(null, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/cycle').flush(null, { status: 401, statusText: 'Unauthorized' });

    controller.expectOne('/auth/refresh').flush({ accessToken: 'n', refreshToken: 'r' });
    controller.expectOne('/tontine').flush([]);
    controller.expectOne('/cycle').flush([]);
  });

  // Règle : refresh refusé → on vide la session et on renvoie à la connexion.
  it('deconnecte et renvoie a la connexion si le refresh echoue', () => {
    connecter();
    let erreur: unknown;

    http.get('/tontine').subscribe({ error: (e) => (erreur = e) });
    controller.expectOne('/tontine').flush(null, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(erreur).toBeTruthy();
    expect(localStorage.getItem('samanatteu.accessToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/connexion'], { queryParams: { expiree: 1 } });
  });

  // Règle : un 401 au LOGIN = mauvais mot de passe, pas de refresh tenté.
  it('ne tente pas de refresh sur un 401 du login', () => {
    connecter();

    http.post('/auth/login', {}).subscribe({ error: () => undefined });
    controller.expectOne('/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    controller.expectNone('/auth/refresh');
  });

  // Règle : un 403 (mauvais rôle) n'est pas un token périmé : on le laisse passer.
  it('ne tente pas de refresh sur un 403', () => {
    connecter();

    http.get('/utilisateur').subscribe({ error: () => undefined });
    controller.expectOne('/utilisateur').flush(null, { status: 403, statusText: 'Forbidden' });

    controller.expectNone('/auth/refresh');
  });
});
