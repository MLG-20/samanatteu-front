import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SiteApi } from '../../api/site.api';
import { Apparition } from '../../ui/apparition';
import { Icone, NomIcone } from '../../ui/icone';
import { EnTetePublic } from '../en-tete/en-tete-public';
import { PiedPublic } from '../pied/pied-public';

interface Bloc {
  titre: string;
  icone: NomIcone;
  texte: string;
  classe: string;
}

/**
 * La page À propos : une accroche et trois blocs (histoire, mission, valeurs),
 * écrits par l'ADMIN dans son back-office (GET /site). La mise en page est
 * fixe : elle reste belle quoi qu'il écrive. Un bloc vide n'est pas affiché.
 */
@Component({
  selector: 'app-a-propos',
  imports: [RouterLink, Icone, Apparition, EnTetePublic, PiedPublic],
  templateUrl: './a-propos.html',
  styleUrls: ['../vitrine.css', './a-propos.css'],
})
export class APropos {
  private readonly site = inject(SiteApi);
  protected readonly parametres = this.site.parametres;
  protected readonly echec = this.site.echec;

  // Si l'ADMIN a effacé l'accroche, un titre par défaut.
  protected readonly accroche = computed(
    () => this.parametres()?.aproposAccroche ?? 'La tontine, telle qu’on la pratique, avec la confiance en plus.',
  );

  protected readonly blocs = computed<Bloc[]>(() => {
    const p = this.parametres();
    if (!p) {
      return [];
    }
    const tous: (Bloc | null)[] = [
      p.aproposHistoire ? { titre: 'Notre histoire', icone: 'drapeau', texte: p.aproposHistoire, classe: 'large' } : null,
      p.aproposMission ? { titre: 'Notre mission', icone: 'etincelle', texte: p.aproposMission, classe: '' } : null,
      p.aproposValeurs ? { titre: 'Nos valeurs', icone: 'bouclier', texte: p.aproposValeurs, classe: '' } : null,
    ];
    return tous.filter((b): b is Bloc => b !== null);
  });

  constructor() {
    this.site.charger();
  }
}
