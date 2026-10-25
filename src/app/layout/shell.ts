import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../auth/auth.service';
import { initiales, teinteAvatar } from '../core/formatage';
import { libelle } from '../core/libelles';
import { Role } from '../core/modeles';
import { ThemeService } from '../core/theme.service';
import { Icone, NomIcone } from '../ui/icone';

interface Lien {
  libelle: string;
  icone: NomIcone;
  chemin: string;
  exact?: boolean; // vrai pour l'accueil : sinon il resterait allumé sur toutes les sous-pages
}

// Le menu de chaque rôle. Record<Role, …> : un rôle sans menu ne compile pas.
const MENUS: Record<Role, { section: string; liens: Lien[] }[]> = {
  ADMIN: [
    {
      section: 'Plateforme',
      liens: [
        { libelle: "Vue d'ensemble", icone: 'accueil', chemin: '/admin', exact: true },
        { libelle: 'Utilisateurs', icone: 'utilisateurs', chemin: '/admin/utilisateurs' },
      ],
    },
    {
      section: 'Offre',
      liens: [
        { libelle: 'Formules', icone: 'formules', chemin: '/admin/formules' },
        { libelle: 'Abonnements', icone: 'carte', chemin: '/admin/abonnements' },
      ],
    },
    {
      section: 'Site public',
      liens: [
        { libelle: 'Site', icone: 'partager', chemin: '/admin/site' },
        { libelle: 'Messages', icone: 'message', chemin: '/admin/messages' },
      ],
    },
  ],
  GESTIONNAIRE: [
    {
      section: 'Pilotage',
      liens: [
        { libelle: 'Tableau de bord', icone: 'accueil', chemin: '/gestionnaire', exact: true },
        { libelle: 'Mes tontines', icone: 'tontine', chemin: '/gestionnaire/tontines' },
      ],
    },
    {
      section: 'Argent',
      liens: [
        { libelle: 'Prêts', icone: 'pret', chemin: '/gestionnaire/prets' },
        { libelle: 'Journal', icone: 'recu', chemin: '/gestionnaire/journal' },
      ],
    },
    {
      section: 'Compte',
      liens: [
        { libelle: 'Notifications', icone: 'cloche', chemin: '/gestionnaire/notifications' },
        { libelle: 'Mon abonnement', icone: 'carte', chemin: '/gestionnaire/abonnement' },
      ],
    },
  ],
  MEMBRE: [
    {
      section: 'Mon espace',
      liens: [
        { libelle: 'Accueil', icone: 'accueil', chemin: '/membre', exact: true },
        { libelle: 'Mes tontines', icone: 'tontine', chemin: '/membre/tontines' },
        { libelle: 'Historique', icone: 'recu', chemin: '/membre/historique' },
        { libelle: 'Notifications', icone: 'cloche', chemin: '/membre/notifications' },
      ],
    },
  ],
};

/**
 * La coquille des pages connectées : menu latéral + barre du haut + la page
 * (<router-outlet />). Les routes de chaque rôle sont ses « enfants ».
 * Sur téléphone, le menu devient un tiroir qui glisse depuis la gauche.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly tiroirOuvert = signal(false);
  protected readonly menuCompteOuvert = signal(false);

  protected readonly moi = this.auth.utilisateur;
  protected readonly menu = computed(() => {
    const role = this.moi()?.role;
    return role ? MENUS[role] : [];
  });
  protected readonly racine = computed(() => `/${(this.moi()?.role ?? 'membre').toLowerCase()}`);
  protected readonly initiales = computed(() => initiales(this.moi()?.prenom, this.moi()?.nom));
  protected readonly teinte = computed(() => teinteAvatar(this.moi()?.id));
  protected readonly libelleRole = computed(() => libelle('role', this.moi()?.role).texte);

  // Le salut change avec l'heure (petit détail qui fait « produit soigné »).
  protected readonly salut = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  constructor() {
    // À chaque changement de page : on referme le tiroir et le menu du compte.
    // On ne garde que les NavigationEnd (= « la nouvelle page est affichée »).
    // takeUntilDestroyed : l'abonnement s'arrête tout seul quand la coquille
    // disparaît (déconnexion) — sinon il vivrait pour rien en mémoire.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.tiroirOuvert.set(false);
      this.menuCompteOuvert.set(false);
    });
  }

  protected deconnecter(): void {
    this.auth.deconnecter().subscribe({
      complete: () => this.router.navigateByUrl('/connexion'),
    });
  }
}
