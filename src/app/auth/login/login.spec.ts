import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Login } from './login';

// Test de la page de connexion.
//
// On pilote l'écran comme un utilisateur : on tape dans les <input>, on envoie
// le <form>, puis on regarde ce qui part vers le backend (HttpTestingController,
// l'équivalent de MockMvc) et où le routeur nous emmène.
describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let controller: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      // Login → AuthService → HttpClient : on fournit un faux backend.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    controller = TestBed.inject(HttpTestingController);
    // Espion sur le routeur : on vérifie la page demandée sans vraiment naviguer.
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    controller.verify(); // aucune requête laissée en attente
    localStorage.clear();
  });

  // Tape une valeur dans un <input>, comme le clavier (l'événement `input`
  // est ce qu'écoute formControlName).
  function saisir(id: string, valeur: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(`#${id}`);
    input.value = valeur;
    input.dispatchEvent(new Event('input'));
  }

  function envoyer(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function texte(): string {
    return fixture.nativeElement.textContent;
  }

  // Connexion réussie jusqu'à /auth/me, qui renvoie ce rôle.
  function connecterAvecLeRole(role: string): void {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'motdepasse123');
    envoyer();

    controller
      .expectOne('/auth/login')
      .flush({ accessToken: 'acces', refreshToken: 'rafraichissement' });
    controller.expectOne('/auth/me').flush({
      id: 21,
      nom: 'Ndiaye',
      prenom: 'Fatou',
      telephone: '+221771110002',
      email: null,
      role,
    });
  }

  // Règle : le bouton est grisé tant que le formulaire est invalide.
  it('desactive le bouton tant que le formulaire est invalide', () => {
    const bouton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type=submit]');
    expect(bouton.disabled).toBe(true);

    saisir('telephone', '771110002');
    saisir('motDePasse', 'court'); // 5 caractères < 8
    fixture.detectChanges();
    expect(bouton.disabled).toBe(true);

    saisir('motDePasse', 'motdepasse123');
    fixture.detectChanges();
    expect(bouton.disabled).toBe(false);
  });

  // Règle : formulaire invalide → AUCUNE requête (le garde-fou de seConnecter).
  it('n envoie rien au backend si le formulaire est invalide', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'court');
    envoyer();

    controller.expectNone('/auth/login');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  // Règle : on envoie au backend exactement ce qui a été tapé.
  it('envoie le telephone et le mot de passe a /auth/login', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'motdepasse123');
    envoyer();

    const requete = controller.expectOne('/auth/login');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ telephone: '771110002', motDePasse: 'motdepasse123' });
    requete.flush({ accessToken: 'a', refreshToken: 'r' });
    controller.expectOne('/auth/me').flush({ role: 'MEMBRE' });
  });

  // Règle : chaque rôle arrive sur SA page (switchMap login → /auth/me → page).
  it('emmene un MEMBRE sur /membre', () => {
    connecterAvecLeRole('MEMBRE');
    expect(navigateByUrl).toHaveBeenCalledWith('/membre');
  });

  it('emmene un GESTIONNAIRE sur /gestionnaire', () => {
    connecterAvecLeRole('GESTIONNAIRE');
    expect(navigateByUrl).toHaveBeenCalledWith('/gestionnaire');
  });

  it('emmene un ADMIN sur /admin', () => {
    connecterAvecLeRole('ADMIN');
    expect(navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  // Règle : les tokens reçus sont rangés (sinon l'intercepteur n'a rien à envoyer).
  it('range les tokens dans le localStorage', () => {
    connecterAvecLeRole('MEMBRE');
    expect(localStorage.getItem('samanatteu.accessToken')).toBe('acces');
    expect(localStorage.getItem('samanatteu.refreshToken')).toBe('rafraichissement');
  });

  // Règle : 401 → message d'erreur, on reste sur la page, /auth/me n'est pas appelé.
  it('affiche une erreur et reste sur la page si les identifiants sont refuses', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'mauvaismdp');
    envoyer();

    controller
      .expectOne('/auth/login')
      .flush({ message: 'Identifiants invalides' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(texte()).toContain('Téléphone ou mot de passe incorrect.');
    controller.expectNone('/auth/me');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  // Règle : une nouvelle tentative efface l'erreur de la précédente.
  it('efface l ancienne erreur a la tentative suivante', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'mauvaismdp');
    envoyer();
    controller.expectOne('/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(texte()).toContain('Téléphone ou mot de passe incorrect.');

    saisir('motDePasse', 'motdepasse123');
    envoyer(); // la requête est partie, pas encore de réponse

    expect(texte()).not.toContain('Téléphone ou mot de passe incorrect.');
    controller.expectOne('/auth/login').flush({ accessToken: 'a', refreshToken: 'r' });
    controller.expectOne('/auth/me').flush({ role: 'MEMBRE' });
  });

  // Règle : si /auth/me échoue après un login réussi, l'unique `error` de la
  // chaîne s'en charge aussi (pas de navigation).
  it('affiche une erreur si /auth/me echoue apres le login', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'motdepasse123');
    envoyer();

    controller.expectOne('/auth/login').flush({ accessToken: 'a', refreshToken: 'r' });
    controller.expectOne('/auth/me').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texte()).toContain('Téléphone ou mot de passe incorrect.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  // Règle : 403 au login = bon mot de passe, email pas encore confirmé. On ne
  // dit pas « mot de passe incorrect » : on propose de renvoyer l'email.
  it('propose de renvoyer l email si le compte n est pas encore confirme', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'motdepasse123');
    envoyer();

    controller
      .expectOne('/auth/login')
      .flush("Confirmez d'abord votre adresse email.", { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(texte()).toContain("Confirmez d'abord votre adresse email");
    expect(texte()).not.toContain('Téléphone ou mot de passe incorrect.');
    controller.expectNone('/auth/me');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  // Règle : « Renvoyer l'email » envoie le numéro tapé, puis se grise (60 s).
  it('renvoie l email de verification avec le numero tape', () => {
    saisir('telephone', '771110002');
    saisir('motDePasse', 'motdepasse123');
    envoyer();
    controller.expectOne('/auth/login').flush('', { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const bouton: HTMLButtonElement = fixture.nativeElement.querySelector('.encart-verif button');
    bouton.click();
    const requete = controller.expectOne('/auth/renvoyer-verification');
    expect(requete.request.body).toEqual({ telephone: '771110002' });
    requete.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(texte()).toContain("C'est envoyé");
    expect(bouton.disabled).toBe(true);
  });
});
