import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icone, NomIcone } from './icone';

// Ce qu'on affiche quand une liste est vide : une icône, une phrase, et
// (via <ng-content>) un bouton d'action éventuel.
// <ng-content> ≈ un « trou » que le parent remplit avec ce qu'il met entre les balises.
@Component({
  selector: 'app-etat-vide',
  imports: [Icone],
  template: `
    <div class="vide" [class.compact]="compact()">
      <span class="cercle"><app-icone [nom]="icone()" /></span>
      <h3>{{ titre() }}</h3>
      @if (texte()) {
        <p>{{ texte() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2.75rem 1.5rem;
      animation: apparait 0.5s var(--courbe) both;
    }
    .vide.compact {
      padding: 1.75rem 1rem;
    }
    .cercle {
      display: grid;
      place-items: center;
      width: 3.6rem;
      height: 3.6rem;
      margin-bottom: 1rem;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, var(--primaire-100), var(--primaire-50));
      color: var(--primaire-600);
      box-shadow: 0 0 0 8px color-mix(in srgb, var(--primaire-50) 60%, transparent);
    }
    .cercle app-icone {
      width: 1.5rem;
      height: 1.5rem;
    }
    h3 {
      font-size: 1.02rem;
      font-weight: 700;
    }
    p {
      max-width: 26rem;
      margin: 0.4rem 0 1.1rem;
      color: var(--texte-doux);
      font-size: 0.9rem;
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtatVide {
  readonly icone = input<NomIcone>('info');
  readonly titre = input.required<string>();
  readonly texte = input<string>('');
  readonly compact = input(false);
}
