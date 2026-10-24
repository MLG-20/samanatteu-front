import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';

import { CreationUtilisateur, ModificationUtilisateur, Role, Utilisateur } from '../core/modeles';

// Ré-export : les fichiers qui importaient Utilisateur depuis ce service
// continuent de compiler (le type vit désormais dans core/modeles.ts).
export type { Utilisateur } from '../core/modeles';

// Ce que renvoie POST /auth/login.
export interface Token {
  accessToken: string;
  refreshToken: string;
}

// La page d'accueil de chaque rôle (≈ un Map.of Java). Les clés sont vérifiées
// à la compilation contre le type Role : un rôle ajouté sans sa page ne compile pas.
export const PAGE_PAR_ROLE: Record<Role, string> = {
  ADMIN: '/admin',
  GESTIONNAIRE: '/gestionnaire',
  MEMBRE: '/membre',
};

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

  // computed = un signal CALCULÉ à partir d'autres (≈ un getter qui se met à
  // jour tout seul). Relu automatiquement quand `utilisateur` change.
  readonly nomComplet = computed(() => {
    const u = this.utilisateur();
    return u ? `${u.prenom} ${u.nom}` : '';
  });

  // Les appels en cours partagés : si 3 requêtes reçoivent un 401 en même
  // temps, on ne rafraîchit le token qu'UNE fois (les 3 attendent le même).
  private refreshEnCours: Observable<Token> | null = null;
  private restaurationEnCours: Observable<Utilisateur | null> | null = null;

  login(telephone: string, motDePasse: string): Observable<Token> {
    return this.http.post<Token>('/auth/login', { telephone, motDePasse }).pipe(
      // tap : fait un effet SANS changer la valeur (contrairement à map).
      tap((tokens) => this.rangerTokens(tokens)),
    );
  }

  // Le token d'accès, lu dans le localStorage (null si pas connecté).
  get accessToken(): string | null {
    return localStorage.getItem(this.CLE_ACCESS);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(this.CLE_REFRESH);
  }

  // Qui je suis : appelle /auth/me, puis garde le résultat dans le signal.
  chargerMoi(): Observable<Utilisateur> {
    return this.http.get<Utilisateur>('/auth/me').pipe(tap((moi) => this.utilisateur.set(moi)));
  }

  /**
   * Le piège du rechargement : après F5, le token est toujours dans le
   * localStorage, mais le signal `utilisateur` est vide (la mémoire de la page
   * est repartie de zéro). On le reremplit en rappelant /auth/me.
   *
   * Renvoie l'utilisateur, ou null si on n'est pas (ou plus) connecté.
   * Les guards l'appellent avant chaque page protégée.
   */
  restaurerSession(): Observable<Utilisateur | null> {
    const deja = this.utilisateur();
    if (deja) {
      return of(deja); // of() = un Observable qui renvoie tout de suite cette valeur
    }
    if (!this.accessToken) {
      return of(null);
    }
    if (!this.restaurationEnCours) {
      this.restaurationEnCours = this.chargerMoi().pipe(
        // Token périmé et refresh refusé : on nettoie, et on dit « pas connecté ».
        catchError(() => {
          this.logout();
          return of(null);
        }),
        finalize(() => (this.restaurationEnCours = null)),
        // shareReplay(1) : tous ceux qui s'abonnent reçoivent le MÊME résultat
        // (une seule requête /auth/me, même pour plusieurs guards).
        shareReplay(1),
      );
    }
    return this.restaurationEnCours;
  }

  // Échange le refresh token (7 jours) contre une nouvelle paire de tokens.
  rafraichir(): Observable<Token> {
    if (!this.refreshEnCours) {
      this.refreshEnCours = this.http
        .post<Token>('/auth/refresh', { refreshToken: this.refreshToken })
        .pipe(
          tap((tokens) => this.rangerTokens(tokens)),
          finalize(() => (this.refreshEnCours = null)),
          shareReplay(1),
        );
    }
    return this.refreshEnCours;
  }

  // Déconnexion côté serveur (la version de session change : les anciens
  // tokens deviennent invalides partout), puis nettoyage local quoi qu'il arrive.
  deconnecter(): Observable<unknown> {
    return this.http.post('/auth/deconnexion', {}).pipe(
      catchError(() => of(null)),
      finalize(() => this.logout()),
    );
  }

  // Nettoyage local seul (token périmé, session expirée…).
  logout(): void {
    localStorage.removeItem(this.CLE_ACCESS);
    localStorage.removeItem(this.CLE_REFRESH);
    this.utilisateur.set(null);
  }

  // ---------- Compte : inscription, mot de passe, profil ----------

  inscrire(compte: CreationUtilisateur): Observable<Utilisateur> {
    return this.http.post<Utilisateur>('/utilisateur', compte);
  }

  // Étape 1 du mot de passe oublié : un code part par SMS.
  demanderCode(telephone: string): Observable<void> {
    return this.http.post<void>('/auth/mot-de-passe-oublie', { telephone });
  }

  // Étape 2 : le code reçu + le nouveau mot de passe.
  reinitialiser(telephone: string, code: string, nouveauMotDePasse: string): Observable<void> {
    return this.http.post<void>('/auth/reinitialiser-mot-de-passe', { telephone, code, nouveauMotDePasse });
  }

  changerMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string): Observable<void> {
    return this.http.put<void>('/auth/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse });
  }

  modifierProfil(modification: ModificationUtilisateur): Observable<Utilisateur> {
    const id = this.utilisateur()?.id;
    return this.http
      .put<Utilisateur>(`/utilisateur/${id}`, modification)
      .pipe(tap((moi) => this.utilisateur.set({ ...this.utilisateur()!, ...moi })));
  }

  private rangerTokens(tokens: Token): void {
    localStorage.setItem(this.CLE_ACCESS, tokens.accessToken);
    localStorage.setItem(this.CLE_REFRESH, tokens.refreshToken);
  }
}
