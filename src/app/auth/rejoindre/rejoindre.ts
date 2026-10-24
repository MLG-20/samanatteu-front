import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { CompteApi } from '../../api/admin.api';
import { DateCourtePipe } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { LienInvitation } from '../../core/modeles';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService } from '../auth.service';

/**
 * La page d'un lien d'invitation (/rejoindre/{token}), envoyé par WhatsApp ou SMS.
 * Publique : un visiteur voit la tontine qui l'invite, puis se connecte ou
 * crée son compte ; il revient ensuite ICI (paramètre ?retour) pour accepter.
 *
 * Pourquoi /rejoindre et pas /invitation ? /invitation est un préfixe de l'API
 * dans proxy.conf.json : un F5 sur /invitation/… renverrait le JSON du backend.
 */
@Component({
  selector: 'app-rejoindre',
  imports: [RouterLink, CadreAuth, Icone, DateCourtePipe],
  templateUrl: './rejoindre.html',
  styleUrl: './rejoindre.css',
})
export class Rejoindre {
  private readonly api = inject(CompteApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  // paramMap.get('token') : le morceau variable de l'URL (≈ @PathVariable).
  protected readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';
  protected readonly ici = `/rejoindre/${this.token}`;

  protected readonly lien = signal<LienInvitation | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly envoi = signal(false);

  constructor() {
    // Si un token est en mémoire, on recharge l'utilisateur (après F5).
    this.auth.restaurerSession().subscribe();
    this.api
      .lienInvitation(this.token)
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (l) => this.lien.set(l),
        error: (e: unknown) => this.erreur.set(messageErreur(e, "Ce lien d'invitation n'est pas valide.")),
      });
  }

  protected rejoindre(): void {
    this.envoi.set(true);
    this.api
      .rejoindre(this.token)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => {
          this.toasts.succes(`Bienvenue dans « ${this.lien()?.nomTontine} » !`);
          this.router.navigateByUrl('/membre');
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e, "Impossible de rejoindre cette tontine.")),
      });
  }
}
