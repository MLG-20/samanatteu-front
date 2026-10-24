import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';

import { FinanceApi } from '../../api/finance.api';
import { TontineApi } from '../../api/tontine.api';
import { messageErreur } from '../../core/libelles';
import {
  Cotisation,
  Cycle,
  EcheancePret,
  ImportMembre,
  Invitation,
  Participation,
  Pret,
  Tirage,
  Tontine,
} from '../../core/modeles';

/**
 * L'état de LA tontine affichée sur la page de détail, partagé par ses onglets.
 *
 * Ce service n'est PAS providedIn: 'root' : il est déclaré dans les
 * `providers` du composant TontineDetail. Chaque ouverture de la page en crée
 * donc un neuf, que ses onglets (composants enfants) reçoivent par inject().
 * ≈ un bean Spring de portée « requête » (@RequestScope), et non un singleton.
 */
@Injectable()
export class TontineCourante {
  private readonly api = inject(TontineApi);
  private readonly finance = inject(FinanceApi);

  readonly id = signal(0);
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);

  readonly tontine = signal<Tontine | null>(null);
  readonly cycles = signal<Cycle[]>([]);
  readonly participations = signal<Participation[]>([]);
  readonly cotisations = signal<Cotisation[]>([]);
  readonly tirages = signal<Tirage[]>([]);
  readonly prets = signal<Pret[]>([]);
  readonly echeances = signal<EcheancePret[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly imports = signal<ImportMembre[]>([]);

  // ---------- Valeurs calculées ----------

  readonly cyclesTries = computed(() => [...this.cycles()].sort((a, b) => b.numeroCycle - a.numeroCycle));
  readonly cycleEnCours = computed(() => this.cycles().find((c) => c.statut === 'EN_COURS') ?? null);
  readonly membresActifs = computed(() => this.participations().filter((p) => p.statut === 'ACTIF'));
  readonly totalParts = computed(() => this.membresActifs().reduce((s, p) => s + p.nombreParts, 0));

  // Le dernier cycle clôturé SANS tirage : le tirage est à faire.
  readonly cycleATirer = computed(() => {
    const avecTirage = new Set(this.tirages().map((t) => t.cycleId));
    return this.cyclesTries().find((c) => c.statut === 'CLOTURE' && !avecTirage.has(c.id)) ?? null;
  });

  readonly lienGroupe = computed(
    () =>
      this.invitations()
        .filter((i) => i.type === 'GROUPE' && i.statut === 'EN_ATTENTE')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
  );

  // Le nom à afficher pour une participation (le backend le recopie dans le DTO).
  nomDe(p: Participation | undefined | null): string {
    return p ? `${p.membrePrenom} ${p.membreNom}`.trim() : 'Membre';
  }

  telephoneDe(p: Participation | undefined | null): string | null {
    return p?.membreTelephone ?? null;
  }

  participation(id: number): Participation | undefined {
    return this.participations().find((p) => p.id === id);
  }

  participationDuMembre(membreId: number): Participation | undefined {
    return this.participations().find((p) => p.membreId === membreId);
  }

  // ---------- Chargement ----------

  // silencieux : on recharge sans remettre les squelettes (les données restent
  // à l'écran pendant l'appel, puis sont remplacées).
  charger(id: number, silencieux = false): void {
    this.id.set(id);
    if (!silencieux) {
      this.chargement.set(true);
    }
    this.erreur.set(null);
    // Chaque liste a son filet : si une échoue, la page s'affiche quand même.
    const sur = <T>(o: Observable<T[]>) => o.pipe(catchError(() => of([] as T[])));
    forkJoin({
      tontines: this.api.lister(),
      cycles: sur(this.api.cycles()),
      participations: sur(this.api.participations()),
      cotisations: sur(this.api.cotisations()),
      tirages: sur(this.api.tirages()),
      prets: sur(this.finance.prets()),
      echeances: sur(this.finance.echeances()),
      invitations: sur(this.api.invitations()),
      imports: sur(this.api.imports()),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          const tontine = r.tontines.find((t) => t.id === id) ?? null;
          if (!tontine) {
            this.erreur.set("Cette tontine n'existe pas, ou ne vous appartient pas.");
            return;
          }
          // On ne garde que ce qui concerne CETTE tontine.
          const cycles = r.cycles.filter((c) => c.tontineId === id);
          const idsCycles = new Set(cycles.map((c) => c.id));
          const prets = r.prets.filter((p) => p.tontineId === id);
          const idsPrets = new Set(prets.map((p) => p.id));
          const cotisations = r.cotisations.filter((c) => idsCycles.has(c.cycleId));
          const tirages = r.tirages.filter((t) => idsCycles.has(t.cycleId));

          this.tontine.set(tontine);
          this.cycles.set(cycles);
          this.participations.set(r.participations.filter((p) => p.tontineId === id));
          this.cotisations.set(cotisations);
          this.tirages.set(tirages);
          this.prets.set(prets);
          this.echeances.set(r.echeances.filter((e) => idsPrets.has(e.pretId)));
          this.invitations.set(r.invitations.filter((i) => i.tontineId === id));
          this.imports.set(r.imports.filter((i) => i.tontineId === id));
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // Après une action (paiement, tirage…) : tout est relu, en silence.
  recharger(): void {
    this.charger(this.id(), true);
  }
}
