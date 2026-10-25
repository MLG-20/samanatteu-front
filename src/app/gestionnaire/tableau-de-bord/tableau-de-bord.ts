import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { TontineApi } from '../../api/tontine.api';
import { AuthService } from '../../auth/auth.service';
import { DateCourtePipe, DateRelativePipe, FcfaPipe, fcfa, pourcentage } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { CotisationRetard, GainAVerser, MesMembres, PretEnCours, TirageAFaire, TontineResume } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { ConfirmationService } from '../../ui/confirmation';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';
import { ResultatTirage, TirageCelebration } from '../tirage-celebration';
import { GainAVerserCible, VersementGain } from '../versement-gain';

/**
 * Le tableau de bord du gestionnaire : ce qui est collecté, ce qui est en
 * retard, et surtout CE QU'IL Y A À FAIRE (tirages, gains à verser).
 * Cinq vues de synthèse du backend, chargées en parallèle.
 */
@Component({
  selector: 'app-tableau-de-bord-gestionnaire',
  imports: [
    RouterLink,
    CarteStat,
    EtatVide,
    Icone,
    Statut,
    TirageCelebration,
    VersementGain,
    FcfaPipe,
    DateCourtePipe,
    DateRelativePipe,
  ],
  templateUrl: './tableau-de-bord.html',
  styleUrl: './tableau-de-bord.css',
})
export class TableauDeBordGestionnaire {
  private readonly dashboard = inject(DashboardApi);
  private readonly tontineApi = inject(TontineApi);
  private readonly toasts = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly prenom = inject(AuthService).utilisateur()?.prenom;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly tontines = signal<TontineResume[]>([]);
  protected readonly retards = signal<CotisationRetard[]>([]);
  protected readonly prets = signal<PretEnCours[]>([]);
  protected readonly tirages = signal<TirageAFaire[]>([]);
  protected readonly gains = signal<GainAVerser[]>([]);
  // Calculé par le backend : on ne peut pas additionner les membres des
  // tontines (une personne inscrite dans deux tontines serait comptée deux fois).
  protected readonly membres = signal<MesMembres | null>(null);

  protected readonly tirageEnCours = signal<number | null>(null);
  protected readonly resultat = signal<ResultatTirage | null>(null);
  protected readonly versement = signal<GainAVerserCible | null>(null);

  protected readonly fcfa = fcfa;
  protected readonly pourcentage = pourcentage;

  // Les chiffres du bandeau : somme sur les tontines actives.
  protected readonly synthese = computed(() => {
    const actives = this.tontines().filter((t) => t.statut === 'ACTIVE');
    const collecte = actives.reduce((s, t) => s + (t.montantCollecte ?? 0), 0);
    const attendu = actives.reduce((s, t) => s + (t.montantAttendu ?? 0), 0);
    return {
      actives: actives.length,
      collecte,
      attendu,
      part: pourcentage(collecte, attendu),
      caisse: this.tontines().reduce((s, t) => s + (t.soldeCaissePret ?? 0), 0),
      retards: this.retards().reduce((s, r) => s + r.resteDu, 0),
      gains: this.gains().reduce((s, g) => s + g.resteAVerser, 0),
      prets: this.prets().reduce((s, p) => s + p.resteARembourser, 0),
    };
  });

  protected readonly nbActions = computed(() => this.tirages().length + this.gains().length);

  constructor() {
    this.charger();
  }

  private charger(): void {
    // catchError par vue : si UNE vue échoue, les autres s'affichent quand même.
    forkJoin({
      tontines: this.dashboard.mesTontines(),
      membres: this.dashboard.mesMembres().pipe(catchError(() => of(null))),
      retards: this.dashboard.retards().pipe(catchError(() => of([] as CotisationRetard[]))),
      prets: this.dashboard.pretsEnCours().pipe(catchError(() => of([] as PretEnCours[]))),
      tirages: this.dashboard.tiragesAFaire().pipe(catchError(() => of([] as TirageAFaire[]))),
      gains: this.dashboard.gainsAVerser().pipe(catchError(() => of([] as GainAVerser[]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.tontines.set(r.tontines);
          this.membres.set(r.membres);
          this.retards.set(r.retards);
          this.prets.set(r.prets);
          this.tirages.set(r.tirages);
          this.gains.set(r.gains);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // Tirer au sort : confirmation, appel, puis on recharge les gains pour
  // retrouver le NOM du gagnant (le tirage ne renvoie que son id) et on célèbre.
  protected async tirer(t: TirageAFaire): Promise<void> {
    const oui = await this.confirmation.demander({
      titre: `Tirer au sort le cycle ${t.numeroCycle} ?`,
      message: `Un gagnant sera désigné parmi les membres de « ${t.tontineNom} » qui n'ont pas encore gagné. Le résultat est définitif et le gagnant est prévenu par SMS.`,
      bouton: 'Lancer le tirage',
    });
    if (!oui) {
      return;
    }
    this.tirageEnCours.set(t.cycleId);
    this.tontineApi
      .tirerAuSort(t.cycleId)
      .pipe(
        // switchMap : une fois le tirage fait, on enchaîne sur la liste des gains.
        // map : on garde les deux résultats ensemble ({ tirage, gains }).
        switchMap((tirage) =>
          this.dashboard.gainsAVerser().pipe(
            catchError(() => of([] as GainAVerser[])),
            map((gains) => ({ tirage, gains })),
          ),
        ),
        finalize(() => this.tirageEnCours.set(null)),
      )
      .subscribe({
        next: ({ tirage, gains }) => {
          const g = gains.find((x) => x.tirageId === tirage.id);
          this.gains.set(gains);
          this.tirages.update((l) => l.filter((x) => x.cycleId !== t.cycleId));
          this.resultat.set({
            gagnant: g?.gagnantNom ?? 'Le gagnant',
            telephone: g?.gagnantTelephone ?? null,
            tontine: t.tontineNom,
            cycle: t.numeroCycle,
            montant: tirage.montantGagne,
          });
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e, 'Le tirage a échoué.')),
      });
  }

  protected ouvrirVersement(g: GainAVerser): void {
    this.versement.set({ tirageId: g.tirageId, gagnant: g.gagnantNom, tontine: g.tontineNom, reste: g.resteAVerser });
  }

  protected apresVersement(): void {
    this.versement.set(null);
    this.dashboard.gainsAVerser().subscribe((g) => this.gains.set(g));
    this.dashboard.mesTontines().subscribe((t) => this.tontines.set(t));
  }
}
