# E-Commerce Boutique - Benin

Plateforme e-commerce multi-vendeurs pour le Bénin. Next.js 14 + Supabase + TypeScript + Tailwind CSS.

## Installation

```bash
npm install
```

## Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner les valeurs :

```bash
cp .env.example .env.local
```

### Variables requises

| Variable | Description | Côté |
|----------|-------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase (admin) | Serveur |

### Variables optionnelles

| Variable | Description | Côté |
|----------|-------------|------|
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (ex: https://atemi.bj) — requis pour les webhooks | Public |
| `NEXT_PUBLIC_APP_NAME` | Nom de l'app | Public |
| `NEXT_PUBLIC_ADMIN_WHATSAPP` | Numéro WhatsApp admin | Public |
| `WHATSAPP_API_TOKEN` | Token API WhatsApp | Serveur |
| `WHATSAPP_PROVIDER` | Provider WhatsApp (défaut: mock) | Serveur |
| `WHATSAPP_API_URL` | URL API WhatsApp (ex: graph.facebook.com) | Serveur |
| `WHATSAPP_APP_SECRET` | App secret Meta (validation webhook) | Serveur |
| `WHATSAPP_VERIFY_TOKEN` | Token de vérification webhook WhatsApp | Serveur |
| `PAYMENT_PROVIDER` | Provider paiement (défaut: mock) | Serveur |
| `PAYMENT_API_KEY` | Clé API paiement | Serveur |
| `PAYMENT_API_SECRET` | Secret API paiement | Serveur |
| `PAYMENT_WEBHOOK_SECRET` | Secret webhook paiement | Serveur |
| `CINETPAY_API_KEY` | Clé API CinetPay | Serveur |
| `CINETPAY_SITE_ID` | Identifiant du site CinetPay | Serveur |
| `CINETPAY_SECRET_KEY` | Clé secrète CinetPay | Serveur |
| `CINETPAY_ENABLED_METHODS_BJ/CI/TG` | Méthodes activées dans le compte marchand, séparées par des virgules | Serveur |
| `KKIAPAY_PUBLIC_KEY` | Clé publique KKiaPay transmise au widget web (non secrète) | Serveur |
| `KKIAPAY_PRIVATE_KEY` | Clé privée KKiaPay (vérification serveur) | Serveur |
| `KKIAPAY_SECRET_KEY` | Clé secrète KKiaPay (vérification serveur) | Serveur |
| `KKIAPAY_SANDBOX` | `true` avec les clés Sandbox, `false` avec les clés Live | Serveur |
| `UPSTASH_REDIS_REST_URL` | URL Upstash Redis (rate limiting production) | Serveur |
| `UPSTASH_REDIS_REST_TOKEN` | Token Upstash Redis | Serveur |
| `BREVO_API_KEY` | Clé API Brevo (emails transactionnels) | Serveur |
| `CRON_SECRET` | Secret Bearer pour les routes cron (`/api/notifications/dispatch`, `/api/cron/*`) | Serveur |
| `OPENAI_API_KEY` | Clé OpenAI (Content Engine : textes + images) | Serveur |
| `ELEVENLABS_API_KEY` | Clé ElevenLabs (voix) | Serveur |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Clés API TikTok (publication vidéo) | Serveur |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Clés API Facebook/Instagram (publication) | Serveur |
| `CONTENT_ENGINE_STORAGE_BUCKET` | Bucket de stockage Content Engine | Serveur |

## Lancement développement

```bash
npm run dev
```

http://localhost:3000

## Tests

```bash
npm test
```

## Build production

```bash
npm run build
```

## Lancement production

```bash
npm run start
```

## Configuration Supabase

1. Créer un projet Supabase
2. Exécuter les migrations SQL dans `supabase/migrations/`
3. Configurer les variables d'environnement
4. Le service role key est nécessaire pour les opérations admin (confirmation de paiement)

## Configuration WhatsApp

Renseigner `WHATSAPP_API_TOKEN` et `WHATSAPP_PROVIDER` dans `.env.local` pour activer les notifications WhatsApp. Sans ces variables, l'app fonctionne en mode mock.

## Configuration paiement

Pour KKiaPay, renseigner `PAYMENT_PROVIDER=kkiapay`, les trois clés `KKIAPAY_*` et `KKIAPAY_SANDBOX=true` pour le Sandbox. Le widget est chargé après création de la commande, puis chaque transaction est vérifiée côté serveur avec le SDK officiel avant confirmation. Pour CinetPay, renseigner `PAYMENT_PROVIDER=cinetpay`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` et `CINETPAY_SECRET_KEY` ; le webhook `/api/payment/webhook` vérifie chaque transaction avec l'API CinetPay. Les moyens disponibles par pays sont exposés par `GET /api/payment/methods`. FedaPay reste disponible via `PAYMENT_PROVIDER=fedapay`.

## Architecture

- **Frontend** : Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, RLS)
- **State** : Zustand (panier persisté en localStorage)
- **Types** : TypeScript strict

## Routes

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Accueil | Public |
| `/products` | Catalogue | Public |
| `/products/[slug]` | Détail produit | Public |
| `/cart` | Panier | Public |
| `/checkout` | Passage de commande | Connecté |
| `/paiement` | Paiement | Connecté |
| `/confirmation` | Confirmation commande | Connecté |
| `/suivi` | Suivi commande | Public |
| `/recu` | Reçu | Connecté |
| `/mes-commandes` | Commandes client | Connecté |
| `/mon-compte` | Compte client | Connecté |
| `/login` | Connexion | Public |
| `/register` | Inscription | Public |
| `/admin` | Dashboard admin | Admin |
| `/admin/commandes` | Commandes admin | Admin |
| `/admin/paiements` | Paiements admin | Admin |
| `/admin/vendeurs` | Gestion vendeurs | Admin |
| `/admin/produits` | Gestion produits | Admin |
| `/admin/categories` | Gestion catégories | Admin |
| `/vendor` | Dashboard vendeur | Vendeur |
| `/vendor/commandes` | Commandes vendeur | Vendeur |
| `/vendor/produits` | Produits vendeur | Vendeur |
