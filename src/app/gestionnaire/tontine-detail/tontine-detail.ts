import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, FcfaPipe, fcfa, pourcentage } from '../../core/formatage';
import { messageErreur, rythme } from '../../core/libelles';
import { Tontine } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { ConfirmationService } from '../../ui/confirmation';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';
import { FormulaireTontine } from '../formulaire-tontine';
import { ResultatTirage, TirageCelebration } from '../tirage-celebration';
import { OngletCycles } from './onglet-cycles';
import { OngletInvitations } from './onglet-invitations';
import { OngletMembres } from './onglet-membres';
import { OngletPrets } from './onglet-prets';
import { TontineCourante } from './tontine-courante';

// La liste existe à l'exécution (pour valider ?onglet=…) ; le type en est déduit.
const ONGLETS = ['apercu', 'membres', 'cycles', 'prets', 'invitations'] as const;
type Onglet = (typeof ONGLETS)[number];

/**
 * La page d'une tontine : en-tête (statut, actions du cycle de vie) + onglets.
 * `providers: [TontineCourante]` : une instance neuve du store pour CETTE page,
 * partagée avec les onglets (voir tontine-courante.ts).
 */
@Component({
  selector: 'app-tontine-detail',
  imports: [
    RouterLink,
    Icone,
    Statut,
    CarteStat,
    EtatVide,
    FormulaireTontine,
    TirageCelebration,
    OngletMembres,
    OngletCycles,
    OngletPrets,
    OngletInvitations,
    FcfaPipe,
    DateCourtePipe,
  ],
  providers: [TontineCourante],
  templateUrl: './tontine-detail.html',
  styleUrl: './tontine-detail.css',
})
export class TontineDetail {
  protected readonly etat = inject(TontineCourante);
  private readonly api = inject(TontineApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly onglet = signal<Onglet>('apercu');
  protected readonly edition = signal(false);
  protected readonly actionEnCours = signal(false);
  protected readonly resultat = signal<ResultatTirage | null>(null);

  protected readonly fcfa = fcfa;
  protected readonly rythme = rythme;
  protected readonly pourcentage = pourcentage;

  protected readonly t = this.etat.tontine;

  // Les chiffres de l'aperçu.
  protected readonly chiffres = computed(() => {
    const t = this.t();
    const parts = this.etat.totalParts();
    return {
      parCycle: t ? parts * (t.montantPart + t.montantCaissePret) : 0,
      gainParCycle: t ? parts * t.montantPart : 0,
      cyclesFaits: this.etat.cycles().filter((c) => c.statut === 'CLOTURE').length,
    };
  });

  // L'avancement du cycle en cours (cotisations complètes / total).
  protected readonly avancement = computed(() => {
    const c = this.etat.cycleEnCours();
    if (!c) {
      return null;
    }
    const cotis = this.etat.cotisations().filter((x) => x.cycleId === c.id);
    return {
      cycle: c,
      payees: cotis.filter((x) => x.statut === 'COMPLET').length,
      total: cotis.length,
      retards: cotis.filter((x) => x.statut === 'EN_RETARD').length,
      part: pourcentage(c.montantCollecte, c.montantAttendu),
    };
  });

  // Les gagnants, du plus récent au plus ancien.
  protected readonly palmares = computed(() =>
    [...this.etat.tirages()]
      .sort((a, b) => b.dateTirage.localeCompare(a.dateTirage))
      .map((t) => ({
        tirage: t,
        cycle: this.etat.cycles().find((c) => c.id === t.cycleId)?.numeroCycle,
        nom: this.etat.nomDe(this.etat.participation(t.participationId)),
      })),
  );

  constructor() {
    const route = inject(ActivatedRoute).snapshot;
    // Number(…) : le paramètre d'URL est une chaîne (≈ Long.parseLong).
    this.etat.charger(Number(route.paramMap.get('id')));
    // ?onglet=invitations (bouton « Inviter » des listes) : on ouvre directement
    // le bon onglet. Une valeur inconnue est ignorée (on reste sur l'aperçu).
    const demande = route.queryParamMap.get('onglet');
    if (demande && ONGLETS.includes(demande as Onglet)) {
      this.onglet.set(demande as Onglet);
    }
  }

  // ---------- Cycle de vie de la tontine ----------

  protected async changerStatut(action: 'activer' | 'suspendre' | 'cloturer'): Promise<void> {
    const t = this.t();
    if (!t) {
      return;
    }
    const textes = {
      activer: {
        titre: t.statut === 'SUSPENDUE' ? 'Réactiver la tontine ?' : 'Activer la tontine ?',
        message: "Les membres actuels sont fixés pour le tour et vous pourrez ouvrir le premier cycle de cotisations.",
        bouton: t.statut === 'SUSPENDUE' ? 'Réactiver' : 'Activer',
        succes: 'La tontine est active.',
      },
      suspendre: {
        titre: 'Suspendre la tontine ?',
        message: "Plus aucun cycle ne pourra être ouvert tant qu'elle est suspendue. Vous pourrez la réactiver.",
        bouton: 'Suspendre',
        succes: 'Tontine suspendue.',
      },
      cloturer: {
        titre: 'Clôturer définitivement ?',
        message: 'La tontine passera à « Terminée ». Cette action est irréversible.',
        bouton: 'Clôturer',
        succes: 'Tontine terminée. Merci à tous ses membres !',
      },
    }[action];
    const oui = await this.confirmation.demander({ ...textes, danger: action !== 'activer' });
    if (oui) {
      this.executer(this.api.changerStatut(t.id, action), textes.succes);
    }
  }

  protected ouvrirCycle(): void {
    const t = this.t();
    if (t) {
      this.executer(this.api.ouvrirCycle(t.id), 'Nouveau cycle ouvert : les cotisations sont attendues.', () =>
        this.onglet.set('cycles'),
      );
    }
  }

  protected async cloturerCycle(): Promise<void> {
    const c = this.etat.cycleEnCours();
    if (!c) {
      return;
    }
    const av = this.avancement();
    const oui = await this.confirmation.demander({
      titre: `Clôturer le cycle ${c.numeroCycle} ?`,
      message:
        av && av.payees < av.total
          ? `${av.total - av.payees} cotisation(s) ne sont pas encore réglées : elles passeront « en retard ». Vous pourrez ensuite lancer le tirage.`
          : 'Toutes les cotisations sont réglées. Vous pourrez ensuite lancer le tirage.',
      bouton: 'Clôturer le cycle',
    });
    if (oui) {
      this.executer(this.api.cloturerCycle(c.id), `Cycle ${c.numeroCycle} clôturé.`);
    }
  }

  protected async tirer(): Promise<void> {
    const c = this.etat.cycleATirer();
    const t = this.t();
    if (!c || !t) {
      return;
    }
    const oui = await this.confirmation.demander({
      titre: `Tirer au sort le cycle ${c.numeroCycle} ?`,
      message: "Un gagnant est désigné parmi les membres qui n'ont pas encore gagné. Le résultat est définitif.",
      bouton: 'Lancer le tirage',
    });
    if (!oui) {
      return;
    }
    this.actionEnCours.set(true);
    this.api
      .tirerAuSort(c.id)
      .pipe(finalize(() => this.actionEnCours.set(false)))
      .subscribe({
        next: (tirage) => {
          const p = this.etat.participation(tirage.participationId);
          this.resultat.set({
            gagnant: this.etat.nomDe(p),
            telephone: this.etat.telephoneDe(p),
            tontine: t.nom,
            cycle: c.numeroCycle,
            montant: tirage.montantGagne,
          });
          this.etat.recharger();
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e, 'Le tirage a échoué.')),
      });
  }

  protected async supprimer(): Promise<void> {
    const t = this.t();
    if (!t) {
      return;
    }
    const oui = await this.confirmation.demander({
      titre: 'Supprimer cette tontine ?',
      message: `« ${t.nom} » et ses invitations seront supprimées. Cette action est définitive.`,
      bouton: 'Supprimer',
      danger: true,
    });
    if (!oui) {
      return;
    }
    this.api.supprimer(t.id).subscribe({
      next: () => {
        this.toasts.succes('Tontine supprimée.');
        this.router.navigateByUrl('/gestionnaire/tontines');
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e, 'Suppression impossible (des cycles existent peut-être).')),
    });
  }

  protected modifiee(t: Tontine): void {
    this.edition.set(false);
    this.etat.tontine.set(t);
  }

  // Lance une action, affiche le toast, puis recharge la page en silence.
  private executer(action: Observable<unknown>, succes: string, ensuite?: () => void): void {
    this.actionEnCours.set(true);
    action.pipe(finalize(() => this.actionEnCours.set(false))).subscribe({
      next: () => {
        this.toasts.succes(succes);
        this.etat.recharger();
        ensuite?.(); // ?.() : appelle seulement si la fonction existe
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
    });
  }
}
