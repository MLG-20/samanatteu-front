import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TontineApi } from '../api/tontine.api';
import { FcfaPipe } from '../core/formatage';
import { messageErreur } from '../core/libelles';
import { Tirage } from '../core/modeles';
import { Icone } from '../ui/icone';
import { Modale } from '../ui/modale';
import { ToastService } from '../ui/notifications-ui';

export interface GainAVerserCible {
  tirageId: number;
  gagnant: string;
  tontine: string;
  reste: number;
}

// La modale « Verser le gain » : montant pré-rempli avec ce qui reste dû
// (on peut verser en plusieurs fois), ou « Reporter » le versement.
@Component({
  selector: 'app-versement-gain',
  imports: [ReactiveFormsModule, Modale, Icone, FcfaPipe],
  template: `
    @let c = cible();
    <app-modale [ouverte]="!!c" titre="Verser le gain" [sousTitre]="c ? c.gagnant + ' · ' + c.tontine : ''" (fermer)="fermer.emit()">
      <form id="form-versement" [formGroup]="formulaire" (ngSubmit)="verser()">
        @if (erreur()) {
          <div class="alerte alerte-erreur" role="alert"><app-icone nom="erreur" /><span>{{ erreur() }}</span></div>
        }
        <div class="reste">
          <span>Reste à verser</span>
          <strong class="chiffres">{{ c?.reste | fcfa }}</strong>
        </div>
        <div class="champ">
          <label for="v-montant">Montant remis aujourd'hui</label>
          <div class="saisie">
            <input id="v-montant" class="entree" type="number" min="1" [max]="c?.reste ?? null" formControlName="montant" />
            <span class="suffixe">FCFA</span>
          </div>
          @if (formulaire.controls.montant.touched && formulaire.controls.montant.invalid) {
            <span class="aide-erreur">Entre 1 et {{ c?.reste | fcfa }}.</span>
          }
        </div>
      </form>
      <div pied>
        <button type="button" class="btn btn-fantome" [disabled]="envoi()" (click)="reporter()"><app-icone nom="horloge" /> Reporter</button>
        <button type="submit" form="form-versement" class="btn btn-primaire" [disabled]="envoi()">
          @if (envoi()) { <span class="rouage"></span> } @else { <app-icone nom="valider" /> }
          Confirmer le versement
        </button>
      </div>
    </app-modale>
  `,
  styles: `
    .reste {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.1rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.16), rgba(245, 158, 11, 0.06));
      color: var(--texte-2);
      font-weight: 600;
    }
    .reste strong {
      font-family: var(--police-titre);
      font-size: 1.3rem;
      color: var(--texte);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersementGain {
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);

  readonly cible = input<GainAVerserCible | null>(null);
  readonly fermer = output<void>();
  // Émis après un versement ou un report réussi : le parent recharge ses listes.
  readonly fait = output<Tirage>();

  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    montant: [0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    // À chaque ouverture : montant = reste dû, max = reste dû.
    effect(() => {
      const c = this.cible();
      if (c) {
        this.erreur.set(null);
        this.formulaire.controls.montant.setValidators([Validators.required, Validators.min(1), Validators.max(c.reste)]);
        this.formulaire.reset({ montant: c.reste });
      }
    });
  }

  protected verser(): void {
    const c = this.cible();
    if (!c || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.api
      .verserGain(c.tirageId, this.formulaire.getRawValue().montant)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (t) => {
          this.toasts.succes(t.statut === 'VERSE' ? `Gain entièrement versé à ${c.gagnant}.` : 'Versement partiel enregistré.');
          this.fait.emit(t);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected reporter(): void {
    const c = this.cible();
    if (!c) {
      return;
    }
    this.envoi.set(true);
    this.api
      .reporterGain(c.tirageId)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (t) => {
          this.toasts.info('Versement reporté.');
          this.fait.emit(t);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
