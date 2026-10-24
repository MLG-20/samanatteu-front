import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { FinanceApi } from '../api/finance.api';
import { FcfaPipe } from '../core/formatage';
import { messageErreur } from '../core/libelles';
import { Pret } from '../core/modeles';
import { Icone } from '../ui/icone';
import { Modale } from '../ui/modale';
import { ToastService } from '../ui/notifications-ui';

export interface CibleRemboursement {
  pretId: number;
  membre: string;
  reste: number;
  prochaine: number | null; // le montant de la prochaine échéance, si connu
}

// Enregistrer un remboursement de prêt (le backend l'impute sur les échéances, dans l'ordre).
@Component({
  selector: 'app-remboursement-pret',
  imports: [ReactiveFormsModule, Modale, Icone, FcfaPipe],
  template: `
    @let c = cible();
    <app-modale [ouverte]="!!c" titre="Enregistrer un remboursement" [sousTitre]="c?.membre ?? ''" (fermer)="fermer.emit()">
      <form id="form-remboursement" [formGroup]="formulaire" (ngSubmit)="enregistrer()">
        @if (erreur()) {
          <div class="alerte alerte-erreur" role="alert"><app-icone nom="erreur" /><span>{{ erreur() }}</span></div>
        }
        <div class="champ">
          <label for="r-montant">Montant reçu</label>
          <div class="saisie">
            <input id="r-montant" class="entree" type="number" min="1" formControlName="montant" />
            <span class="suffixe">FCFA</span>
          </div>
          <div class="raccourcis">
            @if (c?.prochaine) {
              <button type="button" class="btn btn-doux btn-petit" (click)="formulaire.controls.montant.setValue(c!.prochaine!)">Prochaine échéance ({{ c?.prochaine | fcfa }})</button>
            }
            <button type="button" class="btn btn-fantome btn-petit" (click)="formulaire.controls.montant.setValue(c?.reste ?? 0)">Solde ({{ c?.reste | fcfa }})</button>
          </div>
        </div>
      </form>
      <div pied>
        <button type="button" class="btn btn-secondaire" (click)="fermer.emit()">Annuler</button>
        <button type="submit" form="form-remboursement" class="btn btn-primaire" [disabled]="envoi()">
          @if (envoi()) { <span class="rouage"></span> } @else { <app-icone nom="valider" /> }
          Enregistrer
        </button>
      </div>
    </app-modale>
  `,
  styles: `
    .raccourcis {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemboursementPret {
  private readonly api = inject(FinanceApi);
  private readonly toasts = inject(ToastService);

  readonly cible = input<CibleRemboursement | null>(null);
  readonly fermer = output<void>();
  readonly fait = output<Pret>();

  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    montant: [0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    effect(() => {
      const c = this.cible();
      if (c) {
        this.erreur.set(null);
        this.formulaire.controls.montant.setValidators([Validators.required, Validators.min(1), Validators.max(c.reste)]);
        this.formulaire.reset({ montant: c.prochaine ?? c.reste });
      }
    });
  }

  protected enregistrer(): void {
    const c = this.cible();
    if (!c || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.api
      .rembourser(c.pretId, this.formulaire.getRawValue().montant)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (p) => {
          this.toasts.succes(p.statut === 'REMBOURSE' ? `Prêt de ${c.membre} entièrement remboursé !` : 'Remboursement enregistré.');
          this.fait.emit(p);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
