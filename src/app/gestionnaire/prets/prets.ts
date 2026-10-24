import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { FinanceApi } from '../../api/finance.api';
import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, FcfaPipe, fcfa, pourcentage } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { EcheancePret, Pret, PretEnCours, StatutPret } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';
import { CibleRemboursement, RemboursementPret } from '../remboursement-pret';

type Filtre = 'TOUS' | StatutPret;

// Tous les prêts du gestionnaire, toutes tontines confondues.
@Component({
  selector: 'app-prets',
  imports: [RouterLink, Icone, Statut, EtatVide, CarteStat, RemboursementPret, FcfaPipe, DateCourtePipe],
  templateUrl: './prets.html',
  styleUrl: './prets.css',
})
export class Prets {
  private readonly finance = inject(FinanceApi);
  private readonly tontineApi = inject(TontineApi);
  private readonly dashboard = inject(DashboardApi);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  private readonly prets = signal<Pret[]>([]);
  private readonly echeances = signal<EcheancePret[]>([]);
  private readonly enCours = signal<PretEnCours[]>([]);
  private readonly nomsTontines = signal<Partial<Record<number, string>>>({});
  protected readonly filtre = signal<Filtre>('TOUS');
  protected readonly remboursement = signal<CibleRemboursement | null>(null);

  protected readonly fcfa = fcfa;
  protected readonly filtres: { valeur: Filtre; libelle: string }[] = [
    { valeur: 'TOUS', libelle: 'Tous' },
    { valeur: 'ACTIF', libelle: 'En cours' },
    { valeur: 'EN_RETARD', libelle: 'En retard' },
    { valeur: 'REMBOURSE', libelle: 'Remboursés' },
  ];

  protected readonly lignes = computed(() =>
    this.prets()
      .map((pret) => {
        const ech = this.echeances().filter((e) => e.pretId === pret.id);
        const total = ech.reduce((s, e) => s + e.montantDu, 0) || pret.montant + (pret.montantInteret ?? 0);
        const paye = ech.reduce((s, e) => s + e.montantPaye, 0);
        // .at(0) plutôt que [0] : son type dit « T | undefined » (liste vide), le [0] mentirait.
        const prochaine =
          ech
            .filter((e) => e.statut !== 'PAYE')
            .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
            .at(0) ?? null;
        const resume = this.enCours().find((x) => x.pretId === pret.id);
        return {
          pret,
          membre: resume?.membreNom ?? `Membre n°${pret.membreId}`,
          telephone: resume?.membreTelephone ?? null,
          tontine: this.nomsTontines()[pret.tontineId] ?? '—',
          total,
          reste: Math.max(0, total - paye),
          part: pourcentage(paye, total),
          prochaine,
        };
      })
      .sort((a, b) => Number(a.pret.statut === 'REMBOURSE') - Number(b.pret.statut === 'REMBOURSE') || b.pret.createdAt.localeCompare(a.pret.createdAt)),
  );

  protected readonly visibles = computed(() => this.lignes().filter((l) => this.filtre() === 'TOUS' || l.pret.statut === this.filtre()));

  protected readonly stats = computed(() => {
    const actifs = this.lignes().filter((l) => l.pret.statut !== 'REMBOURSE');
    return {
      encours: actifs.reduce((s, l) => s + l.reste, 0),
      nbActifs: actifs.length,
      retards: this.lignes().filter((l) => l.pret.statut === 'EN_RETARD').length,
      interets: this.lignes().reduce((s, l) => s + (l.total - l.pret.montant), 0),
    };
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    forkJoin({
      prets: this.finance.prets(),
      echeances: this.finance.echeances().pipe(catchError(() => of([] as EcheancePret[]))),
      enCours: this.dashboard.pretsEnCours().pipe(catchError(() => of([] as PretEnCours[]))),
      tontines: this.tontineApi.lister().pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.prets.set(r.prets);
          this.echeances.set(r.echeances);
          this.enCours.set(r.enCours);
          this.nomsTontines.set(Object.fromEntries(r.tontines.map((t) => [t.id, t.nom])));
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected compte(f: Filtre): number {
    return f === 'TOUS' ? this.lignes().length : this.lignes().filter((l) => l.pret.statut === f).length;
  }

  protected rembourse(): void {
    this.remboursement.set(null);
    this.charger();
  }
}
