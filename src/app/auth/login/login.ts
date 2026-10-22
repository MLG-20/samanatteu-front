import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { switchMap } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  // Ce que le TEMPLATE a le droit d'utiliser (différent des `import` du haut,
  // qui ne servent qu'à ce fichier .ts). ReactiveFormsModule apprend au HTML
  // à brancher un <input> sur un champ du formulaire de la classe.
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Le fabricant de formulaires, injecté comme HttpClient. private : le
  // template n'en a pas besoin.
  private readonly fb = inject(FormBuilder);
  // Le service qui parle à /auth/login et /auth/me (= un @Autowired final).
  private readonly auth = inject(AuthService);
  // Le routeur : pour changer de page depuis le code (navigateByUrl).
  private readonly router = inject(Router);

  // La page d'accueil de chaque rôle (≈ un Map.of Java). Les clés sont
  // vérifiées à la compilation contre le type `role` d'AuthService : un rôle
  // ajouté sans sa page ne compile pas.
  private readonly pageParRole = {
    ADMIN: '/admin',
    GESTIONNAIRE: '/gestionnaire',
    MEMBRE: '/membre',
  };


  // Le formulaire = l'équivalent front de LoginDTO. protected : le template
  // doit le lire (il ne voit pas le private).
  // nonNullable : si on vide le formulaire, les champs reviennent à ''
  // et pas à null. Ça évite de gérer null partout.
  // Forme d'un champ : [valeur de départ, [règles synchrones]].
  protected readonly formulaire = this.fb.nonNullable.group({
    telephone: ['', [Validators.required]],
    // Mêmes règles que le backend (@NotBlank + @Size(min = 8)) : le front
    // prévient tout de suite, mais c'est le backend qui a le dernier mot.
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
  });

  // Le message d'erreur affiché sous le formulaire. string | null = « une
  // chaîne OU null » ; null = pas d'erreur (rien ne s'affiche).
  protected readonly erreur = signal<string | null>(null);

  // Appelée à l'envoi du formulaire (clic sur le bouton OU touche Entrée).
  protected seConnecter(): void {
    // Garde-fou : le bouton grisé suffit en temps normal, mais la méthode ne
    // doit pas dépendre du HTML (on peut réactiver un bouton via F12).
    if (this.formulaire.invalid) {
      return;
    }
    // On efface le message d'une tentative précédente avant de réessayer.
    this.erreur.set(null);

    // Déstructuration : deux variables créées d'un coup à partir de l'objet
    // { telephone, motDePasse } renvoyé par le formulaire.
    const { telephone, motDePasse } = this.formulaire.getRawValue();

    // login() PRÉPARE la requête ; c'est subscribe() qui l'envoie.
    // L'objet { next, error } = les deux réactions possibles (≈ une classe
    // anonyme Java à deux méthodes), chacune écrite en fonction fléchée (≈ lambda).
    this.auth.login(telephone, motDePasse)
      // pipe = la chaîne d'opérateurs (≈ stream()). switchMap = « login réussi
      // (tokens rangés), PUIS appelle /auth/me » (≈ thenCompose de CompletableFuture).
      .pipe(switchMap(() => this.auth.chargerMoi()))
      .subscribe({
        // next reçoit le résultat du DERNIER appel : l'utilisateur connecté.
        // On l'envoie sur la page de son rôle (de l'intérieur vers l'extérieur :
        // la page du rôle, puis la navigation vers elle).
        next: (moi) => this.router.navigateByUrl(this.pageParRole[moi.role]),
        // UN SEUL error pour les deux appels : 401 au login, /auth/me qui
        // échoue, backend arrêté... : on prévient l'utilisateur.
        error: () => this.erreur.set('Téléphone ou mot de passe incorrect.'),
      });
  }
}
