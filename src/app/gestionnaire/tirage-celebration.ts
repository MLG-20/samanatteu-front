import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FcfaPipe } from '../core/formatage';
import { Icone } from '../ui/icone';
import { Modale } from '../ui/modale';

export interface ResultatTirage {
  gagnant: string;
  telephone: string | null;
  tontine: string;
  cycle: number;
  montant: number;
}

// Le moment fort d'une tontine : l'annonce du gagnant, avec des confettis.
// Les confettis sont 24 petits <i> animés en CSS (aucune bibliothèque).
@Component({
  selector: 'app-tirage-celebration',
  imports: [Modale, Icone, FcfaPipe],
  template: `
    @let r = resultat();
    <app-modale [ouverte]="!!r" titre="Résultat du tirage" (fermer)="fermer.emit()">
      @if (r) {
        <div class="scene">
          <div class="confettis" aria-hidden="true">
            @for (i of morceaux; track i) {
              <i [style.--i]="i"></i>
            }
          </div>
          <span class="trophee"><app-icone nom="cadeau" /></span>
          <p class="sur">{{ r.tontine }} · cycle {{ r.cycle }}</p>
          <h3>{{ r.gagnant }}</h3>
          @if (r.telephone) {
            <p class="tel">{{ r.telephone }}</p>
          }
          <div class="montant chiffres">{{ r.montant | fcfa }}</div>
          <p class="aide">Le gagnant a été prévenu par SMS. Le versement est à faire depuis « Gains à verser ».</p>
        </div>
      }
      <div pied>
        <button type="button" class="btn btn-primaire" (click)="fermer.emit()">Parfait</button>
      </div>
    </app-modale>
  `,
  styles: `
    .scene {
      position: relative;
      overflow: hidden;
      padding: 1.5rem 0.5rem 0.5rem;
      text-align: center;
    }
    .trophee {
      display: inline-grid;
      place-items: center;
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 50%;
      background: linear-gradient(135deg, #fde68a, #f59e0b);
      color: #78350f;
      box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.15), 0 18px 40px -12px rgba(245, 158, 11, 0.8);
      animation: rebond 0.9s var(--courbe) both;
    }
    .trophee app-icone {
      width: 2.1rem;
      height: 2.1rem;
    }
    .sur {
      margin: 1.2rem 0 0.2rem;
      color: var(--texte-doux);
      font-size: 0.85rem;
      font-weight: 600;
    }
    h3 {
      font-size: 1.6rem;
      font-weight: 800;
      animation: apparait 0.6s 0.3s var(--courbe) both;
    }
    .tel {
      margin: 0.2rem 0 0;
      color: var(--texte-doux);
    }
    .montant {
      display: inline-block;
      margin: 1rem 0 0.8rem;
      padding: 0.5rem 1.1rem;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.18), rgba(245, 158, 11, 0.1));
      color: #b45309;
      font-family: var(--police-titre);
      font-size: 1.5rem;
      font-weight: 800;
      animation: apparait 0.6s 0.45s var(--courbe) both;
    }
    .aide {
      max-width: 22rem;
      margin: 0 auto;
      color: var(--texte-doux);
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .confettis i {
      position: absolute;
      top: -10px;
      left: calc(var(--i) * 4.2%);
      width: 8px;
      height: 14px;
      border-radius: 2px;
      background: hsl(calc(var(--i) * 47), 85%, 60%);
      opacity: 0;
      animation: tombe 2.6s calc(var(--i) * 60ms) ease-in forwards;
    }
    @keyframes tombe {
      0% {
        opacity: 1;
        transform: translateY(0) rotate(0);
      }
      100% {
        opacity: 0;
        transform: translateY(22rem) rotate(calc(var(--i) * 70deg));
      }
    }
    @keyframes rebond {
      0% {
        transform: scale(0.3);
        opacity: 0;
      }
      60% {
        transform: scale(1.12);
        opacity: 1;
      }
      100% {
        transform: scale(1);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TirageCelebration {
  readonly resultat = input<ResultatTirage | null>(null);
  readonly fermer = output<void>();
  protected readonly morceaux = Array.from({ length: 24 }, (_, i) => i);
}
