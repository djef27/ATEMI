# Progress

## Completed

### Infrastructure
- Audit initial du projet
- Structure Next.js 14 (App Router) + TypeScript + Tailwind
- Types Supabase complets (15 tables, 11 enums, 7 RPC)
- Client Supabase (browser + server + admin)
- Middleware de protection routes (admin/vendor/driver)
- Migrations synchronisées (baseline + hardening + v1_functional)
- CSS de base (globals.css avec composants réutilisables)

### PHASE 1 — Authentification
- AuthProvider (contexte session côté client)
- Page /login (connexion)
- Page /register (inscription)
- Header avec menu utilisateur

### PHASE 2 — Catalogue
- Page /products (catalogue, server component)
- ProductCard (composant réutilisable)
- Page /products/[slug] (fiche produit)
- AddToCartButton (composant client)

### PHASE 3 — Panier
- Store Zustand (persistant, localStorage)
- Page /cart (panier)
- CartItemRow (ligne du panier)

### PHASE 4 — Checkout
- Page /checkout (formulaire complet)
- Appel create_order RPC (mono-vendeur)

### PHASE 5 — Paiement
- API route /api/payment/confirm (service_role)
- Page /paiement (sélection mode, référence)
- Admin /admin/paiements (confirmation manuelle)

### PHASE 6 — Confirmation
- Page /confirmation (numéro commande, prochaines étapes)

### PHASE 7 — Suivi
- Page /suivi (get_order_tracking, historique statuts)

### PHASE 8 — Reçu
- Page /recu (get_order_receipt, impression)

### PHASE 9 — Dashboard client
- Page /mon-compte (profil, commandes, reçus)

### PHASE 10 — Vendeur
- Layout vendeur (sidebar)
- Dashboard /vendor (stats)
- /vendor/produits (liste produits)
- /vendor/commandes (liste commandes)

### PHASE 11 — Admin
- Layout admin (sidebar)
- Dashboard /admin (stats)
- /admin/commandes (toutes les commandes)
- /admin/vendeurs (gestion vendeurs)
- /admin/produits (tous les produits)
- /admin/categories (gestion catégories)
- /admin/paiements (confirmation paiements)

### Audit 2026 — CRUD & correctifs
- **`src/lib/order-status.ts`** : statuts admin (8) vs vendeur (2), statuts terminaux.
- **`/api/admin/orders/[id]`** : GET détail (items, paiements, historique, zone), PATCH statut avec verrou optimiste + journal `order_status_history` + restauration stock sur annulation + email client, PUT → 405.
- **`/api/vendor/orders/[id]`** : PATCH limité aux statuts vendeur (payé, non-terminal), `order_status_history` journalisée.
- **`/api/admin/produits/[id]`** : GET (images+vendors), PATCH (recalc acompte/reste, slug unique), DELETE (soft delete).
- **`/api/admin/categories/[id]`** : PATCH (nom/slug/description/image/is_active), DELETE (409 si produits actifs).
- **`/admin/commandes`** : sélecteur de statut admin + ligne détail dépliable (articles, livraison, paiements, historique).
- **`/vendor/commandes`** : sélecteur de statut vendeur (si payé + non-terminal).
- **`/admin/produits`** : modal d'édition, toggle actif/inactif, suppression (corbeille).
- **`/admin/categories`** : édition, toggle actif/inactif, suppression.
- **Dashboards admin/vendeur** : « Activité récente » avec 5 dernières commandes (remplace le placeholder).
- **Footer** : lien WhatsApp fonctionnel (`wa.me` + `NEXT_PUBLIC_ADMIN_WHATSAPP`).
- **Typos corrigés** : register (« Rejoignez Atémi »), a-propos (« combler ce fossé », « lorsque vous avez reçu »), cgv (« photographies »).
- `src/types/database.ts` : `vendor_id` ajouté au type `Order` ; `src/lib/email.ts` : libellés de statut étendus.
- Vérifié `typecheck` ✅, `lint` ✅ (5 warnings préexistants), `build` ✅.

### Audit 2026 — Content Engine (IA) : décision — DÉSACTIVÉ par défaut (fail-closed)
- **Constat** : 22 fichiers d'architecture (router, pipeline, queue, publishing, voice/video/music…) mais AUCUN provider enregistré ; `OPENAI_API_KEY` réelle présente → la génération image/texte aurait facturé de vrais coûts ; les adaptateurs de publication TikTok/Instagram/Facebook sont des **stubs** qui renvoient de faux `published`.
- **Décision** : conserver tout le code (typecheck OK) mais **couper toute la surface** tant que les providers et intégrations réelles ne sont pas implémentés.
- **Implémentation** : `src/lib/ai-engine/config/enabled.ts` (check pur `CONTENT_ENGINE_ENABLED === 'true'`, par défaut OFF) + `feature-flag.ts` (`withContentAdminAuth` → 503 avant auth/DB). Les 8 routes `/api/content-engine/*` passent par ce garde-fou. Bannière « désactivé » dans `/admin/content` (layout serveur + client). Tests `content-engine.test.ts` (11) ✅.
- **Pour activer** : implémenter les providers (router) et les vraies intégrations réseaux sociaux, puis `CONTENT_ENGINE_ENABLED=true`.

## In Progress

### Refonte paiement — phases d'exécution (plan 12 phases validé)

- **MIGRATION 1 — `20260911120000_payment_provider_and_sync.sql`** ✅
  - `create_order` avec `p_provider` (traçabilité réelle du provider au lieu de « mock ») ; drop des overloads 10/11 args (ambiguïté PostgREST) ; `get_order_receipt` / `get_order_tracking` reproduites depuis le backup ; traçabilité `payments` (ADD COLUMN IF NOT EXISTS) ; grants.
- **MIGRATION 2 — `20260911130000_notification_dispatcher.sql`** ✅
  - enum `notification_status` = `sending` (nouveau) + `delivered` (re-assert) ; colonnes `attempts` / `next_retry_at` ; index `idx_notifications_dispatch` sur pending/sending ; RPC `claim_pending_whatsapp_notifications` avec `FOR UPDATE SKIP LOCKED` + re-claim des `sending` stale (>2 min).
- **Dispatcher central — `src/lib/notifications/dispatcher.ts`** ✅
  - `dispatchPendingNotifications` : claim atomique → send → sent / retry / failed ; backoff linéaire 60/120/180 s ; `MAX_ATTEMPTS = 3` ; erreurs définitives → failed (jamais retry) ; `sent` jamais recyclé.
- **Phase 6 — `/api/payment/initiate` (CinetPay)** ✅
  - transactionId déterministe `ATEMI-<order>` (retry sûrs, pas de transaction orpheline) ; métadonnées provider persistées AVANT l'appel CinetPay ; `payment_method` = méthode choisie (plus écrasé par « cinetpay ») ; `payment_url` enregistrée après création ; log `[PAYMENT_CREATED]` / `[PAYMENT_CREATION_FAILED]`.
- **Phase 7 — Webhook non-régression** ✅
  - vérifié (aucune réécriture) ; helpers extraits dans `src/lib/payment/webhook-events.ts` (parseEvent, extractTransactionId, extractAmountCurrency, extractPaymentMethod) et testés unitairement.
- **Phase 8 — UI libellés neutres** ✅
  - `checkout/page.tsx` (« Redirection vers le paiement », erreur générique) et `paiement/page.tsx` (« accepté » sans mention FedaPay).
- **Phase 9 — Environnement CinetPay** ⛔ différé (action utilisateur)
  - clés `CINETPAY_*` ABSENTES ; `PAYMENT_PROVIDER=fedapay` conservé ; bascule uniquement quand les clés sont posées.
- **Phase 10 — Rapport URL publique** ✅
  - aucune URL HTTPS publique stable ; documenté comme **bloqueur E2E** dans `E2E_SANDBOX_TEST_PROCEDURE.md`.
- **Phase 11 — Tests** ✅ (260 tests, 16 suites, typecheck OK)
  - `dispatcher.test.ts` : 2 workers concurrents (1 seul envoi), retry, erreur définitive, max attempts, numéro manquant, sent non recyclé.
  - `webhook-events.test.ts` : parsing JSON / form-encoded / enveloppe FedaPay, montant/devise (XOF sans division, cents Stripe/Paystack /100, CinetPay cpm_*).
  - `cinetpay.test.ts` étendu : mapping statuts ACCEPTED→succeeded, REFUSED→failed, PENDING/CREATED→pending ; erreur HTTP check API ; montant/devise renvoyés.
- **Phase 12 — Documentation E2E sandbox** ✅ (`E2E_SANDBOX_TEST_PROCEDURE.md`)
  - procédure complète (nominal, rejeu webhook, refus, montant/devise divergent, en attente, dispatch concurrent, retry) ; ciblé NON exécuté (pas d'URL publique).
- **Phase 13 — Adresses & villes de livraison** ✅
  - Migration `20260924000000_delivery_zones_benin_v2.sql` : corrige les zones mal classées (Possotomé/Sèmè-Podji/Togba sous Cotonou…), normalise `country='BJ'`, déduplique, crée l'index unique `(country, city, zone_name)`, ajoute la colonne générée `city_normalized` (accent-insensible) et étend le référentiel à ~70 zones / ~60 villes des 12 départements (Abomey-Calavi, Djougou, Allada, Sakété, Pobè, Kétou, Savè…). **À DÉPLOYER** (SQL Editor).
  - API publique `GET /api/delivery-zones` : `?country=BJ`, mode `?cities=1` (liste des villes + frais min + nb zones pour l'autocomplétion), recherche de ville via `city_normalized` (insensible accents/casse/espaces), ordre par frais.
  - Checkout : `<datalist>` des villes livrées, autocorrection de la saisie (`normalizeCity`, ex. `come` → `Comè`), correction d'une zone de livraison obsolète après changement de ville, champ adresse en textarea avec repère (« rue, quartier, point de repère »), encart vert « Livraison disponible à {ville} — à partir de {frais} ».
  - **Admin** : page `/admin/livraison` (groupée par ville, recherche, création modal, édition, bascules Disponible/Active, désactivation douce) + API `/api/admin/delivery-zones` (GET/POST, doublon → 409) et `[id]` (PATCH/DELETE) protégées `withAdminAuth` ; entrée « Livraison » ajoutée au menu admin.
  - Schémas zod `deliveryZoneCreateSchema` / `deliveryZoneUpdateSchema` (`.trim()`, frais 0–1 000 000, pays 2 lettres) + helper `normalizeCity` ; tests `delivery-zones.test.ts` (21) ✅.

### WhatsApp/Meta Cloud API — code 100% prêt et vérifié :
  - Webhook `/api/whatsapp/webhook` : route OK (GET 403 si mauvaise clé, POST 401 si signature invalide — vérifiés en live).
  - Middleware : `src/middleware.ts` contourne désormais `/api/whatsapp/webhook` (réponse immédiate, plus d'appel Supabase sur cette route).
  - Tests Jest : 28/28 PASS (`whatsapp.test.ts` + `whatsapp-webhook.test.ts`).
  - Config `.env.local` : `WHATSAPP_PROVIDER=meta`, Phone Number ID + WABA ID présents.
  - **BLOQUANT** : `WHATSAPP_API_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` sont des **placeholders** (ex. `<le numéro à copier …>`) → Meta répond « Invalid OAuth access token ». Remplacer par les vrais secrets (voir instructions).
  - Tunnel public bloqué ce soir (réseau local filtre api.trycloudflare.com) → Callback URL à renseigner depuis une URL publique (+ tunnel qui fonctionne ou domaine déployé).

## Blocked

- **URL publique HTTPS** (`NEXT_PUBLIC_APP_URL=http://localhost:3000`) : à remplacer par le domaine déployé → requise pour FedaPay `notify_url` et le callback webhook Meta. Ensuite suivre `E2E_SANDBOX_TEST_PROCEDURE.md`.
- **UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absents** : en production, les endpoints financiers (création commande, confirmation paiement, etc.) sont **bloqués en fail-closed** tant qu'Upstash n'est pas configuré (cf. `src/lib/rate-limit.ts`).
- **BREVO_API_KEY absente** : les emails transactionnels sont loggés en console (jamais envoyés).
- **CRON_SECRET absent** : `/api/notifications/dispatch` fonctionne manuellement (admin) et après paiement, mais pas en automatisation cron. `vercel.json` ajouté (cron toutes les 5 min) — fonctionne dès que `CRON_SECRET` est défini dans Vercel.
- **Migrations** `20260911120000` / `20260911130000` / `20260911140000` / `20260924000000_delivery_zones_benin_v2.sql` à déployer (via SQL Editor Supabase ou CLI avec `SUPABASE_DB_PASSWORD`). Sans la dernière, l'autocomplétion des villes du checkout reste vide (`city_normalized` absente).
- **E2E paiement réel** : non exécuté (pas d'URL publique).

## Configuré (mise à jour récente)

- **WhatsApp Meta** : `WHATSAPP_API_TOKEN` (EAA…, 308 car.), `WHATSAPP_APP_SECRET` (32 car.), `WHATSAPP_VERIFY_TOKEN` (`atemi_webhook…`) sont de **vraies valeurs** désormais → reste uniquement la webhook URL publique à déclarer chez Meta (`/api/whatsapp/webhook`).
- `PAYMENT_PROVIDER=fedapay`, `WHATSAPP_PROVIDER=meta`.

## Go-live checklist

1. Déployer sur Vercel (build + env `NEXT_PUBLIC_APP_URL=https://<domaine>`).
2. Créer un compte Upstash → renseigner `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
3. Créer un compte Brevo → `BREVO_API_KEY` ; valider l'expéditeur.
4. Générer un `CRON_SECRET` (ex. `openssl rand -hex 24`) → le définir dans Vercel.
5. Dans le SQL Editor Supabase : appliquer `20260911120000_payment_provider_and_sync.sql`, `20260911130000_notification_dispatcher.sql`, `20260911140000_notification_dispatch_index.sql`.
6. Chez Meta : déclarer la webhook URL publique `/api/whatsapp/webhook` (token = `WHATSAPP_VERIFY_TOKEN`).
7. Chez FedaPay : renseigner la `notify_url` publique.
8. Exécuter `E2E_SANDBOX_TEST_PROCEDURE.md` (paiement sandbox + webhook).
9. Vérifier en vrai navigateur le parcours complet (achat → acompte → statut vendeur/admin → suivi).

## Known Issues

- ESLint timeout (Node 24 + eslint 8.x)

## Database Change Required

- **À DÉPLOYER** : `supabase/migrations/20260911120000_payment_provider_and_sync.sql` (create_order + p_provider, get_order_receipt/tracking, traçabilité payments)
- **À DÉPLOYER** : `supabase/migrations/20260911130000_notification_dispatcher.sql` (enum sending, attempts/next_retry_at, claim RPC)
- **À DÉPLOYER** : `supabase/migrations/20260924000000_delivery_zones_benin_v2.sql` (correctifs + extension zones/villes Bénin, `city_normalized`, index unique)
- `remote_schema_backup.sql` est un snapshot OLD (pré-07/09) — ne pas l'utiliser comme référence de la DB live

## Routes disponibles

| Route | Type | Auth | Description |
|---|---|---|---|
| `/` | Server | Non | Accueil |
| `/login` | Client | Non | Connexion |
| `/register` | Client | Non | Inscription |
| `/products` | Server | Non | Catalogue |
| `/products/[slug]` | Server | Non | Fiche produit |
| `/cart` | Client | Non | Panier |
| `/checkout` | Client | Non | Checkout |
| `/paiement` | Client | Non | Paiement |
| `/confirmation` | Client | Non | Confirmation |
| `/suivi` | Client | Non | Suivi commande |
| `/recu` | Client | Non | Reçu |
| `/mon-compte` | Client | Oui | Dashboard client |
| `/vendor` | Client | Vendor | Dashboard vendeur |
| `/vendor/produits` | Client | Vendor | Produits vendeur |
| `/vendor/commandes` | Client | Vendor | Commandes vendeur |
| `/admin` | Client | Admin | Dashboard admin |
| `/admin/commandes` | Client | Admin | Commandes admin |
| `/admin/paiements` | Client | Admin | Paiements admin |
| `/admin/vendeurs` | Client | Admin | Vendeurs admin |
| `/admin/produits` | Client | Admin | Produits admin |
| `/admin/categories` | Client | Admin | Catégories admin |
| `/admin/livraison` | Client | Admin | Zones de livraison admin |
| `/api/delivery-zones` | API | Public | Zones + villes de livraison (autocomplétion) |
| `/api/admin/delivery-zones` | API | Admin | CRUD zones (list + create, doublon → 409) |
| `/api/admin/delivery-zones/[id]` | API | Admin | Modifier / désactiver une zone |
| `/api/payment/confirm` | API | Admin | Confirmation paiement |
| `/api/admin/orders/[id]` | API | Admin | Détail + statut commande |
| `/api/admin/produits/[id]` | API | Admin | Édition / suppression produit |
| `/api/admin/categories/[id]` | API | Admin | Édition / suppression catégorie |
| `/api/vendor/orders/[id]` | API | Vendor | Statut commande vendeur |
| `/api/whatsapp/webhook` | API | Meta | Webhook WhatsApp (GET vérif + POST events) |
| `/api/notifications/dispatch` | API | Admin/CRON | Envoi des notifications WhatsApp |

## Prochaines étapes

1. Configurer `.env.local` avec les clés Supabase
2. Tester le parcours complet dans le navigateur
3. Ajouter des tests
4. Optimisation UX et performance
