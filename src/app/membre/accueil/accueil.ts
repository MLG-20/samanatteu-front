import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { AuthService } from '../../auth/auth.service';
import { DateCourtePipe, DateRelativePipe, FcfaPipe, fcfa, pourcentage } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { CotisationAPayer, MaTontine, MonGain, MonPret } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

// L'accueil du membre : ce qu'il doit, ce qu'il va recevoir, ses tontines et ses prêts.
@Component({
  selector: 'app-accueil-membre',
  imports: [RouterLink, CarteStat, EtatVide, Icone, Statut, FcfaPipe, DateCourtePipe, DateRelativePipe],
  templateUrl: './accueil.html',
  styleUrl: './accueil.css',
})
export class AccueilMembre {
  private readonly dashboard = inject(DashboardApi);
  protected readonly prenom = inject(AuthService).utilisateur()?.prenom;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly tontines = signal<MaTontine[]>([]);
  protected readonly cotisations = signal<CotisationAPayer[]>([]);
  protected readonly prets = signal<MonPret[]>([]);
  protected readonly gains = signal<MonGain[]>([]);

  protected readonly fcfa = fcfa;
  protected readonly pourcentage = pourcentage;

  // Les cotisations à payer, la plus urgente d'abord.
  protected readonly aPayer = computed(() =>
    [...this.cotisations()].sort((a, b) => Number(b.statut === 'EN_RETARD') - Number(a.statut === 'EN_RETARD') || a.dateLimite.localeCompare(b.dateLimite)),
  );

  protected readonly synthese = computed(() => ({
    actives: this.tontines().filter((t) => t.statut === 'ACTIVE').length,
    du: this.cotisations().reduce((s, c) => s + c.resteDu, 0),
    enRetard: this.cotisations().filter((c) => c.statut === 'EN_RETARD').length,
    prochaine: this.aPayer()[0] ?? null,
    aRecevoir: this.gains().reduce((s, g) => s + g.resteARecevoir, 0),
    gagne: this.gains().reduce((s, g) => s + g.montantGagne, 0),
    pret: this.prets().filter((p) => p.statut !== 'REMBOURSE').reduce((s, p) => s + p.resteARembourser, 0),
  }));

  constructor() {
    forkJoin({
      tontines: this.dashboard.mesParticipations(),
      cotisations: this.dashboard.cotisationsAPayer().pipe(catchError(() => of([] as CotisationAPayer[]))),
      prets: this.dashboard.mesPrets().pipe(catchError(() => of([] as MonPret[]))),
      gains: this.dashboard.mesGains().pipe(catchError(() => of([] as MonGain[]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.tontines.set(r.tontines);
          this.cotisations.set(r.cotisations);
          this.prets.set(r.prets);
          this.gains.set(r.gains);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
