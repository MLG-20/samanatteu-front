import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { SiteApi } from '../../api/site.api';
import { messageErreur } from '../../core/libelles';
import { Icone, NomIcone } from '../../ui/icone';
import { EnTetePublic } from '../en-tete/en-tete-public';
import { PiedPublic } from '../pied/pied-public';

interface Coordonnee {
  icone: NomIcone;
  libelle: string;
  valeur: string;
  lien: string | null; // null = rien à cliquer (adresse, horaires)
  externe: boolean;
}

// Validateur de GROUPE (il voit tout le formulaire) : téléphone OU email,
// au moins l'un des deux. Même règle que le backend (MoyenDeReponseManquantException).
function moyenDeReponse(groupe: AbstractControl): ValidationErrors | null {
  const v = groupe.value;
  return v.telephone?.trim() || v.email?.trim() ? null : { moyenDeReponse: true };
}

/**
 * La page Contact : les coordonnées (pilotées par l'ADMIN, GET /site) à côté
 * d'un formulaire (POST /messageContact, public) dont l'ADMIN lit les messages dans
 * son back-office.
 */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, Icone, EnTetePublic, PiedPublic],
  templateUrl: './contact.html',
  styleUrls: ['../vitrine.css', './contact.css'],
})
export class Contact {
  private readonly site = inject(SiteApi);
  protected readonly parametres = this.site.parametres;
  protected readonly echec = this.site.echec;

  // Les sujets proposés : un clic remplit le champ (le visiteur peut écrire le sien).
  protected readonly sujets = ['Question sur les formules', 'Activer mon abonnement', 'Un problème technique', 'Autre chose'];
  protected readonly maxMessage = 3000;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    {
      nom: ['', [Validators.required, Validators.maxLength(100)]],
      telephone: ['', Validators.pattern(/^\+?[0-9 ]{6,20}$/)],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      sujet: ['', [Validators.required, Validators.maxLength(150)]],
      message: ['', [Validators.required, Validators.maxLength(this.maxMessage)]],
      // Le pot de miel : caché à l'humain, rempli par les robots.
      siteWeb: [''],
    },
    { validators: moyenDeReponse },
  );

  // La longueur du message, en direct (le compteur sous la zone de texte).
  // toSignal : transforme le flux des valeurs en signal (≈ un listener sur le champ).
  private readonly texte = toSignal(this.formulaire.controls.message.valueChanges, { initialValue: '' });
  protected readonly longueur = computed(() => this.texte().length);

  protected readonly envoi = signal(false);
  protected readonly envoye = signal(false);
  protected readonly erreur = signal<string | null>(null);
  // On n'affiche les erreurs qu'après une tentative d'envoi (pas pendant la saisie).
  protected readonly tente = signal(false);

  // Les coordonnées renseignées par l'ADMIN, prêtes à afficher.
  protected readonly coordonnees = computed<Coordonnee[]>(() => {
    const p = this.parametres();
    if (!p) {
      return [];
    }
    const liste: Coordonnee[] = [];
    if (p.contactTelephone) {
      liste.push({ icone: 'telephone', libelle: 'Téléphone', valeur: p.contactTelephone, lien: `tel:${p.contactTelephone.replace(/\s/g, '')}`, externe: false });
    }
    if (p.contactWhatsapp) {
      const chiffres = p.contactWhatsapp.replace(/\D/g, '');
      const lien = `https://wa.me/${chiffres.length === 9 ? '221' + chiffres : chiffres}`;
      liste.push({ icone: 'whatsapp', libelle: 'WhatsApp', valeur: p.contactWhatsapp, lien, externe: true });
    }
    if (p.contactEmail) {
      liste.push({ icone: 'email', libelle: 'Email', valeur: p.contactEmail, lien: `mailto:${p.contactEmail}`, externe: false });
    }
    if (p.contactAdresse) {
      liste.push({ icone: 'lieu', libelle: 'Adresse', valeur: p.contactAdresse, lien: null, externe: false });
    }
    if (p.contactHoraires) {
      liste.push({ icone: 'horloge', libelle: 'Horaires', valeur: p.contactHoraires, lien: null, externe: false });
    }
    return liste;
  });

  constructor() {
    this.site.charger();
  }

  protected choisirSujet(sujet: string): void {
    this.formulaire.controls.sujet.setValue(sujet);
  }

  // Le champ est-il en erreur ET faut-il le montrer ?
  protected invalide(champ: 'nom' | 'telephone' | 'email' | 'sujet' | 'message'): boolean {
    return this.tente() && this.formulaire.controls[champ].invalid;
  }

  protected envoyer(): void {
    this.tente.set(true);
    this.erreur.set(null);
    if (this.formulaire.invalid) {
      return;
    }
    this.envoi.set(true);
    this.site
      .envoyerMessage(this.formulaire.getRawValue())
      // finalize ≈ un bloc finally : exécuté en cas de succès comme d'erreur.
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: () => this.envoye.set(true),
        error: (e: unknown) => this.erreur.set(messageErreur(e, "Le message n'a pas pu être envoyé. Réessayez.")),
      });
  }

  protected nouveauMessage(): void {
    this.formulaire.reset();
    this.tente.set(false);
    this.envoye.set(false);
  }
}
