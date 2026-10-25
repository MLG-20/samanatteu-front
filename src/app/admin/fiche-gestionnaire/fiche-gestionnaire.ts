import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { DashboardApi } from '../../api/dashboard.api';
import { DateCourtePipe, PrixMensuelPipe, QuotaPipe, initiales, pourcentage, teinteAvatar } from '../../core/formatage';
import { etatAbonnement, messageErreur, rythme } from '../../core/libelles';
import { FicheGestionnaire } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Statut } from '../../ui/statut';

// Une jauge d'utilisation : « 12 / 200 membres ». max = 0 : formule sans plafond.
interface Usage {
  libelle: string;
  icone: 'utilisateurs' | 'tontine' | 'message';
  utilise: number;
  max: number | null;
}

// La fiche d'un gestionnaire, pour l'admin : identité, abonnement, utilisation
// face aux quotas, tontines (sans argent ni membre nommé : le backend ne les
// envoie pas).
@Component({
  selector: 'app-fiche-gestionnaire',
  imports: [RouterLink, Icone, Statut, EtatVide, DateCourtePipe, QuotaPipe, PrixMensuelPipe],
  templateUrl: './fiche-gestionnaire.html',
  styleUrl: './fiche-gestionnaire.css',
})
export class FicheGestionnairePage {
  private readonly api = inject(DashboardApi);
  protected readonly etat = etatAbonnement;

  protected readonly fiche = signal<FicheGestionnaire | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  protected readonly initiales = initiales;
  protected readonly teinte = teinteAvatar;
  protected readonly rythme = rythme;

  // Les trois jauges ; sans abonnement, pas de plafond connu (max = null).
  protected readonly usages = computed<Usage[]>(() => {
    const f = this.fiche();
    if (!f) {
      return [];
    }
    const a = f.abonnement;
    return [
      { libelle: 'Membres', icone: 'utilisateurs', utilise: f.nbMembres, max: a ? a.nbMembresMax : null },
      { libelle: 'Tontines en cours', icone: 'tontine', utilise: f.nbTontinesEnCours, max: a ? a.nbTontinesMax : null },
      { libelle: 'SMS ce mois-ci', icone: 'message', utilise: a?.smsEnvoyesMois ?? 0, max: a ? a.smsParMois : null },
    ];
  });

  constructor() {
    // snapshot : l'id lu une fois à l'ouverture (≈ @PathVariable Long id).
    const id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
    this.api
      .ficheGestionnaire(id)
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (f) => this.fiche.set(f),
        error: (e: unknown) => this.erreur.set(messageErreur(e, 'Ce gestionnaire est introuvable.')),
      });
  }

  // La part utilisée (0 à 100) ; 0 si pas de plafond.
  protected part(u: Usage): number {
    return u.max ? pourcentage(u.utilise, u.max) : 0;
  }

  // Orange dès 80 % (même seuil que l'alerte SMS décidée), rouge à 100 %.
  protected ton(u: Usage): 'succes' | 'attention' | 'danger' {
    const p = this.part(u);
    return p >= 100 ? 'danger' : p >= 80 ? 'attention' : 'succes';
  }
}
