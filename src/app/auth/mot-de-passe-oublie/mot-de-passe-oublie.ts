import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { messageErreur } from '../../core/libelles';
import { Icone } from '../../ui/icone';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService } from '../auth.service';

/**
 * Mot de passe oublié, en deux étapes sur la même page :
 *   1. le téléphone → le backend envoie un code par SMS ;
 *   2. le code + le nouveau mot de passe → réinitialisation.
 * Le signal `etape` dit laquelle afficher (≈ une petite machine à états).
 */
@Component({
  selector: 'app-mot-de-passe-oublie',
  imports: [ReactiveFormsModule, RouterLink, CadreAuth, Icone],
  templateUrl: './mot-de-passe-oublie.html',
  styleUrl: './mot-de-passe-oublie.css',
})
export class MotDePasseOublie {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly etape = signal<1 | 2>(1);
  protected readonly erreur = signal<string | null>(null);
  protected readonly envoi = signal(false);

  protected readonly demande = this.fb.nonNullable.group({
    telephone: ['', Validators.required],
  });

  protected readonly reinit = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    nouveauMotDePasse: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected envoyerCode(): void {
    if (this.demande.invalid || this.envoi()) {
      this.demande.markAllAsTouched();
      return;
    }
    this.erreur.set(null);
    this.envoi.set(true);
    this.auth
      .demanderCode(this.demande.getRawValue().telephone)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => this.etape.set(2),
        error: (e: unknown) => this.erreur.set(messageErreur(e, "Le code n'a pas pu être envoyé.")),
      });
  }

  protected reinitialiser(): void {
    if (this.reinit.invalid || this.envoi()) {
      this.reinit.markAllAsTouched();
      return;
    }
    this.erreur.set(null);
    this.envoi.set(true);
    const { code, nouveauMotDePasse } = this.reinit.getRawValue();
    this.auth
      .reinitialiser(this.demande.getRawValue().telephone, code, nouveauMotDePasse)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/connexion'], { queryParams: { reinit: 1 } }),
        error: (e: unknown) => this.erreur.set(messageErreur(e, 'Code invalide ou expiré.')),
      });
  }

  protected recommencer(): void {
    this.etape.set(1);
    this.reinit.reset();
    this.erreur.set(null);
  }
}
