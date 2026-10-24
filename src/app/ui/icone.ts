import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Le jeu d'icônes de l'application, en tracés SVG (style « trait », 24×24).
// Un seul composant pour toutes : <app-icone nom="tontine" />. Pas de
// bibliothèque externe, pas de requête réseau, et la couleur suit le texte
// (stroke="currentColor").
const TRACES = {
  accueil: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
  tontine: 'M12 3a9 9 0 1 0 9 9M12 3v9h9M12 3a9 9 0 0 1 9 9',
  cercle: 'M16 11a4 4 0 1 0-8 0M5 20a7 7 0 0 1 14 0M12 3v2M20 7l-1.5 1M4 7l1.5 1',
  utilisateurs: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  utilisateur: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  ajoutUtilisateur: 'M15 21v-1a5 5 0 0 0-5-5H6a5 5 0 0 0-5 5v1M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
  formules: 'm12 2 10 5-10 5L2 7l10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  carte: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7ZM2 10h20M6 15h4',
  portefeuille: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M21 12h-4a2 2 0 0 0 0 4h4v-4Z',
  cadeau: 'M20 12v9H4v-9M2 7h20v5H2V7ZM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z',
  pret: 'M11 15h2a2 2 0 1 0 0-4h-3a2 2 0 0 0-2 2v.5M7 15l-4.5 4.5M17 9l4.5-4.5M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 0 9 9',
  coffre: 'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5ZM2 9v1a2 2 0 0 0 2 2M16 11h.01',
  recu: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1ZM16 8H8M16 12H8M13 16H8',
  cloche: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  deconnexion: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus: 'M12 5v14M5 12h14',
  recherche: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  flecheDroite: 'M5 12h14M13 6l6 6-6 6',
  flecheGauche: 'M19 12H5M11 18l-6-6 6-6',
  chevronDroit: 'm9 18 6-6-6-6',
  chevronBas: 'm6 9 6 6 6-6',
  fermer: 'M18 6 6 18M6 6l12 12',
  valider: 'M20 6 9 17l-5-5',
  alerte: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
  erreur: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 8v4M12 16h.01',
  succes: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  telephone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 6l-10 7L2 6',
  cadenas: 'M6 10V8a6 6 0 1 1 12 0v2M5 10h14v11H5V10Zm7 4v3',
  oeil: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  oeilBarre: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  copier: 'M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  lien: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  telecharger: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  importer: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  crayon: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z',
  poubelle: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  calendrier: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM16 2v4M8 2v4M3 10h18',
  horloge: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  tendance: 'M22 7 13.5 15.5l-5-5L2 17M16 7h6v6',
  soleil: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  lune: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  lecture: 'm6 3 14 9-14 9V3Z',
  pause: 'M6 4h4v16H6V4ZM14 4h4v16h-4V4Z',
  drapeau: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12ZM4 22v-7',
  melanger: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z',
  partager: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  rafraichir: 'M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5',
  plusOptions: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  bouclier: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z',
  graphique: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  fichier: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h5',
  etincelle: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
  entrant: 'M17 7 7 17M17 17H7V7',
  sortant: 'M7 17 17 7M7 7h10v10',
  couronne: 'm2 7 5 4 5-7 5 7 5-4-2 12H4L2 7ZM4 19h16',
} as const;

// keyof typeof TRACES = l'union des noms ci-dessus ('accueil' | 'tontine' | …) :
// un nom d'icône mal tapé dans un template ne compile pas.
export type NomIcone = keyof typeof TRACES;

@Component({
  selector: 'app-icone',
  template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="trace()" /></svg>`,
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: var(--epaisseur, 1.9);
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  // OnPush : ne se redessine que si son entrée change (une icône ne bouge presque jamais).
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icone {
  // input.required = un paramètre OBLIGATOIRE du composant (≈ un argument de
  // constructeur), passé dans le HTML : <app-icone nom="cloche" />.
  readonly nom = input.required<NomIcone>();
  protected readonly trace = computed(() => TRACES[this.nom()]);
}
