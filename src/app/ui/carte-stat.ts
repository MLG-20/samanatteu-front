import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icone, NomIcone } from './icone';

// Une tuile de chiffre clé (KPI) : icône, libellé, grande valeur, ligne d'aide.
// <app-carte-stat icone="tontine" libelle="Tontines actives" [valeur]="'12'" />
@Component({
  selector: 'app-carte-stat',
  imports: [Icone],
  template: `
    <div class="tuile" [attr.data-ton]="ton()">
      <div class="haut">
        <span class="pastille"><app-icone [nom]="icone()" /></span>
        <span class="libelle">{{ libelle() }}</span>
      </div>
      @if (chargement()) {
        <span class="squelette" style="height: 2rem; width: 60%; margin-top: 0.9rem"></span>
        <span class="squelette" style="height: 0.8rem; width: 40%; margin-top: 0.6rem"></span>
      } @else {
        <strong class="valeur chiffres">{{ valeur() }}</strong>
        @if (aide()) {
          <span class="aide">{{ aide() }}</span>
        }
        <ng-content />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .tuile {
      position: relative;
      height: 100%;
      padding: 1.15rem 1.2rem 1.2rem;
      border-radius: var(--rayon);
      background: var(--surface);
      border: 1px solid var(--bordure);
      box-shadow: var(--ombre-1);
      overflow: hidden;
      animation: apparait 0.5s var(--courbe) both;
      transition: transform 0.25s var(--courbe), box-shadow 0.25s;
    }
    .tuile:hover {
      transform: translateY(-2px);
      box-shadow: var(--ombre-2);
    }
    /* Halo de couleur discret dans le coin. */
    .tuile::after {
      content: '';
      position: absolute;
      top: -3rem;
      right: -3rem;
      width: 8rem;
      height: 8rem;
      border-radius: 50%;
      background: var(--halo, var(--primaire-600));
      opacity: 0.07;
      pointer-events: none;
    }
    .haut {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .pastille {
      display: grid;
      place-items: center;
      width: 2.3rem;
      height: 2.3rem;
      border-radius: 11px;
      background: var(--fond-pastille, var(--primaire-50));
      color: var(--couleur, var(--primaire-600));
    }
    .libelle {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--texte-doux);
    }
    .valeur {
      display: block;
      margin-top: 0.85rem;
      font-family: var(--police-titre);
      font-size: clamp(1.4rem, 1vw + 1.1rem, 1.75rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .aide {
      display: block;
      margin-top: 0.3rem;
      font-size: 0.82rem;
      color: var(--texte-doux);
    }
    [data-ton='succes'] {
      --couleur: var(--succes);
      --fond-pastille: var(--succes-fond);
      --halo: var(--succes);
    }
    [data-ton='attention'] {
      --couleur: var(--attention);
      --fond-pastille: var(--attention-fond);
      --halo: var(--attention);
    }
    [data-ton='danger'] {
      --couleur: var(--erreur);
      --fond-pastille: var(--erreur-fond);
      --halo: var(--erreur);
    }
    [data-ton='info'] {
      --couleur: var(--info);
      --fond-pastille: var(--info-fond);
      --halo: var(--info);
    }
    [data-ton='accent'] {
      --couleur: var(--accent-600);
      --fond-pastille: var(--accent-100);
      --halo: var(--accent-600);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarteStat {
  readonly icone = input.required<NomIcone>();
  readonly libelle = input.required<string>();
  readonly valeur = input<string | number>('');
  readonly aide = input<string>('');
  readonly ton = input<'primaire' | 'succes' | 'attention' | 'danger' | 'info' | 'accent'>('primaire');
  readonly chargement = input(false);
}
