import { Routes } from '@angular/router';

import { inviteGuard, roleGuard } from './auth/guards';
import { Login } from './auth/login/login';
import { Shell } from './layout/shell';

// La table URL → écran (≈ les @RequestMapping des contrôleurs, côté front).
//
// loadComponent : CHARGEMENT PARESSEUX. Le code d'un écran n'est téléchargé
// qu'à sa première ouverture (un membre ne télécharge jamais les écrans admin).
// () => import('…') = « va chercher ce fichier plus tard », puis .then(m => m.X)
// prend la classe X dans le fichier reçu.
export const routes: Routes = [
  // URL vide (localhost:4200/) : la vitrine publique.
  // pathMatch 'full' = seulement si l'URL est EXACTEMENT vide (sinon toutes
  // les URL commenceraient par "" et afficheraient la vitrine).
  {
    path: '',
    pathMatch: 'full',
    title: 'SamaNatteu · La tontine, enfin sereine',
    loadComponent: () => import('./public/accueil/accueil-public').then((m) => m.AccueilPublic),
  },

  // Les pages publiques de la vitrine : leur contenu (coordonnées, textes)
  // est piloté par l'ADMIN depuis son back-office (GET /site).
  {
    path: 'contact',
    title: 'Contact · SamaNatteu',
    loadComponent: () => import('./public/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'a-propos',
    title: 'À propos · SamaNatteu',
    loadComponent: () => import('./public/a-propos/a-propos').then((m) => m.APropos),
  },

  // ---------- Pages publiques ----------
  // inviteGuard : un utilisateur déjà connecté est renvoyé vers son tableau de bord.
  { path: 'connexion', component: Login, canActivate: [inviteGuard], title: 'Connexion · SamaNatteu' },
  {
    path: 'inscription',
    canActivate: [inviteGuard],
    title: 'Créer un compte · SamaNatteu',
    loadComponent: () => import('./auth/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'mot-de-passe-oublie',
    canActivate: [inviteGuard],
    title: 'Mot de passe oublié · SamaNatteu',
    loadComponent: () => import('./auth/mot-de-passe-oublie/mot-de-passe-oublie').then((m) => m.MotDePasseOublie),
  },
  {
    path: 'rejoindre/:token',
    title: 'Invitation · SamaNatteu',
    loadComponent: () => import('./auth/rejoindre/rejoindre').then((m) => m.Rejoindre),
  },

  // ---------- Administrateur de la plateforme ----------
  // La coquille (menu + barre) est le parent ; chaque écran est un enfant
  // affiché dans son <router-outlet />. Le guard protège TOUS les enfants.
  {
    path: 'admin',
    component: Shell,
    canActivate: [roleGuard('ADMIN')],
    children: [
      {
        path: '',
        title: "Vue d'ensemble · SamaNatteu",
        loadComponent: () => import('./admin/vue-ensemble/vue-ensemble').then((m) => m.VueEnsemble),
      },
      {
        path: 'utilisateurs',
        title: 'Utilisateurs · SamaNatteu',
        loadComponent: () => import('./admin/utilisateurs/utilisateurs').then((m) => m.Utilisateurs),
      },
      {
        path: 'gestionnaires/:id',
        title: 'Fiche gestionnaire · SamaNatteu',
        loadComponent: () =>
          import('./admin/fiche-gestionnaire/fiche-gestionnaire').then((m) => m.FicheGestionnairePage),
      },
      {
        path: 'formules',
        title: 'Formules · SamaNatteu',
        loadComponent: () => import('./admin/formules/formules').then((m) => m.Formules),
      },
      {
        path: 'abonnements',
        title: 'Abonnements · SamaNatteu',
        loadComponent: () => import('./admin/abonnements/abonnements').then((m) => m.Abonnements),
      },
      {
        path: 'site',
        title: 'Site public · SamaNatteu',
        loadComponent: () => import('./admin/site/site').then((m) => m.Site),
      },
      {
        path: 'messages',
        title: 'Messages · SamaNatteu',
        loadComponent: () => import('./admin/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'profil',
        title: 'Mon profil · SamaNatteu',
        loadComponent: () => import('./commun/profil/profil').then((m) => m.Profil),
      },
    ],
  },

  // ---------- Gestionnaire de tontines ----------
  {
    path: 'gestionnaire',
    component: Shell,
    canActivate: [roleGuard('GESTIONNAIRE')],
    children: [
      {
        path: '',
        title: 'Tableau de bord · SamaNatteu',
        loadComponent: () =>
          import('./gestionnaire/tableau-de-bord/tableau-de-bord').then((m) => m.TableauDeBordGestionnaire),
      },
      {
        path: 'tontines',
        title: 'Mes tontines · SamaNatteu',
        loadComponent: () => import('./gestionnaire/tontines/tontines').then((m) => m.Tontines),
      },
      {
        // :id = un paramètre de chemin (≈ @PathVariable Long id).
        path: 'tontines/:id',
        title: 'Tontine · SamaNatteu',
        loadComponent: () => import('./gestionnaire/tontine-detail/tontine-detail').then((m) => m.TontineDetail),
      },
      {
        path: 'prets',
        title: 'Prêts · SamaNatteu',
        loadComponent: () => import('./gestionnaire/prets/prets').then((m) => m.Prets),
      },
      {
        path: 'journal',
        title: 'Journal · SamaNatteu',
        loadComponent: () => import('./commun/journal/journal').then((m) => m.Journal),
      },
      {
        path: 'notifications',
        title: 'Notifications · SamaNatteu',
        loadComponent: () => import('./commun/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'abonnement',
        title: 'Mon abonnement · SamaNatteu',
        loadComponent: () => import('./gestionnaire/abonnement/mon-abonnement').then((m) => m.MonAbonnement),
      },
      {
        path: 'profil',
        title: 'Mon profil · SamaNatteu',
        loadComponent: () => import('./commun/profil/profil').then((m) => m.Profil),
      },
    ],
  },

  // ---------- Membre ----------
  {
    path: 'membre',
    component: Shell,
    canActivate: [roleGuard('MEMBRE')],
    children: [
      {
        path: '',
        title: 'Accueil · SamaNatteu',
        loadComponent: () => import('./membre/accueil/accueil').then((m) => m.AccueilMembre),
      },
      {
        path: 'tontines',
        title: 'Mes tontines · SamaNatteu',
        loadComponent: () => import('./membre/mes-tontines/mes-tontines').then((m) => m.MesTontines),
      },
      {
        path: 'historique',
        title: 'Historique · SamaNatteu',
        loadComponent: () => import('./commun/journal/journal').then((m) => m.Journal),
      },
      {
        path: 'notifications',
        title: 'Notifications · SamaNatteu',
        loadComponent: () => import('./commun/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'profil',
        title: 'Mon profil · SamaNatteu',
        loadComponent: () => import('./commun/profil/profil').then((m) => m.Profil),
      },
    ],
  },

  // Une URL inconnue : retour à la vitrine.
  { path: '**', redirectTo: '' },
];
