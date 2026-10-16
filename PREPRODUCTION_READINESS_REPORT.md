# Rapport préproduction — Atémi

Date initiale : 2026-10-11. Vérification complémentaire : 2026-10-13.
Périmètre : finalisation préproduction des paiements, du suivi de commande et des
docs d'exploitation. Aucun paiement réel, aucune commande de test en production,
aucune migration de production, aucune modification DNS/Vercel n'ont été
effectués pendant cette session.

### Complément de constat — DNS et policy vendeur (2026-10-13)

- La délégation DNS renvoie quatre NS `p01.nsone.net` et quatre NS Squarespace.
  L'apex pointe vers Squarespace; les deux MX Proton Mail sont présents aux
  priorités 10/20. Aucune modification n'a été faite. Faute d'accès au projet
  Vercel, les cibles exactes de domaine attendues ne sont pas vérifiables.
- Migration additive locale préparée :
  `20261013100000_scope_orders_vendor_read_to_authenticated.sql` restreint
  `orders_vendor_read` aux utilisateurs authentifiés en préservant le filtre
  vendeur. Elle n'est pas appliquée à la base distante. Les tests ciblés policy
  + RPC/récupération passent (3 suites, 19 tests) et le typecheck passe. Le test
  vérifie le SQL du dépôt, pas le comportement distant.
- Le dernier relevé distant des migrations reste `20261009190000`;
  `20261011120000_restrict_order_email_recovery.sql` est en attente. La
  tentative de rafraîchissement a échoué à l'authentification PostgreSQL.
  Aucune sauvegarde/restauration n'est confirmée (`pitr_enabled: false`).

## Décision

**PRÊTE POUR SANDBOX — PAS PRÊTE POUR PRODUCTION.**

### Mise à jour vérifiée du 2026-10-13

- Contrôle complémentaire : la migration distante la plus récente reste
  `20261009190000`; seule `20261011120000` est en attente. Les ACL réellement
  interrogées confirment `get_order_by_email` accessible à `anon` et
  `authenticated`, tandis que `create_order` et `confirm_deposit_payment` sont
  réservés à `service_role`. Le suivi/reçu tokenisés restent accessibles aux
  clients et ne sont pas modifiés par la migration de récupération.
- `supabase backups list` pour le projet lié renvoie une liste vide et
  `pitr_enabled: false`; le niveau de plan n'est pas disponible dans la réponse
  du CLI. Aucune procédure de restauration n'a pu être vérifiée.
- Vercel : utilisateur CLI `elvisdjogbenou-collab`, équipe unique `ATEMI`
  (`atemi`, Hobby); cette équipe contient **0 projet et 0 domaine**. Le bon
  projet n'est donc pas accessible depuis le compte courant. Un essai de
  consultation du périmètre personnel avec `--scope elvisdjogbenou-collab` est
  refusé par la CLI (« You cannot set your Personal Account as the scope »);
  l'absence de projet n'est confirmée que pour l'équipe visible, pas pour tous
  les comptes possibles.
- DNS : registrar Tucows; délégation mixte NS1/Squarespace, SOA sur NS1.
  Le site reste chez Squarespace. Les MX, SPF et DKIM de Proton Mail sont
  présents; DMARC absent. Une éventuelle bascule ne doit pas toucher ces
  enregistrements ni la délégation; les valeurs web exactes doivent venir des
  Domain settings du projet Vercel existant, actuellement inaccessible.
- Tests ciblés paiements/RPC : 7 suites, 63 tests passés, tous simulés; aucun
  paiement de test fournisseur E2E ou réel exécuté.
- Audit supplémentaire hors ligne : `npm audit --omit=dev --offline` termine
  avec `found 0 vulnerabilities` depuis le lockfile/cache disponible. Il ne
  rafraîchit pas les avis du registre; l'audit en ligne reste nécessaire dès
  que le réseau est disponible.
- Revalidation en ligne : `npm audit --omit=dev` retourne 0 vulnérabilité de
  production. L'audit complet retourne 42 vulnérabilités de développement (35
  high, 7 moderate, 0 critical); `npm audit fix --dry-run` sans `--force` ne
  propose aucun changement. Les remédiations indiquées par npm passent par
  Tailwind CSS 4.3.3 et Jest 30.5.2, toutes deux majeures. Les paquets touchés
  incluent `braces@3.0.3`, `postcss-selector-parser@6.1.4` et
  `sprintf-js@1.0.3`. `handlebars@4.7.10` n'est pas signalé par l'audit actuel.
- Nouvelle validation ciblée : typecheck réussi; 4 suites et 36 tests de
  récupération/paiements réussis. Aucun paiement sandbox fournisseur n'a été
  exécuté. La vérification SQL directe confirme que `has_function_privilege`
  accepte l'argument `public` et renvoie `false` pour `get_my_vendor_id()`;
  l'alerte de revue de code sur une erreur SQL à cet endroit est retirée.
- Revalidation complète locale : `npm test -- --runInBand` réussit (24 suites,
  335 tests); `npm run lint` réussit sans erreurs ni avertissements ESLint
  (Next.js signale uniquement la dépréciation à venir de `next lint`);
  `npm run build` réussit et génère 70 pages/routes; typecheck et
  `git diff --check` réussissent.
- Nouvelle lecture Supabase : les ACL restent inchangées; `anon` et
  `authenticated` peuvent toujours exécuter `get_order_by_email`, tandis que
  `create_order` reste service-role-only. La fonction `SECURITY DEFINER` expose
  un token de suivi et des données de commande; l'API de récupération
  rate-limitée peut ainsi être contournée par l'appel RPC direct. Gravité :
  élevée. `supabase backups list` retourne `walg_enabled: true`,
  `pitr_enabled: false` et aucune sauvegarde répertoriée. La dernière tentative
  d'actualiser l'historique des migrations a échoué sur le mot de passe du rôle
  temporaire PostgreSQL; le dernier relevé réussi (migration distante
  `20261009190000`, `20261011120000` en attente) reste la référence. Aucune
  migration ou modification de privilèges distante n'a été effectuée.

- Sur le dépôt courant, `npm run typecheck` et `npm run lint` ont réussi
  (seul avertissement : `next lint` est déprécié). `npm test -- --runInBand`
  passe : 24 suites et 335 tests. `npm run build` a réussi et généré 70 pages.
- `npm audit --omit=dev` confirme 0 vulnérabilité (70 dépendances de production).
  `npm audit` relève 42 entrées (35 high, 7 moderate) dans l'arbre de
  développement, surtout les branches Jest 29, Tailwind 3, `eslint-config-next`
  et `@types/jest`.
  Les avis comprennent notamment des DoS de motifs imbriqués (`braces`),
  d'analyse de sélecteurs CSS (`postcss-selector-parser`) et de précision
  numérique non bornée (`sprintf-js`). Les paquets directs exposés incluent
  Jest 29, Tailwind 3, `eslint-config-next` et `@types/jest`; les correctifs
  agrégés signalés nécessitent des mises à niveau majeures. `handlebars@4.7.10`
  n'est pas signalé par cet audit.
  Aucune montée de version majeure n'a été appliquée sans migration et
  validation complètes.
- Supabase CLI est authentifiée et le contrôle est strictement en lecture seule.
  Les migrations distant/local concordent jusqu'à `20261009190000`; la migration
  `20261011120000` reste absente de l'historique distant. Les ACL confirment
  `create_order`: anon=false, authenticated=false, service_role=true.
- **Exposition de récupération confirmée en production** :
  `get_order_by_email(text,text)` (SECURITY DEFINER, données client + token)
  reste exécutable par anon et authenticated. Le parcours serveur rate-limité
  ne bloque pas les appels RPC directs. La migration locale
  `20261011120000_restrict_order_email_recovery.sql` retire les droits aux deux
  rôles client, conserve service_role et inclut des assertions; elle n'a pas été
  appliquée faute de validation/approbation du changement de droits.
- Vercel CLI est installée et répond à `whoami`, mais le dépôt n'est pas lié
  (`.vercel/project.json`/`repo.json` absents), aucun projet n'est visible dans
  le compte courant, et l'inspection du projet historique `atemi-supabase27`
  renvoie `project_not_found`. L'accès à un autre compte/équipe peut différer;
  le déploiement et ses paramètres ne sont pas vérifiés.
- DNS public via Google DNS-over-HTTPS : `www.atemi.com` est un CNAME vers
  `ext-sq.squarespace.com`; l'apex résout vers les IP Squarespace
  `198.49.23.*` / `198.185.159.*`. Cela confirme que le domaine n'est pas
  dirigé vers Vercel. Le test HTTPS direct de l'apex expire dans cet
  environnement. Aucun changement DNS.
- Un smoke test local a confirmé la page `/` en 200 et les routes protégées
  `/mon-compte`, `/vendor` et `/admin` en redirection 307. D'autres routes et
  appels API ont dépassé le délai en raison de la lenteur de l'environnement /
  de l'accès Supabase; il ne s'agit pas d'une validation fonctionnelle complète.
- `supabase backups list` renvoie `backups: []`, `physical_backup_data: {}`
  et `pitr_enabled: false`. Aucune sauvegarde listée ni restauration vérifiée;
  ne pas appliquer de migration de production tant qu'une sauvegarde et une
  restauration exploitable, le déploiement du parcours serveur et l'approbation
  ne sont pas confirmés.

- Le code des risques identifiés (KKiaPay verify, webhook CinetPay, exposition
  `get_order_by_email`) est corrigé localement; la suite complète actuelle passe
  (24 suites, 335 tests) et typecheck, lint et build ont réussi.
- Les clés KKiaPay **sandbox** sont configurées localement et leur
  authentification a été vérifiée en live (aucun paiement réel).
- La validation sandbox E2E n'est **pas** exécutée (aucune URL HTTPS publique).
  Vercel et ses variables ne sont pas vérifiables depuis le compte courant
  (CLI authentifiée, mais projet non trouvé); la production n'est pas déclarable
  avant l'accès au bon projet, la validation E2E et les contrôles de configuration.

## Résultats par domaine

| Domaine | État |
|---|---|
| KKiaPay verify — montant/devise contrôlés **avant** persistance `provider_transaction_id` | **PASS** (tests + code) |
| Webhook CinetPay — transitions dérivées de l'API `payment/check` uniquement ; `payment_refunded` refusé sans résultat API | **PASS** (tests) |
| Suivi invité — route serveur `POST /api/order/recovery` (zod + rate-limit, fail-closed) | **PASS** (tests) |
| Révocation `anon` sur `get_order_by_email` | **PRÉPARÉ, NON APPLIQUÉ** (migration `20261011120000` locale) |
| Clés KKiaPay sandbox (mapping Public/Private/Secret) | **VÉRIFIÉ** (live, sans paiement) |
| Suites de tests | 24 suites, **335 tests réussis** ; typecheck, lint, build OK |
| Parcours E2E sandbox de paiement | **NON VÉRIFIÉ** (pas d'URL publique) |
| Vercel (projet, environnements, protection, déploiements) | **NON VÉRIFIÉ** (CLI authentifiée, projet non visible dans le compte courant) |
| DNS `atemi.com` / `www` | **SQUARESPACE CONFIRMÉ** via DNS-over-HTTPS, pas Vercel |
| Variables Vercel de production (Upstash, Brevo, CRON_SECRET, paiement) | **NON VÉRIFIABLES** (projet non visible dans le compte courant) |
| Webhook WhatsApp / CinetPay `notify_url` publics | **BLOQUÉ** (pas d'URL publique) |

## Commandes de reproduction

Prérequis : `.env.local` avec `PAYMENT_PROVIDER=kkiapay`, `KKIAPAY_*` sandbox,
`KKIAPAY_SANDBOX=true` (aucune valeur affichée ici).

```
npm test
npm run typecheck
npm run lint
npm run build
```

## Fichiers changés dans cette session

- `src/app/api/payment/kkiapay/verify/route.ts` — contrôle montant/devise avant persistance (P2A).
- `src/app/api/payment/webhook/route.ts` — action dérivée de l'API provider, refus des refunds non vérifiés (P2B).
- `src/app/api/order/recovery/route.ts` — nouvelle route serveur de suivi (P2C).
- `src/app/suivi/page.tsx` — migration vers `/api/order/recovery`, interface `EmailLookupResult` simplifiée, rendu « Solde restant »/« Ville » corrigé.
- `src/lib/validations.ts` — `orderRecoverySchema`.
- `src/lib/rate-limit.ts` — `RATE_LIMIT_CONFIGS.orderRecovery` (5 / 15 min / IP).
- `supabase/migrations/20261011120000_restrict_order_email_recovery.sql` — **locale, NON appliquée**.
- Tests : `src/lib/__tests__/payment/kkiapay-verify-order.test.ts`, `src/lib/__tests__/payment/webhook-action-trust.test.ts`, `src/lib/__tests__/security/order-recovery.test.ts`, ajouts `src/lib/__tests__/payment/cinetpay.test.ts`.
- Docs : `PROGRESS.md`, `PRODUCTION_PAYMENTS.md`, `LOCAL_VALIDATION.md`, `E2E_SANDBOX_TEST_PROCEDURE.md`.

## Procédure d'inspection Vercel + DNS (lecture seule)

Blocage : la CLI répond à `whoami`, mais aucun projet n'est visible dans le
compte courant; l'inspection du projet historique `atemi-supabase27` retourne
`project_not_found`. Le dépôt n'a pas de lien `.vercel/`. L'accès à la bonne
équipe ou au bon compte reste requis — **aucun déploiement ni linking effectué** :

1. RESTRICTION : commander une inspection, pas un changement. Ne pas déployer en
   production, ne pas toucher aux protection zones, ne pas basculer le DNS.
2. Sélectionner le compte/équipe qui contient le projet. Ne jamais coller un
   jeton dans le chat ou dans un fichier du dépôt.
3. Vérifier le projet : `vercel project inspect atemi-supabase27 --scope <équipe>` → production
   branch, build settings, préviews.
4. Vérifier les variables d'environnement de production :
   `vercel env ls production`. Attendu : `NEXT_PUBLIC_APP_URL=https://<domaine>`,
   `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `PAYMENT_PROVIDER`, clés provider, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`/
   `UPSTASH_REDIS_REST_TOKEN`, `BREVO_API_KEY`, `WHATSAPP_*`. Tout secret dans une
   variable `NEXT_PUBLIC_*` ou dupliqué en clair est un signal d'alerte.
5. Vérifier que `PAYMENT_PROVIDER` de production pointe d'abord sur des clés
   **sandbox** (jamais de clés de production tant que le parcours E2E sandbox
   n'est pas validé).
6. Protection : confirmer via le dashboard la présence de la Deployment
   Protection (preview/production derrière authentification) — ou relever son
   absence comme risque.
7. DNS : `nslookup atemi.com` / `nslookup www.atemi.com` et comparer avec les
   instructions de liaison Vercel (actuellement le domaine pointe vers
   Squarespace). Planifier la bascule **après** la validation sandbox E2E et la
   validation du site déployé — jamais avant.
8. Rapport du constat dans `PROGRESS.md` / ce rapport sans révéler de secret.

## Risques restants

- `get_order_by_email` reste exécutable par `anon` et `authenticated` tant que
  `20261011120000` n'est pas appliquée. La migration locale corrigée ne conserve
  que `service_role`; son application reste bloquée par la procédure
  d'autorisation et de sauvegarde.
- `notify_token` CinetPay non stocké (pas de colonne `payments` dédiée) : le
  webhook reste non fiable en soi, compensé par la dérivation des transitions
  depuis l'API `payment/check` ; amélioration future nécessitant une migration.
- Projet Vercel non accessible depuis le compte courant : l'équipe visible
  `ATEMI` (Hobby) ne contient ni projets ni domaines. Le statut Preview/Production
  et les variables Vercel restent inconnus. Les clés Upstash/Brevo absentes du
  `.env.local` local ne permettent pas de déduire leur présence ou absence dans
  Production; seul le rate-limit en production reste bloqué si Upstash n'y est
  pas configuré. DNS dirigé vers Squarespace; E2E sandbox non exécuté.

## Prochaines étapes humaines (ordre recommandé)

1. Se connecter au compte/à l'équipe Vercel qui détient le projet déjà lié à la
   production de ce dépôt, puis vérifier son intégration et ses variables sans
   afficher de valeurs secrètes.
2. Déployer d'abord une Preview sous protection et valider les parcours avec
   les clés sandbox; ne pas envoyer une version Production avant revue des
   variables, tests E2E et sauvegarde/restauration.
3. Vérifier dans Supabase le plan du projet lié et choisir une sauvegarde
   restaurable conforme à ce plan; aucune sauvegarde n'est actuellement listée.
4. Exécuter `E2E_SANDBOX_TEST_PROCEDURE.md` avec un numéro sandbox KKiaPay.
5. Après validation déployée du suivi, sauvegarde/restauration vérifiée et
   autorisation explicite : appliquer uniquement
   `20261011120000_restrict_order_email_recovery.sql`.
6. Déclarer la webhook URL publique chez Meta et CinetPay (`notify_url`).
7. Basculer seulement les enregistrements web vers les valeurs exactes des
   Domain settings Vercel après validation; préserver la délégation DNS et les
   MX/SPF/TXT/DKIM Proton Mail.