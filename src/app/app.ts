import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ApiService } from './api/api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);

  // Un signal : une valeur dont le changement déclenche la mise à jour de
  // l'écran. `null` = pas encore chargé. Le `?` dit à TypeScript "peut être
  // absent" (leCompilation-time check).
  protected readonly nbRoutes = signal<number | null>(null);
  protected readonly erreur = signal<string | null>(null);

  constructor() {
    // Au démarrage de l'application, on demande le nombre de routes à l'API.
    this.api.nombreDeRoutes().subscribe({
      // next : la réponse est arrivée.
      next: (nombre) => this.nbRoutes.set(nombre),
      // error : l'appel a échoué (backend arrêté, 401, 500…).
      error: (e) => this.erreur.set(`L'API ne répond pas : ${e.message ?? e}`),
    });
  }
}
