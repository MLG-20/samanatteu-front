import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TontineApi } from '../api/tontine.api';
import { FcfaPipe } from '../core/formatage';
import { messageErreur, rythme } from '../core/libelles';
import { FrequenceTontine, Tontine } from '../core/modeles';
import { Icone } from '../ui/icone';
import { Modale } from '../ui/modale';
import { ToastService } from '../ui/notifications-ui';

/**
 * La modale de création OU de modification d'une tontine (même formulaire :
 * CreationTontineDTO et ModificationTontineDTO ont les mêmes champs).
 *   <app-formulaire-tontine [ouverte]="…" [tontine]="null ou la tontine" (enregistree)="…" />
 * Un aperçu en direct (« Chaque semaine · 5 000 FCFA par part ») se met à jour à la frappe.
 */
@Component({
  selector: 'app-formulaire-tontine',
  imports: [ReactiveFormsModule, Modale, Icone, FcfaPipe],
  template: `
    <app-modale
      [ouverte]="ouverte()"
      [titre]="tontine() ? 'Modifier la tontine' : 'Nouvelle tontine'"
      [sousTitre]="tontine() ? 'Les cycles déjà ouverts gardent leurs montants.' : 'Elle restera « en préparation » jusqu’à son activation.'"
      [large]="true"
      (fermer)="fermer.emit()"
    >
      <form id="form-tontine" [formGroup]="formulaire" (ngSubmit)="enregistrer()">
        @if (erreur()) {
          <div class="alerte alerte-erreur" role="alert"><app-icone nom="erreur" /><span>{{ erreur() }}</span></div>
        }
        <div class="champ">
          <label for="t-nom">Nom de la tontine</label>
          <input id="t-nom" class="entree" formControlName="nom" placeholder="Ex. Tontine des amies de Médina" />
          @if (formulaire.controls.nom.touched && formulaire.controls.nom.invalid) {
            <span class="aide-erreur">Le nom est obligatoire.</span>
          }
        </div>

        <div class="ligne-champs">
          <div class="champ">
            <label for="t-part">Montant d'une part</label>
            <div class="saisie">
              <input id="t-part" class="entree" type="number" min="1" step="500" formControlName="montantPart" />
              <span class="suffixe">FCFA</span>
            </div>
            <span class="aide">Ce que verse chaque membre, par part et par cycle.</span>
          </div>
          <div class="champ">
            <label for="t-caisse">Caisse de prêt</label>
            <div class="saisie">
              <input id="t-caisse" class="entree" type="number" min="0" step="100" formControlName="montantCaissePret" />
              <span class="suffixe">FCFA</span>
            </div>
            <span class="aide">En plus de la part, pour prêter aux membres. 0 = pas de caisse.</span>
          </div>
        </div>

        <div class="champ">
          <span class="etiquette">Rythme des cotisations</span>
          <div class="rythme">
            <div class="choix">
              <label><input type="radio" formControlName="frequence" value="JOUR" /> Jour</label>
              <label><input type="radio" formControlName="frequence" value="SEMAINE" /> Semaine</label>
              <label><input type="radio" formControlName="frequence" value="MOIS" /> Mois</label>
            </div>
            <div class="intervalle">
              <span>tous les</span>
              <input class="entree" type="number" min="1" max="12" formControlName="intervalle" aria-label="Intervalle" />
            </div>
          </div>
        </div>

        @if (valeurs().frequence !== 'JOUR') {
          <div class="champ">
            <label for="t-jour">{{ valeurs().frequence === 'MOIS' ? 'Jour du mois' : 'Jour de la semaine' }} (facultatif)</label>
            @if (valeurs().frequence === 'MOIS') {
              <input id="t-jour" class="entree" type="number" min="1" max="31" formControlName="jourCotisation" placeholder="Ex. 5" />
            } @else {
              <select id="t-jour" class="entree" formControlName="jourCotisation">
                <option [ngValue]="null">Aucun en particulier</option>
                @for (j of joursSemaine; track j.valeur) {
                  <option [ngValue]="j.valeur">{{ j.libelle }}</option>
                }
              </select>
            }
          </div>
        }

        <div class="champ">
          <label for="t-desc">Description (facultatif)</label>
          <textarea id="t-desc" class="entree" rows="2" formControlName="description" placeholder="Les règles du groupe, le lieu de réunion…"></textarea>
        </div>

        <!-- L'aperçu : ce que le membre comprendra en un coup d'œil. -->
        <div class="apercu">
          <span class="apercu-icone"><app-icone nom="tontine" /></span>
          <div>
            <strong>{{ valeurs().nom || 'Votre tontine' }}</strong>
            <small>{{ apercuRythme() }} · {{ (valeurs().montantPart || 0) + (valeurs().montantCaissePret || 0) | fcfa }} par part</small>
          </div>
        </div>
      </form>
      <div pied>
        <button type="button" class="btn btn-secondaire" (click)="fermer.emit()">Annuler</button>
        <button type="submit" form="form-tontine" class="btn btn-primaire" [disabled]="envoi()">
          @if (envoi()) { <span class="rouage"></span> } @else { <app-icone nom="valider" /> }
          {{ tontine() ? 'Enregistrer' : 'Créer la tontine' }}
        </button>
      </div>
    </app-modale>
  `,
  styles: `
    .rythme {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
    }
    .intervalle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--texte-doux);
      font-size: 0.88rem;
    }
    .intervalle .entree {
      width: 4.5rem;
      text-align: center;
    }
    .apercu {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.95rem 1rem;
      border: 1px dashed var(--bordure-forte);
      border-radius: 14px;
      background: var(--surface-2);
    }
    .apercu-icone {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primaire-600), var(--accent-400));
      color: var(--blanc);
    }
    .apercu strong,
    .apercu small {
      display: block;
    }
    .apercu small {
      margin-top: 0.15rem;
      color: var(--texte-doux);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulaireTontine {
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly ouverte = input(false);
  readonly tontine = input<Tontine | null>(null);
  readonly fermer = output<void>();
  readonly enregistree = output<Tontine>();

  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly joursSemaine = [
    { valeur: 1, libelle: 'Lundi' },
    { valeur: 2, libelle: 'Mardi' },
    { valeur: 3, libelle: 'Mercredi' },
    { valeur: 4, libelle: 'Jeudi' },
    { valeur: 5, libelle: 'Vendredi' },
    { valeur: 6, libelle: 'Samedi' },
    { valeur: 7, libelle: 'Dimanche' },
  ];

  protected readonly formulaire = this.fb.group({
    nom: this.fb.nonNullable.control('', Validators.required),
    montantPart: this.fb.nonNullable.control(5000, [Validators.required, Validators.min(1)]),
    montantCaissePret: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    frequence: this.fb.nonNullable.control<FrequenceTontine>('SEMAINE'),
    intervalle: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    jourCotisation: this.fb.control<number | null>(null),
    description: this.fb.control<string | null>(null),
  });

  // Les valeurs du formulaire, en signal : l'aperçu se recalcule à la frappe.
  protected readonly valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.value });
  protected readonly apercuRythme = computed(() =>
    rythme(this.valeurs().frequence ?? 'SEMAINE', this.valeurs().intervalle ?? 1),
  );

  constructor() {
    // À chaque ouverture : on remplit avec la tontine à modifier, ou on vide.
    effect(() => {
      if (!this.ouverte()) {
        return;
      }
      const t = this.tontine();
      this.erreur.set(null);
      this.formulaire.reset(
        t
          ? {
              nom: t.nom,
              montantPart: t.montantPart,
              montantCaissePret: t.montantCaissePret,
              frequence: t.frequence,
              intervalle: t.intervalle,
              jourCotisation: t.jourCotisation,
              description: t.description,
            }
          : undefined,
      );
    });
  }

  protected enregistrer(): void {
    if (this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const saisie = { ...v, description: v.description?.trim() || null };
    const t = this.tontine();
    this.envoi.set(true);
    (t ? this.api.modifier(t.id, saisie) : this.api.creer(saisie))
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.succes(t ? 'Tontine mise à jour.' : `« ${res.nom} » est créée !`);
          this.enregistree.emit(res);
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }
}
