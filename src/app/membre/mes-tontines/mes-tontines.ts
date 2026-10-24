import { Component, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, FcfaPipe, pourcentage } from '../../core/formatage';
import { messageErreur, rythme } from '../../core/libelles';
import { Cotisation, Cycle, MaTontine, Participation, Tirage, Tontine } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

interface Fiche {
  resume: MaTontine;
  tontine: Tontine | undefined;
  cycleEnCours: Cycle | undefined;
  // Une pastille par cycle : payé / en retard / à venir / gagné.
  historique: { numero: number; statut: string; gagne: boolean }[];
}

// « Mes tontines » côté membre : chaque tontine, son rythme, le cycle en cours
// et l'historique de MES cotisations, cycle par cycle.
@Component({
  selector: 'app-mes-tontines',
  imports: [Icone, Statut, EtatVide, FcfaPipe, DateCourtePipe],
  templateUrl: './mes-tontines.html',
  styleUrl: './mes-tontines.css',
})
export class MesTontines {
  private readonly api = inject(TontineApi);
  private readonly dashboard = inject(DashboardApi);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly fiches = signal<Fiche[]>([]);
  protected readonly rythme = rythme;
  protected readonly pourcentage = pourcentage;

  constructor() {
    forkJoin({
      resumes: this.dashboard.mesParticipations(),
      tontines: this.api.lister().pipe(catchError(() => of([] as Tontine[]))),
      cycles: this.api.cycles().pipe(catchError(() => of([] as Cycle[]))),
      participations: this.api.participations().pipe(catchError(() => of([] as Participation[]))),
      cotisations: this.api.cotisations().pipe(catchError(() => of([] as Cotisation[]))),
      tirages: this.api.tirages().pipe(catchError(() => of([] as Tirage[]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.fiches.set(
            r.resumes.map((resume) => {
              const id = resume.tontineId;
              const cycles = r.cycles.filter((c) => c.tontineId === id).sort((a, b) => a.numeroCycle - b.numeroCycle);
              const mesParts = new Set(r.participations.filter((p) => p.tontineId === id).map((p) => p.id));
              const historique = cycles.map((c) => {
                const cotis = r.cotisations.find((x) => x.cycleId === c.id && mesParts.has(x.participationId));
                const gagne = r.tirages.some((t) => t.cycleId === c.id && mesParts.has(t.participationId));
                return { numero: c.numeroCycle, statut: cotis?.statut ?? 'EN_ATTENTE', gagne };
              });
              return {
                resume,
                tontine: r.tontines.find((t) => t.id === id),
                cycleEnCours: cycles.find((c) => c.statut === 'EN_COURS'),
                historique,
              };
            }),
          );
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
