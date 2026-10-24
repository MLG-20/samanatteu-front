import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, FcfaPipe, fcfa, pourcentage } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Pret } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';
import { CibleRemboursement, RemboursementPret } from '../remboursement-pret';
import { TontineCourante } from './tontine-courante';

// L'onglet « Prêts » : la caisse de la tontine, les prêts accordés et leur remboursement.
@Component({
  selector: 'app-onglet-prets',
  imports: [ReactiveFormsModule, Icone, Statut, EtatVide, Modale, RemboursementPret, FcfaPipe, DateCourtePipe],
  template: `
    @let tt = etat.tontine();
    <div class="caisse">
      <div class="caisse-texte">
        <span class="caisse-icone"><app-icone nom="coffre" /></span>
        <div>
          <small>Disponible dans la caisse</small>
          <strong class="chiffres">{{ tt?.soldeCaissePret | fcfa }}</strong>
        </div>
      </div>
      <button type="button" class="btn btn-primaire" [disabled]="!tt?.soldeCaissePret || etat.membresActifs().length === 0" (click)="ouvrirAccord()">
        <app-icone nom="plus" /> Accorder un prêt
      </button>
    </div>

    @if (lignes().length === 0) {
      <div class="carte">
        <app-etat-vide icone="pret" titre="Aucun prêt" [texte]="tt?.montantCaissePret ? 'La caisse se remplit à chaque cotisation. Elle permet de prêter aux membres, avec ou sans intérêt.' : 'Cette tontine n’a pas de caisse de prêt (montant de caisse à 0).'" />
      </div>
    } @else {
      <div class="grille-cartes">
        @for (l of lignes(); track l.pret.id) {
          <article class="carte pret">
            <div class="haut">
              <div>
                <strong>{{ l.membre }}</strong>
                <small>Accordé le {{ l.pret.dateAccord | dateCourte }}</small>
              </div>
              <app-statut domaine="pret" [valeur]="l.pret.statut" />
            </div>
            <div class="montant chiffres">{{ l.total | fcfa }}</div>
            <small class="detail">{{ l.pret.montant | fcfa }} + {{ l.interet | fcfa }} d'intérêt · {{ l.pret.nbEcheances }} échéance(s)</small>
            <div class="jauge jauge-succes"><span [style.width.%]="l.part"></span></div>
            <div class="ligne">
              <span>{{ l.payees }} / {{ l.pret.nbEcheances }} échéances payées</span>
              <span class="chiffres">Reste {{ l.reste | fcfa }}</span>
            </div>
            @if (l.prochaine) {
              <p class="prochaine" [class.retard]="l.prochaine.statut === 'EN_RETARD'">
                <app-icone [nom]="l.prochaine.statut === 'EN_RETARD' ? 'alerte' : 'calendrier'" />
                Prochaine : {{ l.prochaine.montantDu - l.prochaine.montantPaye | fcfa }} le {{ l.prochaine.dateEcheance | dateCourte }}
              </p>
            }
            @if (l.pret.statut !== 'REMBOURSE') {
              <button type="button" class="btn btn-doux btn-bloc" (click)="remboursement.set({ pretId: l.pret.id, membre: l.membre, reste: l.reste, prochaine: l.prochaine ? l.prochaine.montantDu - l.prochaine.montantPaye : null })">
                <app-icone nom="portefeuille" /> Enregistrer un remboursement
              </button>
            }
          </article>
        }
      </div>
    }

    <!-- Accorder un prêt -->
    <app-modale [ouverte]="accordOuvert()" titre="Accorder un prêt" [sousTitre]="'Caisse disponible : ' + fcfa(tt?.soldeCaissePret)" (fermer)="accordOuvert.set(false)">
      <form id="form-pret" [formGroup]="formulaire" (ngSubmit)="accorder()">
        @if (erreur()) {
          <div class="alerte alerte-erreur" role="alert"><app-icone nom="erreur" /><span>{{ erreur() }}</span></div>
        }
        <div class="champ">
          <label for="pr-membre">Membre</label>
          <select id="pr-membre" class="entree" formControlName="membreId">
            <option [ngValue]="null" disabled>Choisir un membre…</option>
            @for (p of etat.membresActifs(); track p.id) {
              <option [ngValue]="p.membreId">{{ etat.nomDe(p) }}</option>
            }
          </select>
        </div>
        <div class="ligne-champs">
          <div class="champ">
            <label for="pr-montant">Montant prêté</label>
            <div class="saisie">
              <input id="pr-montant" class="entree" type="number" min="1" formControlName="montant" />
              <span class="suffixe">FCFA</span>
            </div>
          </div>
          <div class="champ">
            <label for="pr-ech">Nombre d'échéances</label>
            <input id="pr-ech" class="entree" type="number" min="1" max="36" formControlName="nbEcheances" />
          </div>
        </div>
        <div class="champ">
          <label for="pr-date">Premier remboursement le</label>
          <input id="pr-date" class="entree" type="date" formControlName="dateDebutRemboursement" />
        </div>
        <div class="champ">
          <span class="etiquette">Intérêt</span>
          <div class="choix">
            <label><input type="radio" formControlName="typeInteret" value="AUCUN" /> Sans intérêt</label>
            <label><input type="radio" formControlName="typeInteret" value="TAUX" /> En %</label>
            <label><input type="radio" formControlName="typeInteret" value="MONTANT" /> En FCFA</label>
          </div>
        </div>
        @if (valeurs().typeInteret !== 'AUCUN') {
          <div class="champ">
            <label for="pr-interet">{{ valeurs().typeInteret === 'TAUX' ? 'Taux' : 'Montant de l’intérêt' }}</label>
            <div class="saisie">
              <input id="pr-interet" class="entree" type="number" min="0" formControlName="interet" />
              <span class="suffixe">{{ valeurs().typeInteret === 'TAUX' ? '%' : 'FCFA' }}</span>
            </div>
          </div>
        }
        <div class="recap">
          <div><span>À rembourser</span><strong class="chiffres">{{ fcfa(simulation().total) }}</strong></div>
          <div><span>Par échéance</span><strong class="chiffres">≈ {{ fcfa(simulation().parEcheance) }}</strong></div>
        </div>
      </form>
      <div pied>
        <button type="button" class="btn btn-secondaire" (click)="accordOuvert.set(false)">Annuler</button>
        <button type="submit" form="form-pret" class="btn btn-primaire" [disabled]="envoi()">
          @if (envoi()) { <span class="rouage"></span> } @else { <app-icone nom="valider" /> }
          Accorder
        </button>
      </div>
    </app-modale>

    <app-remboursement-pret [cible]="remboursement()" (fermer)="remboursement.set(null)" (fait)="rembourse()" />
  `,
  styles: `
    .caisse {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.1rem;
      padding: 1.1rem 1.25rem;
      border-radius: var(--rayon);
      background: linear-gradient(135deg, var(--primaire-950), var(--primaire-700) 60%, var(--accent-600));
      color: var(--blanc);
      box-shadow: 0 18px 40px -22px rgba(30, 58, 138, 0.8);
    }
    .caisse-texte {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }
    .caisse-icone {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.14);
      color: var(--accent-400);
    }
    .caisse small {
      display: block;
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.82rem;
    }
    .caisse strong {
      font-family: var(--police-titre);
      font-size: 1.6rem;
      font-weight: 800;
    }
    .pret {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 1.2rem;
    }
    .haut {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .haut small,
    .detail {
      display: block;
      color: var(--texte-doux);
      font-size: 0.8rem;
    }
    .montant {
      margin-top: 0.6rem;
      font-family: var(--police-titre);
      font-size: 1.45rem;
      font-weight: 800;
    }
    .pret .jauge {
      margin: 0.6rem 0 0.2rem;
    }
    .ligne {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      color: var(--texte-doux);
      font-size: 0.8rem;
    }
    .prochaine {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0.4rem 0 0.6rem;
      padding: 0.5rem 0.65rem;
      border-radius: 10px;
      background: var(--surface-2);
      font-size: 0.84rem;
      color: var(--texte-2);
    }
    .prochaine.retard {
      background: var(--erreur-fond);
      color: var(--erreur-texte);
    }
    .prochaine app-icone {
      width: 1rem;
      height: 1rem;
    }
    .recap {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primaire-50), var(--accent-100));
    }
    .recap span {
      display: block;
      font-size: 0.8rem;
      color: var(--texte-doux);
    }
    .recap strong {
      font-family: var(--police-titre);
      font-size: 1.15rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngletPrets {
  protected readonly etat = inject(TontineCourante);
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly fcfa = fcfa;
  protected readonly accordOuvert = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly remboursement = signal<CibleRemboursement | null>(null);

  // Un prêt prêt à afficher : avec son échéancier résumé.
  protected readonly lignes = computed(() =>
    [...this.etat.prets()]
      .sort((a, b) => Number(a.statut === 'REMBOURSE') - Number(b.statut === 'REMBOURSE') || b.createdAt.localeCompare(a.createdAt))
      .map((pret) => {
        const ech = this.etat
          .echeances()
          .filter((e) => e.pretId === pret.id)
          .sort((a, b) => a.numeroEcheance - b.numeroEcheance);
        const total = ech.reduce((s, e) => s + e.montantDu, 0) || pret.montant + (pret.montantInteret ?? 0);
        const paye = ech.reduce((s, e) => s + e.montantPaye, 0);
        return {
          pret,
          membre: this.nomMembre(pret),
          total,
          interet: total - pret.montant,
          reste: Math.max(0, total - paye),
          part: pourcentage(paye, total),
          payees: ech.filter((e) => e.statut === 'PAYE').length,
          prochaine: ech.find((e) => e.statut !== 'PAYE') ?? null,
        };
      }),
  );

  protected readonly formulaire = this.fb.group({
    membreId: this.fb.control<number | null>(null, Validators.required),
    montant: this.fb.nonNullable.control(10000, [Validators.required, Validators.min(1)]),
    nbEcheances: this.fb.nonNullable.control(3, [Validators.required, Validators.min(1)]),
    dateDebutRemboursement: this.fb.nonNullable.control(this.dansUnMois(), Validators.required),
    typeInteret: this.fb.nonNullable.control<'AUCUN' | 'TAUX' | 'MONTANT'>('AUCUN'),
    interet: this.fb.nonNullable.control(0, Validators.min(0)),
  });
  protected readonly valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.getRawValue() });

  // Simulation affichée sous le formulaire (le backend fait le vrai calcul).
  protected readonly simulation = computed(() => {
    const v = this.valeurs();
    const montant = Number(v.montant) || 0;
    const interet = v.typeInteret === 'TAUX' ? (montant * (Number(v.interet) || 0)) / 100 : v.typeInteret === 'MONTANT' ? Number(v.interet) || 0 : 0;
    const total = montant + interet;
    return { total, parEcheance: Math.ceil(total / Math.max(1, Number(v.nbEcheances) || 1)) };
  });

  protected ouvrirAccord(): void {
    this.formulaire.reset({ membreId: null, montant: 10000, nbEcheances: 3, dateDebutRemboursement: this.dansUnMois(), typeInteret: 'AUCUN', interet: 0 });
    this.erreur.set(null);
    this.accordOuvert.set(true);
  }

  protected accorder(): void {
    const tt = this.etat.tontine();
    if (!tt || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    if (v.montant > tt.soldeCaissePret) {
      this.erreur.set(`La caisse ne contient que ${fcfa(tt.soldeCaissePret)}.`);
      return;
    }
    this.envoi.set(true);
    this.api
      .accorderPret(tt.id, {
        membreId: v.membreId!,
        montant: v.montant,
        nbEcheances: v.nbEcheances,
        dateDebutRemboursement: v.dateDebutRemboursement,
        // Une seule forme d'intérêt (règle du backend) : l'autre reste null.
        tauxInteret: v.typeInteret === 'TAUX' ? v.interet : null,
        montantInteret: v.typeInteret === 'MONTANT' ? v.interet : null,
      })
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => {
          this.toasts.succes('Prêt accordé. L’échéancier est créé.');
          this.accordOuvert.set(false);
          this.etat.recharger();
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected rembourse(): void {
    this.remboursement.set(null);
    this.etat.recharger();
  }

  private nomMembre(p: Pret): string {
    return this.etat.nomDe(this.etat.participationDuMembre(p.membreId));
  }

  // La date du jour + 1 mois, au format AAAA-MM-JJ attendu par <input type="date">.
  private dansUnMois(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }
}
