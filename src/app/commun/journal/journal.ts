import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { FinanceApi, telecharger } from '../../api/finance.api';
import { TontineApi } from '../../api/tontine.api';
import { DateHeurePipe, FcfaPipe, fcfa } from '../../core/formatage';
import { MODES_PAIEMENT, TYPES_TRANSACTION, messageErreur } from '../../core/libelles';
import { Transaction, TypeTransaction } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { EtatVide } from '../../ui/etat-vide';
import { Icone, NomIcone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';

const ICONES: Record<TypeTransaction, NomIcone> = {
  COTISATION: 'portefeuille',
  GAIN: 'cadeau',
  PRET: 'pret',
  REMBOURSEMENT: 'rafraichir',
  PENALITE: 'alerte',
};

/**
 * Le journal financier : chaque mouvement d'argent, avec son reçu PDF.
 * Le même écran sert au gestionnaire (« Journal », toutes ses tontines) et au
 * membre (« Historique », ses propres opérations) : le backend filtre selon le rôle.
 */
@Component({
  selector: 'app-journal',
  // FormsModule : [(ngModel)], la liaison « dans les deux sens » d'un champ
  // simple (ici la recherche), sans construire de formulaire réactif.
  imports: [FormsModule, Icone, CarteStat, EtatVide, FcfaPipe, DateHeurePipe],
  templateUrl: './journal.html',
  styleUrl: './journal.css',
})
export class Journal {
  private readonly finance = inject(FinanceApi);
  private readonly tontineApi = inject(TontineApi);
  private readonly toasts = inject(ToastService);
  protected readonly estMembre = inject(AuthService).utilisateur()?.role === 'MEMBRE';

  protected readonly transactions = signal<Transaction[]>([]);
  // Le nom de chaque tontine, par id (≈ Map<Long, String>). Partial : une clé
  // absente donne undefined (comme map.get() qui renvoie null en Java).
  protected readonly nomsTontines = signal<Partial<Record<number, string>>>({});
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly enTelechargement = signal<number | null>(null);

  protected readonly recherche = signal('');
  protected readonly sens = signal<'TOUS' | 'ENTRANT' | 'SORTANT'>('TOUS');
  protected readonly tontine = signal<number | 'TOUTES'>('TOUTES');

  protected readonly icones = ICONES;
  protected readonly types = TYPES_TRANSACTION;
  protected readonly modes = MODES_PAIEMENT;

  protected readonly listeTontines = computed(() =>
    Object.entries(this.nomsTontines()).map(([id, nom]) => ({ id: Number(id), nom: nom ?? '' })),
  );

  protected readonly filtrees = computed(() => {
    const texte = this.recherche().trim().toLowerCase();
    return this.transactions()
      .filter((t) => this.sens() === 'TOUS' || t.sens === this.sens())
      .filter((t) => this.tontine() === 'TOUTES' || t.tontineId === this.tontine())
      .filter(
        (t) =>
          !texte ||
          [t.description, t.reference, this.types[t.type], this.nomsTontines()[t.tontineId]]
            .filter(Boolean)
            .some((champ) => champ!.toLowerCase().includes(texte)),
      )
      .sort((a, b) => b.dateTransaction.localeCompare(a.dateTransaction));
  });

  // Les totaux de ce qui est affiché (ils suivent les filtres).
  // reduce ≈ stream().reduce(0, Integer::sum).
  protected readonly totaux = computed(() => {
    const l = this.filtrees();
    const somme = (sens: string) => l.filter((t) => t.sens === sens).reduce((s, t) => s + t.montant, 0);
    const entrees = somme('ENTRANT');
    const sorties = somme('SORTANT');
    return { entrees, sorties, net: entrees - sorties, nombre: l.length };
  });

  protected readonly fcfa = fcfa;

  constructor() {
    // forkJoin : lance les deux requêtes EN PARALLÈLE et attend les deux
    // (≈ CompletableFuture.allOf).
    forkJoin({ transactions: this.finance.transactions(), tontines: this.tontineApi.lister() })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: ({ transactions, tontines }) => {
          this.transactions.set(transactions);
          // Object.fromEntries : une liste de paires [clé, valeur] → un objet (une « Map »).
          this.nomsTontines.set(Object.fromEntries(tontines.map((t) => [t.id, t.nom])));
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected telechargerRecu(t: Transaction): void {
    this.enTelechargement.set(t.id);
    this.finance
      .recu(t.id)
      .pipe(finalize(() => this.enTelechargement.set(null)))
      .subscribe({
        next: (pdf) => telecharger(pdf, `recu-samanatteu-${t.id}.pdf`),
        error: () => this.toasts.erreur("Le reçu n'a pas pu être généré."),
      });
  }
}
