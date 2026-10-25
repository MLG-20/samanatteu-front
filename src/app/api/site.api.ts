import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { EnvoiMessageContact, MessageContact, ParametreSite } from '../core/modeles';

// Le site public : ses paramètres (réseaux, contact, à propos) et le
// formulaire de contact. Lecture et envoi : publics ; le reste : ADMIN.
@Injectable({ providedIn: 'root' })
export class SiteApi {
  private readonly http = inject(HttpClient);

  // Les paramètres, chargés UNE fois et partagés : le footer, la page Contact
  // et la page À propos lisent le même signal (≈ un cache applicatif).
  // null = pas encore chargés (ou indisponibles : le site reste debout).
  readonly parametres = signal<ParametreSite | null>(null);
  // Le chargement a échoué : les pages arrêtent d'attendre (plus de squelette).
  readonly echec = signal(false);
  private chargement = false;

  charger(): void {
    if (this.parametres() || this.chargement) {
      return;
    }
    this.chargement = true;
    this.echec.set(false);
    this.http.get<ParametreSite>('/site').subscribe({
      next: (p) => this.parametres.set(p),
      // Échec : on pourra réessayer à la prochaine page.
      error: () => {
        this.chargement = false;
        this.echec.set(true);
      },
    });
  }

  // ADMIN : remplace tous les paramètres ; le cache suit, le footer aussi.
  modifier(parametres: ParametreSite): Observable<ParametreSite> {
    return this.http.put<ParametreSite>('/site', parametres).pipe(tap((p) => this.parametres.set(p)));
  }

  envoyerMessage(message: EnvoiMessageContact): Observable<void> {
    return this.http.post<void>('/messageContact', message);
  }

  // ---------- ADMIN : les messages reçus ----------

  messages(): Observable<MessageContact[]> {
    return this.http.get<MessageContact[]>('/messageContact');
  }
  marquerLu(id: number, lu: boolean): Observable<MessageContact> {
    return this.http.put<MessageContact>(`/messageContact/${id}/lu`, null, { params: { valeur: lu } });
  }
  supprimerMessage(id: number): Observable<void> {
    return this.http.delete<void>(`/messageContact/${id}`);
  }
}
