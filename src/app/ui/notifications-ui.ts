import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

import { Icone } from './icone';

// ---------- Les « toasts » : petits messages éphémères en bas d'écran ----------

export interface Toast {
  id: number;
  texte: string;
  type: 'succes' | 'erreur' | 'info';
}

/**
 * Le service des toasts. N'importe quel écran peut écrire :
 *   this.toasts.succes('Paiement enregistré');
 * et le message s'affiche 4 secondes, quel que soit l'écran.
 * Un SINGLETON (providedIn: 'root') qui porte un signal : ≈ un bean Spring
 * partagé, dont l'état est observé par le composant d'affichage.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private compteur = 0;

  succes(texte: string): void {
    this.ajouter(texte, 'succes');
  }
  erreur(texte: string): void {
    this.ajouter(texte, 'erreur');
  }
  info(texte: string): void {
    this.ajouter(texte, 'info');
  }

  retirer(id: number): void {
    // update(f) = « nouvelle valeur = f(ancienne) ». filter ≈ stream().filter().
    this.toasts.update((liste) => liste.filter((t) => t.id !== id));
  }

  private ajouter(texte: string, type: Toast['type']): void {
    const id = ++this.compteur;
    // [...liste, x] = une NOUVELLE liste avec x à la fin (on ne modifie jamais
    // l'ancienne : c'est ce qui permet au signal de voir le changement).
    this.toasts.update((liste) => [...liste.slice(-3), { id, texte, type }]);
    setTimeout(() => this.retirer(id), 4500);
  }
}

@Component({
  selector: 'app-toasts',
  imports: [Icone],
  template: `
    <div class="pile-toasts" aria-live="polite">
      @for (t of service.toasts(); track t.id) {
        <div class="toast" [attr.data-type]="t.type" role="status">
          <app-icone [nom]="t.type === 'succes' ? 'succes' : t.type === 'erreur' ? 'erreur' : 'info'" />
          <span>{{ t.texte }}</span>
          <button type="button" aria-label="Fermer" (click)="service.retirer(t.id)">
            <app-icone nom="fermer" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .pile-toasts {
      position: fixed;
      z-index: 1000;
      right: 1rem;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      pointer-events: none;
    }
    @media (min-width: 640px) {
      .pile-toasts {
        left: auto;
        align-items: flex-end;
      }
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      width: min(100%, 24rem);
      padding: 0.85rem 0.9rem 0.85rem 1rem;
      border-radius: 14px;
      background: #0f172a;
      color: #f1f5f9;
      box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.45);
      font-size: 0.9rem;
      font-weight: 500;
      pointer-events: auto;
      animation: glisse 0.4s var(--courbe);
    }
    .toast span {
      flex: 1;
    }
    .toast > app-icone {
      color: #60a5fa;
    }
    .toast[data-type='succes'] > app-icone {
      color: #34d399;
    }
    .toast[data-type='erreur'] > app-icone {
      color: #f87171;
    }
    button {
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    button app-icone {
      width: 1rem;
      height: 1rem;
    }
    @keyframes glisse {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.96);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  protected readonly service = inject(ToastService);
}
