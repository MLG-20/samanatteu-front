import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TontineApi } from '../../api/tontine.api';
import { FcfaPipe } from '../../core/formatage';
import { MODES_PAIEMENT, messageErreur } from '../../core/libelles';
import { Cotisation, ModePaiement } from '../../core/modeles';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';

export interface CiblePaiement {
  cotisation: Cotisation;
  membre: string;
}

/**
 * Enregistrer le paiement d'une cotisation. Un seul montant couvre la part ET
 * la caisse de prêt : le backend remplit la part d'abord, le surplus va à la
 * caisse. On affiche ce partage en direct pour que ce soit clair.
 */
@Component({
  selector: 'app-paiement-cotisation',
  imports: [ReactiveFormsModule, Modale, Icone, FcfaPipe],
  template: `
    @let c = cible();
    <app-modale [ouverte]="!!c" titre="Enregistrer un paiement" [sousTitre]="c?.membre ?? ''" (fermer)="fermer.emit()">
      <form id="form-paiement" [formGroup]="formulaire" (ngSubmit)="enregistrer()">
        @if (erreur()) {
          <div class="alerte alerte-erreur" role="alert"><app-icone nom="erreur" /><span>{{ erreur() }}</span></div>
        }
        <div class="champ">
          <label for="p-montant">Montant reçu</label>
          <div class="saisie">
            <input id="p-montant" class="entree montant" type="number" min="1" formControlName="montant" />
            <span class="suffixe">FCFA</span>
          </div>
          <div class="raccourcis">
            <button type="button" class="btn btn-doux btn-petit" (click)="formulaire.controls.montant.setValue(reste().total)">Tout ({{ reste().total | fcfa }})</button>
            @if (reste().caisse > 0 && reste().part > 0) {
              <button type="button" class="btn btn-fantome btn-petit" (click)="formulaire.controls.montant.setValue(reste().part)">Part seule</button>
            }
          </div>
          @if (formulaire.controls.montant.touched && formulaire.controls.montant.invalid) {
            <span class="aide-erreur">Entre 1 et {{ reste().total | fcfa }}.</span>
          }
        </div>

        <!-- Le partage du paiement, en direct. -->
        <div class="partage">
          <div><span>Part</span><strong class="chiffres">{{ partage().part | fcfa }}</strong></div>
          <div><span>Caisse de prêt</span><strong class="chiffres">{{ partage().caisse | fcfa }}</strong></div>
          <div class="reste"><span>Restera dû</span><strong class="chiffres">{{ partage().restera | fcfa }}</strong></div>
        </div>

        <div class="champ">
          <span class="etiquette">Mode de paiement</span>
          <div class="choix">
            @for (m of modes; track m.valeur) {
              <label><input type="radio" formControlName="modePaiement" [value]="m.valeur" /> {{ m.libelle }}</label>
            }
          </div>
        </div>
        @if (valeurs().modePaiement !== 'CASH') {
          <div class="champ">
            <label for="p-ref">Référence de la transaction</label>
            <input id="p-ref" class="entree" formControlName="reference" placeholder="Ex. ID Wave reçu par SMS" />
          </div>
        }
      </form>
      <div pied>
        <button type="button" class="btn btn-secondaire" (click)="fermer.emit()">Annuler</button>
        <button type="submit" form="form-paiement" class="btn btn-primaire" [disabled]="envoi()">
          @if (envoi()) { <span class="rouage"></span> } @else { <app-icone nom="valider" /> }
          Enregistrer
        </button>
      </div>
    </app-modale>
  `,
  styles: `
    .montant {
      height: 3.3rem;
      font-family: var(--police-titre);
      font-size: 1.35rem;
      font-weight: 700;
    }
    .raccourcis {
      display: flex;
      gap: 0.4rem;
    }
    .partage {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1.1rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      background: var(--surface-2);
      border: 1px solid var(--bordure);
      font-size: 0.88rem;
    }
    .partage div {
      display: flex;
      justify-content: space-between;
      color: var(--texte-2);
    }
    .partage .reste {
      padding-top: 0.5rem;
      border-top: 1px dashed var(--bordure-forte);
      color: var(--texte-doux);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaiementCotisation {
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);

  readonly cible = input<CiblePaiement | null>(null);
  readonly fermer = output<void>();
  readonly fait = output<Cotisation>();

  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  // Object.entries(MODES_PAIEMENT) → [['CASH','Espèces'], …] → [{valeur, libelle}, …]
  protected readonly modes = Object.entries(MODES_PAIEMENT).map(([valeur, libelle]) => ({
    valeur: valeur as ModePaiement,
    libelle,
  }));

  private readonly fb = inject(FormBuilder);
  protected readonly formulaire = this.fb.nonNullable.group({
    montant: [0, [Validators.required, Validators.min(1)]],
    modePaiement: this.fb.nonNullable.control<ModePaiement>('CASH'),
    reference: [''],
  });
  protected readonly valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.getRawValue() });

  // Ce qui reste dû, séparé en part / caisse.
  protected readonly reste = computed(() => {
    const c = this.cible()?.cotisation;
    const part = c ? Math.max(0, c.montantDu - c.montantPaye) : 0;
    const caisse = c ? Math.max(0, c.montantCaisseDu - c.montantCaissePaye) : 0;
    return { part, caisse, total: part + caisse };
  });

  // Le partage du montant saisi, comme le fera le backend (part prioritaire).
  protected readonly partage = computed(() => {
    const m = Math.max(0, Number(this.valeurs().montant) || 0);
    const r = this.reste();
    const part = Math.min(m, r.part);
    const caisse = Math.min(m - part, r.caisse);
    return { part, caisse, restera: Math.max(0, r.total - part - caisse) };
  });

  constructor() {
    effect(() => {
      const c = this.cible();
      if (c) {
        const total = this.reste().total;
        this.erreur.set(null);
        this.formulaire.controls.montant.setValidators([Validators.required, Validators.min(1), Validators.max(total)]);
        this.formulaire.reset({ montant: total, modePaiement: 'CASH', reference: '' });
      }
    });
  }

  protected enregistrer(): void {
    const c = this.cible();
    if (!c || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    this.envoi.set(true);
    this.api
      .payer(c.cotisation.id, { montant: v.montant, modePaiement: v.modePaiement, reference: v.reference.trim() || null })
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (maj) => {
          this.toasts.succes(maj.statut === 'COMPLET' ? `Cotisation de ${c.membre} réglée.` : 'Paiement partiel enregistré.');
          this.fait.emit(maj);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
