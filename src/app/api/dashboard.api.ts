import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CotisationAPayer,
  CotisationRetard,
  FicheGestionnaire,
  GainAVerser,
  MaTontine,
  MonGain,
  MonPret,
  PretEnCours,
  StatsTontines,
  StatsUtilisateurs,
  TirageAFaire,
  TontineResume,
} from '../core/modeles';

// Les vues de synthèse des 3 tableaux de bord (/dashboard/{role}/...).
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);

  // ---------- Gestionnaire ----------
  mesTontines(): Observable<TontineResume[]> {
    return this.http.get<TontineResume[]>('/dashboard/gestionnaire/tontines');
  }
  retards(): Observable<CotisationRetard[]> {
    return this.http.get<CotisationRetard[]>('/dashboard/gestionnaire/retards');
  }
  pretsEnCours(): Observable<PretEnCours[]> {
    return this.http.get<PretEnCours[]>('/dashboard/gestionnaire/prets');
  }
  tiragesAFaire(): Observable<TirageAFaire[]> {
    return this.http.get<TirageAFaire[]>('/dashboard/gestionnaire/tirages');
  }
  gainsAVerser(): Observable<GainAVerser[]> {
    return this.http.get<GainAVerser[]>('/dashboard/gestionnaire/gains');
  }

  // ---------- Membre ----------
  mesParticipations(): Observable<MaTontine[]> {
    return this.http.get<MaTontine[]>('/dashboard/membre/tontines');
  }
  cotisationsAPayer(): Observable<CotisationAPayer[]> {
    return this.http.get<CotisationAPayer[]>('/dashboard/membre/cotisations');
  }
  mesPrets(): Observable<MonPret[]> {
    return this.http.get<MonPret[]>('/dashboard/membre/prets');
  }
  mesGains(): Observable<MonGain[]> {
    return this.http.get<MonGain[]>('/dashboard/membre/gains');
  }

  // ---------- Admin ----------
  statsUtilisateurs(): Observable<StatsUtilisateurs> {
    return this.http.get<StatsUtilisateurs>('/dashboard/admin/utilisateurs');
  }
  ficheGestionnaire(id: number): Observable<FicheGestionnaire> {
    return this.http.get<FicheGestionnaire>(`/dashboard/admin/gestionnaire/${id}`);
  }
  statsTontines(): Observable<StatsTontines> {
    return this.http.get<StatsTontines>('/dashboard/admin/tontines');
  }
}
