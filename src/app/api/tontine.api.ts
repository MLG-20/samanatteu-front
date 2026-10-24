import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Cotisation,
  Cycle,
  DemandeInvitation,
  DemandePret,
  ImportMembre,
  Invitation,
  Paiement,
  Participation,
  Pret,
  SaisieTontine,
  Tirage,
  Tontine,
} from '../core/modeles';

/**
 * Les appels de la vie d'une tontine : la tontine elle-même, ses membres, ses
 * cycles, ses cotisations et ses tirages.
 *
 * Un composant ne parle JAMAIS directement au réseau : il appelle un service.
 * Chaque méthode PRÉPARE une requête (un Observable) ; c'est le subscribe()
 * du composant qui l'envoie. ≈ un client Feign/RestTemplate côté Spring.
 *
 * Les listes sont déjà filtrées par le backend : un gestionnaire ne reçoit que
 * SES tontines, un membre que celles où il participe.
 */
@Injectable({ providedIn: 'root' })
export class TontineApi {
  private readonly http = inject(HttpClient);

  // ---------- Tontines ----------
  lister(): Observable<Tontine[]> {
    return this.http.get<Tontine[]>('/tontine');
  }
  creer(saisie: SaisieTontine): Observable<Tontine> {
    return this.http.post<Tontine>('/tontine', saisie);
  }
  modifier(id: number, saisie: SaisieTontine): Observable<Tontine> {
    return this.http.put<Tontine>(`/tontine/${id}`, saisie);
  }
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`/tontine/${id}`);
  }
  // Le cycle de vie : activer / suspendre / clôturer (POST sans corps).
  changerStatut(id: number, action: 'activer' | 'suspendre' | 'cloturer'): Observable<Tontine> {
    return this.http.post<Tontine>(`/tontine/${id}/${action}`, {});
  }

  // ---------- Membres (participations) ----------
  participations(): Observable<Participation[]> {
    return this.http.get<Participation[]>('/participation');
  }
  inscrire(membreId: number, tontineId: number, nombreParts: number): Observable<Participation> {
    return this.http.post<Participation>('/participation', { membreId, tontineId, nombreParts });
  }
  modifierParts(id: number, nombreParts: number): Observable<Participation> {
    return this.http.put<Participation>(`/participation/${id}`, { nombreParts });
  }
  retirer(id: number): Observable<void> {
    return this.http.delete<void>(`/participation/${id}`);
  }

  // ---------- Cycles et tirages ----------
  cycles(): Observable<Cycle[]> {
    return this.http.get<Cycle[]>('/cycle');
  }
  ouvrirCycle(tontineId: number): Observable<Cycle> {
    return this.http.post<Cycle>(`/tontine/${tontineId}/cycles`, {});
  }
  cloturerCycle(cycleId: number): Observable<Cycle> {
    return this.http.post<Cycle>(`/cycle/${cycleId}/cloturer`, {});
  }
  tirerAuSort(cycleId: number): Observable<Tirage> {
    return this.http.post<Tirage>(`/cycle/${cycleId}/tirage`, {});
  }
  tirages(): Observable<Tirage[]> {
    return this.http.get<Tirage[]>('/tirage');
  }
  verserGain(tirageId: number, montant: number): Observable<Tirage> {
    return this.http.post<Tirage>(`/tirage/${tirageId}/verser`, { montant });
  }
  reporterGain(tirageId: number): Observable<Tirage> {
    return this.http.post<Tirage>(`/tirage/${tirageId}/reporter`, {});
  }

  // ---------- Cotisations ----------
  cotisations(): Observable<Cotisation[]> {
    return this.http.get<Cotisation[]>('/cotisation');
  }
  payer(cotisationId: number, paiement: Paiement): Observable<Cotisation> {
    return this.http.post<Cotisation>(`/cotisation/${cotisationId}/paiement`, paiement);
  }

  // ---------- Prêts sur la caisse ----------
  accorderPret(tontineId: number, demande: DemandePret): Observable<Pret> {
    return this.http.post<Pret>(`/tontine/${tontineId}/prets`, demande);
  }

  // ---------- Faire entrer des membres ----------
  invitations(): Observable<Invitation[]> {
    return this.http.get<Invitation[]>('/invitation');
  }
  genererLienGroupe(tontineId: number): Observable<Invitation> {
    return this.http.post<Invitation>(`/tontine/${tontineId}/lien-groupe`, {});
  }
  inviter(tontineId: number, demande: DemandeInvitation): Observable<Invitation> {
    return this.http.post<Invitation>(`/tontine/${tontineId}/invitations`, demande);
  }
  // Un fichier ne voyage pas en JSON : FormData = le multipart/form-data du
  // navigateur (le @RequestParam("fichier") MultipartFile côté Spring).
  importer(tontineId: number, fichier: File): Observable<ImportMembre> {
    const corps = new FormData();
    corps.append('fichier', fichier);
    return this.http.post<ImportMembre>(`/tontine/${tontineId}/import`, corps);
  }
  imports(): Observable<ImportMembre[]> {
    return this.http.get<ImportMembre[]>('/importMembre');
  }
}
