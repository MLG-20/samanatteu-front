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

**Quand vous ajoutez un contrôleur côté Spring, ajoutez son préfixe ici.**

## Organisation

Un dossier par **fonctionnalité**, comme les packages par domaine côté Spring :

```
src/app/
├── app.ts                 composant racine (ne contient que le <router-outlet />)
├── app.config.ts          configuration globale (HttpClient + intercepteurs, routeur)
├── app.routes.ts          table URL → composant
├── api/                   service transverse qui parle à l'API
├── auth/                  fonctionnalité « authentification »
│   ├── auth.service.ts        login, tokens, utilisateur connecté
│   ├── auth.interceptor.ts    ajoute le JWT à chaque requête
│   └── login/                 page de connexion
└── dashboard/             un tableau de bord par rôle
    ├── dashboard-admin/
    ├── dashboard-gestionnaire/
    └── dashboard-membre/
```

## Écrans

| URL | Composant | État |
|---|---|---|
| `/` | — | redirige vers `/connexion` |
| `/connexion` | `Login` | fait |
| `/admin` | `DashboardAdmin` | coquille (les API existent) |
| `/gestionnaire` | `DashboardGestionnaire` | coquille (les API existent) |
| `/membre` | `DashboardMembre` | coquille (les API existent) |

## Design

- Palette « bleu océan + cyan » définie **une seule fois** en variables CSS dans `src/styles.css`,
  nommées par rôle (`--primaire-…`, `--accent-…`) : changer de palette = changer ce bloc.
- Mobile d'abord, avec des paliers pour petit téléphone, tablette, deux colonnes (≥ 960px), grand
  écran et téléphone en paysage ; typographie fluide avec `clamp()`.
- Animations d'entrée et de survol, coupées si le système demande moins d'animations
  (`prefers-reduced-motion`).

## Authentification

Le backend renvoie un JWT (`POST /auth/login`) : un `accessToken` (15 min) et un `refreshToken`
(7 jours). Le front :

1. stocke les deux tokens dans le `localStorage` (`AuthService`) ;
2. ajoute `Authorization: Bearer …` à **chaque** requête (intercepteur HTTP) — on ne le passe
   jamais à la main ;
3. demande `GET /auth/me` pour savoir qui est connecté (le backend ne renvoie que les tokens au
   login) ;
4. envoie l'utilisateur sur la page de son rôle (`ADMIN` → `/admin`, `GESTIONNAIRE` →
   `/gestionnaire`, `MEMBRE` → `/membre`) ;
5. *(à venir)* protège les routes par rôle avec des **guards** (équivalent des règles de rôle de
   `SecurityConfig`). Aujourd'hui, une page de rôle reste atteignable en tapant son URL ; le
   backend refuse quand même les données (403).

### La page de connexion

Formulaire réactif (téléphone + mot de passe) dont les règles reprennent celles de `LoginDTO`
(`@NotBlank`, `@Size(min = 8)`) : le front prévient tout de suite, le backend garde le dernier mot.
À l'envoi, `POST /auth/login` puis `GET /auth/me` sont **enchaînés** par `switchMap` ; un seul
gestionnaire d'erreur couvre les deux appels (identifiants refusés, `/auth/me` en échec, API
arrêtée).

## Décisions

| Décision | Pourquoi |
|---|---|
| `switchMap` plutôt qu'un `subscribe` dans un `subscribe` | `/auth/me` a besoin du token du login : on enchaîne les deux appels dans une seule chaîne, avec **un seul** `error` au lieu de deux. |
| Table `pageParRole` typée sur le rôle | Les clés sont vérifiées à la compilation contre `'ADMIN' \| 'GESTIONNAIRE' \| 'MEMBRE'` : un rôle ajouté sans sa page ne compile pas. |
| Garde-fou `if (formulaire.invalid) return` malgré le bouton grisé | La méthode ne dépend pas du HTML (un bouton se réactive via les outils du navigateur). |
| Budget CSS par composant relevé à 10 kB (avertissement) / 16 kB (erreur) | La page de connexion (animations, paliers responsive) dépasse les 4 kB par défaut d'Angular. |

## Tests

Vitest, avec `HttpTestingController` (l'équivalent de `MockMvc` côté front : les requêtes sont
interceptées, aucun appel réseau) et `TestBed` pour l'injection de dépendances.

**17 tests verts** (`npx ng test --watch=false`). Les tests de la page de connexion pilotent
l'écran comme un utilisateur (saisie dans les `<input>`, envoi du `<form>`) et vérifient les
requêtes envoyées, la page de destination pour chaque rôle, les tokens rangés et les messages
d'erreur. Vérifiés par mutation : retirer le garde-fou, l'effacement de l'erreur ou le
`switchMap`, ou se tromper de page, fait échouer au moins un test (ou la compilation).
