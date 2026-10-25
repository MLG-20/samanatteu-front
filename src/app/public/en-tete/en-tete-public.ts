import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService, PAGE_PAR_ROLE } from '../../auth/auth.service';
import { Icone } from '../../ui/icone';

/**
 * La barre du haut des pages publiques secondaires (contact, à propos).
 * La vitrine garde la sienne (elle navigue dans ses propres sections).
 * Ses couleurs viennent des variables posées par la page (vitrine.css).
 */
@Component({
  selector: 'app-en-tete-public',
  imports: [RouterLink, RouterLinkActive, Icone],
  templateUrl: './en-tete-public.html',
  styleUrl: './en-tete-public.css',
})
export class EnTetePublic {
  private readonly auth = inject(AuthService);

  protected readonly menuOuvert = signal(false);

  // Déjà connecté ? Le bouton devient « Mon espace ».
  protected readonly monEspace = computed(() => {
    const u = this.auth.utilisateur();
    return u ? PAGE_PAR_ROLE[u.role] : null;
  });

  constructor() {
    // Visiteur déjà connecté (token en mémoire) : on le reconnaît.
    this.auth.restaurerSession().subscribe();
  }
}
