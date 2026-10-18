# Production Readiness — ATEMI

Date : 2026-10-17 (mise à jour tardive).
Dépôt : `C:\dev\ecommerce-boutique` — branche `feat/catalogue-background`, HEAD **`3709954`**
(poussé sur `origin` : `https://github.com/djef27/ATEMI.git` ; `origin/master` = `16111de`).
Périmètre : audit, corrections et mise en production du projet existant.
Aucun paiement réel, aucune donnée de production supprimée, aucun enregistrement DNS
modifié. La seule variable Vercel ajoutée par la CLI a échoué (déjà existante) ;
`UPSTASH_REDIS_REST_URL` est apparu côté dashboard (action humaine), **sans** son token.

Ce rapport n'affiche **aucune valeur secrète** : uniquement des noms de variables,
des identifiants de projet et des URL publiques de déploiement.

---

## 1. Synthèse

| Objectif | État | Preuve |
|---|---|---|
| Vercel : accès, projet, déploiements | **CORRIGÉ — OK** | CLI `--non-interactive`; projet `atemi-preview` |
| Blocage build Vercel (cause racine) | **CORRIGÉ** | `[STATIC_BUILD_EMPTY_OUT_DIR]` → fix framework |
| Preview déployée et **Ready** | **OK** | `https://atemi-preview-o04deelp6-atemi.vercel.app` |
| **Production déployée et READY** | **OK** | `https://atemi-preview.vercel.app` |
| Pages servies en production | **OK** | `/`, `/products`, `/suivi`, `/cart`, `/sitemap.xml` → 200 |
| Parcours transactionnel en production | **BLOQUÉ (fail-closed, diagnostic corrigé)** | POST `/api/orders`, `/api/payment/initiate` → **503** (plus 429 trompeur) ; cause = `UPSTASH_REDIS_REST_TOKEN` **absent** (URL présente) |
| SEO — titres dupliqués | **CORRIGÉ + déployé** | `/products` → `Catalogue | Atémi`, `/contact` → `Contact | Atémi`… |
| SEO — sitemap/robots/canonicals sur domaine mort | **CORRIGÉ + déployé** | plus aucune URL `atemi.bj` ; dérivent de `getAppUrl()` |
| SEO — `NEXT_PUBLIC_APP_URL` canonique | **NON CORRIGÉ (bloqueur)** | sitemap/OG pointent sur l'URL du déploiement |
| Sécurité RPC `get_order_by_email` (anon) | **CORRIGÉ — DENIED** | probe → `401 42501` |
| `create_order` / `confirm_deposit_payment` (anon) | **OK — DENIED** | probe → `401 42501` |
| Sécurité `SECURITY DEFINER` (`SET search_path`) | **CORRIGÉ (local, non appliqué)** | dump distant : 16 fonctions sans `search_path` ; migration `20261017120000` commitée `3709954`, **non appliquée** (backup d'abord) |
| Tests unitaires | **OK** | 28 suites / 392 tests (incl. 24 nouveaux sur le 429/503) |
| Typecheck | **OK** | `tsc --noEmit` → 0 |
| Lint (fichiers modifiés) | **OK** | `eslint --max-warnings=0` → clean |
| Build local | **OK** | `next build` → 78 pages |
| Sauvegardes Supabase | **BLOQUÉ** | `backups: []`, `pitr_enabled: false` |
| Domaine `atemi.com` | **NON FAIT** | apex → Squarespace; 0 domaine sous Vercel |
| `BREVO_API_KEY` / `EMAIL_FROM_*` | **ABSENTS** | `vercel env ls production` (noms) |
| `UPSTASH_REDIS_REST_URL` | **PRÉSENT** (4 h) | `vercel env ls production` |
| `UPSTASH_REDIS_REST_TOKEN` | **ABSENT (bloquant)** | `vercel env ls production` → routes financières en **503** |
| Migration P2 (RLS vendeur) | **NON APPLIQUÉE** | registre distant = `20261009190000` |
| Go-live production | **BLOQUÉ** | `UPSTASH_*` et `BREVO_API_KEY` absents ; voir §6/§7 |

**Décision : PAS ENCORE PRÊT POUR LE GO-LIVE TRANSACTIONNEL.** Le site est **déployé
et Ready** en production (`https://atemi-preview.vercel.app`, 200), le build passe
(78 routes), le SEO est corrigé, et le blocage de sécurité RPC est résolu. Reste un
seul prérequis technique court (`UPSTASH_REDIS_REST_TOKEN`) plus des prérequis
opérationnels (sauvegarde Supabase, e-mails Brevo, domaine canonique) qui exigent
une intervention humaine (§7). Aucun de ces points ne peut être levé en autonomie :

---

## 1bis. Correction du 429 (priorité absolue, session du 2026-10-17)

### Cause racine

`rate-limit.ts` (`upstashCheck`) exigeait `UPSTASH_REDIS_REST_URL` **et**
`UPSTASH_REDIS_REST_TOKEN` pour tout préfixe financier (`rl:order:`, `rl:pay:`) en
production. `URL` est présente mais `TOKEN` **absent** → la condition
`(!url || !token)` (l.91) retournait `allowed:false` avec `retryAfterMs:60000`, et
chaque route traduisait ce refus en **429 « Trop de requêtes »**. Résultat : le
message mobile « Trop de requêtes, réessayez dans 60 s » était **faux** (aucun quota
n'avait été atteint) et revenait après chaque tentative. Le fail-closed était
souhaitable ; seul le **diagnostic** (429 vs indisponibilité) était incorrect.

### Correction (fail-closed préservé, diagnostic exact)

- `rate-limit.ts` : nouveau champ `reason` sur `RateLimitResult`
  (`'ok' | 'limited' | 'unavailable'`). `unavailable` = dépendance obligatoire
  absente/échouante ; `limited` = vrai quota dépassé. Export de `RateLimitResult`.
- `api-rate-limit.ts` (nouveau) : `rateLimitResponse(rl)` mappe
  `unavailable` → **503** (avec `Retry-After`), `limited` → **429**, `ok` → `null`
  (aucune réponse). Message 503 générique, sans fuite de config.
- 7 routes financières (`orders`, `payment/initiate`, `payment/confirm`,
  `order/recovery`, `payment/kkiapay/verify`, `payment/mock/confirm`,
  `payment/webhook`) passent par ce helper. **Aucune n'a été ouverte** (toujours
  bloquée sans Redis) — seule la sémantique HTTP a changé.
- `checkout/page.tsx` : le jeton d'idempotence est désormais **stable par payload**
  (`useRef` + régénération à la changement du panier/formulaire) au lieu d'être
  régénéré à **chaque clic**. Un double-clic ou une réessai réseau réutilise la
  même clé → le serveur déduplique (pas de commandes en double). Le bouton reste
  `disabled={loading}` pendant l'envoi.

### Preuves en production (après déploiement `atemi-preview-rjvhvu97t`)

| Route | Avant | Après |
|---|---|---|
| `POST /api/orders` | 429 « Trop de requêtes » | **503** `Retry-After: 60`, « Le service de commande est temporairement indisponible » |
| `POST /api/payment/initiate` | 429 | **503** |
| `/`, `/products`, `/sitemap.xml` | 200 | 200 (inchangé) |

Le parcours reste **bloqué** (fail-closed, correct) tant que le token Upstash n'est
pas fourni — mais l'utilisateur n'est plus induit en erreur. Dès l'ajout du token,
les endpoints repasseront en fonctionnement normal (429 uniquement sur vrai quota).

### Fichiers modifiés

`src/lib/rate-limit.ts`, `src/lib/api-rate-limit.ts` (nouveau),
`src/app/api/{orders,payment/initiate,payment/confirm,order/recovery,payment/kkiapay/verify,payment/mock/confirm,payment/webhook}/route.ts`,
`src/app/checkout/page.tsx`,
tests : `src/lib/__tests__/security/rate-limit-availability.test.ts` (nouveau, 24 tests),
`order-recovery.test.ts`, `public-api-routes.test.ts` (champ `reason` ajouté aux mocks).

---

## 2. Corrections réalisées cette session

### 2.1 Cause racine du blocage Vercel (critique)

Le projet Vercel `atemi-preview` avait **Framework Preset = "Other"**, donc
Output Directory = `public`. Next.js génère dans `.next/` : les 3 déploiements
précédents ont tous échoué avec :

```
Error: [STATIC_BUILD_EMPTY_OUT_DIR] The Output Directory "public" is empty.
```

L'URL de production (`latestProductionUrl`) renvoyait `404 DEPLOYMENT_NOT_FOUND`
car aucun build n'avait jamais réussi.

**Correction** : `"framework": "nextjs"` ajouté à `vercel.json`
(+ les `crons` existants préservés). `git diff -- vercel.json` = 1 ligne ajoutée.

**Validation** : déploiement Preview `atemi-preview-o04deelp6` → `status: Ready`,
`build duration 1m 19s`, `λ index (1.42MB) [iad1]`.

### 2.2 Exposition RPC en production (critique, sécurité)

Le rapport `PREPRODUCTION_READINESS_REPORT.md` (2026-10-13) décrivait
`get_order_by_email(text,text)` — `SECURITY DEFINER` exposant données client et
`tracking_token` — comme **encore exécutable par `anon` et `authenticated`**,
ce qui contournait le rate-limit de `/api/order/recovery`.

Sonde directe (2026-10-17, rôle `anon` vs `service_role`) :

| Fonction | anon | service_role |
|---|---|---|
| `get_order_by_email(p_order_number,p_email)` | **401 `42501` DENIED** | 200 |
| `create_order` | **401 DENIED** | 400 (valide, exécutable) |
| `confirm_deposit_payment` | **401 DENIED** | 400 (exécutable) |
| `get_my_vendor_id` | **401 DENIED** | 200 |
| `get_order_tracking` | 400 (token-gated, **par design**) | 400 |
| `get_order_receipt` | 400 (token-gated, **par design**) | 400 |

Tables en `anon` : `orders` 401, `order_items` 401 (RLS actif) ; `products` 200,
`vendors` 200, `profiles` 200 (données publiques, normal).

**Conclusion : le blocage de sécurité critique est désormais RÉSOLU.** Le revoking
de la migration `20261011120000` a été **appliqué à distance** (hors registre), même si
le fichier de migration n'est toujours pas inscrit dans l'historique distant.

### 2.3 Dette de documentation corrigée

`PREPRODUCTION_READINESS_REPORT.md` affirme encore (lignes 34, 76-77, 105-109, 151,
217-220) que `get_order_by_email` reste exécutable par `anon`/`authenticated` et que
les tests font 24 suites / 335 tests. **Obsolète** : l'état réel est 401 DENIED et
27 suites / 368 tests. Ce document doit être mis à jour ou marqué comme historique.

---

## 3. Vérifications (état réel reproduit)

| Contrôle | Commande | Résultat |
|---|---|---|
| Tests | `jest --ci --silent` | **27 suites / 368 tests, tous OK** (71,9 s), exit 0 |
| Typecheck | `tsc -p tsconfig.typecheck.json --noEmit` | exit 0 |
| Build local | `next build` | exit 0, **78 pages/routes** |
| Build Vercel | `vercel deploy` (preview) | **Ready**, 1m19s |
| Statut git | `git status` | voir §4 |

Note : `npm run lint` (wrapper `next lint`) dépasse le délai du shell (~180 s) ;
le lint de fichiers ciblés (`eslint … --max-warnings=0`) passe avec exit 0, et le
lint complet s'exécute aussi pendant `next build`.

---

## 4. État Git

- Branche : `feat/catalogue-background`, HEAD **`3709954`**. **Poussée sur `origin`**
  (`https://github.com/djef27/ATEMI.git`) ; `origin/master` = `16111de`
  (la branche locale est en avance de 10 sur `origin/master`).
- Derniers commits : `d2610d4`, `8483c9b` (hero `/products`), `260982e`,
  `76fe47c`, `bd1a9fa` (SEO Phase 7), `b95fadd`, `3709954` (migration
  `SECURITY DEFINER`, locale uniquement).
- `src/`, `public/`, `vercel.json`, `supabase/migrations`, `docs` sont **propres**
  (tout est commité). Working tree : uniquement `.agents/skills/*` et
  `tsconfig*.json` modifiés (préexistants).
- `.vercel/` bien ignoré (`.gitignore:60`). Tous les artefacts temporaires de cette
  session (`.out`, `bou.txt`, `tmp_*`, `npm-audit-*.json`, `ns1_network*.txt`,
  `.playwright-mcp/`) ont été **supprimés** — `git status --porcelain` ne montre
  plus aucun fichier non suivi.

---

## 5. Supabase

- Réf : `hmjvjepmnvtoabddsxeu` (CLI 2.116.0, liée). Région `eu-west-2`.
- Historique **distant** : dernier enregistré `20261009190000`.
  - `20261011120000_restrict_order_email_recovery.sql` — **privilege APPLIQUÉ
    hors registre** (prouvé par la sonde §2.2), mais **non inscrit** dans l'historique.
  - `20261013100000_scope_orders_vendor_read_to_authenticated.sql` — **NON appliquée**.
- Sauvegardes : `{"walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{}}`
  → **aucune sauvegarde restaurable**. Aucune procédure de restauration vérifiée.
  Ni mot de passe rôle PostgreSQL ni URI directe disponibles localement → pas de
  `pg_dump` possible ; le PITR est une option **payante** (Plan Pro).
- Sécurité `SECURITY DEFINER` (constaté 2026-10-17) : le dump distant
  (`remote_schema_backup.sql`) contient **16 fonctions `SECURITY DEFINER` sans
  `SET search_path`** — `confirm_deposit_payment`, `create_delivery_when_ready`,
  `create_order`, `get_admin_order_summary`, `get_my_role`, `get_my_vendor_id`,
  `get_order_receipt`, `get_order_tracking`, `is_admin`, `is_driver`, `is_vendor`,
  `prepare_admin_order_notification`, `prepare_order_notifications`,
  `prepare_vendor_order_notification`, `trigger_order_notifications`,
  `update_delivery_status`. Sans `search_path` fixé, ces fonctions résolvent les
  objets dans le `search_path` de l'appelant → risque d'usurpation de schéma.
  **Correction prête** : `20261017120000_harden_security_definer_search_path.sql`
  (idempotente, non destructive, ajoutant `SET search_path = pg_catalog, public`),
  commitée `3709954`. **Décision utilisateur : activer d'abord une sauvegarde/PITR**
  → migration **non appliquée à distance**.
- Attention : appliquer les migrations pendantes nécessite le mot de passe du rôle
  PostgreSQL (la tentative du 2026-10-13 a échoué sur l'authentification) **et** une
  autorisation explicite, et surtout une sauvegarde préalable.

---

## 6. Vercel, variables et domaine

- Compte/équipe : `atemi` (org `team_ZinKc6xnOxz45Xp5WY6oXcJ1`), utilisateur
  `elvisdjogbenou-collab`. Projet : `atemi-preview`
  (`prj_OiSARIfCsKusxO9kbYTO4wJK1MoF`), créé 2026-10-14, root `.`, Node 24.x, région `iad1`.
- **Accès CLI rétabli** : les commandes échouaient en mode interactif
  (`Worker timed out after 10 seconds`, `EPIPE`). Toutes les commandes doivent être
  lancées avec `--non-interactive` (+ `VERCEL_DISABLE_UPDATE_CHECK=1`). L'authentification
  est valide.
- Déploiements : 3 précédents **Error** (cause §2.1), puis 1 **Preview Ready**.
- Variables présentes (Production **et** Preview, créées « 1d ago ») — noms uniquement :
  `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (bien en **Secret**, pas `NEXT_PUBLIC_`),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ADMIN_WHATSAPP`, `PAYMENT_PROVIDER`,
  `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `KKIAPAY_SANDBOX`,
  `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET_KEY`, `WHATSAPP_*` (8),
  `OPENAI_API_KEY`, `FACEBOOK_APP_ID`, `VERCEL_OIDC_TOKEN`.
  → **Aucun secret en clair ni doublon en `NEXT_PUBLIC_*`.** ✅
- Variables **ABSENTES** (bloquantes pour le go-live) :
  - `BREVO_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`
    → l'envoi d'e-mails est **fail-closed** depuis `72cc987` : aucune confirmation
    de commande sera envoyée.
  - **`UPSTASH_REDIS_REST_TOKEN`** → c'est **le seul prérequis manquant** au
    rate-limit ; `UPSTASH_REDIS_REST_URL` est **désormais présent** (ajouté via
    dashboard il y a ~4 h). Sans le token, `rate-limit.ts:91-97` refuse tout
    endpoint financier en production (fail-closed, `retryAfterMs: 60000`).
  - `ELEVENLABS_API_KEY`, `TIKTOK_CLIENT_KEY`, `CONTENT_ENGINE_ENABLED` (optionnels).
- Domaines : `vercel domains ls` → **0 domaine** sous `atemi`. Aucun domaine
  personnalisé attaché. Donc **le déploiement Production n'est pas exposé publiquement
  sous `atemi.com`**.

### DNS (`atemi.com`) — non modifié

- Apex → Squarespace `198.185.159.144/145`, `198.49.23.144/145`.
- `www` → `ext-sq.squarespace.com`.
- NS mixtes : `ns01-04.squarespacedns.com` + `dns1-4.p01.nsone.net` (SOA sur NS1).
- MX Proton priorités **10/20** — **à préserver** (avec SPF/DKIM/TXT). `DMARC` absent.
- Le site reste hébergé chez **Squarespace**. La bascule vers Vercel doit venir des
  valeurs exactes des **Domain settings du projet Vercel** et intervenir **après**
  validation du site déployé. Ticket OpenSRS `#12846700` en attente.

---

## 6bis. Déploiement Production — vérifications (2026-10-17)

- Déploiement : `vercel deploy --prod` → `readyState: READY`, `target: production`,
  `dpl_9aYoXVd5JrGfq6Q9bGVBiNpBSuyM`, alias **`https://atemi-preview.vercel.app`**.
  Le correctif `framework` a donc bien débloqué la production (auparavant 404).
- Réponses HTTP anonymes (curl, sans auth) :

  | Route | Code |
  |---|---|
  | `/` | 200 |
  | `/products` | 200 |
  | `/suivi` | 200 |
  | `/cart` | 200 |
  | `/sitemap.xml` | 200 |
  | `/images/hero-catalogue.webp` | 200 |
  | `/mon-compte`, `/admin`, `/vendor` | 307 (redirection, protégé — attendu) |
  | `/panier` | 404 (route inexistante : le panier est `/cart`) |
  | `GET /api/payment/initiate` | 405 (méthode non autorisée — attendu) |

- Rendu vérifié : titres `Atémi — La marketplace des talents africains` et
  `Catalogue - Atémi | Atémi` ; le HTML de `/products` contient bien
  `/images/hero-catalogue.webp` et le texte accentué « belles découvertes ».
- **BLOCAGE CRITIQUE — parcours transactionnel :**
  `POST /api/orders` → **429**, `POST /api/payment/initiate` → **429**,
  `POST /api/order/recovery` → **429**.
  Cause : `src/lib/rate-limit.ts` traite tout préfixe `rl:pay:` / `rl:order:`
  comme *endpoint financier* et, **en production, refuse tout si
  `UPSTASH_REDIS_REST_URL`/`_TOKEN` ne sont pas définis** (fail-closed,
  `retryAfterMs: 60000`). Depuis, `UPSTASH_REDIS_REST_URL` **a été ajouté** via le
  dashboard Vercel, mais **`UPSTASH_REDIS_REST_TOKEN` est toujours absent** → la
  condition `(!url || !token)` de `rate-limit.ts:91` reste vraie et **aucune commande,
  aucun paiement, aucune récupération invité ne peut aboutir en production.**
  C'est un comportement volontairement sûr (protection anti-brute-force), mais il
  rend le site **non fonctionnel** côté transaction tant que le token n'est pas
  configuré. Re-vérifié 2026-10-17 : `POST /api/orders` → 429,
  `POST /api/payment/initiate` → 429, `/` → 200.
- Note de protection : le déploiement expose `deploymentProtection:
  ["vercel_authentication"]`, mais l'accès anonyme racine répond **200**
  (la protection ne s'applique pas à l'alias de production dans ce cas).
- Note SEO mineure : le `<title>` de `/products` est `Catalogue - Atémi | Atémi`
  (suffixe « Atémi » dupliqué par le template de layout).

---

## 6ter. SEO technique (Phase 7) — constat et correctifs

### Constats

1. **Domaine codé en dur et inexistant** : `atemi.bj` apparaissait **17 fois** dans
   `src/` — dans `sitemap.ts` (`BASE_URL`), `robots.ts` (URL sitemap),
   `breadcrumbs.tsx` (JSON-LD), les `alternates.canonical` des layouts `contact`,
   `devenir-vendeur`, `comment-ca-marche`, et `ai-engine/text/product-truth.ts`.
   Vérification DNS : **`atemi.bj` → NXDOMAIN (n'existe pas)** ; `atemi.com` résout
   (Squarespace). La production servait donc un `robots.txt` et un `sitemap.xml`
   pointant sur un domaine qui **ne résout pas**.
2. **Titres dupliqués** : le root layout utilise le template `%s | Atémi`, et
   plusieurs segments ajoutaient eux-mêmes « - Atémi » / « — Atémi » :
   - `/products` → `Catalogue - Atémi | Atémi`
   - `/products/[slug]` → `<Nom> - Atémi | Atémi`
   - `/contact` → `Contact — Atémi | Atémi`
   - `/devenir-vendeur` → `Devenir Vendeur — Atémi | Atémi`
   - `/comment-ca-marche` → `Comment Ça Marche — Atémi | Atémi`
   (`/cgv`, `/a-propos`, `/politique-de-confidentialite` n'avaient pas ce suffixe et
   étaient corrects.)
3. **`NEXT_PUBLIC_APP_URL` non renseignée pour la prod** : `metadataBase` et l'`og:image`
   résolvent vers l'**URL du déploiement** (`atemi-preview-<hash>.vercel.app`), ce qui
   prouve que `getAppUrl()` retombe sur `VERCEL_URL` — donc la variable configurée est
   vide ou en loopback. Après le correctif, `sitemap.xml`/`robots.txt` pointent donc
   sur l'URL de déploiement : correcte et joignable, mais **pas canonique**.

### Correctifs appliqués (commit `bd1a9fa`, déployés et vérifiés)

- Titres : suppression du suffixe marque dans `products/page.tsx`,
  `products/[slug]/page.tsx`, et les layouts `contact`, `devenir-vendeur`,
  `comment-ca-marche` → rendu `X | Atémi` (confirmé en production).
- `sitemap.ts`, `robots.ts`, `product-truth.ts` : dérivent de `getAppUrl()`
  (source unique).
- `breadcrumbs.tsx` (JSON-LD) : utilise **uniquement** `NEXT_PUBLIC_APP_URL`
  (inliné identiquement serveur/client) et retombe sur une URL relative si absente —
  évite un **mismatch d'hydratation**, ce composant étant aussi importé par le client
  `cart/page.tsx` (`'use client'`).
- Vérifications : `tsc` 0, `eslint --max-warnings=0` 0 (9 fichiers),
  `next build` 0, déploiement production OK.

### Reste à traiter (décision métier requise)

- **`atemi.bj` subsiste dans 10 emplacements** : e-mails (`contact@atemi.bj` ×4,
  `noreply@atemi.bj` dans `email.ts`) et **texte légal des CGV** (4 mentions du site
  « atemi.bj »). Le domaine n'existant pas, ces adresses sont inutilisables et le
  texte des CGV cite un site inexistant. **À arbitrer : atemi.bj ou atemi.com ?**
- Fixer `NEXT_PUBLIC_APP_URL` (= domaine canonique) dans Vercel pour que sitemap,
  robots, canonicals, OG et les URLs de callback de paiement pointent sur le domaine
  réel.

---

## 7. Bloqueurs du go-live (intervention humaine requise)

1. **`UPSTASH_REDIS_REST_TOKEN` (bloquant n°1 — le plus court à lever)** : l'URL est
   déjà en place ; il manque **le token REST** de la **même** base Upstash. Sans lui,
   **toutes** les routes transactionnelles renvoient 429 en production (fail-closed) →
   le site ne peut pas prendre de commande ni de paiement. Copier le token depuis le
   dashboard Upstash (base déjà créée) et l'ajouter dans le dashboard Vercel en
   Production **et** Preview (jamais dans le chat ni dans un fichier du dépôt).
2. **`BREVO_API_KEY` (+ `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`)** : sans elle,
   l'envoi d'e-mails est fail-closed (`72cc987`) → aucune confirmation de commande.
   À définir dans le dashboard Vercel. Ne jamais coller ces secrets dans le chat
   ni dans un fichier du dépôt.
3. **Sauvegarde Supabase (prérequis à toute migration)** : `backups: []`,
   `pitr_enabled: false` → **aucun point de restauration**. Options : (a) fournir le
   mot de passe rôle PostgreSQL pour un `pg_dump` logique, ou (b) autoriser l'activation
   du PITR/Backups (option **payante** Plan Pro). **Décision utilisateur : sauvegarde
   d'abord** → la migration `20261017120000` (SECURITY DEFINER `search_path`) reste
   locale tant que ce n'est pas fait.
4. **Migrations pendantes** : réconcilier le registre distant (`20261011120000`
   appliquée hors registre) puis appliquer `20261013100000` — **autorisation
   explicite + sauvegarde préalable obligatoires**.
5. **Domaine (bloquant n°2)** : trancher entre **`atemi.bj`** (utilisé partout dans
   le code, CGV et e-mails… mais **NXDOMAIN**) et **`atemi.com`** (résout, hébergé chez
   Squarespace). Puis : renseigner `NEXT_PUBLIC_APP_URL` dans Vercel (domine sitemap,
   robots, canonicals, OG et URLs de callback de paiement), attacher le domaine au
   projet Vercel et basculer le DNS **en préservant la délégation NS et les
   MX/SPF/TXT/DKIM Proton**. Mettre à jour les e-mails publics et les CGV en conséquence.
6. **Clés de paiement Live** : `KKIAPAY_SANDBOX` est présent ; passer en production
   uniquement **après** validation E2E sandbox (`E2E_SANDBOX_TEST_PROCEDURE.md`).
7. **Branche Git** : commits **poussés** sur `feat/catalogue-background` (`3709954`),
   incluant le hero, le SEO et la migration SECURITY DEFINER. La branche locale est
   en avance de **10** sur `origin/master` (`16111de`) — ouvrir une PR pour fusionner
   si souhaité.
8. **Nettoyage** : **fait** — plus aucun artefact temporaire non suivi dans le
   working tree.

---

## 8. Procédure Vercel (reproductible, sans secret)

```powershell
$env:VERCEL_DISABLE_UPDATE_CHECK = "1"
npx --no-install vercel project ls            --non-interactive
npx --no-install vercel env ls production     --non-interactive
npx --no-install vercel ls atemi-preview      --non-interactive
npx --no-install vercel deploy                --non-interactive   # preview
npx --no-install vercel deploy --prod         --non-interactive   # production
```

Test Supabase (lecture seule, identifiants factices) : `node sb-probe.js`
(environnement temporaire, hors dépôt).

**Note de validation** : les previews sont protégées par la
*Deployment Protection* de Vercel → redirection 302 vers `vercel.com/sso-api`.
Un `curl` anonyme renverra donc 302 et **ne valide pas le HTML** ; la preuve de
bon build est `status: Ready` + `λ index`. La validation publique du HTML se fait
soit avec un *Protection Bypass for Automation* (secret), soit sur un déploiement
Production non protégé.

---

## 9. Risques et rollback

- Le correctif `vercel.json` est **réversible** : retirer `"framework": "nextjs"`
  (ou roll back de la prévisualisation) restaure le comportement précédent
  (builds en erreur — donc aucun risque de régression).
- Un déploiement Vercel défaillant se corrige par un nouveau `vercel deploy` ou un
  rollback dans le dashboard ; le code source reste inchangé.
- Aucune migration ni donnée distante n'a été modifiée → rien à rollback côté Supabase.
- Le DNS n'a pas été touché → aucun risque sur les e-mails entrants/sortants.

---

## 10. Ce qui n'a pas été fait (et pourquoi)

- **Déploiement Production promu** : **effectué sur décision explicite** de
  l'utilisateur → `https://atemi-preview.vercel.app` (READY). Le domaine n'étant
  pas attaché, il est isolé sur `*.vercel.app`. Le site sert les pages mais le
  parcours transactionnel est bloqué par le fail-closed Upstash (voir §6bis).
- **`atemi.com` non pointé** : action registrars/DNS à mener manuellement.
- **Aucune migration distante** appliquée (décision « ne rien appliquer,
  documenter » + sauvegarde requise).
- **Aucun paiement E2E** exécuté, aucun paiement réel activé (paiements en
  production restés sur clés **sandbox**).
- **Push Git effectué** : `feat/catalogue-background` → `origin` (`3709954`).
- **Aucun token Upstash, aucun mot de passe base Supabase, aucune clé Brevo** obtenus
  en autonomie : ces informations vivent dans des dashboards externes (Upstash,
  Supabase, Brevo) auxquels l'assistant n'a **pas** les identifiants — intervention
  humaine incontournable (§7).
