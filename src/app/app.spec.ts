import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { App } from './app';
import { ApiService } from './api/api.service';

describe('App', () => {
  // On remplace le vrai ApiService par un faux : le test ne doit pas
  // dépendre du backend (ni du réseau). C'est l'équivalent d'un @Mock Spring.
  let nombreDeRoutes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    nombreDeRoutes = vi.fn().mockReturnValue(of(56));
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ApiService, useValue: { nombreDeRoutes } }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Règle : le nombre de routes reçu de l'API est affiché.
  it('affiche le nombre de routes renvoyé par l API', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('56');
  });

  // Règle : si l'API ne répond pas, l'écran le dit (au lieu d'être vide).
  it('affiche un message quand l API ne repond pas', () => {
    nombreDeRoutes.mockReturnValue(throwError(() => new Error('backend arrete')));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('backend arrete');
  });
});
