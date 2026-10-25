import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { messageErreur } from '../../core/libelles';
import { Icone } from '../../ui/icone';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService } from '../auth.service';

/**
 * La page ouverte par le lien de l'email (/verifier-email/{jeton}).
 * Ouvrir la page = confirmer : l'appel part tout seul au chargement (la
 * gestionnaire a déjà fait son geste en cliquant dans l'email). Trois états :
 * en cours → adresse confirmée (essai démarré) → ou lien refusé, avec de quoi
 * en redemander un.
 */
@Component({
  selector: 'app-verifier-email',
  imports: [ReactiveFormsModule, RouterLink, CadreAuth, Icone],
  templateUrl: './verifier-email.html',
  styleUrl: './verifier-email.css',
})
export class VerifierEmail {
  private readonly auth = inject(AuthService);

  // 'en-cours' | 'confirme' | 'refuse' : un type UNION de chaînes, l'équivalent
  // léger d'un enum Java (le compilateur refuse toute autre valeur).
  protected readonly etat = signal<'en-cours' | 'confirme' | 'refuse'>('en-cours');
  protected readonly erreur = signal<string | null>(null);

  // Lien refusé : redemander un email (le backend répond toujours 204).
  protected readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly envoi = signal(false);
  protected readonly renvoye = signal(false);

  constructor() {
    // paramMap.get('jeton') : le morceau variable de l'URL (≈ @PathVariable).
    const jeton = inject(ActivatedRoute).snapshot.paramMap.get('jeton') ?? '';
    this.auth.verifierEmail(jeton).subscribe({
      next: () => this.etat.set('confirme'),
      error: (e: unknown) => {
        this.erreur.set(messageErreur(e, "Ce lien n'est plus valable."));
        this.etat.set('refuse');
      },
    });
  }

  protected renvoyer(): void {
    if (this.email.invalid || this.envoi()) {
      this.email.markAsTouched();
      return;
    }
    this.envoi.set(true);
    this.auth
      .renvoyerVerification({ email: this.email.value.trim() })
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => this.renvoye.set(true),
        error: (e: unknown) => this.erreur.set(messageErreur(e, "L'email n'a pas pu être renvoyé.")),
      });
  }
}
