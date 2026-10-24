import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AdminApi } from '../../api/admin.api';
import { AuthService } from '../../auth/auth.service';
import { DateCourtePipe, initiales, teinteAvatar } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Role, Utilisateur } from '../../core/modeles';
import { ConfirmationService } from '../../ui/confirmation';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';
import { Statut } from '../../ui/statut';

type FiltreRole = 'TOUS' | Role;

// Tous les comptes de la plateforme : recherche, filtre par rôle, création,
// modification, suppression.
@Component({
  selector: 'app-utilisateurs',
  imports: [FormsModule, ReactiveFormsModule, Icone, Statut, Modale, EtatVide, DateCourtePipe],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css',
})
export class Utilisateurs {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly moiId = inject(AuthService).utilisateur()?.id;

  protected readonly liste = signal<Utilisateur[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly recherche = signal('');
  protected readonly role = signal<FiltreRole>('TOUS');

  protected readonly initiales = initiales;
  protected readonly teinte = teinteAvatar;
  protected readonly filtresRoles: { valeur: FiltreRole; libelle: string }[] = [
    { valeur: 'TOUS', libelle: 'Tous' },
    { valeur: 'MEMBRE', libelle: 'Membres' },
    { valeur: 'GESTIONNAIRE', libelle: 'Gestionnaires' },
    { valeur: 'ADMIN', libelle: 'Admins' },
  ];

  protected readonly compte = computed(() => {
    const l = this.liste();
    return {
      TOUS: l.length,
      MEMBRE: l.filter((u) => u.role === 'MEMBRE').length,
      GESTIONNAIRE: l.filter((u) => u.role === 'GESTIONNAIRE').length,
      ADMIN: l.filter((u) => u.role === 'ADMIN').length,
    };
  });

  protected readonly filtres = computed(() => {
    const texte = this.recherche().trim().toLowerCase();
    return this.liste()
      .filter((u) => this.role() === 'TOUS' || u.role === this.role())
      .filter((u) => !texte || `${u.prenom} ${u.nom} ${u.telephone} ${u.email ?? ''}`.toLowerCase().includes(texte))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  });

  // ---------- La modale « créer / modifier » ----------
  // null = fermée ; 'nouveau' = création ; un Utilisateur = modification de celui-là.
  protected readonly edition = signal<Utilisateur | 'nouveau' | null>(null);
  protected readonly envoi = signal(false);
  protected readonly erreurModale = signal<string | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
    role: this.fb.nonNullable.control<Role>('MEMBRE'),
  });

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.api
      .utilisateurs()
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (l) => this.liste.set(l),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  protected ouvrirCreation(): void {
    this.formulaire.reset();
    // En création, téléphone et mot de passe sont saisis ; en modification, non.
    this.formulaire.controls.telephone.enable();
    this.formulaire.controls.motDePasse.enable();
    this.formulaire.controls.role.enable();
    this.erreurModale.set(null);
    this.edition.set('nouveau');
  }

  protected ouvrirModification(u: Utilisateur): void {
    this.formulaire.reset({ prenom: u.prenom, nom: u.nom, telephone: u.telephone, email: u.email ?? '', role: u.role });
    // disable() : le champ n'est plus validé ni modifiable (le backend ne
    // permet de changer que nom, prénom et email).
    this.formulaire.controls.telephone.disable();
    this.formulaire.controls.motDePasse.disable();
    this.formulaire.controls.role.disable();
    this.erreurModale.set(null);
    this.edition.set(u);
  }

  protected enregistrer(): void {
    const cible = this.edition();
    if (!cible || this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const email = v.email.trim() || null;
    // Même règle que le backend : un ADMIN ou un GESTIONNAIRE a un email.
    if (cible === 'nouveau' && v.role !== 'MEMBRE' && !email) {
      this.erreurModale.set('Un compte gestionnaire ou administrateur doit avoir un email.');
      return;
    }
    this.envoi.set(true);
    this.erreurModale.set(null);

    const requete =
      cible === 'nouveau'
        ? this.api.creerUtilisateur({ ...v, email })
        : this.api.modifierUtilisateur(cible.id, { prenom: v.prenom, nom: v.nom, email });

    requete.pipe(finalize(() => this.envoi.set(false))).subscribe({
      next: (u) => {
        // Création : on ajoute en tête. Modification : on remplace l'ancien.
        this.liste.update((l) => (cible === 'nouveau' ? [u, ...l] : l.map((x) => (x.id === u.id ? { ...x, ...u } : x))));
        this.toasts.succes(cible === 'nouveau' ? `Compte de ${u.prenom} créé.` : 'Compte mis à jour.');
        this.edition.set(null);
      },
      error: (e: unknown) => this.erreurModale.set(messageErreur(e)),
    });
  }

  protected async supprimer(u: Utilisateur): Promise<void> {
    const oui = await this.confirmation.demander({
      titre: 'Supprimer ce compte ?',
      message: `Le compte de ${u.prenom} ${u.nom} (${u.telephone}) sera supprimé. Cette action est définitive.`,
      bouton: 'Supprimer',
      danger: true,
    });
    if (!oui) {
      return;
    }
    this.api.supprimerUtilisateur(u.id).subscribe({
      next: () => {
        this.liste.update((l) => l.filter((x) => x.id !== u.id));
        this.toasts.succes('Compte supprimé.');
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e, 'Suppression impossible.')),
    });
  }

  protected estEdition(): boolean {
    return this.edition() !== 'nouveau';
  }
}
