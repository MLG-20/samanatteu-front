import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { SiteApi } from '../../api/site.api';
import { DateHeurePipe, DateRelativePipe, initiales } from '../../core/formatage';
import { messageErreur } from '../../core/libelles';
import { MessageContact } from '../../core/modeles';
import { ConfirmationService } from '../../ui/confirmation';
import { EtatVide } from '../../ui/etat-vide';
import { Icone } from '../../ui/icone';
import { Modale } from '../../ui/modale';
import { ToastService } from '../../ui/notifications-ui';

type Filtre = 'tous' | 'nonLus' | 'lus';

/**
 * Les messages reçus par le formulaire de la page Contact.
 * Ouvrir un message le marque lu ; on peut le remettre « non lu » (à traiter
 * plus tard), répondre (email, appel, WhatsApp) ou le supprimer.
 */
@Component({
  selector: 'app-messages',
  imports: [Icone, Modale, EtatVide, DateRelativePipe, DateHeurePipe],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages {
  private readonly api = inject(SiteApi);
  private readonly toasts = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly initiales = initiales;

  protected readonly liste = signal<MessageContact[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly filtre = signal<Filtre>('tous');
  protected readonly ouvert = signal<MessageContact | null>(null);

  protected readonly nbNonLus = computed(() => this.liste().filter((m) => !m.lu).length);
  protected readonly visibles = computed(() => {
    const f = this.filtre();
    return this.liste().filter((m) => f === 'tous' || (f === 'nonLus' ? !m.lu : m.lu));
  });

  constructor() {
    this.api
      .messages()
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (l) => this.liste.set(l),
        error: (e: unknown) => this.erreur.set(messageErreur(e)),
      });
  }

  // Le prénom et le nom ne sont pas séparés : on prend les deux premiers mots.
  protected avatar(nom: string): string {
    const [a, b] = nom.trim().split(/\s+/);
    return initiales(a, b);
  }

  // Ouvrir = lire : le message passe « lu » tout seul.
  protected ouvrir(m: MessageContact): void {
    this.ouvert.set(m);
    if (!m.lu) {
      this.changerLu(m, true, false);
    }
  }

  protected changerLu(m: MessageContact, lu: boolean, annoncer = true): void {
    this.api.marquerLu(m.id, lu).subscribe({
      next: (maj) => {
        this.liste.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        if (this.ouvert()?.id === maj.id) {
          this.ouvert.set(maj);
        }
        if (annoncer) {
          this.toasts.succes(lu ? 'Message marqué comme lu.' : 'Message remis en « non lu ».');
        }
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
    });
  }

  protected async supprimer(m: MessageContact): Promise<void> {
    const oui = await this.confirmation.demander({
      titre: 'Supprimer ce message ?',
      message: `Le message de ${m.nom} (« ${m.sujet} ») sera définitivement supprimé.`,
      bouton: 'Supprimer',
      danger: true,
    });
    if (!oui) {
      return;
    }
    this.api.supprimerMessage(m.id).subscribe({
      next: () => {
        this.liste.update((l) => l.filter((x) => x.id !== m.id));
        this.ouvert.set(null);
        this.toasts.succes('Message supprimé.');
      },
      error: (e: unknown) => this.toasts.erreur(messageErreur(e)),
    });
  }

  // ---------- Les liens pour répondre ----------

  protected lienEmail(m: MessageContact): string {
    return `mailto:${m.email}?subject=${encodeURIComponent('Re : ' + m.sujet)}`;
  }

  protected lienTel(m: MessageContact): string {
    return `tel:${(m.telephone ?? '').replace(/\s/g, '')}`;
  }

  protected lienWhatsapp(m: MessageContact): string {
    const chiffres = (m.telephone ?? '').replace(/\D/g, '');
    return `https://wa.me/${chiffres.length === 9 ? '221' + chiffres : chiffres}`;
  }
}
