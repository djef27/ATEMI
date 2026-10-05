# PROCÉDURE DE TEST E2E SANDBOX (PAIEMENT)

Document de procédure pour valider de bout en bout les flux de paiement réels
(KKiaPay, CinetPay et FedaPay) AVANT tout passage en production.

> **STATUT : À EXÉCUTER AVEC DES CLÉS SANDBOX.**
> Les tests CinetPay/FedaPay nécessitent une URL HTTPS publique stable pour les
> notifications. KKiaPay utilise son widget web et une vérification serveur; il
> ne dépend pas de `NEXT_PUBLIC_APP_URL` ni du webhook générique.

---

## 0. Prérequis (blocage actuel)

- [ ] Pour CinetPay/FedaPay seulement : déployer derrière une URL HTTPS publique
      et renseigner `NEXT_PUBLIC_APP_URL`.
- [ ] Choisir un seul fournisseur pour le test. Pour KKiaPay, configurer les trois
      clés Sandbox `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_PRIVATE_KEY` et
      `KKIAPAY_SECRET_KEY`, puis `PAYMENT_PROVIDER=kkiapay` et
      `KKIAPAY_SANDBOX=true`.
- [ ] Pour CinetPay, configurer les clés sandbox :
      `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`.
- [ ] Pour FedaPay, configurer ses clés sandbox et son secret webhook.
- [ ] Migrations déployées :
      `20260911120000_payment_provider_and_sync.sql` +
      `20260911130000_notification_dispatcher.sql` +
      `20261002190000_unique_provider_payment_reference.sql`.

---

## 1. Préparation des données de test

1. Créer une commande via le checkout avec un montant faible (ex. acompte
   1 000 XOF).
2. Noter : `order_number`, `tracking_token`, `id` du `payments` créé.
3. Vérifier que la ligne `payments` a bien `provider = 'cinetpay'` et
   `transaction_reference = ATEMI-<order>` (traçabilité réelle, plus « mock »).

```sql
SELECT id, order_id, amount, currency, status, provider,
       transaction_reference, payment_method, payment_url
FROM payments
ORDER BY created_at DESC
LIMIT 1;
```

## 2. Scénarios E2E

### 2.0 KKiaPay (widget + vérification serveur)

1. Créer une commande via le checkout et ouvrir le widget KKiaPay.
2. Utiliser un numéro Sandbox documenté par KKiaPay (ex. `97000000` pour
   succès, `97000003` pour refus au Bénin).
3. Après le succès du widget, vérifier que le navigateur appelle
   `POST /api/payment/kkiapay/verify` avec l'identifiant de transaction.
4. Vérifier que le serveur confirme la transaction via le SDK KKiaPay avant
   toute mise à jour du paiement. Un retour du widget seul ne doit jamais mettre
   une commande en `paid`.
5. Rejouer la même transaction : elle ne doit pas être appliquée à une seconde
   commande ni déclencher une seconde confirmation.

Le widget peut être testé depuis une origine autorisée dans le compte marchand.
En cas de blocage CSP, vérifier les directives `script-src`, `frame-src` et
`connect-src` dans `next.config.mjs`.

### 2.1 Parcours nominal
1. Checkout → redirection vers `payment_url` CinetPay (page de paiement hébergée).
2. Payer **en mode test** avec un moyen de paiement actif.
3. Attendre le retour (returnUrl) → page `/paiement?order=…&token=…&return=1`.
4. Vérifier état intermédiaire : `payments.status = 'pending'`
   (jamais `paid` avant l'API de vérification).
5. Vérifier réception webhook → `payments.status = 'paid'`,
   `verified_at` renseigné, `provider_transaction_id` = id CinetPay.
6. Vérifier :
   - ordre `status = 'confirmed'`, `deposit_amount` confirmé ;
   - reçu `/recu` visible ;
   - notifications WhatsApp envoyées (status `sent`) ;
   - email de confirmation reçu ;
   - `receipt_number` généré (unique).

### 2.2 Webhook rejoué (idempotence)
Renvoyer le MÊME webhook (même `cpm_trans_id`).
- Attendu : même réponse, pas de double confirmation ;
  `payments.status` reste `paid` ;
  `already_processed = true` côté réponse ;
  aucune nouvelle notification WhatsApp (ne rien re-envoyer).

### 2.3 Paiement refusé
1. Refuser le paiement en mode test.
2. Attendu : `payments.status = 'failed'`,
   `failure_reason = 'Transaction refusée par le fournisseur'`,
   ordre **non** confirmé, aucun reçu.

### 2.4 Montant divergent (sécurité)
1. Forcer un webhook dont `cpm_amount` ≠ montant stocké.
2. Attendu : HTTP 400, `Montant divergent entre fournisseur et système`,
   `payments.status` reste `pending`.

### 2.5 Devise divergente (sécurité)
1. Forcer un webhook avec `cpm_currency != 'XOF'`.
2. Attendu : HTTP 400, `Devise divergente`, statut inchangé.

### 2.6 Paiement en attente
1. Webhook avec statut fournisseur `PENDING` / `CREATED`.
2. Attendu : réponse « Paiement CinetPay en attente », **jamais** `paid`.
3. Confirmation uniquement quand l'API `check` (migration) renvoie `ACCEPTED`.

### 2.7 Double dispatch concurrent (file WhatsApp)
1. Déclencher 2 workers `/api/notifications/dispatch` simultanés.
2. Attendu : chaque notification envoyée AU PLUS une fois
   (claim via `FOR UPDATE SKIP LOCKED`, tests unitaires associés).

### 2.8 Retry notification
1. Éteindre l'API Meta (ou réseau) pendant un cycle.
2. Attendu : statut repars en `pending`, `attempts+1`, `next_retry_at` dans le
   futur ; après 3 tentatives → `failed`, plus jamais re-soulevé.

---

## 3. Vérifications DB attendues

```sql
-- Paiement confirmé avec traçabilité provider réelle
SELECT status, provider, transaction_reference, provider_transaction_id,
       payment_method, verified_at, webhook_received_at
FROM payments WHERE order_id = '<order_id>';

-- Notifications
SELECT status, attempts, next_retry_at, error_message
FROM notifications ORDER BY created_at DESC;
```

---

## 4. Quitter le sandbox

1. Remettre `PAYMENT_PROVIDER=mock` après les tests Sandbox.
2. Effacer toutes les commandes de test et logs webhook de test en base.
3. Ne passer en production qu'avec des **clés live** et après validation
   complète de la liste de sécurité dans `PRODUCTION_PAYMENTS.md`.