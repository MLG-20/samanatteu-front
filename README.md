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
├── app.ts                 composant racine
├── app.config.ts          configuration globale (HttpClient + intercepteurs, routeur)
├── app.routes.ts          table URL → composant, avec les guards
├── api/                   service transverse qui parle à l'API
└── auth/                  fonctionnalité « authentification » (service, intercepteur, composants)
```

## Authentification

Le backend renvoie un JWT (`POST /auth/login`) : un `accessToken` (15 min) et un `refreshToken`
(7 jours). Le front :

1. stocke les deux tokens dans le `localStorage` (`AuthService`) ;
2. ajoute `Authorization: Bearer …` à **chaque** requête (intercepteur HTTP) — on ne le passe
   jamais à la main ;
3. demande `GET /auth/me` pour savoir qui est connecté (le backend ne renvoie que les tokens au
   login) ;
4. protège les routes par rôle avec des **guards** (équivalent des règles de rôle de
   `SecurityConfig`).

## Tests

Vitest, avec `HttpTestingController` (l'équivalent de `MockMvc` côté front : les requêtes sont
interceptées, aucun appel réseau) et `TestBed` pour l'injection de dépendances.
