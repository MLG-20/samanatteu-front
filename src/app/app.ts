import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Confirmation } from './ui/confirmation';
import { Toasts } from './ui/notifications-ui';

// Composant racine : le <router-outlet /> (chaque écran est un composant
// affiché par le routeur), plus les toasts et la confirmation, communs à tous.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirmation],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
