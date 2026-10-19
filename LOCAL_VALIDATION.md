# Validation locale : paiements (mock) et automatisations

Complément de reprise — 2026-10-13 : la délégation DNS renvoie quatre NS
`p01.nsone.net` et quatre NS Squarespace; l'apex pointe vers Squarespace et les
MX Proton Mail sont présents aux priorités 10 et 20. Aucun enregistrement n'a
été modifié. Le projet Vercel n'étant pas accessible, ses valeurs d'A/CNAME de
domaine ne peuvent pas être établies en sécurité.

La migration locale `20261013100000_scope_orders_vendor_read_to_authenticated.sql`
recrée la policy vendeur avec `TO authenticated` sans changer le prédicat. Le
test ciblé policy + RPC + récupération passe : 3 suites, 19 tests; le typecheck
passe également. Le test inspecte le SQL local, pas une base distante. Migration
non appliquée. Le dernier historique distant vérifié reste `20261009190000`;
la tentative de rafraîchissement échouait à l'authentification PostgreSQL.
Aucune migration distante ou sauvegarde/restauration n'a été exécutée.

Au relevé distant en lecture seule du 2026-10-13, seule la migration
`20261011120000_restrict_order_email_recovery.sql` était en attente; la
migration locale `20261013100000_scope_orders_vendor_read_to_authenticated.sql`
a été créée depuis ce relevé et n'a pas été appliquée. Supabase ne
liste aucune sauvegarde (`pitr_enabled: false`) et le CLI ne donne pas le plan;
ne pas exécuter cette migration en production avant d'avoir une sauvegarde
restaurable, une restauration vérifiée et l'autorisation explicite.

Le projet Vercel attendu n'est pas visible dans l'unique équipe CLI `ATEMI`
(plan Hobby, liste de projets vide). Le dépôt n'est pas lié. Le DNS du site
pointe toujours vers Squarespace; les MX/SPF/DKIM Proton Mail doivent être
conservés pour toute modification web ultérieure.

Une tentative de lister les projets personnels avec
`--scope elvisdjogbenou-collab` a été refusée par Vercel CLI; le résultat vide
concerne donc l'équipe visible et ne permet pas de conclure pour d'autres
comptes. `npm audit --omit=dev --offline` a retourné `found 0 vulnerabilities`
avec le cache disponible, sans rafraîchir les avis du registre.

Revalidation du 2026-10-13 : audit npm en ligne production = 0 vulnérabilité;
audit complet = 42 vulnérabilités de développement (35 high, 7 moderate,
0 critical). Le dry-run `npm audit fix` sans `--force` ne modifie rien; les
remédiations rapportées exigent des mises à niveau majeures de Tailwind CSS et
Jest. `handlebars@4.7.10` n'est pas signalé. Typecheck et tests ciblés de
récupération/paiements réussis (4 suites, 36 tests). Le contrôle SQL de
`has_function_privilege('public', ...)` s'exécute correctement en lecture seule;
il ne nécessite pas de correction.

Nouvelle validation locale complète : typecheck réussi; `npm test -- --runInBand`
réussit avec 24 suites et 335 tests; lint réussi sans erreurs/avertissements
ESLint (message de dépréciation Next.js uniquement); build réussi avec 70
pages/routes; `git diff --check` réussi.

Le contrôle Supabase en lecture seule confirme toujours que les rôles clients
peuvent appeler directement le RPC `get_order_by_email`, lequel expose le token
de suivi et des données de commande et contourne le rate-limit API. La migration
corrective reste non appliquée. Le nouvel inventaire de sauvegardes donne
`walg_enabled: true`, `pitr_enabled: false`, aucune sauvegarde listée. La
tentative de rafraîchir l'historique distant des migrations a échoué sur
l'authentification du rôle PostgreSQL temporaire; utiliser le dernier relevé
réussi indiqué dans `PROGRESS.md`.

Valide le parcours **commande → paiement → notifications WhatsApp → dispatch (cron)**
en mode mock, sans paiement réel. Pour KKiaPay/CinetPay/FedaPay en Sandbox, voir
`E2E_SANDBOX_TEST_PROCEDURE.md`.

> Temps estimé : ~15 min. Aucun paiement réel n'est déclenché en mode `mock`.

## 0. Prérequis (base + données)

### 0.1 Déployer les migrations (SQL Editor Supabase)

Cette procédure vise un projet Supabase **sandbox/non-production**. Vérifier l'URL et
l'identifiant du projet avant toute exécution. Ne pas appliquer ces migrations à la
base de production sans la procédure et l'autorisation prévues dans
`PRODUCTION_PAYMENTS.md`.

Dans le **SQL Editor**, coller et exécuter **dans l'ordre** le contenu de :

1. `supabase/migrations/20260911120000_payment_provider_and_sync.sql` — `create_order` avec `p_provider`, reçu/suivi
2. `supabase/migrations/20260911130000_notification_dispatcher.sql` — enum `sending`, `attempts`, `next_retry_at`, `claim_pending_whatsapp_notifications`
3. `supabase/migrations/20260911140000_notification_dispatch_index.sql` — index de dispatch
4. `supabase/migrations/20260924000000_delivery_zones_benin_v2.sql` — zones/villes + `city_normalized`
5. `supabase/migrations/20261002190000_unique_provider_payment_reference.sql` — empêche de réutiliser une transaction fournisseur sur plusieurs paiements
6. `supabase/migrations/20261009190000_restrict_order_rpc_execution.sql` — limite le RPC de commande au service role; appliquer seulement après validation du checkout hors production et autorisation du changement de privilèges distant
7. `supabase/migrations/20261011120000_restrict_order_email_recovery.sql` — retire l'accès `PUBLIC`, `anon` et `authenticated` à `get_order_by_email` et conserve `service_role` uniquement. Le suivi email+n° passe par `POST /api/order/recovery`. Migration **NON appliquée** : lecture seule du 2026-10-13 confirme que les deux rôles clients peuvent encore exécuter ce RPC en production. Ne pas appliquer avant autorisation explicite, vérification de sauvegarde et validation du parcours déployé.

Sans (1)+(2) : le dispatch échoue (`claim_pending_whatsapp_notifications` introuvable).
Sans (4) : l'autocomplétion des villes du checkout reste vide.

Après application de la migration des privilèges, vérifier dans le SQL Editor que les résultats
`anon_can_create_order` et `authenticated_can_create_order` sont `false`, que
`service_role_can_create_order` est `true` et que seul le rôle authentifié et le
service role peuvent exécuter `order_has_vendor_items` :

```sql
SELECT
  has_function_privilege(
    'anon',
    'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
    'EXECUTE'
  ) AS anon_can_create_order,
  has_function_privilege(
    'authenticated',
    'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
    'EXECUTE'
  ) AS authenticated_can_create_order,
  has_function_privilege(
    'service_role',
    'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
    'EXECUTE'
  ) AS service_role_can_create_order,
  has_function_privilege(
    'anon',
    'public.order_has_vendor_items(uuid,uuid)',
    'EXECUTE'
  ) AS anon_can_probe_vendor_order,
  has_function_privilege(
    'authenticated',
    'public.order_has_vendor_items(uuid,uuid)',
    'EXECUTE'
  ) AS authenticated_can_check_vendor_order,
  has_function_privilege(
    'service_role',
    'public.order_has_vendor_items(uuid,uuid)',
    'EXECUTE'
  ) AS service_role_can_check_vendor_order;
```

Expected results in column order: `false`, `false`, `true`, `false`, `true`, `true`.
Then test guest checkout through `POST /api/orders` in sandbox; do not invoke the
stock-mutating RPC directly in production.

Pour le RPC de récupération après la migration `20261011120000`, vérifier également
que `anon` et `authenticated` ont `EXECUTE = false` et `service_role` a
`EXECUTE = true` sur `public.get_order_by_email(text,text)`. Avant migration,
les deux rôles clients étaient effectivement autorisés (lecture distante
2026-10-13) ; le parcours serveur ne suffit donc pas à fermer l'ancien RPC.

### 0.2 Créer des données de test (via l'UI admin)

1. `npm run dev` → se connecter en admin → `/admin/vendeurs` : créer un vendeur.
2. `/admin/produits` : créer 1 produit actif (avec stock > 0, acompte ~50 %).
3. Le catalogue (`/products`) doit afficher ce produit.

## 1. Configuration locale

`.env.local` contient désormais :

- `PAYMENT_PROVIDER=kkiapay` + `KKIAPAY_SANDBOX=true` et les trois clés sandbox (Public/Private/Secret) — permet de tester le flux de vérification serveur KKiaPay sans réel débit (**jamais de clés sandbox en production** : `getPaymentConfig()` refuse).
- `CRON_SECRET=…` (Bearer pour déclencher le dispatch comme le ferait Vercel Cron).

Vérifier : `PAYMENT_PROVIDER=kkiapay` sur la ligne active, `KKIAPAY_SANDBOX=true`,
`WHATSAPP_PROVIDER=meta`. Le mode `mock` reste disponible pour le parcours hors paiement.

Redémarrer le serveur si `.env.local` a changé :
`npm run dev`

## 2. Passer une commande (flux complet)

1. `/products` → ajouter le produit au panier.
2. `/checkout` → ville (ex. Cotonou → zone Akpakpa), adresse, téléphone.
   - Si l'autocomplétion des villes n'apparaît pas, la migration (0.1.4) n'est pas déployée.
3. Paiement → moyen disponible → « Confirmer ».
   - En mode `mock`, `/paiement` affiche un bouton explicite de simulation.
     Aucun débit réel n'est effectué et cette route est désactivée en production.

Noter `order_number` (format `CMD-YYYYMMDD-HHMMSS-XXXXXX`).

**Vérifier côté banque :**

```sql
SELECT order_number, total_amount, deposit_amount, status
FROM orders ORDER BY created_at DESC LIMIT 3;

SELECT order_id, amount, status, provider, payment_method
FROM payments ORDER BY created_at DESC LIMIT 3;
  -- provider doit être 'mock' (sinon la migration 20260911120000 n'est pas déployée)
```

## 3. Automatisation des notifications WhatsApp

À la création, la commande insère des notifications pas encore envoyées.

**Vérifier les notifications en attente :**

```sql
SELECT status, channel, recipient_phone, message
FROM notifications ORDER BY created_at DESC LIMIT 5;
```

### 3.1 Déclenchement automatique post-paiement

Ce déclenchement est `fire-and-forget` dans le flux de confirmation. Si la
configuration WhatsApp est bonne, le(s) message(s) arrivent sur le numéro indiqué.

### 3.2 Déclenchement manuel / cron (dispatch central)

```powershell
# sans secret → doit répondre 401
Invoke-WebRequest -Uri http://localhost:3000/api/notifications/dispatch `
  -Method POST | Select-Object StatusCode

# avec le Bearer CRON_SECRET → doit répondre 200
$cronSecret = (Select-String -Path .env.local -Pattern '^CRON_SECRET=').Line.Split('=')[1]
Invoke-RestMethod -Uri http://localhost:3000/api/notifications/dispatch `
  -Method POST -Headers @{ Authorization = "Bearer $cronSecret" }

# compteur de notifications whatsapp en attente (dashboard)
Invoke-RestMethod -Uri http://localhost:3000/api/notifications/dispatch
```

**Vérifier l'envoi :**

```sql
SELECT status, attempts, provider_message_id, sent_at, error_message
FROM notifications ORDER BY created_at DESC LIMIT 5;
  -- status='sent' + provider_message_id renseigné ⇨ message réellement parti
```

Deux dispatch simultanés ne doivent jamais envoyer deux fois la même notification
(claim atomique `FOR UPDATE SKIP LOCKED`).

## 4. Tester un fournisseur en Sandbox

1. KKiaPay : les clés Sandbox sont déjà dans `.env.local` (`PAYMENT_PROVIDER=kkiapay`,
   `KKIAPAY_SANDBOX=true`). L'authentification des clés a été vérifiée en live
   (`verify` sur id inexistant → « Transaction Not Found ») ; le débit sandbox réel
   se teste avec un numéro sandbox KKiaPay (voir `E2E_SANDBOX_TEST_PROCEDURE.md`).
2. Pour CinetPay/FedaPay, déployer l'app sur une URL HTTPS et configurer
   `NEXT_PUBLIC_APP_URL` avant les tests avec notifications.
3. Suivre `E2E_SANDBOX_TEST_PROCEDURE.md` (nominal, rejouabilité, refus,
   vérification du montant et de la devise).
4. Vérifier que les lignes `payments.provider` correspondent au fournisseur choisi.
5. Le suivi invité email+n° passe par `POST /api/order/recovery` (rate-limité) :
   vérifier sur `/suivi` que le mode « Email + N° commande » renvoie le token de
   suivi. La vérification distante du 2026-10-13 confirme que `anon` et
   `authenticated` peuvent encore appeler directement `get_order_by_email`.
   Appliquer la migration de restriction seulement après validation du parcours
   déployé, sauvegarde/restauration vérifiée et autorisation explicite.
6. Si WhatsApp est activé, déclarer et tester `/api/whatsapp/webhook` avec
   `WHATSAPP_VERIFY_TOKEN`.

## Vérification finale (tout cocher)

- [ ] Toutes les migrations du dossier `supabase/migrations` appliquées
- [ ] Une commande fictive créée en mock avec `payments.provider='mock'`
- [ ] La commande apparaît côté admin (`/admin/commandes`) et vendeur (`/vendor/commandes`)
- [ ] Les notifications whatsapp passent `pending → sent` (message reçu)
- [ ] `/api/notifications/dispatch` : 401 sans Bearer, 200 avec

---

## Correction du 2026-10-18 — mesures directes, ce document faisait autorité à tort

Les relevés du **2026-10-13** consignés plus haut affirmaient que `anon` et
`authenticated` pouvaient **toujours** exécuter `get_order_by_email`. Un sondage
direct des catalogues **distants** (Management API, lecture seule, requête
`has_function_privilege`) le **2026-10-18** donne le résultat inverse :

| Rôle | `EXECUTE` sur `public.get_order_by_email(text,text)` |
|---|---|
| `anon` | **false** |
| `authenticated` | **false** |
| `service_role` | **true** |

→ **le REVOKE de `20261011120000` est bien en vigueur en production** (appliqué
hors registre, comme l'affirmait `docs/PRODUCTION_READINESS.md`). Les entrées du
2026-10-13 de ce fichier sont **considérées obsolètes** sur ce point. La
récupération par e-mail passe uniquement par `POST /api/order/recovery`
(rate-limitée, validée), et le RPC direct depuis le navigateur est impossible.

Mesures complémentaires du même jour, toujours sur les catalogues distants :

- **25** fonctions `SECURITY DEFINER` dans `public`, dont **0 sans
  `SET search_path`** → l'affirmation d'un dump « 16 fonctions sans
  `SET search_path` » n'est **pas confirmée** par les catalogues.
- `get_order_receipt(text,uuid)` et `get_order_tracking(text,uuid)` restent
  **`anon=true`** (attendu : le suivi public repose sur l'entropie du
  `tracking_token`) — mais elles propageaient `sqlerrm` à l'appelant, corrigé par
  `20261018140000_generic_order_rpc_error_messages.sql` (non appliquée à distance).

Test local complet du 2026-10-18 : restauration de la sauvegarde gratuite sur une
instance PostgreSQL jetable, puis application des **5** migrations en attente
(**5/5 OK**), preuve fonctionnelle du correctif retrait, puis arrêt et suppression
de l'instance. Typecheck, lint et `npm test` (28 suites / 400 tests) au vert.
Voir `docs/PRODUCTION_READINESS.md` §11.