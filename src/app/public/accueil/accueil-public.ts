import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompteApi } from '../../api/admin.api';
import { AuthService, PAGE_PAR_ROLE } from '../../auth/auth.service';
import { fcfa, prixFormule, quota } from '../../core/formatage';
import { Formule } from '../../core/modeles';
import { Apparition } from '../../ui/apparition';
import { Icone, NomIcone } from '../../ui/icone';
import { PiedPublic } from '../pied/pied-public';

interface Etape {
  numero: string;
  titre: string;
  texte: string;
  icone: NomIcone;
}

interface Atout {
  titre: string;
  texte: string;
  icone: NomIcone;
  classe: string; // la case de la grille « bento » (grande, haute…)
}

/**
 * La page d'accueil publique (la « vitrine ») : la première chose que voit un
 * visiteur. Une seule API : les formules à la vente (GET /formule/disponibles,
 * public), pour que les tarifs affichés soient ceux de la base. Le reste est du
 * contenu, plus trois animations pilotées par des signaux :
 *   - le mot qui change dans le titre (« entre amies », « en famille »…) ;
 *   - la cagnotte de la maquette qui se remplit ;
 *   - la démo de tirage au sort que le visiteur lance lui-même.
 */
@Component({
  selector: 'app-accueil-public',
  imports: [RouterLink, Icone, Apparition, PiedPublic],
  templateUrl: './accueil-public.html',
  styleUrl: './accueil-public.css',
  // host : des liaisons sur la balise <app-accueil-public> elle-même. Les
  // variables CSS --sx / --sy suivent la souris (effet de profondeur du héros).
  host: {
    '[style.--sx]': 'souris().x',
    '[style.--sy]': 'souris().y',
  },
})
export class AccueilPublic {
  private readonly auth = inject(AuthService);
  private readonly minuteurs: ReturnType<typeof setInterval>[] = [];

  // Déjà connecté ? Le bouton du haut devient « Mon espace ».
  protected readonly moi = this.auth.utilisateur;
  protected readonly monEspace = computed(() => {
    const u = this.moi();
    return u ? PAGE_PAR_ROLE[u.role] : null;
  });

  protected readonly fcfa = fcfa;
  protected readonly quota = quota;
  protected readonly prixFormule = prixFormule;

  // ---------- La barre de navigation ----------
  protected readonly defile = signal(false); // la page a défilé : la barre devient « verre »
  protected readonly menuOuvert = signal(false);
  protected readonly progression = signal(0); // la fine barre de progression de lecture

  // ---------- Le mot qui tourne dans le titre ----------
  protected readonly mots = ['entre amies', 'en famille', 'entre collègues', 'au quartier', 'au marché'];
  protected readonly indexMot = signal(0);

  // ---------- La maquette du héros ----------
  protected readonly cagnotte = signal(187500);
  protected readonly objectif = 250000;
  protected readonly partCagnotte = computed(() => Math.round((this.cagnotte() / this.objectif) * 100));
  protected readonly souris = signal({ x: 0, y: 0 });

  // ---------- La démo du tirage ----------
  protected readonly participants = ['Aïssatou', 'Fatou', 'Mariama', 'Khady', 'Coumba', 'Ndeye', 'Awa', 'Binta'];
  protected readonly surligne = signal<number | null>(null);
  protected readonly gagnante = signal<string | null>(null);
  protected readonly tirageEnCours = signal(false);
  protected readonly confettis = Array.from({ length: 30 }, (_, i) => i);

  protected readonly etapes: Etape[] = [
    {
      numero: '01',
      titre: 'Créez votre tontine',
      texte: 'Le montant d’une part, le rythme (chaque semaine, chaque mois…), une caisse de prêt si vous voulez. Une minute, pas plus.',
      icone: 'tontine',
    },
    {
      numero: '02',
      titre: 'Invitez en un lien',
      texte: 'Collez le lien dans votre groupe WhatsApp, ou importez votre liste Excel. Chaque membre rejoint depuis son téléphone.',
      icone: 'lien',
    },
    {
      numero: '03',
      titre: 'Cotisez, tirez, recevez',
      texte: 'Chaque paiement est noté et confirmé par SMS. À la fin du cycle, le tirage désigne le gagnant, sans contestation.',
      icone: 'cadeau',
    },
  ];

  protected readonly atouts: Atout[] = [
    {
      titre: 'Chaque franc a sa trace',
      texte: 'Espèces, Wave, Orange Money, Free Money : chaque cotisation est enregistrée avec sa référence. La caisse est juste, à tout moment.',
      icone: 'portefeuille',
      classe: 'grande',
    },
    {
      titre: 'Un tirage équitable',
      texte: 'Seuls ceux qui n’ont pas encore gagné participent. Le résultat est horodaté et visible par tous.',
      icone: 'melanger',
      classe: '',
    },
    // L'ordre compte : sur grand écran, la grille 3 × 3 se remplit sans trou
    // (2 + 1 / haute + 1 + 1 / large sur 2 colonnes).
    {
      titre: 'La caisse de prêt',
      texte: 'Une petite part en plus à chaque cotisation, et la tontine prête à ses membres. Échéancier, intérêt et remboursements suivis.',
      icone: 'coffre',
      classe: 'haute',
    },
    {
      titre: 'Rappels par SMS',
      texte: 'Ouverture du cycle, échéance qui approche, paiement reçu : chacun est prévenu, vous n’avez plus à relancer.',
      icone: 'message',
      classe: '',
    },
    {
      titre: 'Un reçu pour chaque paiement',
      texte: 'Un PDF propre, téléchargeable à tout moment. Fini les cahiers raturés et les « j’avais payé ».',
      icone: 'recu',
      classe: '',
    },
    {
      titre: 'Chacun voit où il en est',
      texte: 'Le membre voit ce qu’il doit, ce qu’il a gagné et son historique. La confiance vient de la transparence.',
      icone: 'oeil',
      classe: 'large',
    },
  ];

  protected readonly profils: { titre: string; texte: string; icone: NomIcone }[] = [
    { titre: 'Entre amies', texte: 'La tontine du mois, sans le cahier ni les calculs du dimanche soir.', icone: 'utilisateurs' },
    { titre: 'Associations & quartiers', texte: 'Des dizaines de membres, plusieurs tontines, une gestion qui reste simple.', icone: 'accueil' },
    { titre: 'Collègues & commerçants', texte: 'Des cotisations rapprochées, des prêts dépannage, des reçus pour tout le monde.', icone: 'portefeuille' },
  ];

  // ---------- L'offre : les formules de la base ----------
  private readonly compteApi = inject(CompteApi);
  protected readonly formules = signal<Formule[]>([]);
  protected readonly chargementFormules = signal(true);
  protected readonly erreurFormules = signal(false);

  // Par prix croissant, mais « sur devis » (prix 0) en dernier : c'est la plus
  // grande formule, pas la moins chère.
  protected readonly formulesTriees = computed(() =>
    [...this.formules()].sort((a, b) => (a.prixMensuel || Infinity) - (b.prixMensuel || Infinity)),
  );
  // Celle du milieu est mise en avant (même règle que l'écran admin).
  protected readonly vedette = computed(() => {
    const liste = this.formulesTriees();
    return liste.length >= 3 ? liste[Math.floor(liste.length / 2)].id : null;
  });

  // Une phrase d'accroche déduite des quotas (le backend ne stocke pas de texte).
  protected accroche(f: Formule): string {
    if (!f.nbTontinesMax) {
      return 'Pour les grandes associations, sans aucune limite.';
    }
    return f.nbTontinesMax === 1 ? 'Pour lancer votre première tontine.' : 'Pour gérer plusieurs tontines en même temps.';
  }

  protected readonly faq: { question: string; reponse: string }[] = [
    {
      question: 'Est-ce que SamaNatteu encaisse l’argent ?',
      reponse:
        'Non. L’argent circule comme d’habitude entre les membres et le gestionnaire (espèces, Wave, Orange Money…). SamaNatteu enregistre chaque mouvement, prévient tout le monde et produit les reçus.',
    },
    {
      question: 'Les membres doivent-ils payer ?',
      reponse: 'Non, rejoindre une tontine est gratuit. Seul le gestionnaire choisit une formule, selon le nombre de tontines et de membres qu’il gère.',
    },
    {
      question: 'Faut-il un smartphone ?',
      reponse:
        'Le gestionnaire, oui (ou un ordinateur). Les membres reçoivent l’essentiel par SMS : rappels, confirmations de paiement, résultat du tirage.',
    },
    {
      question: 'Comment le gagnant est-il choisi ?',
      reponse:
        'Par un tirage au sort parmi les membres qui n’ont pas encore gagné, lancé par le gestionnaire à la clôture du cycle. Le résultat est enregistré et visible : personne ne peut le modifier.',
    },
    {
      question: 'Mes données sont-elles protégées ?',
      reponse:
        'Les comptes sont protégés par mot de passe, les accès sont limités selon le rôle, et un gestionnaire ne voit que ses propres tontines.',
    },
  ];

  constructor() {
    // Si un token est en mémoire (visiteur déjà connecté), on reconnaît l'utilisateur.
    this.auth.restaurerSession().subscribe();

    // Les tarifs : en cas de panne, la section l'indique sans casser la page.
    this.compteApi.formulesDisponibles().subscribe({
      next: (liste) => {
        this.formules.set(liste);
        this.chargementFormules.set(false);
      },
      error: () => {
        this.erreurFormules.set(true);
        this.chargementFormules.set(false);
      },
    });

    // setInterval ≈ un ScheduledExecutorService : une tâche répétée.
    // On garde chaque minuteur pour l'arrêter quand on quitte la page.
    this.minuteurs.push(setInterval(() => this.indexMot.update((i) => (i + 1) % this.mots.length), 2600));
    this.minuteurs.push(
      setInterval(() => {
        // La cagnotte monte de 12 500 en 12 500, puis repart (boucle de démonstration).
        this.cagnotte.update((c) => (c >= this.objectif ? 150000 : c + 12500));
      }, 1800),
    );
    // DestroyRef.onDestroy ≈ un @PreDestroy : nettoyage à la sortie de la page.
    inject(DestroyRef).onDestroy(() => this.minuteurs.forEach(clearInterval));
  }

  // @HostListener : écoute un événement global (ici le défilement de la fenêtre).
  @HostListener('window:scroll')
  protected auDefilement(): void {
    const y = window.scrollY;
    this.defile.set(y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.progression.set(max > 0 ? Math.min(100, (y / max) * 100) : 0);
  }

  // La souris dans le héros → deux nombres entre -1 et 1 (centre = 0).
  protected bougeSouris(evenement: MouseEvent): void {
    const zone = (evenement.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((evenement.clientX - zone.left) / zone.width) * 2 - 1;
    const y = ((evenement.clientY - zone.top) / zone.height) * 2 - 1;
    this.souris.set({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  }

  protected allerA(id: string): void {
    this.menuOuvert.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // La démo : la surbrillance passe de prénom en prénom en ralentissant,
  // puis s'arrête sur la gagnante (≈ une roue de loterie).
  protected lancerTirage(): void {
    if (this.tirageEnCours()) {
      return;
    }
    this.tirageEnCours.set(true);
    this.gagnante.set(null);
    const n = this.participants.length;
    const cible = Math.floor(Math.random() * n);
    const tours = n * 3 + cible; // 3 tours complets, puis la cible
    let pas = 0;
    const avancer = () => {
      this.surligne.set(pas % n);
      if (pas >= tours) {
        this.gagnante.set(this.participants[cible]);
        this.tirageEnCours.set(false);
        return;
      }
      pas++;
      // De plus en plus lent vers la fin : 45 ms au début, ~340 ms à la fin.
      const reste = tours - pas;
      setTimeout(avancer, reste < 8 ? 340 - reste * 30 : 45);
    };
    avancer();
  }
}
