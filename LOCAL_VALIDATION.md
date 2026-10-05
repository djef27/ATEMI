# Validation locale — Paiements (mock) & Automatisations

Valide le parcours **commande → paiement → notifications WhatsApp → dispatch (cron)**
en mode mock, sans paiement réel. Pour KKiaPay/CinetPay/FedaPay en Sandbox, voir
`E2E_SANDBOX_TEST_PROCEDURE.md`.

> Temps estimé : ~15 min. Aucun paiement réel n'est déclenché en mode `mock`.

---

## 0. Prérequis (base + données)

### 0.1 Déployer les migrations (SQL Editor Supabase)

Dans le **SQL Editor**, coller et exécuter **dans l'ordre** le contenu de :

1. `supabase/migrations/20260911120000_payment_provider_and_sync.sql` — `create_order` avec `p_provider`, reçu/suivi
2. `supabase/migrations/20260911130000_notification_dispatcher.sql` — enum `sending`, `attempts`, `next_retry_at`, `claim_pending_whatsapp_notifications`
3. `supabase/migrations/20260911140000_notification_dispatch_index.sql` — index de dispatch
4. `supabase/migrations/20260924000000_delivery_zones_benin_v2.sql` — zones/villes + `city_normalized`
5. `supabase/migrations/20261002190000_unique_provider_payment_reference.sql` — empêche de réutiliser une transaction fournisseur sur plusieurs paiements

Sans (1)+(2) : le dispatch échoue (`claim_pending_whatsapp_notifications` introuvable).
Sans (4) : l'autocomplétion des villes du checkout reste vide.

### 0.2 Créer des données de test (via l'UI admin)

1. `npm run dev` → se connecter en admin → `/admin/vendeurs` : créer un vendeur.
2. `/admin/produits` : créer 1 produit actif (avec stock > 0, acompte ~50 %).
3. Le catalogue (`/products`) doit afficher ce produit.

---

## 1. Configuration locale

Déjà en place dans `.env.local` :

- `PAYMENT_PROVIDER=mock` (mode test local ; **jamais en dev==mock en prod**).
- `CRON_SECRET=…` (Bearer pour déclencher le dispatch comme le ferait Vercel Cron).

Vérifier : `PAYMENT_PROVIDER=mock` sur la ligne active, `WHATSAPP_PROVIDER=meta`.

Redémarrer le serveur si `.env.local` a changé :
`npm run dev`

---

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
  -- provider doit être 'mock' (sinon(20260911120000) non déployée)
```

---

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

---

## 4. Tester un fournisseur en Sandbox

1. Pour KKiaPay, configurer les clés Sandbox et `PAYMENT_PROVIDER=kkiapay`,
   `KKIAPAY_SANDBOX=true`, puis redémarrer.
2. Pour CinetPay/FedaPay, déployer l'app sur une URL HTTPS et configurer
   `NEXT_PUBLIC_APP_URL` avant les tests avec notifications.
3. Suivre `E2E_SANDBOX_TEST_PROCEDURE.md` (nominal, rejouabilité, refus,
   vérification du montant et de la devise).
4. Vérifier que les lignes `payments.provider` correspondent au fournisseur choisi.
5. Si WhatsApp est activé, déclarer et tester `/api/whatsapp/webhook` avec
   `WHATSAPP_VERIFY_TOKEN`.

---

## Check rapide final (tout cocher)

- [ ] Toutes les migrations du dossier `supabase/migrations` appliquées
- [ ] Une commande fictive créée en mock avec `payments.provider='mock'`
- [ ] La commande apparaît côté admin (`/admin/commandes`) et vendeur (`/vendor/commandes`)
- [ ] Les notifications whatsapp passent `pending → sent` (message reçu)
- [ ] `/api/notifications/dispatch` : 401 sans Bearer, 200 avec