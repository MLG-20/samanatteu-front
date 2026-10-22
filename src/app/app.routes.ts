import { Routes } from '@angular/router';

import { Login } from './auth/login/login';
import { DashboardAdmin } from './dashboard/dashboard-admin/dashboard-admin';
import { DashboardGestionnaire } from './dashboard/dashboard-gestionnaire/dashboard-gestionnaire';
import { DashboardMembre } from './dashboard/dashboard-membre/dashboard-membre';

export const routes: Routes = [
    // URL vide (localhost:4200/) : on renvoie vers la page de connexion.
  // pathMatch 'full' = seulement si l'URL est EXACTEMENT vide (sinon
  // toutes les URL commenceraient par "" et seraient redirigées).
  {path: '', redirectTo: 'connexion', pathMatch: 'full'},

  // localhost:4200/connexion affiche le composant Login.
  {path: 'connexion', component: Login},

  // Une page par rôle. Pour l'instant n'importe qui peut y aller en tapant
  // l'URL : les guards (contrôle par rôle) viendront après.
  {path: 'admin', component: DashboardAdmin},
  {path: 'gestionnaire', component: DashboardGestionnaire},
  {path: 'membre', component: DashboardMembre},
];
