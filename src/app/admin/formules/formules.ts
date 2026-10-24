import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AdminApi } from '../../api/admin.api';
import { FcfaPipe } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Formule } from '../../core/modeles';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';

// Les formules d'abonnement proposées aux gestionnaires, en cartes « tarifs ».
@Component({
  selector: 'app-formules',
  imports: [ReactiveFormsModule, Icone, Modale, EtatVide, FcfaPipe],
  templateUrl: './formules.html',
  styleUrl: './formules.css',
})
export class Formules {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  protected readonly liste = signal<Formule[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  // Triées par prix ; la plus chère des formules actives est mise en avant.
  protected readonly triees = computed(() => [...this.liste()].sort((a, b) => a.prixMensuel - b.prixMensuel));
  protected readonly vedette = computed(() => {
    const actives = this.triees().filter((f) => f.active);
    return actives.length >= 3 ? actives[Math.floor(actives.length / 2)].id : null;
  });

  protected readonly edition = signal<Formule | 'nouvelle' | null>(null);
  protected readonly envoi = signal(false);
  protected readonly erreurModale = signal<string | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    nom: ['', Validators.required],
    prixMensuel: [0, [Validators.required, Validators.min(0)]],
    nbTontinesMax: [1, [Validators.required, Validators.min(0)]],
    nbMembresMax: [20, [Validators.required, Validators.min(0)]],
    smsParMois: [100, [Validators.required, Validators.min(0)]],
    active: [true],
  });

  constructor() {
    this.api
      .formules()
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (l) => this.liste.set(l),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected ouvrir(f: Formule | 'nouvelle'): void {
    this.formulaire.reset(f === 'nouvelle' ? undefined : f);
    this.erreurModale.set(null);
    this.edition.set(f);
  }

  protected enregistrer(): void {
    const cible = this.edition();
    if (!cible || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    const saisie: Formule = { id: cible === 'nouvelle' ? null : cible.id, ...this.formulaire.getRawValue() };
    const requete = cible === 'nouvelle' ? this.api.creerFormule(saisie) : this.api.modifierFormule(cible.id!, saisie);
    requete.pipe(finalize(() => this.envoi.set(false))).subscribe({
      next: (f) => {
        this.liste.update((l) => (cible === 'nouvelle' ? [...l, f] : l.map((x) => (x.id === f.id ? f : x))));
        this.toasts.succes(cible === 'nouvelle' ? `Formule « ${f.nom} » créée.` : 'Formule mise à jour.');
        this.edition.set(null);
      },
      error: (e: unknown) => this.erreurModale.set(messageErreur(e)),
    });
  }

  // Activer / retirer de la vente, d'un clic (PUT avec active inversé).
  protected basculer(f: Formule): void {
    this.api.modifierFormule(f.id!, { ...f, active: !f.active }).subscribe({
      next: (maj) => {
        this.liste.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.toasts.succes(maj.active ? `« ${maj.nom} » est de nouveau proposée.` : `« ${maj.nom} » n'est plus proposée.`);
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
    });
  }
}
