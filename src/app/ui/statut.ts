import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { libelle } from '../core/libelles';

// Le badge d'un statut : <app-statut domaine="tontine" [valeur]="t.statut" />
// → une pastille colorée + le texte (la couleur seule ne porte jamais le sens).
@Component({
  selector: 'app-statut',
  template: `<span class="badge" [class]="'badge badge-' + info().tonalite">{{ info().texte }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statut {
  readonly domaine = input.required<string>();
  readonly valeur = input<string | null | undefined>(null);
  protected readonly info = computed(() => libelle(this.domaine(), this.valeur()));
}
