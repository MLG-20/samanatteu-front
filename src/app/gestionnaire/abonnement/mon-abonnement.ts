import { Component, computed, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { CompteApi } from '../../api/admin.api';
import { DashboardApi } from '../../api/dashboard.api';
import { DateCourtePipe, DateRelativePipe, FcfaPipe, pourcentage } from '../../core/formatage';
import { etatAbonnement, messageErreur } from '../../core/libelles';
import { Abonnement, TontineResume } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone, NomIcone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

// L'abonnement du gestionnaire : sa formule, sa période et sa consommation.
@Component({
  selector: 'app-mon-abonnement',
  imports: [Icone, Statut, EtatVide, FcfaPipe, DateCourtePipe, DateRelativePipe],
  templateUrl: './mon-abonnement.html',
  styleUrl: './mon-abonnement.css',
})
export class MonAbonnement {
  private readonly compte = inject(CompteApi);
  private readonly dashboard = inject(DashboardApi);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly abonnement = signal<Abonnement | null>(null);
  private readonly tontines = signal<TontineResume[]>([]);
  protected readonly etat = etatAbonnement;

  // L'essai gratuit en cours ? (statut ESSAI et date de fin pas encore passée)
  protected readonly enEssai = computed(() => {
    const a = this.abonnement();
    return !!a && a.statut === 'ESSAI' && a.actif;
  });

  // Les jours qu'il reste, aujourd'hui COMPRIS : dateFin est le dernier jour
  // couvert (même règle que le backend), d'où le + 1. Un jour = 86 400 000 ms.
  protected readonly joursRestants = computed(() => {
    const a = this.abonnement();
    if (!a) {
      return 0;
    }
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const fin = new Date(a.dateFin + 'T00:00:00');
    return Math.max(0, Math.round((fin.getTime() - aujourdhui.getTime()) / 86_400_000) + 1);
  });

  // La progression dans la période (jours écoulés / durée totale).
  protected readonly periode = computed(() => {
    const a = this.abonnement();
    if (!a) {
      return 0;
    }
    const debut = new Date(a.dateDebut).getTime();
    const fin = new Date(a.dateFin).getTime();
    return pourcentage(Date.now() - debut, fin - debut);
  });

  // Les trois quotas de la formule et leur consommation. max = 0 : sans
  // plafond (formule MAX) → pas de jauge, ni de « restant(s) ».
  protected readonly quotas = computed<{ icone: NomIcone; libelle: string; utilise: number; max: number; illimite: boolean; part: number }[]>(() => {
    const a = this.abonnement();
    if (!a) {
      return [];
    }
    const enCours = this.tontines().filter((t) => t.statut !== 'TERMINEE');
    const plusGrande = Math.max(0, ...this.tontines().map((t) => t.nombreMembres ?? 0));
    const ligne = (icone: NomIcone, libelle: string, utilise: number, max: number) => ({
      icone,
      libelle,
      utilise,
      max,
      illimite: !max,
      part: pourcentage(utilise, max),
    });
    return [
      ligne('tontine', 'Tontines en cours', enCours.length, a.nbTontinesMax),
      ligne('utilisateurs', 'Membres (plus grande tontine)', plusGrande, a.nbMembresMax),
      ligne('message', 'SMS ce mois-ci', a.smsEnvoyesMois, a.smsParMois),
    ];
  });

  constructor() {
    forkJoin({
      abonnement: this.compte.monAbonnement(),
      tontines: this.dashboard.mesTontines().pipe(catchError(() => of([] as TontineResume[]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.abonnement.set(r.abonnement);
          this.tontines.set(r.tontines);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
