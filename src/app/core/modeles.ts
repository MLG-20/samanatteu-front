// Les formes des données échangées avec l'API : un `interface` TypeScript par
// DTO Java. Une interface ne produit AUCUN code JavaScript : elle n'existe qu'à
// la compilation, pour que l'IDE et `tsc` vérifient qu'on lit les bons champs.
//
//   Java : public class TontineDTO { private Long id; private String nom; }
//   TS   : export interface Tontine { id: number; nom: string; }
//
// Correspondances de types : Long/Integer/BigDecimal → number,
// LocalDate/LocalDateTime → string (ISO, ex. "2026-10-24"), enum → union de chaînes.

// ---------- Les enums Java, en unions de chaînes ----------
// 'A' | 'B' = « soit la chaîne A, soit la chaîne B » : une faute de frappe ne compile pas.

export type Role = 'ADMIN' | 'GESTIONNAIRE' | 'MEMBRE';
export type StatutTontine = 'EN_ATTENTE' | 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';
export type FrequenceTontine = 'JOUR' | 'SEMAINE' | 'MOIS';
export type StatutCycle = 'EN_ATTENTE' | 'EN_COURS' | 'CLOTURE';
export type StatutParticipation = 'ACTIF' | 'SUSPENDU' | 'SORTI';
export type StatutCotisation = 'EN_ATTENTE' | 'PARTIEL' | 'COMPLET' | 'EN_RETARD';
export type StatutTirage = 'EN_ATTENTE' | 'PARTIEL' | 'VERSE' | 'REPORTE';
export type StatutPret = 'ACTIF' | 'EN_RETARD' | 'REMBOURSE';
export type StatutEcheancePret = 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD';
export type ModePaiement = 'CASH' | 'WAVE' | 'ORANGE' | 'FREE';
export type TypeTransaction = 'COTISATION' | 'GAIN' | 'PRET' | 'REMBOURSEMENT' | 'PENALITE';
export type SensTransaction = 'ENTRANT' | 'SORTANT';
export type StatutInvitation = 'EN_ATTENTE' | 'ACCEPTE' | 'EXPIRE' | 'ANNULEE';
export type TypeInvitation = 'GROUPE' | 'INDIVIDUELLE';
export type StatutImportMembre = 'EN_COURS' | 'TERMINE' | 'ECHEC';
export type StatutAbonnement = 'ACTIF' | 'SUSPENDU' | 'RESILIE';
export type TypeNotification =
  | 'BIENVENUE'
  | 'INVITATION'
  | 'PAIEMENT_CONFIRME'
  | 'RESULTAT_TIRAGE'
  | 'RAPPEL_COTISATION'
  | 'RAPPEL_ECHEANCE';
export type CanalNotification = 'SMS' | 'EMAIL';
export type StatutNotification = 'EN_ATTENTE' | 'ENVOYE' | 'ECHEC';

// ---------- Utilisateurs ----------

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  role: Role;
  actif?: boolean;
  createdAt?: string;
}

export interface CreationUtilisateur {
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  motDePasse: string;
  role: Role;
}

export interface ModificationUtilisateur {
  nom: string;
  prenom: string;
  email: string | null;
}

// ---------- Tontines ----------

export interface Tontine {
  id: number;
  nom: string;
  montantPart: number;
  montantCaissePret: number;
  soldeCaissePret: number;
  frequence: FrequenceTontine;
  intervalle: number;
  nbCycles: number | null;
  description: string | null;
  jourCotisation: number | null;
  createdAt: string;
  updatedAt: string | null;
  statut: StatutTontine;
  gestionnaireId: number;
}

// Même corps pour la création et la modification (CreationTontineDTO = ModificationTontineDTO).
export interface SaisieTontine {
  nom: string;
  montantPart: number;
  montantCaissePret: number;
  frequence: FrequenceTontine;
  intervalle: number;
  description: string | null;
  jourCotisation: number | null;
}

export interface Participation {
  id: number;
  membreId: number;
  membrePrenom: string;
  membreNom: string;
  membreTelephone: string;
  tontineId: number;
  nombreParts: number;
  dateAdhesion: string;
  statut: StatutParticipation;
  ordreInscription: number;
}

export interface Cycle {
  id: number;
  tontineId: number;
  numeroCycle: number;
  dateDebut: string;
  dateFinPrevue: string;
  dateFinReelle: string | null;
  montantAttendu: number;
  montantCollecte: number;
  statut: StatutCycle;
  createdAt: string;
}

// ---------- Argent : cotisations, tirages, prêts, transactions ----------

export interface Cotisation {
  id: number;
  participationId: number;
  cycleId: number;
  montantDu: number;
  montantPaye: number;
  montantCaisseDu: number;
  montantCaissePaye: number;
  datePaiement: string | null;
  modePaiement: ModePaiement | null;
  reference: string | null;
  statut: StatutCotisation;
  createdAt: string;
}

export interface Paiement {
  montant: number;
  modePaiement: ModePaiement;
  reference: string | null;
}

export interface Tirage {
  id: number;
  cycleId: number;
  participationId: number;
  montantGagne: number;
  montantVerse: number;
  dateTirage: string;
  dateVersement: string | null;
  statut: StatutTirage;
  createdAt: string;
}

export interface Pret {
  id: number;
  membreId: number;
  tontineId: number;
  gestionnaireId: number;
  montant: number;
  tauxInteret: number | null;
  montantInteret: number | null;
  nbEcheances: number;
  dateAccord: string;
  dateDebutRemboursement: string;
  statut: StatutPret;
  createdAt: string;
}

export interface DemandePret {
  membreId: number;
  montant: number;
  nbEcheances: number;
  dateDebutRemboursement: string;
  tauxInteret: number | null;
  montantInteret: number | null;
}

export interface EcheancePret {
  id: number;
  pretId: number;
  numeroEcheance: number;
  montantDu: number;
  montantPaye: number;
  dateEcheance: string;
  datePaiement: string | null;
  statut: StatutEcheancePret;
}

export interface Transaction {
  id: number;
  membreId: number;
  tontineId: number;
  type: TypeTransaction;
  montant: number;
  sens: SensTransaction;
  modePaiement: ModePaiement | null;
  reference: string | null;
  referenceId: number | null;
  description: string | null;
  dateTransaction: string;
  createdAt: string;
}

// ---------- Invitations, import, notifications ----------

export interface Invitation {
  id: number;
  tontineId: number;
  token: string;
  telephone: string | null;
  email: string | null;
  prenomPreRempli: string | null;
  nomPreRempli: string | null;
  nombreParts: number | null;
  expireAt: string;
  statut: StatutInvitation;
  type: TypeInvitation;
  createdAt: string;
}

export interface DemandeInvitation {
  telephone: string;
  prenom: string | null;
  nom: string | null;
  nombreParts: number;
}

// Ce que voit un visiteur qui ouvre un lien d'invitation (GET /invitation/{token}).
export interface LienInvitation {
  nomTontine: string;
  type: TypeInvitation;
  prenomPreRempli: string | null;
  nomPreRempli: string | null;
  telephone: string | null;
  expireAt: string;
}

export interface ImportMembre {
  id: number;
  tontineId: number;
  fichierNom: string;
  nbMembresTotal: number;
  nbImportes: number;
  nbErreurs: number;
  erreursDetail: string | null;
  statut: StatutImportMembre;
  createdAt: string;
}

export interface Notification {
  id: number;
  destinataireId: number;
  titre: string;
  message: string;
  type: TypeNotification;
  canal: CanalNotification;
  statut: StatutNotification;
  dateEnvoi: string | null;
  createdAt: string;
}

// ---------- Abonnements (formules et gestionnaires abonnés) ----------

export interface Formule {
  id: number | null;
  nom: string;
  nbTontinesMax: number;
  nbMembresMax: number;
  smsParMois: number;
  prixMensuel: number;
  active: boolean;
}

export interface Abonnement {
  id: number;
  utilisateurId: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  formuleId: number;
  formule: string;
  prixMensuel: number;
  statut: StatutAbonnement;
  actif: boolean;
  dateDebut: string;
  dateFin: string;
  nbTontinesMax: number;
  nbMembresMax: number;
  smsParMois: number;
  smsEnvoyesMois: number;
}

export interface ActivationAbonnement {
  utilisateurId: number;
  formuleId: number;
  dureeMois: number;
}

// ---------- Tableaux de bord ----------

export interface TontineResume {
  id: number;
  nom: string;
  statut: StatutTontine;
  nombreMembres: number;
  numeroCycleEnCours: number | null;
  montantCollecte: number;
  montantAttendu: number;
  soldeCaissePret: number;
}

export interface CotisationRetard {
  cotisationId: number;
  tontineNom: string;
  numeroCycle: number;
  membreNom: string;
  membreTelephone: string;
  resteDu: number;
}

export interface PretEnCours {
  pretId: number;
  tontineNom: string;
  membreNom: string;
  membreTelephone: string;
  montantTotal: number;
  resteARembourser: number;
  prochaineEcheance: string | null;
  statut: StatutPret;
}

export interface TirageAFaire {
  cycleId: number;
  tontineNom: string;
  numeroCycle: number;
  dateCloture: string;
  montantCollecte: number;
  montantAttendu: number;
}

export interface GainAVerser {
  tirageId: number;
  tontineNom: string;
  numeroCycle: number;
  gagnantNom: string;
  gagnantTelephone: string;
  montantGagne: number;
  montantVerse: number;
  resteAVerser: number;
  statut: StatutTirage;
}

export interface MaTontine {
  tontineId: number;
  tontineNom: string;
  statut: StatutTontine;
  nombreParts: number;
  montantParCycle: number;
  nombreGains: number;
}

export interface CotisationAPayer {
  cotisationId: number;
  tontineNom: string;
  numeroCycle: number;
  resteDu: number;
  dateLimite: string;
  statut: StatutCotisation;
}

export interface MonPret {
  pretId: number;
  tontineNom: string;
  montantTotal: number;
  resteARembourser: number;
  prochaineEcheance: string | null;
  statut: StatutPret;
}

export interface MonGain {
  tirageId: number;
  tontineNom: string;
  numeroCycle: number;
  montantGagne: number;
  montantVerse: number;
  resteARecevoir: number;
  statut: StatutTirage;
}

export interface StatsUtilisateurs {
  total: number;
  nbAdmins: number;
  nbGestionnaires: number;
  nbMembres: number;
}

export interface StatsTontines {
  total: number;
  nbEnAttente: number;
  nbActive: number;
  nbSuspendue: number;
  nbTerminee: number;
}
