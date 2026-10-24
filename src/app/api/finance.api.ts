import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EcheancePret, Notification, Pret, Transaction } from '../core/modeles';

// L'argent qui a déjà circulé (prêts, échéances, journal, reçus) et les
// notifications. Listes filtrées par le backend selon le rôle connecté.
@Injectable({ providedIn: 'root' })
export class FinanceApi {
  private readonly http = inject(HttpClient);

  prets(): Observable<Pret[]> {
    return this.http.get<Pret[]>('/pret');
  }
  rembourser(pretId: number, montant: number): Observable<Pret> {
    return this.http.post<Pret>(`/pret/${pretId}/remboursement`, { montant });
  }
  echeances(): Observable<EcheancePret[]> {
    return this.http.get<EcheancePret[]>('/echeancePret');
  }
  transactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>('/transaction');
  }
  // Le reçu PDF : responseType 'blob' = « ne lis pas en JSON, garde les octets »
  // (≈ le byte[] renvoyé par le contrôleur Java).
  recu(transactionId: number): Observable<Blob> {
    return this.http.get(`/transaction/${transactionId}/recu`, { responseType: 'blob' });
  }
  notifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>('/notification');
  }
}

// Déclenche le téléchargement d'un fichier reçu en Blob : on crée un lien
// invisible vers une URL temporaire, on clique dessus, puis on libère l'URL.
export function telecharger(fichier: Blob, nom: string): void {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}
