import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { FinanceApi } from '../../api/finance.api';
import { DateHeurePipe, dateCourte } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Notification, TypeNotification } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone, NomIcone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

// L'icône et la couleur de chaque type de notification.
const APPARENCE: Record<TypeNotification, { icone: NomIcone; ton: string }> = {
  BIENVENUE: { icone: 'etincelle', ton: 'primaire' },
  INVITATION: { icone: 'lien', ton: 'info' },
  PAIEMENT_CONFIRME: { icone: 'succes', ton: 'succes' },
  RESULTAT_TIRAGE: { icone: 'cadeau', ton: 'or' },
  RAPPEL_COTISATION: { icone: 'horloge', ton: 'attention' },
  RAPPEL_ECHEANCE: { icone: 'calendrier', ton: 'attention' },
};

// Les SMS et emails envoyés à l'utilisateur, regroupés par jour.
@Component({
  selector: 'app-notifications',
  imports: [Icone, Statut, EtatVide, DateHeurePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private readonly api = inject(FinanceApi);

  protected readonly liste = signal<Notification[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly canal = signal<'TOUS' | 'SMS' | 'EMAIL'>('TOUS');
  protected readonly apparence = APPARENCE;

  // Filtrées par canal, triées de la plus récente à la plus ancienne, puis
  // regroupées par jour : [{ jour: '24 oct. 2026', elements: [...] }, …].
  protected readonly groupes = computed(() => {
    const filtre = this.canal();
    const triees = this.liste()
      .filter((n) => filtre === 'TOUS' || n.canal === filtre)
      // localeCompare sur des dates ISO = tri chronologique (≈ un Comparator).
      .sort((a, b) => (b.dateEnvoi ?? b.createdAt).localeCompare(a.dateEnvoi ?? a.createdAt));
    // Map garde l'ordre d'insertion (≈ LinkedHashMap).
    const parJour = new Map<string, Notification[]>();
    for (const n of triees) {
      const jour = dateCourte(n.dateEnvoi ?? n.createdAt);
      parJour.set(jour, [...(parJour.get(jour) ?? []), n]);
    }
    return [...parJour].map(([jour, elements]) => ({ jour, elements }));
  });

  protected readonly compte = computed(() => ({
    TOUS: this.liste().length,
    SMS: this.liste().filter((n) => n.canal === 'SMS').length,
    EMAIL: this.liste().filter((n) => n.canal === 'EMAIL').length,
  }));

  constructor() {
    this.api
      .notifications()
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (l) => this.liste.set(l),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
