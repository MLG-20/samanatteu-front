import { Pipe, PipeTransform } from '@angular/core';

// Un PIPE transforme une valeur pour l'affichage, dans le template :
//   {{ 125000 | fcfa }}  →  « 125 000 FCFA »
// ≈ un formateur Java (NumberFormat) qu'on applique avec le caractère « | ».
// `pure` (par défaut) : Angular ne le recalcule que si la valeur change.

// Intl = l'API de formatage du navigateur (≈ java.text.NumberFormat avec un Locale).
const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_HEURE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function fcfa(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) {
    return '—';
  }
  // Intl sépare les milliers par une espace insécable fine : on garde, c'est la norme française.
  return `${NOMBRE.format(montant)} FCFA`;
}

// Un « 2026-10-24 » (LocalDate) lu en date LOCALE : new Date('2026-10-24') le
// lirait en UTC, et afficherait le 23 à Dakar… (UTC+0 ici, mais pas ailleurs).
function versDate(valeur: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? new Date(`${valeur}T00:00:00`) : new Date(valeur);
}

export function dateCourte(valeur: string | null | undefined): string {
  return valeur ? DATE_COURTE.format(versDate(valeur)) : '—';
}

export function dateHeure(valeur: string | null | undefined): string {
  return valeur ? DATE_HEURE.format(versDate(valeur)) : '—';
}

// « dans 3 jours », « il y a 2 jours », « aujourd'hui ».
const RELATIF = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
export function dateRelative(valeur: string | null | undefined): string {
  if (!valeur) {
    return '—';
  }
  const jour = 24 * 60 * 60 * 1000;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const cible = versDate(valeur);
  cible.setHours(0, 0, 0, 0);
  const ecart = Math.round((cible.getTime() - aujourdhui.getTime()) / jour);
  return RELATIF.format(ecart, 'day');
}

// La part (0 à 100) d'un montant sur un total, bornée : jamais de barre à 130 %.
export function pourcentage(partie: number | null | undefined, total: number | null | undefined): number {
  if (!total || !partie) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((partie / total) * 100)));
}

// Les initiales pour l'avatar : « Fatou Ndiaye » → « FN ».
export function initiales(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${(prenom ?? '').charAt(0)}${(nom ?? '').charAt(0)}`.toUpperCase() || '?';
}

// Une teinte d'avatar stable par personne (0 à 4) : la même couleur à chaque visite.
export function teinteAvatar(id: number | null | undefined): number {
  return Math.abs(id ?? 0) % 5;
}

// ---------- Les pipes (les mêmes fonctions, utilisables dans le HTML) ----------

@Pipe({ name: 'fcfa' })
export class FcfaPipe implements PipeTransform {
  transform(montant: number | null | undefined): string {
    return fcfa(montant);
  }
}

@Pipe({ name: 'dateCourte' })
export class DateCourtePipe implements PipeTransform {
  transform(valeur: string | null | undefined): string {
    return dateCourte(valeur);
  }
}

@Pipe({ name: 'dateHeure' })
export class DateHeurePipe implements PipeTransform {
  transform(valeur: string | null | undefined): string {
    return dateHeure(valeur);
  }
}

@Pipe({ name: 'dateRelative' })
export class DateRelativePipe implements PipeTransform {
  transform(valeur: string | null | undefined): string {
    return dateRelative(valeur);
  }
}
