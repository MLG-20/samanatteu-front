import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icone } from '../../ui/icone';

/**
 * Le cadre commun des pages publiques (connexion, inscription, mot de passe
 * oublié, invitation) : le panneau de marque animé, et à côté, la carte où la
 * page met son formulaire (<ng-content>).
 *
 * Avant, ce panneau vivait dans la page de connexion ; dès qu'une 2e page en a
 * eu besoin, on l'a sorti ici (≈ extraire une classe mère en Java).
 */
@Component({
  selector: 'app-cadre-auth',
  imports: [Icone, RouterLink],
  templateUrl: './cadre-auth.html',
  styleUrl: './cadre-auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadreAuth {
  // Le titre du panneau de marque (chaque page peut avoir son accroche).
  readonly accroche = input('Votre tontine,');
  readonly surligne = input('en toute confiance.');
  readonly texte = input('Cotisations, tirages, prêts : tout est suivi, chacun voit où en est la caisse.');
  readonly large = input(false);
}
