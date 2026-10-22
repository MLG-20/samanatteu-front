import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Composant racine : il ne contient que le <router-outlet />, chaque écran
// (connexion, tableaux de bord...) est un composant affiché par le routeur.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
