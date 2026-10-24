import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { DateCourtePipe, initiales, teinteAvatar } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Icone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';

// Le profil de l'utilisateur connecté (les 3 rôles) : ses informations et son mot de passe.
@Component({
  selector: 'app-profil',
  imports: [ReactiveFormsModule, Icone, Statut, DateCourtePipe],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly moi = this.auth.utilisateur;
  protected readonly initiales = computed(() => initiales(this.moi()?.prenom, this.moi()?.nom));
  protected readonly teinte = computed(() => teinteAvatar(this.moi()?.id));

  // Pré-rempli avec les valeurs actuelles (le ! dit à TS « je sais qu'il
  // n'est pas null » : le guard garantit qu'on est connecté sur cette page).
  protected readonly infos = this.fb.nonNullable.group({
    prenom: [this.moi()!.prenom, Validators.required],
    nom: [this.moi()!.nom, Validators.required],
    email: [this.moi()!.email ?? '', Validators.email],
  });

  protected readonly motDePasse = this.fb.nonNullable.group({
    ancien: ['', Validators.required],
    nouveau: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly envoiInfos = signal(false);
  protected readonly envoiMdp = signal(false);
  protected readonly erreurInfos = signal<string | null>(null);
  protected readonly erreurMdp = signal<string | null>(null);

  protected enregistrerInfos(): void {
    if (this.infos.invalid || this.envoiInfos()) {
      this.infos.markAllAsTouched();
      return;
    }
    this.erreurInfos.set(null);
    this.envoiInfos.set(true);
    const { prenom, nom, email } = this.infos.getRawValue();
    this.auth
      .modifierProfil({ prenom, nom, email: email.trim() || null })
      .pipe(finalize(() => this.envoiInfos.set(false)))
      .subscribe({
        next: () => {
          this.infos.markAsPristine(); // « rien de neuf à enregistrer » : le bouton se grise
          this.toasts.succes('Profil mis à jour.');
        },
        error: (e: unknown) => this.erreurInfos.set(messageErreur(e)),
      });
  }

  protected changerMotDePasse(): void {
    if (this.motDePasse.invalid || this.envoiMdp()) {
      this.motDePasse.markAllAsTouched();
      return;
    }
    this.erreurMdp.set(null);
    this.envoiMdp.set(true);
    const { ancien, nouveau } = this.motDePasse.getRawValue();
    this.auth
      .changerMotDePasse(ancien, nouveau)
      .pipe(finalize(() => this.envoiMdp.set(false)))
      .subscribe({
        next: () => {
          this.motDePasse.reset();
          this.toasts.succes('Mot de passe changé.');
        },
        error: (e: unknown) => this.erreurMdp.set(messageErreur(e, 'Ancien mot de passe incorrect.')),
      });
  }
}
