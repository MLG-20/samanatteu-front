# SamaNatteu — front (Angular)

Front de la plateforme de tontines **SamaNatteu** : c'est ici que vivent les écrans des
membres, des gestionnaires et de l'administrateur de la plateforme.

Le **backend** (API REST, Spring Boot) est dans le dépôt voisin [`samanatteu`](../samanatteu).

## Démarrer

Il faut **les deux** : l'API (Spring Boot) sur le port 8080, et le front sur le port 4200.

```bash
# 1) l'API, depuis le dossier samanatteu/
./mvnw spring-boot:run

# 2) le front, depuis ce dossier
npm install     # une seule fois
npm start
```

Puis <http://localhost:4200>.

| Commande | Rôle |
|---|---|
| `npm start` | serveur de développement (recompile à chaque modification, recharge le navigateur) |
| `npm test` | tests **en watch** (relance à chaque modification) |
| `npx ng test --watch=false` | tests **une seule fois** (contrôle ponctuel, CI) |
| `npm run build` | bundle de production dans `dist/` (fichiers statiques) |
| `npx tsc -b` | régénère les sorties de compilation (corrige les erreurs TS6305 de l'IDE) |

## Le proxy

`proxy.conf.json` renvoie les préfixes de l'API (`/auth`, `/tontine`, `/dashboard`…) vers
`http://localhost:8080`. Le navigateur ne voit donc qu'une seule origine (`localhost:4200`) : pas
de problème de CORS en développement, et **exactement le même schéma qu'en production** (un
serveur web sert les fichiers Angular et forwarde l'API).

**Quand vous ajoutez un contrôleur côté Spring, ajoutez son préfixe ici**, et vérifiez qu'il ne
ressemble à aucune URL de page : le proxy enverrait la page au back (d'où `/messageContact` pour
l'API du formulaire, la page restant `/contact`).

## Organisation

Un dossier par **fonctionnalité**, comme les packages par domaine côté Spring :

```
src/app/
├── app.ts / app.html      composant racine : <router-outlet />, toasts, boîte de confirmation
├── app.config.ts          configuration globale (HttpClient + intercepteur, routeur)
├── app.routes.ts          table URL → écran, chargement paresseux, guards par rôle
├── core/                  modèles (1 interface par DTO), libellés, formatage (FCFA, dates), thème
├── api/                   un service par domaine (tontine, finance, dashboard, admin, site)
├── ui/                    composants réutilisables (icône, modale, toasts, badge, tuile…)
├── layout/                la coquille des pages connectées (menu, barre du haut)
├── auth/                  session, intercepteur, guards + pages publiques (connexion, inscription…)
├── public/                la vitrine (accueil), contact, à propos + en-tête et footer partagés
├── commun/                écrans partagés : profil, notifications, journal
├── admin/                 vue d'ensemble, gestionnaires + fiche, formules, abonnements, site, messages
├── gestionnaire/          tableau de bord, tontines (+ détail à onglets), prêts, abonnement
└── membre/                accueil, mes tontines
```

## Écrans

| URL | Pour qui | Contenu |
|---|---|---|
| `/` | tous | vitrine : présentation, démo du tirage, offre (les vraies formules), FAQ |
| `/contact`, `/a-propos` | tous | coordonnées + formulaire, présentation ; contenu piloté par l'ADMIN |
| `/connexion`, `/inscription`, `/mot-de-passe-oublie` | visiteur | pages publiques (un connecté est renvoyé chez lui) |
| `/rejoindre/:token` | visiteur, membre | accepter une invitation (pas `/invitation` : préfixe de l'API dans le proxy) |
| `/admin/…` | ADMIN | vue d'ensemble, gestionnaires (et leur fiche : aucun membre nommé, seulement leur nombre), formules, abonnements, site public, messages, profil |
| `/gestionnaire/…` | GESTIONNAIRE | tableau de bord, tontines, détail d'une tontine, prêts, journal, notifications, abonnement, profil |
| `/membre/…` | MEMBRE | accueil, mes tontines, historique, notifications, profil |

## Design

- Palette « bleu océan + cyan » définie **une seule fois** en variables CSS dans `src/styles.css`,
  nommées par rôle (`--primaire-…`, `--surface`, `--succes`…) : changer de palette ou passer en
  sombre = changer ce bloc. Mode sombre : réglage du système, ou bouton soleil/lune (retenu).
- Système commun : boutons, champs, cartes, tableaux (empilés en cartes sur téléphone), badges de
  statut, squelettes de chargement, modales (feuille qui monte du bas sur téléphone), toasts.
- La vitrine a son propre univers, toujours sombre (aurores animées, maquette 3D qui suit la souris,
  démo de tirage jouable), sans faux témoignage ni chiffre inventé.
- Mobile d'abord ; animations coupées si le système le demande (`prefers-reduced-motion`).

## Authentification

Le backend renvoie un JWT (`POST /auth/login`) : un `accessToken` (15 min) et un `refreshToken`
(7 jours). Le front :

1. stocke les deux tokens dans le `localStorage` (`AuthService`) ;
2. ajoute `Authorization: Bearer …` à chaque requête (intercepteur), sauf au login et au refresh ;
3. sur un **401**, échange le refresh token contre une nouvelle paire et **rejoue** la requête
   (un seul refresh même si plusieurs requêtes échouent en même temps) ; refresh refusé →
   retour à `/connexion` ;
4. demande `GET /auth/me` pour savoir qui est connecté ;
5. protège les routes par **guards** : pas connecté → `/connexion?retour=…` ; mauvais rôle →
   sa propre page. Après un **F5**, le guard rappelle `/auth/me` (le signal `utilisateur` est vide
   au rechargement).

## Décisions

| Décision | Pourquoi |
|---|---|
| `switchMap` plutôt qu'un `subscribe` dans un `subscribe` | `/auth/me` a besoin du token du login : on enchaîne les deux appels dans une seule chaîne, avec **un seul** `error`. |
| `PAGE_PAR_ROLE` typée sur le rôle | Un rôle ajouté sans sa page ne compile pas. |
| Pas de token envoyé au login ni au refresh | Un vieux token périmé ne prouve rien ; on ne tente jamais de refresh sur ces routes (un 401 au login = mauvais mot de passe). |
| `?retour=` accepté seulement s'il commence par `/` (et pas `//`) | Sinon un lien piégé pourrait envoyer l'utilisateur sur un autre site après la connexion. |
| Store de la page tontine fourni par le composant (`providers`) | Une instance neuve par page ouverte, partagée par ses onglets (≈ `@RequestScope`). |
| Chargement paresseux de chaque écran (`loadComponent`) | Un membre ne télécharge jamais le code des écrans admin. |
| Paramètres du site en cache dans un `signal` de `SiteApi` | Footer, Contact et À propos font un seul `GET /site` ; quand l'ADMIN enregistre, le footer change sans recharger. |
| L'admin ne voit aucun membre, seulement leur nombre par gestionnaire | Frontière SaaS. Appliquée par l'**API** (elle n'envoie pas les membres), pas seulement par l'écran : une donnée masquée dans le front resterait lisible dans l'onglet Réseau. |
| `allowedHosts` ngrok dans la config `development` | Ouvrir le serveur de dev sur un téléphone via `ngrok http 4200` ; le proxy transmet l'API, donc un seul tunnel suffit. |
| Budget CSS par composant : 28 kB (avertissement) / 40 kB (erreur) | La vitrine (animations, paliers responsive) fait ~24 kB ; les autres écrans restent bien en dessous. |

## Tests

Vitest, avec `HttpTestingController` (l'équivalent de `MockMvc` côté front : les requêtes sont
interceptées, aucun appel réseau) et `TestBed` pour l'injection de dépendances.

**26 tests verts** (`npx ng test --watch=false`) : connexion, intercepteur (refresh, rejeu, un
seul refresh pour plusieurs 401, échec → déconnexion) et guards (F5, mauvais rôle, page demandée
retenue). Les tests de la page de connexion pilotent
l'écran comme un utilisateur (saisie dans les `<input>`, envoi du `<form>`) et vérifient les
requêtes envoyées, la page de destination pour chaque rôle, les tokens rangés et les messages
d'erreur. Vérifiés par mutation : retirer le garde-fou, l'effacement de l'erreur ou le
`switchMap`, ou se tromper de page, fait échouer au moins un test (ou la compilation).
