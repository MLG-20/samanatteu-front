import { Injectable, signal } from '@angular/core';

// Le thème clair / sombre. Au premier passage, on suit le réglage du système ;
// dès que l'utilisateur clique sur le bouton, son choix est retenu.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly CLE = 'samanatteu.theme';
  readonly sombre = signal(this.etatInitial());

  basculer(): void {
    const sombre = !this.sombre();
    this.sombre.set(sombre);
    const theme = sombre ? 'dark' : 'light';
    document.documentElement.dataset['theme'] = theme;
    // try : le localStorage peut être bloqué (navigation privée) ; le thème
    // marche quand même, il ne sera juste pas retenu.
    try {
      localStorage.setItem(this.CLE, theme);
    } catch {
      /* rien à faire */
    }
  }

  private etatInitial(): boolean {
    const force = document.documentElement.dataset['theme'];
    if (force) {
      return force === 'dark';
    }
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
