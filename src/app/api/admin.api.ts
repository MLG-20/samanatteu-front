import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import {
  Abonnement,
  ActivationAbonnement,
  CreationUtilisateur,
  Formule,
  LienInvitation,
  ModificationUtilisateur,
  Utilisateur,
} from '../core/modeles';

// La plateforme : comptes, formules, abonnements des gestionnaires.
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  utilisateurs(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>('/utilisateur');
  }
  creerUtilisateur(compte: CreationUtilisateur): Observable<Utilisateur> {
    return this.http.post<Utilisateur>('/utilisateur', compte);
  }
  modifierUtilisateur(id: number, modification: ModificationUtilisateur): Observable<Utilisateur> {
    return this.http.put<Utilisateur>(`/utilisateur/${id}`, modification);
  }
  supprimerUtilisateur(id: number): Observable<void> {
    return this.http.delete<void>(`/utilisateur/${id}`);
  }

  formules(): Observable<Formule[]> {
    return this.http.get<Formule[]>('/formule');
  }
  creerFormule(formule: Formule): Observable<Formule> {
    return this.http.post<Formule>('/formule', formule);
  }
  modifierFormule(id: number, formule: Formule): Observable<Formule> {
    return this.http.put<Formule>(`/formule/${id}`, formule);
  }

  abonnements(): Observable<Abonnement[]> {
    return this.http.get<Abonnement[]>('/abonnement');
  }
  activerAbonnement(activation: ActivationAbonnement): Observable<Abonnement> {
    return this.http.post<Abonnement>('/abonnement', activation);
  }
}

// Ce dont le gestionnaire et le visiteur ont besoin (hors admin).
@Injectable({ providedIn: 'root' })
export class CompteApi {
  private readonly http = inject(HttpClient);

  // L'abonnement du gestionnaire connecté. 404 s'il n'en a pas : on le
  // transforme en null (« pas d'abonnement » n'est pas une panne).
  monAbonnement(): Observable<Abonnement | null> {
    return this.http.get<Abonnement>('/abonnement/mon').pipe(
      catchError((e: unknown) => (e instanceof HttpErrorResponse && e.status === 404 ? of(null) : throwError(() => e))),
    );
  }
  // Public : les formules à la vente (la grille tarifaire de la vitrine).
  formulesDisponibles(): Observable<Formule[]> {
    return this.http.get<Formule[]>('/formule/disponibles');
  }
  // Public : ce qu'un lien d'invitation propose.
  lienInvitation(token: string): Observable<LienInvitation> {
    return this.http.get<LienInvitation>(`/invitation/${token}`);
  }
  rejoindre(token: string): Observable<void> {
    return this.http.post<void>(`/invitation/${token}/rejoindre`, {});
  }
}
