# Progress

## Complément de sécurité, DNS et reprise — 2026-10-13

- Une migration additive locale, `20261013100000_scope_orders_vendor_read_to_authenticated.sql`, limite la policy `orders_vendor_read` au rôle `authenticated` tout en conservant son prédicat vendeur existant. Un test statique de non-régression est ajouté dans `src/lib/__tests__/security/order-rls-role-scope.test.ts`. Ces changements sont locaux et non appliqués; le test de policy, les régressions RPC/récupération (3 suites, 19 tests au total) et le typecheck passent. Le test vérifie le SQL du dépôt, pas le comportement d'une base distante.
- L'inventaire DNS public du domaine renvoie huit serveurs NS délégués : quatre `dns1`–`dns4.p01.nsone.net` et quatre `ns01`–`ns04.squarespacedns.com`. L'apex résout vers les quatre IP Squarespace relevées précédemment. Les MX Proton Mail restent publiés (`mail.protonmail.ch` priorité 10 et `mailsec.protonmail.ch` priorité 20). Le registrar identifié précédemment est Tucows. Cette délégation mixte ne justifie pas une modification NS; aucun DNS n'a été changé.
- Le projet Vercel existant n'est toujours pas accessible dans le compte/équipe disponibles, donc les enregistrements A/CNAME exacts exigés par la configuration de domaine Vercel ne sont pas connus. Ne pas déduire ni appliquer une IP/CNAME générique; préserver MX, TXT/SPF et DKIM jusqu'à validation du projet et du fournisseur DNS autoritaire.
- Le dernier historique Supabase lisible reste distant jusqu'à `20261009190000`, avec `20261011120000_restrict_order_email_recovery.sql` en attente. Le rafraîchissement ultérieur a échoué à l'authentification PostgreSQL; la nouvelle migration `20261013100000_scope_orders_vendor_read_to_authenticated.sql` s'ajoute localement à cette attente. Aucune application distante, sauvegarde ou restauration n'est confirmée.

## Vérifications complémentaires — 2026-10-13

- **Audits npm rafraîchis** : `npm audit --omit=dev` en ligne retourne `found 0 vulnerabilities`; l'audit complet en ligne compte 42 vulnérabilités uniquement dans les dépendances de développement (35 high, 7 moderate, 0 critical). Le dry-run de `npm audit fix` sans `--force` n'ajoute, ne retire et ne modifie aucun paquet. Les avis portent notamment sur `braces@3.0.3`, `postcss-selector-parser@6.1.4` et `sprintf-js@1.0.3`; les corrections proposées par npm impliquent Tailwind CSS 4.3.3 et Jest 30.5.2 (mises à niveau majeures). `braces@3.0.3` est la version publiée la plus récente vue sur le registre; éviter une mise à niveau majeure sans migration et tests dédiés. `handlebars@4.7.10` est l'override installé et n'est pas signalé par cet audit.
- **Audit hors ligne** : `npm audit --omit=dev --offline` retourne également `found 0 vulnerabilities` depuis le cache; ce résultat seul ne rafraîchit pas les avis.
- **Régressions locales** : typecheck réussi; tests ciblés récupération/paiements : 4 suites, 36 tests réussis. Les résultats complets précédents (24 suites/335 tests, lint, build) restent consignés plus bas.
- **Nouvelle validation complète** : `npm test -- --runInBand` passe, 24 suites et 335 tests; `npm run lint` passe sans avertissements/erreurs ESLint (Next.js affiche seulement la dépréciation future de `next lint`); `npm run build` passe et génère les 70 pages/routes; `npm run typecheck` passe. `git diff --check` passe.
- **ACL Supabase, vérification en lecture seule** : `get_order_by_email` est toujours exécutable par `anon` et `authenticated` et par `service_role`; `create_order` reste réservé à `service_role`. `get_order_by_email` est une fonction `SECURITY DEFINER` qui renvoie le token de suivi et des informations personnelles depuis la migration `20260901130000`. L'accès direct contourne le rate-limit de la route de récupération; c'est le blocage de sécurité actif (gravité élevée). Le contrôle `has_function_privilege('public', ...)` de la migration existante est valide : la requête distante réussit et renvoie `false` pour `PUBLIC` et `anon`; l'alerte initiale disant que ce test SQL échouerait est retirée.
- **Sauvegardes/migrations distantes** : nouvel appel `supabase backups list` : `walg_enabled: true`, `pitr_enabled: false`, listes de sauvegardes vide (`backups: []`, `physical_backup_data: {}`). Aucun backup restaurable ni test de restauration n'est prouvé. L'actualisation de `supabase migration list --linked` a échoué sur l'authentification PostgreSQL du rôle temporaire (`password authentication failed`); le dernier relevé réussi reste : migration distante `20261009190000`, `20261011120000` en attente. Aucune migration n'a été appliquée.
- **Vercel** : nouvelle tentative en lecture seule avec `--scope elvisdjogbenou-collab` refusée par la CLI (« You cannot set your Personal Account as the scope »). Elle ne permet donc pas d'énumérer les projets personnels. Le constat établi reste limité à l'unique équipe visible `atemi`, sans projet ni domaine; cela ne prouve pas l'absence du projet dans un autre compte/une autre équipe.

## Complément de reprise — accès, permissions et préparation DNS (2026-10-13)

- **Contrôle Supabase distant en lecture seule** : seul `20261011120000` reste local; toutes les migrations précédentes sont inscrites à distance. Les privilèges réels montrent `get_order_by_email` (SECURITY DEFINER) encore exécutable par `anon` et `authenticated`; `create_order` et `confirm_deposit_payment` sont limités à `service_role`. `get_order_tracking` et `get_order_receipt` restent accessibles aux rôles clients avec le numéro et le token bearer, préservant le suivi/reçu légitime. `get_my_vendor_id` et `order_has_vendor_items` ont les permissions vendeur attendues. Le REVOKE local de `get_order_by_email` n'interrompt donc ni la route de récupération (client admin) ni le suivi token.
- **RLS** : les politiques observées sur `orders` comprennent les accès admin, client-propriétaire et vendeur via helpers. Le checkout invité passe par l'API serveur `service_role`; aucune policy n'a été modifiée. Aucune migration n'a été poussée.
- **Sauvegardes** : `supabase backups list` sur le projet lié `hmjvjepmnvtoabddsxeu` retourne `backups: []`, `physical_backup_data: {}` et `pitr_enabled: false`. Le CLI ne retourne pas le plan de facturation; le tableau Supabase redirige vers la connexion. Ne pas activer une option payante ni extraire une copie locale de données clients sans accès/accord et destination de sauvegarde approuvée; aucune sauvegarde/restauration n'est attestée.
- **Vercel** : le CLI identifie l'utilisateur `elvisdjogbenou-collab` et une seule équipe `ATEMI` (`atemi`, plan Hobby). La liste de projets et la liste de domaines dans cette équipe sont toutes deux vides; le dépôt n'a pas de `.vercel/project.json` ni de `.vercel/repo.json`. Le projet existant de production n'est pas visible dans ce compte/équipe; aucune liaison, création, variable d'environnement ou publication n'a été faite. L'accès à l'autre compte/équipe qui détient le projet est nécessaire.
- **Variables** : .env.local contient les identifiants de variables locaux pour Supabase et KKiaPay sandbox, mais pas `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` ni `BREVO_API_KEY`. Ce constat local ne permet aucune conclusion sur Preview/Production; ces variables Vercel sont inaccessibles tant que le projet ne l'est pas. Aucun secret/valeur n'a été affiché.
- **DNS** : RDAP identifie Tucows Domains Inc. comme registrar (domaine verrouillé pour transfert/mise à jour). La délégation publie quatre NS `p01.nsone.net` et quatre NS Squarespace; le SOA annonce `dns1.p01.nsone.net`, et les réponses SOA/MX ont été concordantes depuis NS1 et Squarespace. `atemi.com` et `www.atemi.com` servent actuellement Squarespace. Proton Mail utilise les MX prioritaires 10/20, SPF, vérification TXT et trois CNAME DKIM; aucun DMARC n'a été trouvé. Ne pas remplacer la délégation NS : la bascule web éventuelle devra modifier seulement l'A apex et le CNAME `www`, après confirmation du projet, avec les valeurs exactes affichées par la fiche Domaine Vercel. Documentation Vercel actuelle : l'IP apex est spécifique au projet (souvent `76.76.21.21`) et le CNAME `www` peut aussi être spécifique; conserver MX/TXT/DKIM et ne pas ajouter d'AAAA vers l'ancien hébergeur.
- **Tests paiement/RPC** : 7 suites ciblées et 63 tests passent sans transaction réelle. La suite complète précédemment confirmée passe (24 suites, 335 tests); typecheck/lint/build réussis. Ce sont des tests de code/mocks, pas un paiement sandbox E2E.

## Validation de reprise et état distant (2026-10-13)

- **Dépôt** : branche `master`, alignée sur `origin/master` au commit `94fc686` au début de la reprise. Nombreux changements préexistants non commités : conservés. Aucun commit, push, déploiement, changement DNS ou paiement réel effectué.
- **Validation reproductible (rerun du 2026-10-13)** : typecheck réussi; lint réussi (seul avertissement : `next lint` déprécié); tests **24 suites, 335 tests réussis**; build production réussi avec **70 pages** générées.
- **Audit npm en ligne** : `npm audit --omit=dev` = 0 vulnérabilité ; audit complet = 42 entrées (35 high, 7 moderate, 0 critical), toutes dans les dépendances de développement. Les chemins dominants sont Jest 29, Tailwind CSS 3 et leur graphe, ainsi que `eslint-config-next` et `@types/jest`. Les avis incluent des risques DoS dans `braces` (motifs imbriqués), `postcss-selector-parser` (complexité quadratique) et `sprintf-js` (précision non bornée). Les correctifs agrégés proposés requièrent des mises à niveau majeures. `handlebars@4.7.10` est présent via override et n'apparaît pas dans l'audit courant. Ne pas forcer des versions transversales incompatibles ; planifier des mises à niveau coordonnées et testées.
- **Supabase lié — lecture seule** : historique distant identique au local jusqu'à `20261009190000`; `20261011120000` est la seule migration affichée comme locale mais non distante. Vérification des ACL effectives : `create_order` n'est exécutable ni par `anon` ni par `authenticated`, mais l'est par `service_role`; les helpers vendeurs gardent leurs rôles attendus.
- **Risque sécurité confirmé en production** : malgré la route serveur de récupération, `get_order_by_email(text,text)` reste exécutable par `anon` et `authenticated`; cette fonction `SECURITY DEFINER` renvoie un tracking token et des données de commande, ce qui contourne le rate limit par IP. `get_order_tracking(text,uuid)` est également appelable par ces rôles, mais exige le bearer token ; l'accès anonyme à ce suivi n'est pas considéré ici comme un défaut indépendant. La migration `20261011120000` a été corrigée localement pour retirer les droits `PUBLIC`, `anon` et `authenticated` sur `get_order_by_email`, conserver `service_role` et valider les ACL dans le SQL. **Non appliquée** : demande une autorisation explicite, sauvegarde vérifiée et validation du parcours après déploiement.
- **Vercel et domaine** : CLI présente/authentifiée; aucun projet n'est visible dans le compte courant et l'inspection de `atemi-supabase27` renvoie `project_not_found`. Le répertoire n'a pas de lien `.vercel`. DNS-over-HTTPS confirme `www.atemi.com → ext-sq.squarespace.com` et l'apex renvoie des IP Squarespace; la connexion directe à `atemi.com` expire depuis cet environnement. Aucun changement DNS ou déploiement.
- **Parcours local HTTP** : accueil renvoie 200 et routes protégées redirigent (307) vers l'authentification ; plusieurs pages lentes et endpoints dépendant de Supabase n'ont pas donné de réponse avant le timeout. La réponse 400 à un payload invalide sur `/api/orders` est attendue. Aucun checkout réel ni paiement sandbox bout en bout validé.
- **Sauvegardes** : `supabase backups list` renvoie `backups: []`, `physical_backup_data: {}` et `pitr_enabled: false`. Aucune sauvegarde répertoriée ni restauration vérifiée; le changement de privilèges ne doit pas être appliqué en production dans ces conditions.

## Mise à jour du 2026-10-11

- **Audits UI/accessibilité, rédaction et sécurité** appliqués en correctifs ciblés.
- **Accessibilité** : passage des anneaux de focus en `focus-visible` (boutons, `.btn-*`, `.input-base`), `aria-label` sur les boutons icônes (header, panier, quantité, galerie, statut de commande), `aria-hidden="true"` sur les icônes décoratives, `role="status"`/`aria-live` sur les toasts et messages de chargement, `role="alert"` sur l'erreur de paiement.
- **Modales/overlays** : `product-gallery` doté de `role="dialog"`/`aria-modal`, fermeture Échap, navigation flèches, restitution du focus, `overscroll-contain` ; `quick-view-modal` conserve son piège de focus ; backdrops convertis en éléments interactifs accessibles.
- **Copie** : ellipse typographique `…` et accents restaurés (page paiement, suivi, reçu, chargement, placeholders).
- **Animations** : remplacement de `transition-all` par des propriétés explicites + `motion-reduce:transition-none` (HeroSection, CtaSection, CategoryCard, HowItWorks, TrustEngagements, NewsletterSignup, PromoBanner, mes-commandes, mobile-preview).
- **Alertes natives** remplacées par des toasts sur les pages admin/content, admin/vendeurs et vendor/produits.
- **Docs** : `README.md`, `PRODUCTION_PAYMENTS.md`, `PROGRESS.md`, `LOCAL_VALIDATION.md`, `E2E_SANDBOX_TEST_PROCEDURE.md` (titres en casse de phrase, suppression des séparateurs `---`, rigueurs typographiques, acronymes épelés : SEO, RLS, CSP).
- **Tests** : `src/lib/__tests__/security/audit-fixes.test.ts` ajouté (27 tests des correctifs de la session). Suite complète : **21 suites, 306 tests, tous réussis**.
- **Vérifications locales** : `typecheck` réussi ; `lint` sans avertissement ni erreur ESLint (seul message : `next lint` sera retiré en Next 16).
- **Sécurité RPC déployée** : la migration `20261009190000_restrict_order_rpc_execution.sql` (étendue à `get_my_vendor_id`) a été appliquée à la base distante et vérifiée — voir la section « Déploiement de la restriction RPC (2026-10-11) ».

## Correctifs paiement & suivi (2026-10-11)

- **KKiaPay verify (P2A)** : le contrôle montant + devise (`XOF`) est déplacé **avant** la persistance de `provider_transaction_id` sur `payments` — une transaction vérifiée dont le montant diverge ne peut plus « empoisonner » l'index unique `(provider, provider_transaction_id)`. Idempotence `pay:kkiapay:…` et gestion `23505` conservées.
- **Webhook CinetPay (P2B)** : les notifications CinetPay ne sont pas signées ; leur statut déclaré (`cpm_result`) n'est plus jamais utilisé. L'action (`payment_confirmed` / `payment_failed` / attente) est dérivée **uniquement** de l'API `payment/check`. Un événement falsifié « payment.failed » ne peut plus descendre un paiement réellement réussi. `payment_refunded` est refusé sans résultat API vérifié par le prestataire (reconcilation manuelle) ; le code automatique `paid → refunded` a été retiré.
- **Suivi invité email + n° (P2C)** : nouvelle route serveur `POST /api/order/recovery` (validation zod + rate-limit strict `rl:order:recovery:` 5 / 15 min / IP, fail-closed Upstash en prod) qui remplace l'appel navigateur au RPC `SECURITY DEFINER get_order_by_email` (qui exposait le `tracking_token` + PII à `anon`). La page `/suivi` a été migrée vers cette route (même format de réponse). Migration `20261011120000_restrict_order_email_recovery.sql` **préparée localement, NON appliquée** (REVOKE anon) — à appliquer uniquement après validation du parcours en production.
- **Clés KKiaPay SANDBOX** : configurées dans `.env.local` (`PAYMENT_PROVIDER=kkiapay`, `KKIAPAY_SANDBOX=true`) ; mapping confirmé par l'utilisateur (Public = hex, Private = `tpk_…`, Secret = `tsk_…`). Smoke test `verify(…)` sur un id de transaction inexistant : authentification acceptée par l'API sandbox (réponse « Transaction Not Found »), aucune erreur d'auth ni timeout réseau — **aucun paiement réel effectué**.
- **Doc officielle consultée** : CinetPay (le webhook n'est qu'un « signal », statut réel via `POST /v2/payment/check` ; mécanisme `notify_token` non exploitable sans colonne dédiée — évolutif futur) ; KKiaPay (server SDK `kkiapay({...}).verify(transactionId)`, statuts `SUCCESS`/`FAILED`).
- **Tests (rerun du 2026-10-13)** : **24 suites, 335 tests, tous réussis** ; typecheck ✅, lint ✅, build ✅ (route `/api/order/recovery` présente).
- **Reste** : le flux sandbox E2E complet (paiement de test réel avec les numéros sandbox KKiaPay) n'est **pas** exécuté (pas d'URL publique HTTPS ; aucune commande de test en production) — voir `E2E_SANDBOX_TEST_PROCEDURE.md`. Vercel et ses variables restent non vérifiés car le projet n'est pas accessible depuis le compte CLI courant; DNS observé sur Squarespace. Rapport final : `PREPRODUCTION_READINESS_REPORT.md` → décision **PRÊTE POUR SANDBOX — PAS PRÊTE POUR PRODUCTION**.

## Déploiement de la restriction RPC (2026-10-11)

- **Projet lié** : `hmjvjepmnvtoabddsxeu` (seul projet Actif de l'organisation = base live ; pas de préproduction séparée).
- **Audit distant en lecture seule** (via `supabase db query --linked`, sans mot de passe) avant application : migrations appliquées jusqu'à `20261002190000` ; RLS active sur orders/order_items/payments/notifications/products ; aucune policy INSERT permissive sur les commandes/paiements ; `orders.vendor_id` présent ; aucun doublon `(provider, provider_transaction_id)` ; 23 commandes / 23 paiements cohérents.
- **Faille P0 confirmée en production** : `create_order` et `order_has_vendor_items` exécutables par `anon` et `authenticated`.
- **Application (autorisée le 2026-10-11)** : migration `20261009190000_restrict_order_rpc_execution.sql`, étendue à `get_my_vendor_id` (REVOKE PUBLIC/anon + GRANT authenticated/service_role), exécutée en une transaction (`BEGIN`/`COMMIT`) et enregistrée dans `supabase_migrations.schema_migrations`.
- **Vérification post-application** : `create_order` → seulement `service_role` (+ postgres) ; `order_has_vendor_items` → `authenticated` + `service_role` ; `get_my_vendor_id` → `authenticated` + `service_role` ; aucun grant PUBLIC (`=X`) restant sur ces fonctions ; migration enregistrée.
- **Non-régression** : le seul appel de `create_order` est serveur (`src/app/api/orders/route.ts` via client admin service-role) — chemin de code inchangé ; `order-rpc-privileges.test.ts` passe (4 tests, dont le nouveau sur `get_my_vendor_id`) ; typecheck et lint OK.
- **Restauration** : script de rollback (re-grant des ACL d'origine) préparé et conservé hors du dépôt.

## Mise à jour du 2026-10-09

- **P0 confirmé** : la base distante autorise toujours `anon` à exécuter `public.create_order`, une fonction `SECURITY DEFINER` qui crée une commande et décrémente le stock. L'API `/api/orders` utilise bien `createAdminSupabaseClient()` pour son appel RPC; il n'existe donc pas de raison de laisser le RPC ouvert directement aux clients.
- **Correctif local préparé, non déployé** : migration additive `20261009190000_restrict_order_rpc_execution.sql`. Elle réserve `create_order` à `service_role`, retire l'accès anonyme au helper de lecture vendeur, préserve l'accès `authenticated` nécessaire à la politique RLS et vérifie les privilèges attendus dans la migration.
- **Non-régression ajoutée** : `src/lib/__tests__/security/order-rpc-privileges.test.ts` vérifie le contenu de la migration, les rôles et le chemin serveur du checkout. **3 tests ciblés réussis**. Les assertions SQL de la migration contrôleront les privilèges effectifs au moment où elle sera appliquée.
- **État** : la migration n'a pas été appliquée à Supabase distant; l'application modifierait les droits d'accès de production et reste soumise à autorisation. Le checkout invité doit être validé en environnement sandbox après application.
- **Dépendances** : `source-map-js@1.2.2` est épinglé; le dernier audit de production réussi signalait 0 vulnérabilité. `handlebars@4.7.10` corrige le signalement critique auparavant apporté par `ts-jest`. Le dernier audit complet réussi après ce correctif comptait 42 avis (7 modérés, 35 élevés, 0 critique), dans les dépendances de développement.
- **Vulnérabilités de développement restantes** : `braces@3.0.3` arrive par Tailwind CSS 3.4.19 (`chokidar`/`micromatch`); `postcss-selector-parser@6.1.4` arrive via Tailwind CSS et `postcss-nested`; `sprintf-js@1.0.3` arrive via `ts-jest` → `js-yaml` → `argparse`. Les mises à niveau proposées nécessitent des changements de dépendances plus larges/majeurs; pas de mise à niveau forcée faite. Une nouvelle vérification npm dans cette session n'a pas pu joindre le registre (socket hang up), donc les nombres ci-dessus sont le dernier audit réussi, pas un nouveau résultat.
- **Vérifications locales** : typecheck réussi; lint réussi sans avertissement ni erreur ESLint (Next signale seulement que `next lint` sera supprimé en Next 16); suite complète réussie (**20 suites, 279 tests**). Le build a compilé avec succès et termine encore la collecte/rendu des pages.
- **État Supabase** : `supabase migration list --linked` confirme que les migrations distantes sont synchronisées jusqu'à `20261002190000`; `20261009190000` est uniquement locale.

## Identité et marchés

- La vitrine, le référencement (SEO), l'Open Graph, les courriels, le catalogue, À propos, le parcours d'achat et les contenus marketing générés présentent désormais Atémi comme une marketplace tournée vers les communautés africaines.
- Le Bénin est nommé comme marché de lancement, et non comme limite de la marque. Le formulaire vendeur crée toujours les inscriptions avec `country: 'BJ'`; son libellé le précise.
- Le checkout propose BJ, CI et TG, mais leur présence dans la liste ne prouve pas que les paiements et la livraison sont opérationnels dans ces marchés. Les textes renvoient aux options effectivement proposées à la commande; les mentions légales et l'adresse béninoises restent inchangées.
- Aucun paiement réel, changement DNS ou changement de privilèges Supabase n'a été effectué.

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

### Audit 2026 : Content Engine (IA), décision : désactivé par défaut (fail-closed)
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
  - Checkout : `<datalist>` des villes livrées, autocorrection de la saisie (`normalizeCity`, ex. `come` → `Comè`), correction d'une zone de livraison obsolète après changement de ville, champ adresse en textarea avec repère (« rue, quartier, point de repère »), encart vert « Livraison disponible à {ville} : à partir de {frais} ».
  - **Admin** : page `/admin/livraison` (groupée par ville, recherche, création modal, édition, bascules Disponible/Active, désactivation douce) + API `/api/admin/delivery-zones` (GET/POST, doublon → 409) et `[id]` (PATCH/DELETE) protégées `withAdminAuth` ; entrée « Livraison » ajoutée au menu admin.
  - Schémas zod `deliveryZoneCreateSchema` / `deliveryZoneUpdateSchema` (`.trim()`, frais 0–1 000 000, pays 2 lettres) + helper `normalizeCity` ; tests `delivery-zones.test.ts` (21) ✅.

### WhatsApp/Meta Cloud API — code 100% prêt et vérifié :
  - Webhook `/api/whatsapp/webhook` : route OK (GET 403 si mauvaise clé, POST 401 si signature invalide, vérifiés en live).
  - Middleware : `src/middleware.ts` contourne désormais `/api/whatsapp/webhook` (réponse immédiate, plus d'appel Supabase sur cette route).
  - Tests Jest : 28/28 PASS (`whatsapp.test.ts` + `whatsapp-webhook.test.ts`).
  - Config `.env.local` : `WHATSAPP_PROVIDER=meta`, Phone Number ID + WABA ID présents.
  - **BLOQUANT** : `WHATSAPP_API_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` sont des **placeholders** (ex. `<le numéro à copier …>`) → Meta répond « Invalid OAuth access token ». Remplacer par les vrais secrets (voir instructions).
  - Tunnel public bloqué ce soir (réseau local filtre api.trycloudflare.com) → Callback URL à renseigner depuis une URL publique (+ tunnel qui fonctionne ou domaine déployé).

## Blocked

- **URL publique HTTPS** (`NEXT_PUBLIC_APP_URL=http://localhost:3000`) : à remplacer par le domaine déployé → requise pour FedaPay `notify_url` et le callback webhook Meta. Ensuite suivre `E2E_SANDBOX_TEST_PROCEDURE.md`.
- **UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absents** : en production, les endpoints financiers (création commande, confirmation paiement, etc.) sont **bloqués en fail-closed** tant qu'Upstash n'est pas configuré (cf. `src/lib/rate-limit.ts`).
- **BREVO_API_KEY absente** : les emails transactionnels sont loggés en console (jamais envoyés).
- **CRON_SECRET absent** : `/api/notifications/dispatch` fonctionne manuellement (admin) et après paiement, mais pas en automatisation cron. `vercel.json` ajouté (cron toutes les 5 min), fonctionne dès que `CRON_SECRET` est défini dans Vercel.
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
- `remote_schema_backup.sql` est un snapshot OLD (pré-07/09), ne pas l'utiliser comme référence de la DB live

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

---

## Correction du 2026-10-18 — mesures directes sur les catalogues distants

Les constats des sessions antérieures de ce fichier (lignes ~16, ~22, ~35-36)
affirmaient que `get_order_by_email(text,text)` « reste exécutable par `anon` et
`authenticated` ». **C'est faux à la date du 2026-10-18.** Sondage direct des
catalogues **distants** (Management API, lecture seule) :

| Rôle | `get_order_by_email` | `create_order` | `order_has_vendor_items` | `get_order_receipt` | `get_order_tracking` | `get_my_vendor_id` | `confirm_deposit_payment` |
|---|---|---|---|---|---|---|---|
| `anon` | **false** | false | false | true | true | false | false |
| `authenticated` | **false** | false | true | true | true | true | false |
| `service_role` | true | true | true | true | true | true | true |

Lignes de conduite retenues :

- Le REVOKE de `20261011120000` **est en vigueur** ; le RPC direct depuis le
  navigateur est impossible, la récupération passe par `POST /api/order/recovery`.
- **0** fonction `SECURITY DEFINER` de `public` est sans `SET search_path`
  (25 au total) → l'affirmation d'un dump « 16 fonctions sans `search_path` »
  n'est pas confirmée par les catalogues.
- `get_order_receipt` / `get_order_tracking` restent volontairement `anon=true`
  (le suivi public repose sur l'entropie du `tracking_token`) mais propageaient
  `sqlerrm` → corrigé par `20261018140000` (non appliquée à distance).

Reste **non appliqué à distance** (aucun canal d'écriture : Docker cassé,
SQL distant `read_only=on`) : `20261011120000` (privileges appliqués hors
registre mais non inscrits), `20261013100000`, `20261017120000` (réécrite),
`20261018130000`, `20261018140000`. Les 5 ont été **testées avec succès sur une
base locale restaurée à partir de la sauvegarde gratuite** avant toute
application. Voir `docs/PRODUCTION_READINESS.md` §11.
