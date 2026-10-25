import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { CompteARebours } from '../../core/compte-a-rebours';
import { Icone } from '../../ui/icone';
import { CadreAuth } from '../cadre-auth/cadre-auth';
import { AuthService, PAGE_PAR_ROLE } from '../auth.service';

@Component({
  selector: 'app-login',
  // Ce que le TEMPLATE a le droit d'utiliser (différent des `import` du haut,
  // qui ne servent qu'à ce fichier .ts). ReactiveFormsModule apprend au HTML
  // à brancher un <input> sur un champ du formulaire de la classe.
  imports: [ReactiveFormsModule, RouterLink, CadreAuth, Icone],
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

  // Les paramètres de l'URL (?retour=…&expiree=1), lus une fois à l'ouverture.
  // snapshot = « la photo » de la route au moment où la page s'ouvre.
  private readonly parametres = inject(ActivatedRoute).snapshot.queryParamMap;

  // La page qu'on voulait voir avant d'être renvoyé ici (posée par le guard).
  // On n'accepte qu'un chemin interne (« /… », pas « //site-pirate.com ») :
  // sinon un lien piégé pourrait nous emmener ailleurs après la connexion.
  protected readonly retour = (() => {
    const r = this.parametres.get('retour');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : null;
  })();
  protected readonly sessionExpiree = this.parametres.has('expiree');
  protected readonly motDePasseChange = this.parametres.has('reinit');

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
  // Vrai pendant l'aller-retour avec le backend : le bouton tourne et se grise
  // (un double clic n'envoie pas deux connexions).
  protected readonly envoi = signal(false);

  // Bon mot de passe, mais email pas encore confirmé (le backend répond 403,
  // et 401 pour des identifiants faux) : le numéro tapé, pour « Renvoyer l'email ».
  // null = ce n'est pas le cas.
  protected readonly nonVerifie = signal<string | null>(null);
  protected readonly renvoye = signal(false);
  protected readonly attente = new CompteARebours();

  // Appelée à l'envoi du formulaire (clic sur le bouton OU touche Entrée).
  protected seConnecter(): void {
    // Garde-fou : le bouton grisé suffit en temps normal, mais la méthode ne
    // doit pas dépendre du HTML (on peut réactiver un bouton via F12).
    if (this.formulaire.invalid || this.envoi()) {
      return;
    }
    // On efface le message d'une tentative précédente avant de réessayer.
    this.erreur.set(null);
    this.nonVerifie.set(null);
    this.renvoye.set(false);
    this.envoi.set(true);

    // Déstructuration : deux variables créées d'un coup à partir de l'objet
    // { telephone, motDePasse } renvoyé par le formulaire.
    const { telephone, motDePasse } = this.formulaire.getRawValue();

    // login() PRÉPARE la requête ; c'est subscribe() qui l'envoie.
    this.auth
      .login(telephone, motDePasse)
      // pipe = la chaîne d'opérateurs (≈ stream()). switchMap = « login réussi
      // (tokens rangés), PUIS appelle /auth/me » (≈ thenCompose de CompletableFuture).
      // finalize = « à la fin, succès ou échec » (≈ le finally d'un try).
      .pipe(
        switchMap(() => this.auth.chargerMoi()),
        finalize(() => this.envoi.set(false)),
      )
      .subscribe({
        // next reçoit le résultat du DERNIER appel : l'utilisateur connecté.
        // On l'envoie là où il voulait aller, sinon sur la page de son rôle.
        next: (moi) => this.router.navigateByUrl(this.retour ?? PAGE_PAR_ROLE[moi.role]),
        // UN SEUL error pour les deux appels : 401 au login, /auth/me qui
        // échoue, backend arrêté... : on prévient l'utilisateur.
        // instanceof + status ≈ un catch (EmailNonVerifieException e) en Java :
        // le 403 du login a son propre écran.
        error: (e: unknown) => {
          if (e instanceof HttpErrorResponse && e.status === 403 && e.url?.endsWith('/auth/login')) {
            this.nonVerifie.set(telephone);
          } else {
            this.erreur.set('Téléphone ou mot de passe incorrect.');
          }
        },
      });
  }

  // Le même identifiant qu'à la connexion : le backend retrouve le compte et
  // renvoie un lien à son adresse (toujours 204, même pour un compte inconnu).
  protected renvoyer(): void {
    const telephone = this.nonVerifie();
    if (!telephone || this.attente.secondes() > 0) {
      return;
    }
    this.auth.renvoyerVerification({ telephone }).subscribe({
      next: () => {
        this.renvoye.set(true);
        this.attente.demarrer();
      },
      error: () => this.erreur.set("L'email n'a pas pu être renvoyé. Réessayez dans un instant."),
    });
  }
}
