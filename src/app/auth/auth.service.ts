import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

// Ce que renvoie POST /auth/login.
export interface Token {
  accessToken: string;
  refreshToken: string;
}

// Ce que renvoie GET /auth/me.
export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  role: 'ADMIN' | 'GESTIONNAIRE' | 'MEMBRE';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Le localStorage est le stockage PERSISTANT du navigateur (contrairement
  // au sessionStorage, effacé à la fermeture). L'utilisateur ne doit pas
  // se reconnecter à chaque rechargement de page.
  private readonly CLE_ACCESS = 'samanatteu.accessToken';
  private readonly CLE_REFRESH = 'samanatteu.refreshToken';

  // L'utilisateur connecté. Un signal : dès qu'il change, l'écran se
  // redessine (menu, tableau de bord...).
  readonly utilisateur = signal<Utilisateur | null>(null);

  login(telephone: string, motDePasse: string): Observable<Token> {
    return this.http.post<Token>('/auth/login', { telephone, motDePasse }).pipe(
      // tap : fait un effet SANS changer la valeur (contrairement à map).
      tap((tokens) => {
        localStorage.setItem(this.CLE_ACCESS, tokens.accessToken);
        localStorage.setItem(this.CLE_REFRESH, tokens.refreshToken);
      }),
    );
  }

  // Le token d'accès, lu dans le localStorage (null si pas connecté).
  get accessToken(): string | null {
    return localStorage.getItem(this.CLE_ACCESS);
  }

  // Qui je suis : appelle /auth/me, puis garde le résultat dans le signal.
  chargerMoi(): Observable<Utilisateur> {
    return this.http.get<Utilisateur>('/auth/me').pipe(
      tap((moi) => this.utilisateur.set(moi)),
    );
  }

  logout(): void {
    localStorage.removeItem(this.CLE_ACCESS);
    localStorage.removeItem(this.CLE_REFRESH);
    this.utilisateur.set(null);
  }
}
