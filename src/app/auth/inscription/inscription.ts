import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { CompteApi } from '../../api/admin.api';
import { CompteARebours } from '../../core/compte-a-rebours';
import { prixFormule, quota } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { Formule } from '../../core/modeles';
import { Icone } from '../../ui/icone';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService, PAGE_PAR_ROLE } from '../auth.service';

// Validateur de GROUPE : il voit tout le formulaire (≈ une contrainte de classe
// @AssertTrue en Java, qui compare deux champs).
//   - les deux mots de passe doivent être identiques ;
//   - un gestionnaire doit donner un email et choisir une formule (mêmes
//     règles que le backend).
function reglesCroisees(groupe: AbstractControl): ValidationErrors | null {
  const v = groupe.value;
  const erreurs: ValidationErrors = {};
  if (v.confirmation && v.motDePasse !== v.confirmation) {
    erreurs['differents'] = true;
  }
  if (v.role === 'GESTIONNAIRE' && !v.email?.trim()) {
    erreurs['emailObligatoire'] = true;
  }
  if (v.role === 'GESTIONNAIRE' && v.formuleId === null) {
    erreurs['formuleObligatoire'] = true;
  }
  // Object.keys(x).length ≈ map.isEmpty() inversé.
  return Object.keys(erreurs).length ? erreurs : null;
}

@Component({
  selector: 'app-inscription',
  imports: [ReactiveFormsModule, RouterLink, CadreAuth, Icone],
  templateUrl: './inscription.html',
  styleUrl: './inscription.css',
})
export class Inscription {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly compteApi = inject(CompteApi);
  private readonly parametres = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly retour = (() => {
    const r = this.parametres.get('retour');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : null;
  })();

  // Le rôle n'est plus choisi : il dépend de la façon dont on arrive.
  //   - par un lien d'invitation (/rejoindre/… → ?retour=/rejoindre/…) : MEMBRE ;
  //   - directement (site public) : GESTIONNAIRE. Un membre sans invitation
  //     arriverait sur un espace vide : on ne rejoint une tontine que sur invitation.
  protected readonly invite = this.retour?.startsWith('/rejoindre/') ?? false;
  // Le jeton du lien, envoyé avec l'inscription : le backend refuse un MEMBRE sans
  // lien valide (et, pour une invitation nominative, un autre numéro que l'invité).
  private readonly jeton = this.invite ? this.retour!.substring('/rejoindre/'.length) : null;

  protected readonly formulaire = this.fb.nonNullable.group(
    {
      // control<Type>(…) : on précise le type, sinon TS en déduirait « string ».
      role: this.fb.nonNullable.control<'MEMBRE' | 'GESTIONNAIRE'>(this.invite ? 'MEMBRE' : 'GESTIONNAIRE'),
      prenom: ['', Validators.required],
      nom: ['', Validators.required],
      telephone: ['', Validators.required],
      email: ['', Validators.email],
      motDePasse: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
      // number | null : null = pas encore choisie (≈ un Long qui peut être null).
      formuleId: this.fb.control<number | null>(null),
    },
    { validators: reglesCroisees },
  );

  // toSignal : la valeur du champ « role », en signal (le template réagit).
  protected readonly role = toSignal(this.formulaire.controls.role.valueChanges, {
    initialValue: this.formulaire.controls.role.value,
  });

  protected readonly erreur = signal<string | null>(null);
  protected readonly envoi = signal(false);

  // ---------- La formule (gestionnaire seulement) ----------
  protected readonly quota = quota;
  protected readonly prixFormule = prixFormule;
  private readonly formules = signal<Formule[]>([]);
  // Seules les formules avec un prix se choisissent ici ; « sur devis » (0)
  // passe par la page Contact (le backend refuse aussi, en 400).
  protected readonly formulesChoisissables = computed(() =>
    this.formules()
      .filter((f) => f.prixMensuel > 0)
      .sort((a, b) => a.prixMensuel - b.prixMensuel),
  );
  protected readonly existeSurDevis = computed(() => this.formules().some((f) => !f.prixMensuel));
  protected readonly formuleChoisie = toSignal(this.formulaire.controls.formuleId.valueChanges, {
    initialValue: null,
  });
  protected readonly nomFormuleChoisie = computed(
    () => this.formulesChoisissables().find((f) => f.id === this.formuleChoisie())?.nom ?? '',
  );

  // ---------- Après l'inscription : « Vérifiez votre boîte mail » ----------
  // L'adresse où le lien est parti (null = le formulaire est encore affiché).
  protected readonly emailEnvoye = signal<string | null>(null);
  // Secondes avant de pouvoir redemander un email (le backend en refuse un
  // second dans la minute, sans le dire : on l'affiche pour ne pas mentir).
  protected readonly attente = new CompteARebours();
  protected readonly renvoye = signal(false);

  constructor() {
    if (this.invite) {
      return; // un membre ne choisit pas de formule
    }
    // ?formule=2 : la carte cliquée sur la vitrine (« Choisir PRO »). Sinon la
    // moins chère. Number('abc') = NaN : un id fantaisiste ne sélectionne rien.
    const demandee = Number(this.parametres.get('formule'));
    this.compteApi.formulesDisponibles().subscribe({
      next: (liste) => {
        this.formules.set(liste);
        const choix = this.formulesChoisissables();
        const parDefaut = choix.find((f) => f.id === demandee) ?? choix[0];
        if (parDefaut) {
          this.formulaire.controls.formuleId.setValue(parDefaut.id);
        }
      },
      error: () => this.erreur.set('Les formules ne sont pas disponibles pour le moment. Réessayez dans un instant.'),
    });
  }

  // Raccourci pour le template : « ce champ est touché ET invalide ».
  protected fautif(nom: keyof typeof this.formulaire.controls): boolean {
    const c = this.formulaire.controls[nom];
    return c.touched && c.invalid;
  }

  protected creerCompte(): void {
    if (this.formulaire.invalid || this.envoi()) {
      this.formulaire.markAllAsTouched(); // montre toutes les erreurs d'un coup
      return;
    }
    this.erreur.set(null);
    this.envoi.set(true);
    const { confirmation: _, email, formuleId, ...reste } = this.formulaire.getRawValue();

    // Le gestionnaire ne se connecte PAS tout de suite : son email doit d'abord
    // être vérifié (le backend refuserait la connexion, en 403).
    if (!this.invite) {
      this.auth
        .inscrire({ ...reste, email: email.trim(), formuleId })
        .pipe(finalize(() => this.envoi.set(false)))
        .subscribe({
          next: () => {
            this.emailEnvoye.set(email.trim());
            this.attente.demarrer();
          },
          error: (e: unknown) => this.erreur.set(messageErreur(e, "Le compte n'a pas pu être créé.")),
        });
      return;
    }

    // Un invité (MEMBRE) : trois appels enchaînés, créer le compte → se connecter → qui suis-je.
    this.auth
      .inscrire({ ...reste, email: email.trim() || null, jetonInvitation: this.jeton })
      .pipe(
        switchMap(() => this.auth.login(reste.telephone, reste.motDePasse)),
        switchMap(() => this.auth.chargerMoi()),
        finalize(() => this.envoi.set(false)),
      )
      .subscribe({
        next: (moi) => this.router.navigateByUrl(this.retour ?? PAGE_PAR_ROLE[moi.role]),
        error: (e: unknown) => this.erreur.set(messageErreur(e, "Le compte n'a pas pu être créé.")),
      });
  }

  protected renvoyer(): void {
    const email = this.emailEnvoye();
    if (!email || this.attente.secondes() > 0) {
      return;
    }
    this.renvoye.set(false);
    this.auth.renvoyerVerification({ email }).subscribe({
      next: () => {
        this.renvoye.set(true);
        this.attente.demarrer();
      },
      error: (e: unknown) => this.erreur.set(messageErreur(e, "L'email n'a pas pu être renvoyé.")),
    });
  }
}
