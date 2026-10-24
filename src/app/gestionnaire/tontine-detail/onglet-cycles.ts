import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { DateCourtePipe, DateHeurePipe, FcfaPipe, pourcentage } from '../../core/formatage';
import { MODES_PAIEMENT } from '../../core/libelles';
import { Cotisation, Cycle } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';
import { CiblePaiement, PaiementCotisation } from './paiement-cotisation';
import { TontineCourante } from './tontine-courante';

// L'onglet « Cycles » : chaque cycle en accordéon, avec ses cotisations à encaisser.
@Component({
  selector: 'app-onglet-cycles',
  imports: [Icone, Statut, EtatVide, PaiementCotisation, FcfaPipe, DateCourtePipe, DateHeurePipe],
  template: `
    @let tt = etat.tontine();
    <!-- La barre d'action : la prochaine étape du cycle. -->
    <div class="barre-cycle">
      <p>
        @if (etat.cycleEnCours(); as c) {
          <app-icone nom="horloge" /> Cycle {{ c.numeroCycle }} en cours, jusqu'au {{ c.dateFinPrevue | dateCourte }}.
        } @else if (etat.cycleATirer(); as c) {
          <app-icone nom="cadeau" /> Le cycle {{ c.numeroCycle }} est clôturé : place au tirage.
        } @else if (tt?.statut === 'ACTIVE') {
          <app-icone nom="info" /> Aucun cycle ouvert.
        } @else {
          <app-icone nom="info" /> La tontine doit être active pour ouvrir un cycle.
        }
      </p>
      <div class="boutons">
        @if (etat.cycleATirer()) {
          <button type="button" class="btn btn-primaire" [disabled]="occupe()" (click)="tirer.emit()"><app-icone nom="melanger" /> Tirer au sort</button>
        }
        @if (etat.cycleEnCours()) {
          <button type="button" class="btn btn-secondaire" [disabled]="occupe()" (click)="cloturerCycle.emit()"><app-icone nom="drapeau" /> Clôturer le cycle</button>
        } @else if (tt?.statut === 'ACTIVE' && !etat.cycleATirer()) {
          <button type="button" class="btn btn-primaire" [disabled]="occupe()" (click)="ouvrirCycle.emit()"><app-icone nom="plus" /> Ouvrir le cycle {{ etat.cycles().length + 1 }}</button>
        }
      </div>
    </div>

    @if (etat.cyclesTries().length === 0) {
      <div class="carte">
        <app-etat-vide icone="rafraichir" titre="Aucun cycle" texte="Chaque cycle crée les cotisations de tous les membres. À la clôture, un tirage désigne le gagnant." />
      </div>
    } @else {
      <div class="pile">
        @for (c of etat.cyclesTries(); track c.id) {
          @let ouvert = estOuvert(c);
          @let cotis = cotisationsDu(c);
          <section class="carte cycle" [class.ouvert]="ouvert" [attr.data-statut]="c.statut">
            <button type="button" class="tete" [attr.aria-expanded]="ouvert" (click)="basculer(c)">
              <span class="numero">{{ c.numeroCycle }}</span>
              <div class="infos">
                <div class="ligne">
                  <strong>Cycle {{ c.numeroCycle }}</strong>
                  <app-statut domaine="cycle" [valeur]="c.statut" />
                </div>
                <small>{{ c.dateDebut | dateCourte }} → {{ c.dateFinReelle ?? c.dateFinPrevue | dateCourte }}</small>
              </div>
              <div class="avancement">
                <div class="ligne"><span class="chiffres">{{ c.montantCollecte | fcfa }}</span><small class="chiffres">{{ pourcentage(c.montantCollecte, c.montantAttendu) }} %</small></div>
                <div class="jauge" [class.jauge-succes]="pourcentage(c.montantCollecte, c.montantAttendu) === 100">
                  <span [style.width.%]="pourcentage(c.montantCollecte, c.montantAttendu)"></span>
                </div>
              </div>
              <app-icone class="chevron" nom="chevronBas" />
            </button>

            @if (ouvert) {
              <div class="corps">
                @if (gagnantDu(c); as g) {
                  <div class="gagnant">
                    <app-icone nom="cadeau" />
                    <span><strong>{{ g.nom }}</strong> a remporté {{ g.montant | fcfa }}</span>
                    <app-statut domaine="tirage" [valeur]="g.statut" />
                  </div>
                }
                @if (cotis.length === 0) {
                  <app-etat-vide icone="portefeuille" titre="Aucune cotisation" [compact]="true" />
                } @else {
                  <div class="tableau-conteneur">
                    <table class="tableau tableau-empilable">
                      <thead>
                        <tr>
                          <th>Membre</th>
                          <th class="droite">Dû</th>
                          <th class="droite">Payé</th>
                          <th>Paiement</th>
                          <th>Statut</th>
                          <th class="droite"><span class="sr-only">Encaisser</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (x of cotis; track x.cotisation.id) {
                          <tr>
                            <td class="td-principal"><strong>{{ x.membre }}</strong></td>
                            <td data-label="Dû" class="montant">{{ x.cotisation.montantDu + x.cotisation.montantCaisseDu | fcfa }}</td>
                            <td data-label="Payé" class="montant" [class.texte-succes]="x.cotisation.statut === 'COMPLET'">
                              {{ x.cotisation.montantPaye + x.cotisation.montantCaissePaye | fcfa }}
                            </td>
                            <td data-label="Paiement" class="texte-doux">
                              @if (x.cotisation.datePaiement) {
                                {{ x.cotisation.datePaiement | dateHeure }} · {{ modes[x.cotisation.modePaiement ?? ''] ?? '' }}
                              } @else {
                                —
                              }
                            </td>
                            <td data-label="Statut"><app-statut domaine="cotisation" [valeur]="x.cotisation.statut" /></td>
                            <td class="droite">
                              @if (x.cotisation.statut !== 'COMPLET') {
                                <button type="button" class="btn btn-doux btn-petit" (click)="paiement.set({ cotisation: x.cotisation, membre: x.membre })">
                                  <app-icone nom="portefeuille" /> Encaisser
                                </button>
                              } @else {
                                <app-icone class="ok" nom="succes" />
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </section>
        }
      </div>
    }

    <app-paiement-cotisation [cible]="paiement()" (fermer)="paiement.set(null)" (fait)="paye($event)" />
  `,
  styles: `
    .barre-cycle {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem 1rem;
      margin-bottom: 1.1rem;
      padding: 0.9rem 1.1rem;
      border-radius: var(--rayon);
      background: linear-gradient(135deg, var(--primaire-50), var(--accent-100));
      border: 1px solid var(--primaire-100);
    }
    .barre-cycle p {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--texte-2);
      font-weight: 500;
    }
    .barre-cycle p app-icone {
      color: var(--primaire-600);
    }
    .boutons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .cycle {
      overflow: hidden;
    }
    .tete {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      width: 100%;
      padding: 1rem 1.2rem;
      border: none;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
    }
    .tete:hover {
      background: var(--surface-2);
    }
    .numero {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 12px;
      background: var(--surface-3);
      color: var(--texte-2);
      font-family: var(--police-titre);
      font-weight: 800;
    }
    [data-statut='EN_COURS'] .numero {
      background: linear-gradient(135deg, var(--primaire-600), var(--accent-400));
      color: var(--blanc);
    }
    .infos {
      flex: 1 1 10rem;
      min-width: 0;
    }
    .ligne {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .infos .ligne {
      justify-content: flex-start;
    }
    .infos small {
      display: block;
      margin-top: 0.15rem;
      color: var(--texte-doux);
      font-size: 0.8rem;
    }
    .avancement {
      flex: 0 1 13rem;
      min-width: 8rem;
    }
    .avancement .ligne {
      margin-bottom: 0.35rem;
      font-size: 0.86rem;
      font-weight: 600;
    }
    .avancement small {
      color: var(--texte-doux);
    }
    .chevron {
      color: var(--texte-pale);
      transition: transform 0.3s var(--courbe);
    }
    .ouvert .chevron {
      transform: rotate(180deg);
    }
    .corps {
      border-top: 1px solid var(--bordure);
      animation: apparait 0.3s var(--courbe) both;
    }
    .gagnant {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1.25rem;
      background: linear-gradient(90deg, rgba(251, 191, 36, 0.14), transparent);
      border-bottom: 1px solid var(--bordure);
      font-size: 0.9rem;
    }
    .gagnant > app-icone {
      color: #d97706;
    }
    .gagnant span {
      flex: 1;
    }
    .ok {
      color: var(--succes);
    }
    @media (max-width: 640px) {
      .avancement {
        flex-basis: 100%;
        order: 3;
      }
      .tete {
        flex-wrap: wrap;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngletCycles {
  protected readonly etat = inject(TontineCourante);
  readonly occupe = input(false);
  readonly ouvrirCycle = output<void>();
  readonly cloturerCycle = output<void>();
  readonly tirer = output<void>();

  protected readonly paiement = signal<CiblePaiement | null>(null);
  protected readonly modes: Partial<Record<string, string>> = MODES_PAIEMENT;
  protected readonly pourcentage = pourcentage;

  // Les cycles dépliés. Par défaut : le plus récent (Set ≈ HashSet).
  private readonly ouverts = signal<Set<number> | null>(null);
  private readonly ouvertsEffectifs = computed(() => this.ouverts() ?? new Set(this.etat.cyclesTries().slice(0, 1).map((c) => c.id)));

  protected estOuvert(c: Cycle): boolean {
    return this.ouvertsEffectifs().has(c.id);
  }

  protected basculer(c: Cycle): void {
    const s = new Set(this.ouvertsEffectifs());
    if (s.has(c.id)) {
      s.delete(c.id);
    } else {
      s.add(c.id);
    }
    this.ouverts.set(s);
  }

  // Les cotisations d'un cycle, avec le nom du membre, les impayées d'abord.
  protected cotisationsDu(c: Cycle): { cotisation: Cotisation; membre: string }[] {
    const ordre: Record<string, number> = { EN_RETARD: 0, PARTIEL: 1, EN_ATTENTE: 2, COMPLET: 3 };
    return this.etat
      .cotisations()
      .filter((x) => x.cycleId === c.id)
      .sort((a, b) => ordre[a.statut] - ordre[b.statut])
      .map((x) => ({ cotisation: x, membre: this.etat.nomDe(this.etat.participation(x.participationId)) }));
  }

  protected gagnantDu(c: Cycle) {
    const t = this.etat.tirages().find((x) => x.cycleId === c.id);
    return t ? { nom: this.etat.nomDe(this.etat.participation(t.participationId)), montant: t.montantGagne, statut: t.statut } : null;
  }

  protected paye(maj: Cotisation): void {
    this.paiement.set(null);
    // Mise à jour immédiate de la ligne, puis relecture complète (montants du cycle, caisse).
    this.etat.cotisations.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
    this.etat.recharger();
  }
}
