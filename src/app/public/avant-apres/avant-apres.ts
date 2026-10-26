import { Component } from '@angular/core';

import { Apparition } from '../../ui/apparition';

/**
 * L'« avant / après » de la vitrine : chaque question du mois, telle que le
 * cahier y répond (griffonné, barré, en doute) et telle que SamaNatteu y
 * répond (une carte nette). Sorti de la page d'accueil, déjà très longue.
 */
@Component({
  selector: 'app-avant-apres',
  imports: [Apparition],
  templateUrl: './avant-apres.html',
  styleUrl: './avant-apres.css',
})
export class AvantApres {
  // L'« avant / après » : la même question, au cahier puis dans SamaNatteu.
  // Le cahier est découpé en morceaux pour pouvoir barrer un chiffre corrigé
  // (barre) ou écrire un doute en rouge (doute), comme à la main. \u00a0 = espace
  // insécable : un montant (« 30 000 ») n'est jamais coupé en fin de ligne.
  protected readonly avantApres: {
    question: string;
    cahier: { texte: string; barre?: boolean; doute?: boolean }[];
    apres: { titre: string; detail: string; valeur: string; badge: string; ton: 'ok' | 'attente' | 'or' };
  }[] = [
    {
      question: 'Qui a payé ?',
      cahier: [{ texte: 'Fatou ' }, { texte: 'payé ? (voir WhatsApp)', doute: true }],
      apres: { titre: 'Fatou N.', detail: 'Wave · reçu PDF disponible', valeur: '12 500 F', badge: 'Payé', ton: 'ok' },
    },
    {
      question: 'Combien y a-t-il dans la caisse ?',
      cahier: [{ texte: 'Total ' }, { texte: '180\u00a0000', barre: true }, { texte: ' 175\u00a0000 ' }, { texte: '??', doute: true }],
      apres: { titre: 'Collecté ce cycle', detail: '7 membres sur 10 ont payé', valeur: '175 000 F', badge: 'À jour', ton: 'ok' },
    },
    {
      question: 'Qui a gagné, et c’était juste ?',
      cahier: [{ texte: 'Gagnante : Khady ' }, { texte: '(Mariama conteste)', doute: true }],
      apres: { titre: 'Khady B.', detail: 'Tirage du cycle 4 · 12 oct., 18 h 42', valeur: '250 000 F', badge: 'Horodaté', ton: 'or' },
    },
    {
      question: 'Qui doit encore rembourser ?',
      cahier: [{ texte: 'Prêt Coumba : rendu ' }, { texte: '20\u00a0000', barre: true }, { texte: ' 30\u00a0000 ? ', doute: true }],
      apres: { titre: 'Coumba S.', detail: 'Prochaine échéance le 5 nov.', valeur: 'reste 20 000 F', badge: 'En cours', ton: 'attente' },
    },
  ];
}
