import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Un compte à rebours en secondes, pour griser un bouton « Renvoyer l'email »
 * pendant la minute où le backend refuserait (sans le dire) un nouvel envoi.
 *
 * À créer dans un champ de composant (`new CompteARebours()`) : inject() n'est
 * permis qu'à la construction. Le minuteur s'arrête tout seul quand on quitte
 * la page (≈ un @PreDestroy).
 */
export class CompteARebours {
  // Secondes restantes ; 0 = le bouton peut servir.
  readonly secondes = signal(0);
  private minuteur: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.arreter());
  }

  // setInterval ≈ un ScheduledExecutorService : la tâche tourne chaque seconde.
  demarrer(duree = 60): void {
    this.arreter();
    this.secondes.set(duree);
    this.minuteur = setInterval(() => {
      this.secondes.update((s) => s - 1);
      if (this.secondes() <= 0) {
        this.arreter();
      }
    }, 1000);
  }

  private arreter(): void {
    if (this.minuteur) {
      clearInterval(this.minuteur);
      this.minuteur = null;
    }
  }
}
