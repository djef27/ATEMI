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
- Sécurité `SECURITY DEFINER` — **mesurée directement sur les catalogues distants
  le 2026-10-18** (requête `pg_proc`/`pg_namespace`, lecture seule) : **25 fonctions
  `SECURITY DEFINER` dans `public`, dont 0 sans `SET search_path`**.
  - L'assertion antérieure (§ rédigé le 2026-10-17) de « **16 fonctions sans
    `SET search_path`** », déduite d'un dump texte (`remote_schema_backup.sql`),
    est **contredite par la mesure** et n'est plus tenue pour acquise. Le
    balayage de `20261017120000` a durci **0** fonction lors de son test local
    sur l'état restauré, ce qui recoupe la mesure distante.
  - **Correction prête** : `20261017120000_harden_security_definer_search_path.sql`,
    **réécrite** (balayage dynamique vérifié sur catalogue + assertion fail-loud,
    non destructive, idempotente) ; elle sert désormais surtout de **garde-fou
    anti-dérive**. **Non appliquée à distance** (voir §11).
  - Attention : `get_order_receipt(text,uuid)` et `get_order_tracking(text,uuid)`
    restent **exécutables par `anon`** (volontairement, le suivi public repose sur
    l'entropie du `tracking_token`). Elles propageaient pourtant le message SQL
    brut (`sqlerrm`) à l'appelant : corrigé par
    `20261018140000_generic_order_rpc_error_messages.sql`, **non appliquée à
    distance**.
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

---

## 11. Sauvegarde logique locale (gratuite) et restauration vérifiée — 2026-10-18

Contexte : Supabase **Pro inaccessible financièrement**, et `backups list` renvoie
`{"backups":[],"pitr_enabled":false}` → **aucune sauvegarde gérée, aucun PITR**.
Cette section documente une alternative 100 % gratuite, testée de bout en bout.

### 11.1 Canaux d'accès disponibles (vérifiés, aucun secret révélé)

| Canal | État | Usage |
|---|---|---|
| `npx supabase db dump` | **inutilisable** | exécute `pg_dump` dans Docker ; Docker Desktop est **cassé** ici (agent `dockerAgent` : `failed to verify docker agent API server health`) |
| `pg_dump`/`psql`/`pg_restore` | **présents** | `C:\Program Files\PostgreSQL\18\bin` (18.4) |
| `cli_login_postgres` (Postgres wire) | **connecte mais sans droits** | 0 privilège `SELECT` sur les 25 tables publiques → `pg_dump` échoue (`permission denied for table profiles`) |
| **Supabase Management API** `POST /v1/projects/{ref}/database/query` | **OPÉRANT** | rôle `supabase_read_only_user`, `transaction_read_only=on` → lecture seule intégrale |
| Postgres 18 local (service `postgresql-x64-18`) | en écoute | **mot de passe inconnu** (`scram-sha-256`) → non utilisé |

Le token Management API est lu depuis le **Gestionnaire d'credentials Windows**
(`Supabase CLI:supabase`) via `CredRead`, et **jamais affiché ni écrit**.
Toutes les requêtes sont émises avec `read_only: true` : **aucune écriture possible
en production** par construction.

### 11.2 Contenu de la sauvegarde

Emplacement : **`C:\dev\atemi-db-backups\`** — **hors du dépôt Git** (jamais committable).

| Fichier | Taille | SHA256 |
|---|---|---|
| `schema.sql` | 112 567 B | `5A23BBF3C9C974EE73DAE68A46EE868A6000EB1BE3ACB36177CFCD1A2EEAD8F7` |
| `data.sql` | 149 488 B | `89AB4329228EC375362EE30E682F166DD342F40110F68D19D8F3F4386FB12ED7` |
| `manifest.json` | — | comptages, empreintes, dépendances FK, ordre d'insertion, migrations appliquées |

**Rafraîchi le 2026-10-19T20:52Z** (§11.9) : l'ancien dump
(2026-10-18T15:53Z, 298 lignes, 32 migrations) est **préservé** dans
`archive\2026-10-18\` avec son manifeste (preuve de restauration §11.3
inchangée).

`schema.sql` (13 sections extraites des catalogues) : extensions (informatif),
types/enum, tables + colonnes générées/identité, contraintes PK/UNIQUE/CHECK,
**FK en dernier**, index hors contrainte, séquences, vues, fonctions, triggers,
activation RLS, policies, grants.

`data.sql` : **25 tables / 310 lignes** (rafraîchissement du 2026-10-19 ;
298 lignes au dump initial), générées en `INSERT … json_populate_recordset`
(colonnes générées exclues, **ordre FK respecté** par tri topologique des 32
dépendances), plus les **4 comptes `auth.users`** nécessaires à la FK
`profiles → auth.users`.

### 11.3 Intégrité vérifiée par restauration réelle (preuve, pas intention)

Restauration dans une **instance PostgreSQL jetable locale** (port 5499, `trust`
sur loopback, **sans toucher au service existant**), avec un stub `auth`
(`users`, `uid()`, `role()`) et les rôles `anon`/`authenticated`/`service_role`.

| Contrôle | Résultat |
|---|---|
| Erreurs à la restauration du schéma | **0** |
| Erreurs à la restauration des données | **0** |
| Tables distant vs restauré | **25/25 identiques** |
| Lignes distant vs restauré | **298 / 298** |
| Enums / fonctions / FK / policies / RLS actives | 7 / 26 / 32 / 62 / 25 — **identiques** |
| Contraintes PK/UNIQUE/CHECK (c/f/p/u) | 42 / 32 / 25 / 13 — **identiques** |

Seul écart : le type `contype='n'` (NOT NULL) apparaît dans le catalogue **PG18**
restauré mais pas dans **PG17.6** distant → **cosmétique**, sans impact sémantique.

### 11.4 Méthode de restauration gratuite — honnête

**Réelle et prouvée** : `prep.sql` (rôles + stub `auth`) → `schema.sql` → `data.sql`,
en une seule transaction, sur une instance PostgreSQL quelconque (ici 18.4 locale).

**Limites réelles, à connaître avant d'en dépendre :**

1. **Périmètre `public` uniquement** — le schéma `auth` n'est extrait qu'à
   minimale (`users.id/email/created_at`). `auth.identities`, `auth.sessions`,
   `auth.refresh_tokens`, `auth.audit_log_entries` **ne sont pas** sauvegardés.
2. **Fichiers stockés non inclus** — les objets du bucket Storage (images produits)
   ne sont pas dans le dump ; une restauration complète exige une ré-upload.
3. **Point-in-time impossible** : c'est un instantané, pas un journal. Aucun
   PITR sans plan payant.
4. **Horodatage et séquences** : aucune séquence dans `public` (IDs en
   `gen_random_uuid()`), donc aucun décalage de séquence à réaligner.
5. **Stockage** : les fichiers sont sur le disque local de la machine de
   développement — **pas de redondance**. À copier hors machine (disque externe,
   coffre) pour être réellement utile en cas de sinistre.
6. **Rôles/GRANTS** : les rôles Supabase (`anon`, `authenticated`, `service_role`)
   sont recréés sans droits par défaut ; les `GRANT` de `schema.sql` les réappliquent
   sur `public`.
7. **Restauration vers un nouveau projet Supabase** : fonctionne pour `public`
   + les comptes minimalistes ; il faudra re-créer les utilisateurs réels et
   leurs identités, ce qui **ne peut pas** être fait avec cette sauvegarde seule.

### 11.5 Test des migrations en attente (sur base locale, avant toute prod)

Appliquées **sur la base restaurée** (donc exactement l'état distant), dans l'ordre
chronologique — **5 migrations, 5/5 OK** :

| Migration | Résultat |
|---|---|
| `20261011120000_restrict_order_email_recovery` | **OK** |
| `20261013100000_scope_orders_vendor_read_to_authenticated` | **OK** |
| `20261017120000_harden_security_definer_search_path` | **OK** (réécrite, voir ci-dessous) |
| `20261018130000_allow_nullable_delivery_for_pickup` | **OK** |
| `20261018140000_generic_order_rpc_error_messages` | **OK** (nouvelle, voir 11.8) |

**Bugs de migration trouvés puis corrigés** :

1. **Version initiale de `20261017120000`** : `DO BEGIN … END;` **sans délimiteur
   dollar-quoted** → invalide en PostgreSQL (`syntax error at or near "BEGIN"`) ;
   elle aurait fait échouer intégralement un `db push`. Le dernier bloc plaçait
   en outre un `EXCEPTION` à l'intérieur d'un `IF`.
2. **Version intermédiaire (16 blocs `DO $$`)** — trois défauts silencieux, tous
   détectés par revue puis par la nouvelle assertion :
   - signature **erronée** pour `create_order`
     (`text,text,text,text,text,text,uuid,boolean,text,jsonb,uuid` alors que la
     fonction réelle est
     `uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text`) →
     « function does not exist », **avale** par `EXCEPTION WHEN OTHERS THEN NULL` ;
   - garde **erronée** pour `get_order_receipt` : `pg_get_function_identity_arguments`
     comparé à `'text,text'` alors que la fonction est `get_order_receipt(text, uuid)`
     → **le bloc ne s'exécutait jamais** ;
   - `EXCEPTION WHEN OTHERS THEN NULL` sur chaque bloc → **échec silencieux**,
     contraire au style fail-loud du dépôt.

**Version actuelle** : balayage dynamique et vérifié sur le catalogue
(`pg_proc` / `pg_namespace` : `prosecdef`, absence de `search_path` dans
`proconfig`, exclusion des fonctions possédées par une extension), suivi d'une
**assertion fail-loud** qui lève une erreur si une fonction SECURITY DEFINER de
`public` reste sans `search_path`. Idempotente, auto-vérifiante, et corrige
l'ensemble des défauts ci-dessus d'un coup.

**Constat vérifié** : sur la base restaurée (état distant), le balayage a durci
**0** fonction et l'assertion est passée → les fonctions publiques portent
**déjà** `SET search_path = 'public'` (appliqué via `20260904100000`). La valeur
de cette migration est donc **sécuritaire et anti-dérive**, son effet net actuel
est nul.

### 11.6 Preuve fonctionnelle du correctif « retrait » (500 corrigé)

Test réel sur la base restaurée après application des migrations, effectué **deux
fois** (une fois après les 4 migrations initiales, une fois après la réécriture
de `20261017120000` et l'ajout de `20261018140000`) :

```
create_order(..., p_delivery_address => NULL, p_delivery_city => NULL,
             p_delivery_zone_id => NULL, p_delivery_required => false, ...)
```

Résultat (deuxième passe) : commande **créée** — `CMD-20261018-173440-BD2B54`,
`delivery_required=false`, `delivery_address=NULL`, `delivery_city=NULL`,
`delivery_zone_id=NULL`.

Avant le correctif (`20261018130000`), ce même appel échouait par la contrainte
`NOT NULL` de `orders.delivery_address` / `orders.delivery_city` forcée à `NULL`
par `create_order` → **HTTP 500 sur toute commande en retrait** en production.
Le correctif est donc **validé de bout en bout**, sans avoir touché à la production.

### 11.8 Corrections fonctionnelles et sécurité — session du 2026-10-18 (suite)

#### Contradiction de documentation tranchée par mesure directe

`LOCAL_VALIDATION.md` affirmait que `anon`/`authenticated` pouvaient **toujours**
exécuter `get_order_by_email`, alors que `PRODUCTION_READINESS.md` affirme que le
REVOKE avait été appliqué. Mesure sur la base restaurée (état distant) :

| Rôle | `EXECUTE` sur `public.get_order_by_email(text,text)` |
|---|---|
| `anon` | **false** |
| `authenticated` | **false** |
| `service_role` | **true** |

→ **le REVOKE est bien en vigueur** : `PRODUCTION_READINESS.md` avait raison,
`LOCAL_VALIDATION.md` était obsolète. La récupération par e-mail passe
exclusivement par `POST /api/order/recovery` (rate-limitée, validée), et le RPC
direct depuis le navigateur est **impossible**.

**Confirmation sur les catalogues distants eux-mêmes** (Management API, lecture
seule, requête `has_function_privilege`) — le 2026-10-18 :

| Rôle | `get_order_by_email` | `create_order` | `order_has_vendor_items` | `get_order_receipt` | `get_order_tracking` | `get_my_vendor_id` | `confirm_deposit_payment` |
|---|---|---|---|---|---|---|---|
| `anon` | **false** | false | false | **true** | **true** | false | false |
| `authenticated` | **false** | false | true | **true** | **true** | true | false |
| `service_role` | true | true | true | true | true | true | true |

Et sur le même relevé : **25** fonctions `SECURITY DEFINER` dans `public`,
**0 sans `SET search_path`** → l'affirmation d'un dump « 16 fonctions sans
`SET search_path` » (§5, rédigé le 2026-10-17 à partir de
`remote_schema_backup.sql`) est **contredite par la mesure** et a été corrigée.

#### Vérifications post-migrations (base restaurée)

| Contrôle | Résultat |
|---|---|
| Policy `orders_vendor_read` — rôles | `authenticated` (migration appliquée) |
| Policy `orders_vendor_read` — prédicat | `((vendor_id = get_my_vendor_id()) OR order_has_vendor_items(id, get_my_vendor_id()))` |
| `orders.delivery_address` / `delivery_city` NOT NULL | **false / false** (retrait débloqué) |
| Fonctions SECURITY DEFINER sans `search_path` | **0** |
| `get_order_receipt` / `get_order_tracking` contenant `sqlerrm` | **0** (après `20261018140000`) |
| `create_order` — arguments d'identité | `p_customer_id uuid, p_customer_name text, p_customer_phone text, p_customer_whatsapp text, p_delivery_address text, p_delivery_city text, p_delivery_zone_id uuid, p_delivery_required boolean, p_customer_notes text, p_items jsonb, p_customer_email text, p_provider text` |

#### Fuite d'informations corrigée (`sqlerrm`)

`get_order_receipt(text,uuid)` et `get_order_tracking(text,uuid)` rattrapaient
toute erreur inattendue avec `RAISE EXCEPTION '… : %', sqlerrm`, ce qui remonte le
message PostgreSQL brut au navigateur d'un appelant **non authentifié** (simple
détention d'un `order_number` + `tracking_token`). La nouvelle migration
`20261018140000_generic_order_rpc_error_messages` rejoue les deux corps avec un
message fixe, et se termine par une **assertion fail-loud** qui échoue si
`sqlerrm` subsiste. `CREATE OR REPLACE` conserve les grants et le
`REVOKE … FROM PUBLIC` en place ; les `RAISE` explicites de « commande
introuvable » sont inchangés (contrat public, aucun détail interne).

#### Corrections applicatives (code)

| # | Problème | Fichier | Correctif |
|---|---|---|---|
| 1 | Vendeur légitime **rejeté (403)** sur commande multi-vendeur : `orders.vendor_id` est `NULL` pour un panier multi-vendeurs, et la route tourne en `service_role` (RLS non appliquée) | `src/app/api/vendor/orders/[id]/route.ts` | La propriété est maintenant testée **à l'identique du prédicat RLS** via `order_has_vendor_items(p_order_id, p_vendor_id)` ; contournement réservé à l'admin |
| 2 | **Idempotence contournable** : n'active que si l'en-tête `Idempotency-Key` était présent → un appel sans en-tête créait une 2ᵉ commande | `src/app/api/orders/route.ts` | La clé est **toujours** dérivée (`getIdempotencyKey`, repli méthode+URL+empreinte du corps) |
| 3 | **Fenêtre de course** : si la commande était créée mais que le stockage de la réponse d'idempotence échouait, un retry **recréait une commande** | `src/app/api/orders/route.ts` | Replay sans réponse stockée → **409** (« déjà en cours de traitement ») au lieu de retomber dans la création ; stockage déplacé **avant** l'e-mail |
| 4 | **Double transaction paiement** : deux appels simultanés de `POST /api/payment/initiate` pouvaient chacun créer une transaction fournisseur | `src/app/api/payment/initiate/route.ts` | Idempotence ajoutée (vérification + stockage des URL de paiement créées) ; un échec de la vérification ne bloque jamais le paiement |
| 5 | **PII superflue** renvoyée par la récupération e-mail alors que `/suivi` ne l'affiche jamais | `src/app/api/order/recovery/route.ts`, `src/app/suivi/page.tsx` | `customer_name` / `customer_phone` retirés du `select` et de la réponse |
| 6 | Page vendeur en `select('*')` : exposait au vendeur `customer_email`, `customer_notes`, `customer_whatsapp`, `tracking_token`, `vendor_id` sur des commandes **partiellement** les siennes | `src/app/vendor/commandes/page.tsx` | Liste de colonnes explicite, limitée à ce qui est rendu |

#### Vérifications de régression

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK** — aucun avertissement ni erreur |
| `npm test` | **28 suites / 400 tests OK** (7 tests ajoutés couvrant les protections ci-dessus) |

L'instance PostgreSQL de validation a été **arrêtée et supprimée**, les tâches
planificateur **supprimées**, les fichiers temporaires **effacés**. La sauvegarde
`C:\dev\atemi-db-backups\` est **inchangée et intacte**.

### 11.7 Ce qui reste hors de portée autonome

- **Appliquer** ces 5 migrations en production : nécessite soit un `db push`
  (Docker cassé), soit un mot de passe base avec droits d'écriture, soit un canal
  Management API en écriture (le token CLI est en lecture seule). Le SQL distant
  est `read_only=on` : **aucune écriture possible**, ce qui est aussi une bonne
  garantie d'accident.
- **Restaurer dans un projet Supabase vierge** : faisable pour `public` +
  comptes minimaux, mais **pas** pour les identités/authentifications réelles.
- **Copie hors machine** de `C:\dev\atemi-db-backups\` (redondance).

### 11.9 Rafraîchissement du dump — 2026-10-19

Le dump du 2026-10-18 prédate les 5 migrations `20261018*` et l'activité du
19/10 → rafraîchi pour que la sauvegarde reflète exactement le live.

| Contrôle | Résultat |
|---|---|
| Export schéma (13 sections catalogue) | **13/13 OK, 0 échec** |
| Export données | **25 tables / 310 lignes / 0 échec**, 32 FK, 0 cycle forcé |
| Migrations dans le manifeste | **37/37** — identiques local ↔ distant (aucun écart) |
| Ancien dump | **archivé** `archive\2026-10-18\` (schema + data + manifest) |
| Restauration complète (§11.4) | **non re-exécutée** sur ce dump — honnête : le pipeline est celui prouvé le 2026-10-18 (§11.3), et les 5 migrations ajoutées depuis ont été validées fonctionnellement (§11.5, §11.8) |

Écarts détectés vs dump précédent et traités :
- **Supprimé** (résidu E2E du matin, haute confiance : anonyme, paiement
  `pending`, produit de test) : commande `CMD-20261019-094214-FE3D61` +
  ses 1 payment, 1 order_item, 1 order_status_history (CTE ciblé par
  `order_number`, aucune autre ligne touchée ; 0 notification/0 delivery).
- **`idempotency_keys` +5** : entrées hashées des tests API du jour —
  laissées ( TTL d'usage, aucune PII).
- **Détecté, à décision de l'utilisateur (PAS supprimé)** :
  commande `CMD-20261019-190627-51FB9D` (anonyme, `pending_payment`,
  32 000 F, livraison — possiblement un test iPhone passé après le fix
  menu) et produit **« Gghhdd »** (créé 2026-10-19 09:13, actif, stock 44,
  30 000 F) qui apparaît dans le catalogue public. Le dump les contient
  donc aussi (live = dump, cohérent).

Scripts utilisés (hors dépôt, `C:\Users\DJOGBENOU Jean\AppData\Local\Temp\opencode\`) :
`sgquery.ps1` (token Management API lu via `CredRead`, jamais affiché),
`export_schema.ps1`, `export_data.ps1` (manifeste régénéré automatiquement).

## 12. État final — 2026-10-19 (mise à jour de go-live)

### 12.1 Acquis (vérifiés)

- **Site en production** : `https://atemi-preview.vercel.app` (alias du projet
  Vercel `atemi-preview`). Healthcheck 200 sur `/`, `/checkout`, `/contact`,
  `/admin`, `/products/:slug`, `GET /api/payment/methods?country=BJ`.
- **Menu mobile iOS corrigé** : cause racine prouvée (`backdrop-filter` du
  `<header>` créait un containing block pour les descendants `position:fixed` →
  panneau écrasé à 64 px). Panneau déplacé hors du header, vérifié en headless
  Chromium (panneau 844 px, 17/17 liens, fermetures X/Backdrop/Escape/lien OK,
  desktop inchangé). Déployé.
- **Migrations : 37/37 synchronisées** local ↔ distant (5 appliquées le
  2026-10-18 : recovery PII, vendor scope RPC, search_path SECURITY
  DEFINER, nullable delivery pickup, messages RPC génériques ; re-vérifié
  le 19/10 via le manifeste de sauvegarde : aucun écart).
- **Rate-limiting Upstash actif** en prod (fail-closed documenté, plus de
  fausses ruptures de quota 429).
- **Audit sécurité complet (2026-10-19)** :
  - en-têtes re-vérifiés après déploiement : CSP avec `frame-ancestors 'none'`,
    HSTS 1 an `includeSubDomains`, `nosniff`, `X-Frame-Options: DENY`,
    Referrer-Policy, Permissions-Policy, `poweredByHeader: false` ;
    `/admin` → 307 vers `/login` (côté serveur) ; HTTP→HTTPS 308.
  - guards API cartographiés : admin = `withAdminAuth` (+ rate-limit
    `adminMutation` inclus), content-engine = `withContentAdminAuth`,
    vendor = `requireVendorAuth`/`requireProductOwner`/`requireMediaOwner`,
    cron = `CRON_SECRET`, webhooks = signature, publics = `general`.
  - **dernier endpoint sans garde corrigé** : `GET /api/payment/methods`
    → `withRateLimit(general)` (60 req/min). **Preuve en prod** : rafale
    70 req en 9,8 s → **59×200 + 11×429** (`Trop de requêtes. Réessayez
    dans 21s`), usage normal inchangé (200 + payload correct).
  - `npm audit` : **0 CVE** ; open-redirect de `/login` assaini
    (`sanitizeRedirect`) ; aucun PII dans les logs d'API.
- **Pipeline de vérification du 2026-10-19** : typecheck ✓, lint ✓ (0
  warning), tests **400/400** (28 suites), build ✓ (79 pages), healthcheck
  200 sur `/`, `/checkout`, `/contact`, `/admin` (307 login),
  `/api/payment/methods?country=BJ`.
- **Sauvegarde logique rafraîchie** le 2026-10-19T20:52Z (310 lignes,
  37/37 migrations, ancien dump archivé) — §11.9.
- **Sauvegarde logique locale vérifiée** (`C:\dev\atemi-db-backups\`,
  restauration prouvée, §11).
- **Code versionné** : commit `d7fa21c` poussé sur
  `github.com/djef27/ATEMI`, branche `feat/catalogue-background` (32 fichiers :
  fix menu iOS, galerie vidéo, PhoneInput/regions, durcissement API,
  migrations 20261018*).
- **Paiements testables** : KKiaPay sandbox autorisée en prod
  (`KKIAPAY_ALLOW_SANDBOX_PRODUCTION`).
- **Tunnel commande + paiement prouvé de bout en bout en production**
  (2026-10-19) : `POST /api/orders` → commande `CMD-20261019-192837-A856AE`
  créée (200), `POST /api/payment/initiate` → KKiaPay sandbox OK
  (26 277 F, `sandbox: true`). Nettoyage intégral vérifié : paiements,
  order_items et commande de test supprimés, stock du produit restauré
  (25), **0 ligne de test restante**.
- **Les e-mails ne bloquent jamais la vente** : `sendEmail` est
  fire-and-forget (`orders/route.ts`), encapsulé en try/catch côté
  dispatch, et ne throw jamais sans `BREVO_API_KEY` → sans clé email, le
  site commande et encaisse quand même (e-mail simplement non envoyé, logé).
  Les confirmations WhatsApp sont déjà configurées en production.
- **Domaine : `atemistore.com` choisi, libre (RDAP Verisign), ATTACHÉ au
  projet** (`vercel domains add atemistore.com atemi-preview` OK) — en
  attente de l'achat sur open.bj. `atemi.bj` retiré de Vercel (non acheté) ;
  `atemi.com` occupé par Squarespace (abandonné).
- **Dernier déploiement** : `atemi-preview-5la681qx8-atemi.vercel.app`
  (Production, 2026-10-19 soir) — durcissement `GET /api/payment/methods`
  (voir ci-dessous).

### 12.2 Reste à faire pour le lancement réel (décision/action humaine)

1. **Domaine définitif (bloquant #1 — sans lui, pas de lien durable)**
   - **Choix acté : `atemistore.com`** (RDAP Verisign = libre ; `atemi.com`
     Squarespace occupé et abandonné ; `atemi.bj` retiré de Vercel, non
     acheté). Achat chez **open.bj** (registraire accrédité, ~9 000 FCFA/an,
     Mobile Money/FCFA).
   - **Déjà fait** : domaine **attaché au projet** Vercel
     (`vercel domains add atemistore.com atemi-preview` → OK).
   - **Reste (utilisateur)** : acheter sur open.bj, puis créer chez open.bj
     les enregistrements recommandés par Vercel :
     - `A` **@** → `76.76.21.21`
     - `CNAME` **www** → `cname.vercel-dns.com`
     (alternative : nameservers Vercel `ns1/ns2.vercel-dns.com` — à
     privilégier seulement si MX/open.bj reste géré ailleurs ; A/CNAME
     conservent les e-mails chez open.bj.)
   - **Puis (automatisé dès confirmation « acheté »)** :
     `vercel domains verify atemistore.com` → `NEXT_PUBLIC_APP_URL =
     https://atemistore.com` (Production **et** Preview) → `vercel --prod`
     → E2E (canonicals, sitemap, OG, callbacks paiement, santé).
2. **E-mail transactionnel (bloquant #2 — confirmations de commande)**
   - Le site affiche encore le placeholder `votre@email.com` sur `/contact`.
   - Créer la boîte officielle (ex. `contact@…`), un compte Brevo (gratuit
     300 j/j) ou Resend, générer la clé API côté fournisseur, puis renseigner
     dans Vercel (Production **et** Preview, via dashboard — jamais dans le
     dépôt ni le chat) : `BREVO_API_KEY`, `EMAIL_FROM_NAME`,
     `EMAIL_FROM_ADDRESS`, et `NEXT_PUBLIC_CONTACT_EMAIL` = la vraie adresse.
   - Valider : passer une commande de test → e-mail reçu.
3. **Paiements en live (bloquant #3 — encaisser réellement)**
   - KKiaPay : compte marchand validé + passage en production **après**
     domaine public et validation E2E sandbox
     (`E2E_SANDBOX_TEST_PROCEDURE.md`) ; retirer alors
     `KKIAPAY_ALLOW_SANDBOX_PRODUCTION` et remplacer les clés sandbox par les
     clés live.
   - CinetPay/FedaPay : non configurés (aucune variable) — à ajouter
     uniquement si le choix métier les retient.
4. **Redondance de sauvegarde** : copier `C:\dev\atemi-db-backups\` vers un
   cloud externe (Drive/Dropbox/USB hors site). Optionnelle : activer les
   backups Supabase gérés (Plan Pro, payant) ou PITR.
5. **PR vers `master`** : la branche `feat/catalogue-background` est en
   avance sur `master` — ouvrir une PR pour tracer la fusion une fois le
   lancement stabilisé.

### 12.3 Commandes prêtes (à exécuter dès que l'achat est confirmé)

```
vercel domains verify atemistore.com          # après achat + DNS en place
vercel env add NEXT_PUBLIC_APP_URL production  # valeur: https://atemistore.com
vercel env add NEXT_PUBLIC_APP_URL preview     # idem pour Preview
vercel --prod                                  # redeploy avec la bonne URL
```

DNS attendu chez open.bj : `A @ → 76.76.21.21`, `CNAME www →
cname.vercel-dns.com`. Vérifier ensuite : `curl -sI https://atemistore.com`
(HSTS + 200), canonicals/sitemap/OG à domaine neuf, callbacks paiement.

### 12.4 Données à trancher (décision utilisateur)

- **`CMD-20261019-190627-51FB9D`** (anonyme, `pending_payment`, 32 000 F,
  livraison) et produit **« Gghhdd »** (actif, visible au public) :
  possiblement un test passé depuis l'iPhone de l'utilisateur après le fix
  menu — **non supprimés** (peuvent être un vrai test à conserver ou une
  commande à examiner dans Admin). Demander avant toute purge.
- Catalogue contenant encore des produits de test anciens aux noms
  aberrants (ex. `fregrfgrfgrfg`, `scscsxcscss`, `eefefe`) — purge
  catalogue à ordonner par le propriétaire avant ouverture publique.

