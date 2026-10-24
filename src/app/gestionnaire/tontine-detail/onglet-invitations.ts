import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TontineApi } from '../../api/tontine.api';
import { DateCourtePipe, DateHeurePipe } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { ImportMembre, Invitation } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';
import { TontineCourante } from './tontine-courante';

/**
 * L'onglet « Inviter » : les trois façons de faire entrer des membres.
 *   1. le lien de groupe, à coller dans le groupe WhatsApp ;
 *   2. l'invitation individuelle (usage unique, pour une personne précise) ;
 *   3. l'import d'un fichier CSV / Excel.
 */
@Component({
  selector: 'app-onglet-invitations',
  imports: [ReactiveFormsModule, Icone, Statut, EtatVide, DateCourtePipe, DateHeurePipe],
  template: `
    @let tt = etat.tontine();
    @if (tt && tt.statut !== 'EN_ATTENTE' && tt.statut !== 'ACTIVE') {
      <div class="alerte alerte-attention"><app-icone nom="info" /><span>Cette tontine n'accepte plus de nouveaux membres.</span></div>
    }

    <div class="grille-2">
      <!-- 1. Lien de groupe -->
      <section class="carte">
        <div class="carte-entete">
          <div>
            <h2>Lien de groupe</h2>
            <p class="sous">Un seul lien pour tout le groupe WhatsApp</p>
          </div>
          <span class="pastille whatsapp"><app-icone nom="partager" /></span>
        </div>
        <div class="carte-corps">
          @if (etat.lienGroupe(); as l) {
            <div class="lien">
              <app-icone nom="lien" />
              <code>{{ url(l) }}</code>
            </div>
            <p class="aide">Valable jusqu'au {{ l.expireAt | dateCourte }}. Chaque personne qui l'ouvre crée son compte (ou se connecte) puis rejoint la tontine.</p>
            <div class="boutons">
              <button type="button" class="btn btn-primaire" (click)="copier(url(l))"><app-icone [nom]="copie() ? 'valider' : 'copier'" /> {{ copie() ? 'Copié !' : 'Copier le lien' }}</button>
              <a class="btn btn-whatsapp" [href]="whatsapp(l)" target="_blank" rel="noopener"><app-icone nom="message" /> WhatsApp</a>
              <button type="button" class="btn btn-fantome" [disabled]="envoiLien()" (click)="genererLien()"><app-icone nom="rafraichir" /> Nouveau lien</button>
            </div>
          } @else {
            <app-etat-vide icone="lien" titre="Aucun lien actif" texte="Générez un lien et collez-le dans le groupe WhatsApp de la tontine." [compact]="true">
              <button type="button" class="btn btn-primaire" [disabled]="envoiLien()" (click)="genererLien()">
                @if (envoiLien()) { <span class="rouage"></span> } @else { <app-icone nom="lien" /> }
                Générer le lien
              </button>
            </app-etat-vide>
          }
        </div>
      </section>

      <!-- 2. Invitation individuelle -->
      <form class="carte" [formGroup]="formulaire" (ngSubmit)="inviter()">
        <div class="carte-entete">
          <div>
            <h2>Invitation personnelle</h2>
            <p class="sous">Pour une personne hors du groupe WhatsApp</p>
          </div>
          <span class="pastille"><app-icone nom="ajoutUtilisateur" /></span>
        </div>
        <div class="carte-corps">
          @if (derniere(); as d) {
            <div class="alerte alerte-succes">
              <app-icone nom="succes" />
              <span>Invitation créée pour {{ d.prenomPreRempli ?? d.telephone }}.
                <button type="button" class="lien-bouton" (click)="copier(url(d))">Copier son lien</button> ·
                <a class="lien-bouton" [href]="whatsapp(d, d.telephone)" target="_blank" rel="noopener">Lui envoyer sur WhatsApp</a>
              </span>
            </div>
          }
          <div class="champ">
            <label for="i-tel">Téléphone</label>
            <div class="saisie">
              <app-icone nom="telephone" />
              <input id="i-tel" class="entree" type="tel" formControlName="telephone" placeholder="77 123 45 67" />
            </div>
          </div>
          <div class="ligne-champs">
            <div class="champ">
              <label for="i-prenom">Prénom</label>
              <input id="i-prenom" class="entree" formControlName="prenom" />
            </div>
            <div class="champ">
              <label for="i-nom">Nom</label>
              <input id="i-nom" class="entree" formControlName="nom" />
            </div>
          </div>
          <div class="ligne-bas">
            <div class="champ parts">
              <label for="i-parts">Parts</label>
              <input id="i-parts" class="entree" type="number" min="1" formControlName="nombreParts" />
            </div>
            <button type="submit" class="btn btn-primaire" [disabled]="envoiInvitation()">
              @if (envoiInvitation()) { <span class="rouage"></span> } @else { <app-icone nom="message" /> }
              Inviter
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- 3. Import de fichier -->
    <section class="carte bloc-import">
      <div class="carte-entete">
        <div>
          <h2>Importer une liste</h2>
          <p class="sous">CSV ou Excel, une ligne par membre : nom, prénom, téléphone, email, parts</p>
        </div>
      </div>
      <div class="carte-corps">
        <!-- Le vrai <input type=file> est caché ; toute la zone est son étiquette. -->
        <label class="depot" [class.survol]="survol()" (dragover)="$event.preventDefault(); survol.set(true)" (dragleave)="survol.set(false)" (drop)="deposer($event)">
          <input type="file" accept=".csv,.xlsx,.xls" (change)="choisir($event)" />
          @if (envoiImport()) {
            <span class="rouage gros"></span>
            <strong>Import en cours…</strong>
          } @else {
            <span class="depot-icone"><app-icone nom="importer" /></span>
            <strong>Glissez votre fichier ici, ou <span class="lien-discret">parcourez</span></strong>
            <small>.csv, .xlsx — les numéros sont normalisés automatiquement</small>
          }
        </label>

        @if (dernierImport(); as im) {
          <div class="resultat-import">
            <div class="compteurs">
              <span class="ok"><strong>{{ im.nbImportes }}</strong> importé(s)</span>
              @if (im.nbErreurs) {
                <span class="ko"><strong>{{ im.nbErreurs }}</strong> erreur(s)</span>
              }
              <span class="texte-doux">sur {{ im.nbMembresTotal }} ligne(s) · {{ im.fichierNom }}</span>
            </div>
            @if (im.erreursDetail) {
              <pre class="erreurs">{{ im.erreursDetail }}</pre>
            }
          </div>
        }
      </div>
    </section>

    <!-- Historique des invitations -->
    <section class="carte">
      <div class="carte-entete">
        <div>
          <h2>Invitations envoyées</h2>
          <p class="sous">{{ invitationsTriees().length }} au total</p>
        </div>
      </div>
      @if (invitationsTriees().length === 0) {
        <app-etat-vide icone="message" titre="Aucune invitation" [compact]="true" />
      } @else {
        <div class="tableau-conteneur">
          <table class="tableau tableau-empilable">
            <thead>
              <tr>
                <th>Destinataire</th>
                <th>Type</th>
                <th>Créée</th>
                <th>Expire</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              @for (i of invitationsTriees(); track i.id) {
                <tr>
                  <td class="td-principal">
                    <strong>{{ i.type === 'GROUPE' ? 'Tout le groupe' : (i.prenomPreRempli ?? '') + ' ' + (i.nomPreRempli ?? '') }}</strong>
                    @if (i.telephone) { <small class="petit">{{ i.telephone }}</small> }
                  </td>
                  <td data-label="Type">{{ i.type === 'GROUPE' ? 'Lien de groupe' : 'Personnelle' }}</td>
                  <td data-label="Créée" class="texte-doux">{{ i.createdAt | dateHeure }}</td>
                  <td data-label="Expire" class="texte-doux">{{ i.expireAt | dateCourte }}</td>
                  <td data-label="Statut"><app-statut domaine="invitation" [valeur]="i.statut" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .grille-2 {
      margin-bottom: 1.1rem;
    }
    .pastille {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 12px;
      background: var(--primaire-50);
      color: var(--primaire-600);
    }
    .pastille.whatsapp {
      background: rgba(37, 211, 102, 0.14);
      color: #128c4a;
    }
    .lien {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.75rem 0.9rem;
      border: 1.5px dashed var(--bordure-forte);
      border-radius: 12px;
      background: var(--surface-2);
    }
    .lien app-icone {
      color: var(--primaire-600);
    }
    code {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.86rem;
      color: var(--texte-2);
    }
    .aide {
      margin: 0.7rem 0 1rem;
      color: var(--texte-doux);
      font-size: 0.84rem;
      line-height: 1.5;
    }
    .boutons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .btn-whatsapp {
      background: #25d366;
      color: #04361b;
    }
    .btn-whatsapp:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }
    .ligne-bas {
      display: flex;
      align-items: flex-end;
      gap: 0.8rem;
    }
    .ligne-bas .btn {
      flex: 1;
      margin-bottom: 1.05rem;
      height: 2.9rem;
    }
    .parts {
      width: 6rem;
    }
    .lien-bouton {
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font-weight: 700;
      text-decoration: underline;
      cursor: pointer;
    }
    .bloc-import {
      margin-bottom: 1.1rem;
    }
    .depot {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 2rem 1rem;
      border: 2px dashed var(--bordure-forte);
      border-radius: 16px;
      background: var(--surface-2);
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .depot:hover,
    .depot.survol {
      border-color: var(--primaire-600);
      background: var(--primaire-50);
    }
    .depot input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .depot small {
      color: var(--texte-doux);
      font-size: 0.8rem;
    }
    .depot-icone {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      margin-bottom: 0.3rem;
      border-radius: 50%;
      background: var(--surface);
      color: var(--primaire-600);
      box-shadow: var(--ombre-1);
    }
    .rouage.gros {
      width: 1.8rem;
      height: 1.8rem;
      color: var(--primaire-600);
    }
    .resultat-import {
      margin-top: 1rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      border: 1px solid var(--bordure);
    }
    .compteurs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 1rem;
      font-size: 0.88rem;
    }
    .ok {
      color: var(--succes-texte);
    }
    .ko {
      color: var(--erreur-texte);
    }
    .erreurs {
      max-height: 10rem;
      overflow: auto;
      margin: 0.7rem 0 0;
      padding: 0.7rem;
      border-radius: 8px;
      background: var(--erreur-fond);
      color: var(--erreur-texte);
      font-size: 0.8rem;
      white-space: pre-wrap;
    }
    .petit {
      display: block;
      color: var(--texte-doux);
      font-size: 0.8rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngletInvitations {
  protected readonly etat = inject(TontineCourante);
  private readonly api = inject(TontineApi);
  private readonly toasts = inject(ToastService);

  protected readonly envoiLien = signal(false);
  protected readonly envoiInvitation = signal(false);
  protected readonly envoiImport = signal(false);
  protected readonly copie = signal(false);
  protected readonly survol = signal(false);
  protected readonly derniere = signal<Invitation | null>(null);
  protected readonly dernierImport = signal<ImportMembre | null>(null);

  protected readonly invitationsTriees = computed(() =>
    [...this.etat.invitations()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    telephone: ['', Validators.required],
    prenom: [''],
    nom: [''],
    nombreParts: [1, [Validators.required, Validators.min(1)]],
  });

  // L'adresse publique de la page d'invitation (côté front : /rejoindre/{token}).
  protected url(i: Invitation): string {
    return `${location.origin}/rejoindre/${i.token}`;
  }

  // Un lien wa.me ouvre WhatsApp avec le message déjà écrit (et le destinataire, si on le connaît).
  protected whatsapp(i: Invitation, telephone?: string | null): string {
    const texte = `Rejoins la tontine « ${this.etat.tontine()?.nom} » sur SamaNatteu : ${this.url(i)}`;
    const numero = telephone ? telephone.replace(/\D/g, '') : '';
    return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
  }

  protected copier(texte: string): void {
    // navigator.clipboard : le presse-papiers du système (demande une page sécurisée : https ou localhost).
    navigator.clipboard?.writeText(texte).then(
      () => {
        this.copie.set(true);
        this.toasts.succes('Lien copié dans le presse-papiers.');
        setTimeout(() => this.copie.set(false), 2000);
      },
      () => this.toasts.erreur('Copie impossible : sélectionnez le lien à la main.'),
    );
  }

  protected genererLien(): void {
    const tt = this.etat.tontine();
    if (!tt) {
      return;
    }
    this.envoiLien.set(true);
    this.api
      .genererLienGroupe(tt.id)
      .pipe(finalize(() => this.envoiLien.set(false)))
      .subscribe({
        next: (i) => {
          // L'ancien lien de groupe est annulé côté serveur : on le marque ici aussi.
          this.etat.invitations.update((l) => [
            i,
            ...l.map((x) => (x.type === 'GROUPE' && x.statut === 'EN_ATTENTE' ? { ...x, statut: 'ANNULEE' as const } : x)),
          ]);
          this.toasts.succes('Nouveau lien de groupe prêt à partager.');
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
      });
  }

  protected inviter(): void {
    const tt = this.etat.tontine();
    if (!tt || this.formulaire.invalid || this.envoiInvitation()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    this.envoiInvitation.set(true);
    this.api
      .inviter(tt.id, { telephone: v.telephone, prenom: v.prenom.trim() || null, nom: v.nom.trim() || null, nombreParts: v.nombreParts })
      .pipe(finalize(() => this.envoiInvitation.set(false)))
      .subscribe({
        next: (i) => {
          this.etat.invitations.update((l) => [i, ...l]);
          this.derniere.set(i);
          this.formulaire.reset({ telephone: '', prenom: '', nom: '', nombreParts: 1 });
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
      });
  }

  protected choisir(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    if (fichier) {
      this.importer(fichier);
    }
    champ.value = ''; // pour pouvoir réimporter le même fichier
  }

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    const fichier = evenement.dataTransfer?.files?.[0];
    if (fichier) {
      this.importer(fichier);
    }
  }

  private importer(fichier: File): void {
    const tt = this.etat.tontine();
    if (!tt) {
      return;
    }
    this.envoiImport.set(true);
    this.api
      .importer(tt.id, fichier)
      .pipe(finalize(() => this.envoiImport.set(false)))
      .subscribe({
        next: (im) => {
          this.dernierImport.set(im);
          this.toasts.succes(`${im.nbImportes} membre(s) importé(s).`);
          this.etat.recharger();
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e, "L'import a échoué.")),
      });
  }
}
