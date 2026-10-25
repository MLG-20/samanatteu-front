import { HttpErrorResponse } from '@angular/common/http';

// Les textes affichés pour chaque valeur d'enum, et la « tonalité » de couleur
// de son badge. Un seul endroit : le jour où « EN_RETARD » devient « En retard
// de paiement », on change une ligne.
//
// Record<string, X> ≈ Map<String, X> en Java, écrit comme un objet littéral.

export type Tonalite = 'succes' | 'attention' | 'danger' | 'info' | 'neutre' | 'primaire';

export interface Libelle {
  texte: string;
  tonalite: Tonalite;
}

const STATUTS: Record<string, Libelle> = {
  // Tontines
  'tontine.EN_ATTENTE': { texte: 'En préparation', tonalite: 'neutre' },
  'tontine.ACTIVE': { texte: 'Active', tonalite: 'succes' },
  'tontine.SUSPENDUE': { texte: 'Suspendue', tonalite: 'attention' },
  'tontine.TERMINEE': { texte: 'Terminée', tonalite: 'info' },
  // Cycles
  'cycle.EN_ATTENTE': { texte: 'À venir', tonalite: 'neutre' },
  'cycle.EN_COURS': { texte: 'En cours', tonalite: 'primaire' },
  'cycle.CLOTURE': { texte: 'Clôturé', tonalite: 'info' },
  // Participations
  'participation.ACTIF': { texte: 'Actif', tonalite: 'succes' },
  'participation.SUSPENDU': { texte: 'Suspendu', tonalite: 'attention' },
  'participation.SORTI': { texte: 'Sorti', tonalite: 'neutre' },
  // Cotisations
  'cotisation.EN_ATTENTE': { texte: 'À payer', tonalite: 'neutre' },
  'cotisation.PARTIEL': { texte: 'Partielle', tonalite: 'attention' },
  'cotisation.COMPLET': { texte: 'Payée', tonalite: 'succes' },
  'cotisation.EN_RETARD': { texte: 'En retard', tonalite: 'danger' },
  // Tirages
  'tirage.EN_ATTENTE': { texte: 'À verser', tonalite: 'attention' },
  'tirage.PARTIEL': { texte: 'Versé en partie', tonalite: 'attention' },
  'tirage.VERSE': { texte: 'Versé', tonalite: 'succes' },
  'tirage.REPORTE': { texte: 'Reporté', tonalite: 'neutre' },
  // Prêts et échéances
  'pret.ACTIF': { texte: 'En cours', tonalite: 'primaire' },
  'pret.EN_RETARD': { texte: 'En retard', tonalite: 'danger' },
  'pret.REMBOURSE': { texte: 'Remboursé', tonalite: 'succes' },
  'echeance.EN_ATTENTE': { texte: 'À venir', tonalite: 'neutre' },
  'echeance.PAYE': { texte: 'Payée', tonalite: 'succes' },
  'echeance.EN_RETARD': { texte: 'En retard', tonalite: 'danger' },
  // Invitations et imports
  'invitation.EN_ATTENTE': { texte: 'En attente', tonalite: 'attention' },
  'invitation.ACCEPTE': { texte: 'Acceptée', tonalite: 'succes' },
  'invitation.EXPIRE': { texte: 'Expirée', tonalite: 'neutre' },
  'invitation.ANNULEE': { texte: 'Annulée', tonalite: 'neutre' },
  'import.EN_COURS': { texte: 'En cours', tonalite: 'primaire' },
  'import.TERMINE': { texte: 'Terminé', tonalite: 'succes' },
  'import.ECHEC': { texte: 'Échec', tonalite: 'danger' },
  // Abonnements
  'abonnement.ESSAI': { texte: 'Essai gratuit', tonalite: 'info' },
  'abonnement.ACTIF': { texte: 'Actif', tonalite: 'succes' },
  // Pas des statuts du backend : des ÉTATS calculés par etatAbonnement() (la
  // fin de période se déduit de la date, comme Abonnement.estActif() en Java).
  'abonnement.ESSAI_TERMINE': { texte: 'Essai terminé', tonalite: 'attention' },
  'abonnement.EXPIRE': { texte: 'Expiré', tonalite: 'neutre' },
  'abonnement.SUSPENDU': { texte: 'Suspendu', tonalite: 'attention' },
  'abonnement.RESILIE': { texte: 'Résilié', tonalite: 'neutre' },
  // Rôles
  'role.ADMIN': { texte: 'Administrateur', tonalite: 'info' },
  'role.GESTIONNAIRE': { texte: 'Gestionnaire', tonalite: 'primaire' },
  'role.MEMBRE': { texte: 'Membre', tonalite: 'neutre' },
  // Notifications
  'notification.EN_ATTENTE': { texte: 'En attente', tonalite: 'neutre' },
  'notification.ENVOYE': { texte: 'Envoyée', tonalite: 'succes' },
  'notification.ECHEC': { texte: 'Échec', tonalite: 'danger' },
};

// Ce qu'on affiche d'un abonnement : le statut ne suffit pas, car un ACTIF ou un
// ESSAI dont la date de fin est passée ne donne plus accès (actif = false, calculé
// par le backend). Un seul endroit pour cette règle, lu par les trois écrans.
export function etatAbonnement(a: { statut: string; actif: boolean }): string {
  if (a.statut === 'ESSAI') {
    return a.actif ? 'ESSAI' : 'ESSAI_TERMINE';
  }
  if (a.statut === 'ACTIF') {
    return a.actif ? 'ACTIF' : 'EXPIRE';
  }
  return a.statut; // SUSPENDU, RESILIE : une décision de la plateforme
}

// Le libellé d'un statut, ex. libelle('tontine', 'ACTIVE') → { texte: 'Active', … }.
// Valeur inconnue (enum ajouté côté Java) : on affiche la valeur brute plutôt que de planter.
export function libelle(domaine: string, valeur: string | null | undefined): Libelle {
  if (!valeur) {
    return { texte: '—', tonalite: 'neutre' };
  }
  return STATUTS[`${domaine}.${valeur}`] ?? { texte: valeur, tonalite: 'neutre' };
}

export const MODES_PAIEMENT: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE: 'Orange Money',
  FREE: 'Free Money',
};

export const TYPES_TRANSACTION: Record<string, string> = {
  COTISATION: 'Cotisation',
  GAIN: 'Gain de tirage',
  PRET: 'Prêt',
  REMBOURSEMENT: 'Remboursement',
  PENALITE: 'Pénalité',
};

export const FREQUENCES: Record<string, { un: string; plusieurs: string }> = {
  JOUR: { un: 'jour', plusieurs: 'jours' },
  SEMAINE: { un: 'semaine', plusieurs: 'semaines' },
  MOIS: { un: 'mois', plusieurs: 'mois' },
};

// « Toutes les 2 semaines », « Chaque mois »…
export function rythme(frequence: string, intervalle: number): string {
  const f = FREQUENCES[frequence];
  if (!f) {
    return frequence;
  }
  if (intervalle <= 1) {
    return frequence === 'SEMAINE' ? 'Chaque semaine' : `Chaque ${f.un}`;
  }
  const toutes = frequence === 'MOIS' || frequence === 'JOUR' ? 'Tous les' : 'Toutes les';
  return `${toutes} ${intervalle} ${f.plusieurs}`;
}

// Le message lisible d'une erreur HTTP. Le backend renvoie soit une chaîne
// (SamanatteuException), soit une Map champ → message (validation @Valid).
// `unknown` = « type pas encore vérifié » (plus sûr que `any`) : on teste
// avant de lire, comme un `instanceof` Java.
export function messageErreur(erreur: unknown, parDefaut = 'Une erreur est survenue. Réessayez.'): string {
  if (!(erreur instanceof HttpErrorResponse)) {
    return parDefaut;
  }
  if (erreur.status === 0) {
    return 'Serveur injoignable. Vérifiez votre connexion.';
  }
  const corps = erreur.error;
  if (typeof corps === 'string' && corps.trim() && !corps.trim().startsWith('<')) {
    return corps;
  }
  if (corps && typeof corps === 'object') {
    // Object.values ≈ map.values() : les messages des champs fautifs.
    const messages = Object.values(corps).filter((m) => typeof m === 'string');
    if (messages.length) {
      return messages.join(' · ');
    }
  }
  if (erreur.status === 403) {
    return "Vous n'avez pas le droit de faire cette action.";
  }
  if (erreur.status === 404) {
    return 'Élément introuvable.';
  }
  return parDefaut;
}
