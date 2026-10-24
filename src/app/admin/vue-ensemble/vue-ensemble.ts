import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AdminApi } from '../../api/admin.api';
import { DashboardApi } from '../../api/dashboard.api';
import { DateCourtePipe, DateRelativePipe, FcfaPipe, fcfa, initiales, pourcentage, teinteAvatar } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Abonnement, StatsTontines, StatsUtilisateurs, Utilisateur } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

/**
 * Le tableau de bord de l'administrateur : la santé de la plateforme.
 * Quatre appels en parallèle (forkJoin) ; si les abonnements ou la liste des
 * comptes échouent, on affiche quand même les statistiques (catchError → []).
 */
@Component({
  selector: 'app-vue-ensemble',
  imports: [RouterLink, CarteStat, EtatVide, Icone, Statut, FcfaPipe, DateCourtePipe, DateRelativePipe],
  templateUrl: './vue-ensemble.html',
  styleUrl: './vue-ensemble.css',
})
export class VueEnsemble {
  private readonly dashboard = inject(DashboardApi);
  private readonly admin = inject(AdminApi);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly comptes = signal<StatsUtilisateurs | null>(null);
  protected readonly tontines = signal<StatsTontines | null>(null);
  protected readonly abonnements = signal<Abonnement[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);

  protected readonly fcfa = fcfa;
  protected readonly initiales = initiales;
  protected readonly teinte = teinteAvatar;

  // Le revenu mensuel récurrent : la somme des prix des abonnements actifs.
  protected readonly revenuMensuel = computed(() =>
    this.abonnements()
      .filter((a) => a.actif)
      .reduce((s, a) => s + a.prixMensuel, 0),
  );
  protected readonly nbAbonnesActifs = computed(() => this.abonnements().filter((a) => a.actif).length);

  // Les abonnements actifs qui finissent dans les 30 jours : à relancer.
  protected readonly bientotExpires = computed(() => {
    const limite = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return this.abonnements()
      .filter((a) => a.actif && new Date(a.dateFin).getTime() <= limite)
      .sort((a, b) => a.dateFin.localeCompare(b.dateFin))
      .slice(0, 5);
  });

  // Les 5 derniers comptes créés.
  protected readonly recents = computed(() =>
    [...this.utilisateurs()].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5),
  );

  // La répartition des comptes, prête pour la barre empilée.
  // Couleurs catégorielles validées (palette de référence, ordre fixe).
  protected readonly repartition = computed(() => {
    const c = this.comptes();
    if (!c) {
      return [];
    }
    return [
      { libelle: 'Membres', valeur: c.nbMembres, couleur: 'var(--serie-1)' },
      { libelle: 'Gestionnaires', valeur: c.nbGestionnaires, couleur: 'var(--serie-2)' },
      { libelle: 'Administrateurs', valeur: c.nbAdmins, couleur: 'var(--serie-3)' },
    ].map((p) => ({ ...p, part: pourcentage(p.valeur, c.total) }));
  });

  // Les tontines par statut : une barre horizontale par statut (même teinte,
  // la longueur porte la quantité).
  protected readonly parStatut = computed(() => {
    const t = this.tontines();
    if (!t) {
      return [];
    }
    const lignes = [
      { libelle: 'Actives', valeur: t.nbActive, statut: 'ACTIVE' },
      { libelle: 'En préparation', valeur: t.nbEnAttente, statut: 'EN_ATTENTE' },
      { libelle: 'Suspendues', valeur: t.nbSuspendue, statut: 'SUSPENDUE' },
      { libelle: 'Terminées', valeur: t.nbTerminee, statut: 'TERMINEE' },
    ];
    const max = Math.max(1, ...lignes.map((l) => l.valeur));
    return lignes.map((l) => ({ ...l, largeur: (l.valeur / max) * 100 }));
  });

  constructor() {
    forkJoin({
      comptes: this.dashboard.statsUtilisateurs(),
      tontines: this.dashboard.statsTontines(),
      abonnements: this.admin.abonnements().pipe(catchError(() => of([]))),
      utilisateurs: this.admin.utilisateurs().pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.comptes.set(r.comptes);
          this.tontines.set(r.tontines);
          this.abonnements.set(r.abonnements);
          this.utilisateurs.set(r.utilisateurs);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
