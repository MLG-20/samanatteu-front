import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { inviteGuard, roleGuard } from './guards';

// Test des guards par rôle.
// Un guard est une simple fonction : on l'exécute « dans le contexte
// d'injection » (TestBed.runInInjectionContext), là où inject() fonctionne.
describe('guards', () => {
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  // Lance le guard pour l'URL donnée et renvoie son verdict (true ou une URL).
  function executer(guard: ReturnType<typeof roleGuard>, url = '/admin'): Promise<boolean | UrlTree> {
    const resultat = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(resultat);
  }

  const moi = (role: string) => ({ id: 1, nom: 'Ndiaye', prenom: 'Fatou', telephone: '+221', email: null, role });

  it('renvoie a la connexion sans token, en retenant la page demandee', async () => {
    const verdict = await executer(roleGuard('ADMIN'), '/admin/utilisateurs');
    expect(router.serializeUrl(verdict as UrlTree)).toBe('/connexion?retour=%2Fadmin%2Futilisateurs');
  });

  it('laisse entrer le bon role (apres rechargement : rappelle /auth/me)', async () => {
    localStorage.setItem('samanatteu.accessToken', 'jwt');
    const verdict = executer(roleGuard('ADMIN'));
    controller.expectOne('/auth/me').flush(moi('ADMIN'));
    expect(await verdict).toBe(true);
  });

  it('renvoie un MEMBRE qui tape /admin vers sa propre page', async () => {
    localStorage.setItem('samanatteu.accessToken', 'jwt');
    const verdict = executer(roleGuard('ADMIN'));
    controller.expectOne('/auth/me').flush(moi('MEMBRE'));
    expect(router.serializeUrl((await verdict) as UrlTree)).toBe('/membre');
  });

  it('ne rappelle pas /auth/me si l utilisateur est deja en memoire', async () => {
    localStorage.setItem('samanatteu.accessToken', 'jwt');
    TestBed.inject(AuthService).utilisateur.set(moi('GESTIONNAIRE') as never);
    expect(await executer(roleGuard('GESTIONNAIRE'))).toBe(true);
    controller.expectNone('/auth/me');
  });

  it('nettoie la session si /auth/me echoue (token mort)', async () => {
    localStorage.setItem('samanatteu.accessToken', 'jwt');
    const verdict = executer(roleGuard('ADMIN'));
    controller.expectOne('/auth/me').flush(null, { status: 500, statusText: 'Erreur' });
    expect(router.serializeUrl((await verdict) as UrlTree)).toContain('/connexion');
    expect(localStorage.getItem('samanatteu.accessToken')).toBeNull();
  });

  it('inviteGuard : un connecte qui ouvre /connexion part sur son tableau de bord', async () => {
    localStorage.setItem('samanatteu.accessToken', 'jwt');
    const verdict = executer(inviteGuard, '/connexion');
    controller.expectOne('/auth/me').flush(moi('GESTIONNAIRE'));
    expect(router.serializeUrl((await verdict) as UrlTree)).toBe('/gestionnaire');
  });

  it('inviteGuard : un visiteur entre sur /connexion', async () => {
    expect(await executer(inviteGuard, '/connexion')).toBe(true);
  });
});
