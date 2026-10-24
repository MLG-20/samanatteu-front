import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, initiales, teinteAvatar } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Participation } from '../../core/modeles';
import { ConfirmationService } from '../../ui/confirmation';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';
import { TontineCourante } from './tontine-courante';

// L'onglet « Membres » : qui participe, avec combien de parts, a-t-il déjà gagné.
@Component({
  selector: 'app-onglet-membres',
  imports: [FormsModule, Icone, Statut, EtatVide, DateCourtePipe],
  template: `
    <section class="carte">
      <div class="carte-entete">
        <div>
          <h2>{{ etat.membresActifs().length }} membres · {{ etat.totalParts() }} parts</h2>
          <p class="sous">Ordre d'inscription, parts et gains de chacun</p>
        </div>
        <div class="outils">
          <div class="recherche saisie">
            <app-icone nom="recherche" />
            <input class="entree" type="search" placeholder="Rechercher…" aria-label="Rechercher un membre" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" />
          </div>
          <button type="button" class="btn btn-primaire btn-petit" (click)="inviter.emit()"><app-icone nom="ajoutUtilisateur" /> Ajouter</button>
        </div>
      </div>

      @if (lignes().length === 0) {
        <app-etat-vide icone="utilisateurs" [titre]="etat.participations().length ? 'Aucun résultat' : 'Aucun membre pour le moment'" texte="Partagez le lien de groupe sur WhatsApp, ou importez votre liste depuis un fichier Excel.">
          <button type="button" class="btn btn-primaire" (click)="inviter.emit()"><app-icone nom="lien" /> Inviter des membres</button>
        </app-etat-vide>
      } @else {
        <div class="tableau-conteneur">
          <table class="tableau tableau-empilable">
            <thead>
              <tr>
                <th>#</th>
                <th>Membre</th>
                <th>Parts</th>
                <th>Gains</th>
                <th>Adhésion</th>
                <th>Statut</th>
                <th class="droite"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.p.id) {
                <tr>
                  <td data-label="Ordre" class="texte-doux chiffres">{{ l.p.ordreInscription }}</td>
                  <td class="td-principal">
                    <div class="personne">
                      <span class="avatar" [attr.data-teinte]="teinte(l.p.membreId)">{{ l.initiales }}</span>
                      <div>
                        <strong>{{ l.nom }}</strong>
                        <small>{{ l.tel }}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Parts">
                    @if (etat.tontine()?.statut === 'EN_ATTENTE' && l.p.statut === 'ACTIF') {
                      <!-- Un « stepper » − / + : les parts ne se changent qu'avant l'activation. -->
                      <div class="stepper">
                        <button type="button" aria-label="Une part de moins" [disabled]="l.p.nombreParts <= 1 || occupe() === l.p.id" (click)="changerParts(l.p, -1)">−</button>
                        <span class="chiffres">{{ l.p.nombreParts }}</span>
                        <button type="button" aria-label="Une part de plus" [disabled]="occupe() === l.p.id" (click)="changerParts(l.p, 1)">+</button>
                      </div>
                    } @else {
                      <strong class="chiffres">{{ l.p.nombreParts }}</strong>
                    }
                  </td>
                  <td data-label="Gains">
                    @if (l.gains > 0) {
                      <span class="gagne"><app-icone nom="cadeau" /> {{ l.gains }}</span>
                    } @else {
                      <span class="texte-doux">—</span>
                    }
                  </td>
                  <td data-label="Adhésion" class="texte-doux">{{ l.p.dateAdhesion | dateCourte }}</td>
                  <td data-label="Statut"><app-statut domaine="participation" [valeur]="l.p.statut" /></td>
                  <td class="droite">
                    @if (etat.tontine()?.statut === 'EN_ATTENTE') {
                      <button type="button" class="btn btn-fantome btn-icone btn-petit retirer" aria-label="Retirer" (click)="retirer(l.p, l.nom)"><app-icone nom="poubelle" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .outils {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem;
    }
    .recherche .entree {
      height: 2.2rem;
      width: 12rem;
      font-size: 0.9rem;
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--bordure);
      border-radius: 10px;
      overflow: hidden;
    }
    .stepper button {
      width: 1.9rem;
      height: 1.9rem;
      border: none;
      background: var(--surface-2);
      color: var(--texte-2);
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }
    .stepper button:hover:not(:disabled) {
      background: var(--primaire-50);
      color: var(--primaire-600);
    }
    .stepper button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .stepper span {
      min-width: 2rem;
      text-align: center;
      font-weight: 700;
    }
    .gagne {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #92400e;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .gagne app-icone {
      width: 0.9rem;
      height: 0.9rem;
    }
    .retirer:hover {
      background: var(--erreur-fond);
      color: var(--erreur);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngletMembres {
  protected readonly etat = inject(TontineCourante);
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);

  readonly inviter = output<void>();
  protected readonly recherche = signal('');
  protected readonly occupe = signal<number | null>(null);
  protected readonly teinte = teinteAvatar;

  // Une ligne prête à afficher par participation (nom, gains…), triée par ordre d'inscription.
  protected readonly lignes = computed(() => {
    const t = this.recherche().trim().toLowerCase();
    const gains = this.etat.tirages();
    return [...this.etat.participations()]
      .sort((a, b) => (a.ordreInscription ?? 0) - (b.ordreInscription ?? 0))
      .map((p) => ({
        p,
        nom: this.etat.nomDe(p),
        tel: p.membreTelephone,
        initiales: initiales(p.membrePrenom, p.membreNom),
        gains: gains.filter((g) => g.participationId === p.id).length,
      }))
      .filter((l) => !t || `${l.nom} ${l.tel ?? ''}`.toLowerCase().includes(t));
  });

  protected changerParts(p: Participation, delta: number): void {
    this.occupe.set(p.id);
    this.api.modifierParts(p.id, p.nombreParts + delta).subscribe({
      next: (maj) => {
        this.etat.participations.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.occupe.set(null);
      },
      error: (e: unknown) => {
        this.occupe.set(null);
        this.toasts.erreur(messageErreur(e));
      },
    });
  }

  protected async retirer(p: Participation, nom: string): Promise<void> {
    const oui = await this.confirmation.demander({
      titre: 'Retirer ce membre ?',
      message: `${nom} ne fera plus partie de la tontine. Il pourra être réinvité.`,
      bouton: 'Retirer',
      danger: true,
    });
    if (!oui) {
      return;
    }
    this.api.retirer(p.id).subscribe({
      next: () => {
        this.etat.participations.update((l) => l.filter((x) => x.id !== p.id));
        this.toasts.succes(`${nom} a été retiré(e).`);
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
    });
  }
}
