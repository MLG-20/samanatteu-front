# Contexte du front SamaNatteu

Fichier de suivi du projet front. **Mis à jour à la fin de chaque phase**, comme
`Notes_Cours/25_Memoire_Contexte.md` côté backend.

## Règles de travail

- Commandes : `npm start` (serveur de dev, port 4200), `npm test` (tests **en watch**),
  `npx ng test --watch=false` (tests **une fois**, pour un contrôle ponctuel — c'est la bonne
  commande en CI), `npm run build` (bundle de production dans `dist/`).
- Le backend doit tourner sur `localhost:8080` (sinon le proxy ne trouve rien).
- `npx tsc -b` : si l'IDE affiche des erreurs sur les `tsconfig*.json` (TS6305), c'est que les
  sorties de compilation sont périmées → cette commande les régénère.
- Branche : `main` (à renommer depuis `master`, cf. « Dépôt Git » plus bas). Le dépôt GitHub
  distant reste à créer.
- Aucun secret dans le front : les identifiants (Twilio, base) restent dans le `.env` du backend.

## Architecture

```
samanatteu-front/
├── proxy.conf.json      → /auth, /tontine, /dashboard… : le serveur de dev forwarde vers :8080
├── angular.json         → config du build + le proxy
└── src/app/
    ├── app.ts           → composant racine
    ├── app.config.ts    → providers globaux (HttpClient + intercepteurs, routeur…)
    ├── app.routes.ts    → table URL → composant (+ guards)
    ├── api/api.service.ts        → service transverse qui parle à l'API
    └── auth/            → fonctionnalité « authentification » (service, intercepteur, composants)
```

**Un dossier par fonctionnalité** (comme les packages par domaine côté Spring).

## Les notions Angular à retenir

| Notion | Équivalent Spring | Rôle |
|---|---|---|
| **composant** | `@Controller` + `@RestController` | une pièce d'UI (classe + template + styles) |
| `selector` | le chemin de la route | le nom de la balise (`<app-root>`) |
| `imports` | les imports du contrôleur | ce que le template a le droit d'utiliser |
| **service** (`@Injectable`) | `@Service` | la logique réutilisable ; `providedIn: 'root'` = disponible partout |
| `inject()` | `@Autowired` | l'injection de dépendances |
| **signal** | `AtomicReference` + observabilité | une valeur dont le changement redessine l'écran |
| `Observable` / `subscribe` | `CompletableFuture` / `.get()` | le résultat asynchrone d'un appel |
| `tap` / `map` | `.peek()` / `.map()` | un effet / une transformation |
| **intercepteur HTTP** | `OncePerRequestFilter` | s'exécute sur chaque requête (ici : ajouter le JWT) |
| **guard** (`canActivate`) | la règle de `SecurityConfig` | protège une route (par rôle) |
| `localStorage` | — | stockage persistant du navigateur (le token y vit) |

## État au 2026-10-22

**Fait :**
- Scaffold Angular 21.2 (composants standalone, TypeScript strict, tests Vitest), proxy vers
  l'API backend.
- `ApiService` : prouve la chaîne front → proxy → Spring Boot → JSON.
- `AuthService` : `login()`, stockage des tokens dans le `localStorage`, `chargerMoi()`,
  `logout()`. Signal `utilisateur`.
- `authInterceptor` : ajoute `Authorization: Bearer …` à chaque requête. **Câblé** dans
  `app.config.ts` via `provideHttpClient(withInterceptors([authInterceptor]))`.
- 6 tests verts (`HttpTestingController` = l'équivalent de `MockMvc` côté front).
- Backend : `GET /auth/me` ajouté (l'utilisateur connecté), protégé par `anyRequest()`.

**Manquant (prochaines phases) :**
1. Page de connexion (formulaire) + redirection selon le rôle.
2. Guards par rôle.
3. Les 3 tableaux de bord (membre, gestionnaire, admin) — les API existent déjà.
4. Le reste des écrans (tontines, cotisations, tirages, invitations…).

## Journal

| Date | Phase | Tests |
|---|---|---|
| 2026-10-21 | Scaffold + proxy + `ApiService` | 3 |
| 2026-10-22 | `AuthService` + intercepteur JWT + `GET /auth/me` | 6 |

## Erreurs d'IDE rencontrées (et leur cause)

- **`tsconfig.app.json` / `tsconfig.spec.json` en rouge, sans erreur de compilation réelle** :
  `npx tsc --noEmit` et `npx tsc -b` passent tous les deux. C'est l'erreur **TS6305** (« the
  output file has not been built from source file ») : l'IDE utilise les **sorties de
  compilation** (`out-tsc/`) et elles étaient périmées. Solution : `npx tsc -b` (ou un build),
  puis recharger la fenêtre. `out-tsc/` est ignoré par Git.
- **`describe is not defined`** en lançant `npx vitest run` directement : la config Angular
  (globals, setup) n'est pas chargée. La bonne commande est `ng test`.


## Dépôt Git (à faire)

Le dépôt Git est **local seulement** (`ng new` fait un `git init` + 1 commit) : **aucun remote**,
rien n'est sur GitHub. À faire :
```
git branch -m main
gh repo create samanatteu-front --private --source=. --remote=origin --push
```
(ou créer le dépôt vide sur github.com puis `git remote add origin …` + `git push -u origin main`).
