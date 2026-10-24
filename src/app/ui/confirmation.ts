import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

import { Icone } from './icone';
import { Modale } from './modale';

export interface Demande {
  titre: string;
  message: string;
  bouton?: string;
  danger?: boolean;
}

/**
 * « Êtes-vous sûr ? » avant une action irréversible (supprimer, clôturer…).
 *
 *   if (await this.confirmation.demander({ titre: 'Supprimer ?', message: '…', danger: true })) { … }
 *
 * `await` sur une Promise<boolean> : le code ATTEND la réponse de l'utilisateur
 * (≈ un CompletableFuture<Boolean> qu'on .get(), sans bloquer la page).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  readonly enCours = signal<(Demande & { repondre: (oui: boolean) => void }) | null>(null);

  demander(demande: Demande): Promise<boolean> {
    // new Promise(resolve => …) : on garde `resolve` pour l'appeler plus tard,
    // quand l'utilisateur cliquera sur Oui ou Non.
    return new Promise((resolve) => {
      this.enCours.set({
        ...demande,
        repondre: (oui) => {
          this.enCours.set(null);
          resolve(oui);
        },
      });
    });
  }
}

@Component({
  selector: 'app-confirmation',
  imports: [Modale, Icone],
  template: `
    @let d = service.enCours();
    <app-modale [ouverte]="!!d" [titre]="d?.titre ?? ''" (fermer)="d?.repondre(false)">
      <div class="contenu">
        <span class="symbole" [class.danger]="d?.danger"><app-icone [nom]="d?.danger ? 'alerte' : 'info'" /></span>
        <p>{{ d?.message }}</p>
      </div>
      <div pied>
        <button type="button" class="btn btn-secondaire" (click)="d?.repondre(false)">Annuler</button>
        <button type="button" class="btn" [class]="d?.danger ? 'btn btn-danger' : 'btn btn-primaire'" (click)="d?.repondre(true)">
          {{ d?.bouton ?? 'Confirmer' }}
        </button>
      </div>
    </app-modale>
  `,
  styles: `
    .contenu {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }
    .symbole {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 50%;
      background: var(--primaire-50);
      color: var(--primaire-600);
    }
    .symbole.danger {
      background: var(--erreur-fond);
      color: var(--erreur);
    }
    p {
      margin: 0.35rem 0 0;
      color: var(--texte-2);
      line-height: 1.55;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirmation {
  protected readonly service = inject(ConfirmationService);
}
