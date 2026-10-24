import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Icone } from './icone';

/**
 * Une fenêtre modale, bâtie sur la balise native <dialog> du navigateur :
 * elle gère déjà le focus, la touche Échap et le fond assombri.
 *
 *   <app-modale [ouverte]="formulaireOuvert()" titre="Nouvelle tontine" (fermer)="…">
 *     … contenu …
 *     <div pied> … boutons … </div>
 *   </app-modale>
 *
 * output() = un ÉVÉNEMENT émis vers le parent (≈ un listener Java qu'on appelle).
 */
@Component({
  selector: 'app-modale',
  imports: [Icone],
  template: `
    <dialog
      #dialogue
      [class.large]="large()"
      (cancel)="$event.preventDefault(); fermer.emit()"
      (click)="clicFond($event)"
      [attr.aria-labelledby]="'titre-modale'"
    >
      <div class="boite">
        <header>
          <div>
            <h2 id="titre-modale">{{ titre() }}</h2>
            @if (sousTitre()) {
              <p>{{ sousTitre() }}</p>
            }
          </div>
          <button type="button" class="btn btn-fantome btn-icone btn-petit" aria-label="Fermer" (click)="fermer.emit()">
            <app-icone nom="fermer" />
          </button>
        </header>
        <div class="corps">
          <ng-content />
        </div>
        <ng-content select="[pied]" />
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(34rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      padding: 0;
      border: 1px solid var(--bordure);
      border-radius: 20px;
      background: var(--surface);
      color: var(--texte);
      box-shadow: var(--ombre);
      overflow: auto;
    }
    dialog.large {
      width: min(46rem, calc(100vw - 2rem));
    }
    dialog[open] {
      animation: entre 0.35s var(--courbe);
    }
    dialog::backdrop {
      background: rgba(7, 13, 28, 0.55);
      backdrop-filter: blur(4px);
      animation: fondu 0.3s ease;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.3rem 1.4rem 1rem;
      background: var(--surface);
    }
    h2 {
      font-size: 1.2rem;
      font-weight: 800;
    }
    header p {
      margin: 0.3rem 0 0;
      color: var(--texte-doux);
      font-size: 0.88rem;
    }
    .corps {
      padding: 0.25rem 1.4rem 1.2rem;
    }
    /* Le pied (boutons) : collé en bas, sur toute la largeur. */
    :host ::ng-deep [pied] {
      position: sticky;
      bottom: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.6rem;
      padding: 1rem 1.4rem;
      border-top: 1px solid var(--bordure);
      background: var(--surface-2);
    }
    @media (max-width: 560px) {
      /* Sur téléphone : la modale devient une feuille qui monte du bas. */
      dialog,
      dialog.large {
        width: 100vw;
        max-width: 100vw;
        margin: auto 0 0;
        border-radius: 22px 22px 0 0;
        max-height: 92dvh;
      }
      dialog[open] {
        animation: feuille 0.4s var(--courbe);
      }
      :host ::ng-deep [pied] > .btn {
        flex: 1;
      }
    }
    @keyframes entre {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.97);
      }
    }
    @keyframes feuille {
      from {
        transform: translateY(100%);
      }
    }
    @keyframes fondu {
      from {
        opacity: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modale {
  readonly ouverte = input(false);
  readonly titre = input.required<string>();
  readonly sousTitre = input<string>('');
  readonly large = input(false);
  readonly fermer = output<void>();

  // viewChild = la référence vers un élément du template (#dialogue),
  // ≈ un champ injecté qui pointe sur le composant graphique.
  private readonly dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');

  constructor() {
    // effect = « relance ce code dès qu'un signal lu dedans change ».
    // Ici : ouverte() passe à true → showModal(), à false → close().
    effect(() => {
      const d = this.dialogue().nativeElement;
      if (this.ouverte() && !d.open) {
        // showModal n'existe pas dans jsdom (les tests) : on le vérifie.
        if (typeof d.showModal === 'function') {
          d.showModal();
        } else {
          d.setAttribute('open', '');
        }
      } else if (!this.ouverte() && d.open) {
        if (typeof d.close === 'function') {
          d.close();
        } else {
          d.removeAttribute('open');
        }
      }
    });
  }

  // Un clic sur le fond assombri (hors de la boîte) ferme la modale.
  protected clicFond(evenement: MouseEvent): void {
    if (evenement.target === this.dialogue().nativeElement) {
      this.fermer.emit();
    }
  }
}
