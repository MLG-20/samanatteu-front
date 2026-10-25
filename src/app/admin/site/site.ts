import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

import { SiteApi } from '../../api/site.api';
import { messageErreur } from '../../core/libelles';
import { ParametreSite } from '../../core/modeles';
import { Icone, NomIcone } from '../../ui/icone';
import { ToastService } from '../../ui/notifications-ui';

type Onglet = 'reseaux' | 'contact' | 'apropos';
type ChampReseau = 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'linkedin' | 'youtube' | 'x';
type ChampTexte = 'aproposHistoire' | 'aproposMission' | 'aproposValeurs';

// Une URL https, ou rien (même règle que le backend : pas de lien javascript:).
const URL_HTTPS = /^$|^https:\/\/\S+$/;
const NUMERO = /^$|^\+?[0-9 ]{6,20}$/;

/**
 * Le site public, piloté par l'ADMIN : les réseaux sociaux (footer), les
 * coordonnées (page Contact) et les textes de la page À propos.
 * Un seul formulaire, un seul PUT /site : on enregistre les trois onglets ensemble.
 */
@Component({
  selector: 'app-site',
  imports: [ReactiveFormsModule, Icone],
  templateUrl: './site.html',
  styleUrl: './site.css',
})
export class Site {
  private readonly site = inject(SiteApi);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);

  protected readonly onglet = signal<Onglet>('reseaux');
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly envoi = signal(false);
  protected readonly maxTexte = 5000;

  // Les réseaux, dans l'ordre du footer : de quoi construire les 7 lignes.
  protected readonly reseaux: { champ: ChampReseau; nom: string; icone: NomIcone; exemple: string }[] = [
    { champ: 'facebook', nom: 'Facebook', icone: 'facebook', exemple: 'https://facebook.com/samanatteu' },
    { champ: 'instagram', nom: 'Instagram', icone: 'instagram', exemple: 'https://instagram.com/samanatteu' },
    { champ: 'tiktok', nom: 'TikTok', icone: 'tiktok', exemple: 'https://tiktok.com/@samanatteu' },
    { champ: 'whatsapp', nom: 'WhatsApp', icone: 'whatsapp', exemple: 'https://whatsapp.com/channel/…' },
    { champ: 'linkedin', nom: 'LinkedIn', icone: 'linkedin', exemple: 'https://linkedin.com/company/samanatteu' },
    { champ: 'youtube', nom: 'YouTube', icone: 'youtube', exemple: 'https://youtube.com/@samanatteu' },
    { champ: 'x', nom: 'X', icone: 'x', exemple: 'https://x.com/samanatteu' },
  ];

  // Les trois blocs de la page À propos, dans l'ordre de la page.
  protected readonly blocsApropos: { champ: ChampTexte; titre: string; icone: NomIcone }[] = [
    { champ: 'aproposHistoire', titre: 'Notre histoire', icone: 'drapeau' },
    { champ: 'aproposMission', titre: 'Notre mission', icone: 'etincelle' },
    { champ: 'aproposValeurs', titre: 'Nos valeurs', icone: 'bouclier' },
  ];

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    facebook: ['', Validators.pattern(URL_HTTPS)],
    instagram: ['', Validators.pattern(URL_HTTPS)],
    tiktok: ['', Validators.pattern(URL_HTTPS)],
    whatsapp: ['', Validators.pattern(URL_HTTPS)],
    linkedin: ['', Validators.pattern(URL_HTTPS)],
    youtube: ['', Validators.pattern(URL_HTTPS)],
    x: ['', Validators.pattern(URL_HTTPS)],
    contactTelephone: ['', Validators.pattern(NUMERO)],
    contactWhatsapp: ['', Validators.pattern(NUMERO)],
    contactEmail: ['', [Validators.email, Validators.maxLength(255)]],
    contactAdresse: ['', Validators.maxLength(255)],
    contactHoraires: ['', Validators.maxLength(255)],
    aproposAccroche: ['', Validators.maxLength(255)],
    aproposHistoire: ['', Validators.maxLength(this.maxTexte)],
    aproposMission: ['', Validators.maxLength(this.maxTexte)],
    aproposValeurs: ['', Validators.maxLength(this.maxTexte)],
  });

  // Les valeurs en direct (pour l'aperçu des réseaux et les compteurs).
  private readonly valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.getRawValue() });

  // Les réseaux remplis : c'est ce que le footer affichera.
  protected readonly apercu = computed(() => this.reseaux.filter((r) => !!this.valeurs()[r.champ]?.trim()));

  // Une erreur dans un onglet ? Une pastille rouge sur cet onglet.
  protected readonly ongletsEnErreur = computed(() => {
    this.valeurs(); // relire à chaque frappe
    const c = this.formulaire.controls;
    return {
      reseaux: this.reseaux.some((r) => c[r.champ].invalid),
      contact: c.contactTelephone.invalid || c.contactWhatsapp.invalid || c.contactEmail.invalid || c.contactAdresse.invalid || c.contactHoraires.invalid,
      apropos: c.aproposAccroche.invalid || c.aproposHistoire.invalid || c.aproposMission.invalid || c.aproposValeurs.invalid,
    };
  });

  constructor() {
    // Lecture FRAÎCHE (pas le cache du site public) : l'ADMIN doit voir l'état réel.
    this.http
      .get<ParametreSite>('/site')
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (p) => this.remplir(p),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // null (en base) → '' (dans le champ) : un input n'affiche pas null.
  private remplir(p: ParametreSite): void {
    const vide = Object.fromEntries(Object.entries(p).map(([cle, valeur]) => [cle, valeur ?? '']));
    this.formulaire.reset(vide);
  }

  protected compte(champ: ChampTexte): number {
    return this.valeurs()[champ]?.length ?? 0;
  }

  protected invalide(champ: keyof typeof this.formulaire.controls): boolean {
    const c = this.formulaire.controls[champ];
    return c.invalid && (c.touched || c.dirty);
  }

  protected enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.toasts.erreur('Corrigez les champs en rouge avant d’enregistrer.');
      // On ouvre le premier onglet qui contient une erreur.
      const e = this.ongletsEnErreur();
      this.onglet.set(e.reseaux ? 'reseaux' : e.contact ? 'contact' : 'apropos');
      return;
    }
    this.envoi.set(true);
    this.site
      // Le formulaire a exactement les champs de ParametreSite ('' = effacé).
      .modifier(this.formulaire.getRawValue() as unknown as ParametreSite)
      .pipe(finalize(() => this.envoi.set(false)))
      .subscribe({
        next: (p) => {
          this.remplir(p);
          this.toasts.succes('Le site public est à jour.');
        },
        error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
      });
  }

  protected annuler(): void {
    this.chargement.set(true);
    this.http
      .get<ParametreSite>('/site')
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({ next: (p) => this.remplir(p) });
  }
}
