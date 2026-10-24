import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AdminApi } from '../../api/admin.api';
import { DateCourtePipe, FcfaPipe, fcfa, initiales, pourcentage, teinteAvatar } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Abonnement, Formule, Utilisateur } from '../../core/modeles';
import { CarteStat } from '../../ui/carte-stat';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';

/**
 * Les abonnements des gestionnaires. En attendant le paiement en ligne
 * (Wave / Orange Money), c'est l'admin qui active ou prolonge un abonnement
 * à la main, après avoir reçu le paiement.
 */
@Component({
  selector: 'app-abonnements',
  imports: [FormsModule, ReactiveFormsModule, Icone, Statut, Modale, EtatVide, CarteStat, FcfaPipe, DateCourtePipe],
  templateUrl: './abonnements.html',
  styleUrl: './abonnements.css',
})
export class Abonnements {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  protected readonly liste = signal<Abonnement[]>([]);
  protected readonly formules = signal<Formule[]>([]);
  protected readonly gestionnaires = signal<Utilisateur[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly recherche = signal('');

  protected readonly fcfa = fcfa;
  protected readonly initiales = initiales;
  protected readonly teinte = teinteAvatar;
  protected readonly pourcentage = pourcentage;
  protected readonly durees = [1, 3, 6, 12];

  protected readonly filtres = computed(() => {
    const t = this.recherche().trim().toLowerCase();
    return this.liste()
      .filter((a) => !t || `${a.prenom} ${a.nom} ${a.telephone} ${a.formule}`.toLowerCase().includes(t))
      .sort((a, b) => Number(b.actif) - Number(a.actif) || a.dateFin.localeCompare(b.dateFin));
  });

  protected readonly stats = computed(() => {
    const actifs = this.liste().filter((a) => a.actif);
    return {
      actifs: actifs.length,
      revenu: actifs.reduce((s, a) => s + a.prixMensuel, 0),
      sms: actifs.reduce((s, a) => s + a.smsEnvoyesMois, 0),
    };
  });

  protected readonly formulesActives = computed(() => this.formules().filter((f) => f.active));

  // ---------- Activation ----------
  protected readonly modaleOuverte = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreurModale = signal<string | null>(null);
  protected readonly formulaire = this.fb.nonNullable.group({
    utilisateurId: this.fb.nonNullable.control<number | null>(null, Validators.required),
    formuleId: this.fb.nonNullable.control<number | null>(null, Validators.required),
    dureeMois: [1, [Validators.required, Validators.min(1)]],
  });

  // Le récapitulatif du prix, recalculé à chaque changement du formulaire.
  protected readonly valeurs = signal(this.formulaire.getRawValue());
  protected readonly total = computed(() => {
    const v = this.valeurs();
    const f = this.formules().find((x) => x.id === v.formuleId);
    return f ? f.prixMensuel * v.dureeMois : 0;
  });

  constructor() {
    this.formulaire.valueChanges.subscribe(() => this.valeurs.set(this.formulaire.getRawValue()));
    forkJoin({
      abonnements: this.api.abonnements(),
      formules: this.api.formules().pipe(catchError(() => of([]))),
      utilisateurs: this.api.utilisateurs().pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (r) => {
          this.liste.set(r.abonnements);
          this.formules.set(r.formules);
          this.gestionnaires.set(r.utilisateurs.filter((u) => u.role === 'GESTIONNAIRE'));
        },
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // Ouvrir la modale, éventuellement pré-remplie (bouton « Prolonger » d'une ligne).
  protected ouvrir(a?: Abonnement): void {
    this.formulaire.reset({
      utilisateurId: a?.utilisateurId ?? null,
      formuleId: a?.formuleId ?? this.formulesActives()[0]?.id ?? null,
      dureeMois: 1,
    });
    this.erreurModale.set(null);
    this.modaleOuverte.set(true);
  }

  protected activer(): void {
    if (this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    this.envoi.set(true);
    this.api
      .activerAbonnement({ utilisateurId: v.utilisateurId!, formuleId: v.formuleId!, dureeMois: v.dureeMois })
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (a) => {
          // Créé ou prolongé : on remplace l'éventuel ancien abonnement de ce gestionnaire.
          this.liste.update((l) => [a, ...l.filter((x) => x.id !== a.id)]);
          this.toasts.succes(`Abonnement de ${a.prenom} actif jusqu'au ${new Date(a.dateFin).toLocaleDateString('fr-FR')}.`);
          this.modaleOuverte.set(false);
        },
        error: (e: unknown) => this.erreurModale.set(messageErreur(e)),
      });
  }
}
