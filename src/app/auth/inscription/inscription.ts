import { Component, inject, signal } from '@angular/core';
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

import { messageErreur } from '../../core/libelles';
import { Icone } from '../../ui/icone';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService, PAGE_PAR_ROLE } from '../auth.service';

// Validateur de GROUPE : il voit tout le formulaire (≈ une contrainte de classe
// @AssertTrue en Java, qui compare deux champs).
//   - les deux mots de passe doivent être identiques ;
//   - un gestionnaire doit donner un email (même règle que le backend).
function reglesCroisees(groupe: AbstractControl): ValidationErrors | null {
  const v = groupe.value;
  const erreurs: ValidationErrors = {};
  if (v.confirmation && v.motDePasse !== v.confirmation) {
    erreurs['differents'] = true;
  }
  if (v.role === 'GESTIONNAIRE' && !v.email?.trim()) {
    erreurs['emailObligatoire'] = true;
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
  protected readonly retour = (() => {
    const r = inject(ActivatedRoute).snapshot.queryParamMap.get('retour');
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
    },
    { validators: reglesCroisees },
  );

  // toSignal : la valeur du champ « role », en signal (le template réagit).
  protected readonly role = toSignal(this.formulaire.controls.role.valueChanges, {
    initialValue: this.formulaire.controls.role.value,
  });

  protected readonly erreur = signal<string | null>(null);
  protected readonly envoi = signal(false);

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
    const { confirmation: _, email, ...reste } = this.formulaire.getRawValue();

    // Trois appels enchaînés : créer le compte → se connecter → qui suis-je.
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
}
