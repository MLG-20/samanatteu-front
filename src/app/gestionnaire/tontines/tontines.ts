import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { TontineApi } from '../../api/tontine.api';
import { FcfaPipe, pourcentage } from '../../core/formatage';
import { messageErreur, rythme } from '../../core/libelles';
import { StatutTontine, Tontine, TontineResume } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';
import { FormulaireTontine } from '../formulaire-tontine';

type Filtre = 'TOUTES' | StatutTontine;

// Une tontine + son résumé du tableau de bord (membres, collecte du cycle).
interface Ligne extends Tontine {
  resume?: TontineResume;
}

// La liste des tontines du gestionnaire, en cartes, avec filtre et création.
@Component({
  selector: 'app-tontines',
  imports: [FormsModule, RouterLink, Icone, Statut, EtatVide, FormulaireTontine, FcfaPipe],
  templateUrl: './tontines.html',
  styleUrl: './tontines.css',
})
export class Tontines {
  private readonly api = inject(TontineApi);
  private readonly dashboard = inject(DashboardApi);
  private readonly router = inject(Router);

  protected readonly lignes = signal<Ligne[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly filtre = signal<Filtre>('TOUTES');
  protected readonly recherche = signal('');
  // ?nouvelle=1 dans l'URL (bouton du tableau de bord) : la modale s'ouvre directement.
  protected readonly creation = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('nouvelle'));

  protected readonly rythme = rythme;
  protected readonly pourcentage = pourcentage;
  protected readonly filtres: { valeur: Filtre; libelle: string }[] = [
    { valeur: 'TOUTES', libelle: 'Toutes' },
    { valeur: 'ACTIVE', libelle: 'Actives' },
    { valeur: 'EN_ATTENTE', libelle: 'En préparation' },
    { valeur: 'SUSPENDUE', libelle: 'Suspendues' },
    { valeur: 'TERMINEE', libelle: 'Terminées' },
  ];

  protected readonly compte = computed(() => {
    const c: Partial<Record<string, number>> = { TOUTES: this.lignes().length };
    for (const l of this.lignes()) {
      c[l.statut] = (c[l.statut] ?? 0) + 1;
    }
    return c;
  });

  protected readonly visibles = computed(() => {
    const t = this.recherche().trim().toLowerCase();
    // Les actives d'abord, puis les plus récentes.
    const ordre: Record<string, number> = { ACTIVE: 0, EN_ATTENTE: 1, SUSPENDUE: 2, TERMINEE: 3 };
    return this.lignes()
      .filter((l) => this.filtre() === 'TOUTES' || l.statut === this.filtre())
      .filter((l) => !t || l.nom.toLowerCase().includes(t))
      .sort((a, b) => ordre[a.statut] - ordre[b.statut] || b.createdAt.localeCompare(a.createdAt));
  });

  constructor() {
    forkJoin({
      tontines: this.api.lister(),
      resumes: this.dashboard.mesTontines().pipe(catchError(() => of([] as TontineResume[]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: ({ tontines, resumes }) =>
          this.lignes.set(tontines.map((t) => ({ ...t, resume: resumes.find((r) => r.id === t.id) }))),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // Créée : on va directement sur sa page (la suite logique : inviter les membres).
  protected creee(t: Tontine): void {
    this.creation.set(false);
    this.router.navigate(['/gestionnaire/tontines', t.id]);
  }
}
