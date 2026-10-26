import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SiteApi } from '../../api/site.api';
import { Icone, NomIcone } from '../../ui/icone';

interface Reseau {
  nom: string;
  icone: NomIcone;
  url: string;
}

/**
 * Le pied de page des pages publiques (accueil, contact, à propos).
 *
 * Les réseaux sociaux et les coordonnées viennent de GET /site : l'ADMIN les
 * change depuis son back-office, le footer suit. Un réseau sans URL n'a pas
 * d'icône ; une coordonnée vide n'a pas de ligne.
 */
@Component({
  selector: 'app-pied-public',
  imports: [RouterLink, Icone],
  templateUrl: './pied-public.html',
  styleUrl: './pied-public.css',
})
export class PiedPublic {
  private readonly site = inject(SiteApi);
  protected readonly parametres = this.site.parametres;
  protected readonly annee = new Date().getFullYear();

  constructor() {
    // Une seule requête pour tout le site public (le résultat est partagé).
    this.site.charger();
  }

  // Les réseaux renseignés, dans un ordre fixe.
  protected readonly reseaux = computed<Reseau[]>(() => {
    const p = this.parametres();
    if (!p) {
      return [];
    }
    const tous: (Reseau | null)[] = [
      p.facebook ? { nom: 'Facebook', icone: 'facebook', url: p.facebook } : null,
      p.instagram ? { nom: 'Instagram', icone: 'instagram', url: p.instagram } : null,
      p.tiktok ? { nom: 'TikTok', icone: 'tiktok', url: p.tiktok } : null,
      p.whatsapp ? { nom: 'WhatsApp', icone: 'whatsapp', url: p.whatsapp } : null,
      p.linkedin ? { nom: 'LinkedIn', icone: 'linkedin', url: p.linkedin } : null,
      p.youtube ? { nom: 'YouTube', icone: 'youtube', url: p.youtube } : null,
      p.x ? { nom: 'X', icone: 'x', url: p.x } : null,
    ];
    // filter avec un « type guard » : TypeScript sait ensuite qu'il n'y a plus de null.
    return tous.filter((r): r is Reseau => r !== null);
  });

  // « +221 77 123 45 67 » → « tel:+221771234567 » (le lien qui lance l'appel).
  protected lienTel(numero: string): string {
    return `tel:${numero.replace(/\s/g, '')}`;
  }

  // Le message déjà tapé quand la conversation s'ouvre (le visiteur n'a qu'à envoyer).
  protected readonly messageWhatsapp = 'Bonjour SamaNatteu, j’ai une question sur votre application de tontine.';

  // wa.me veut le numéro international, sans + ni espaces. Un numéro local
  // sénégalais (9 chiffres) reçoit l'indicatif 221. ?text= pré-remplit le
  // message ; encodeURIComponent ≈ URLEncoder.encode (espaces, accents…).
  protected lienWhatsapp(numero: string, message?: string): string {
    const chiffres = numero.replace(/\D/g, '');
    const lien = `https://wa.me/${chiffres.length === 9 ? '221' + chiffres : chiffres}`;
    return message ? `${lien}?text=${encodeURIComponent(message)}` : lien;
  }
}
