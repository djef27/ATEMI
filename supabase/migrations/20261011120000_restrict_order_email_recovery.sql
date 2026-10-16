-- ============================================================================
-- 20261011120000_restrict_order_email_recovery.sql
--
-- STATUT : MIGRATION PREPAREE LOCALEMENT — NON APPLIQUEE A LA PRODUCTION
-- ============================================================================
--
-- Contexte
-- --------
-- Le look-up invité par e-mail + numéro de commande passait par la fonction
-- SECURITY DEFINER public.get_order_by_email(text, text), executable par le
-- navigateur via le client anon et exposant le tracking_token + informations
-- client (nom, téléphone, ville de livraison) dès que les deux valeurs
-- correspondent.
--
-- Correctif local déjà livré (sans migration)
-- -------------------------------------------
-- La page /suivi utilise désormais la route serveur rate-limitée
-- POST /api/order/recovery (client admin service_role uniquement) au lieu
-- d'appeler directement le RPC depuis le navigateur :
--   - src/app/api/order/recovery/route.ts    (zod + rate limit par IP)
--   - src/app/suivi/page.tsx                 (fetch -> /api/order/recovery)
--   - src/lib/validations.ts                 (orderRecoverySchema)
--   - src/lib/rate-limit.ts                  (RATE_LIMIT_CONFIGS.orderRecovery)
--
-- Objet de cette migration
-- ------------------------
-- Après validation en production du nouveau parcours, réserver l'exécution
-- au service_role : le RPC retourne un token et des données personnelles et
-- ne doit pas être accessible directement aux clients connectés non plus.
--
-- PROCEDURE DE DÉPLOIEMENT (à faire avec l'accord du responsable projet)
-- ----------------------------------------------------------------------
--   1. Déployer la nouvelle route + la page modifiée en production.
--   2. Vérifier fonctionnellement /suivi (modes "Token" et "Email + N°").
--   3. Avant toute application, vérifier l'historique distant et les migrations
--      en attente. Ne pas utiliser "supabase db push --linked" ici : cette
--      commande peut appliquer d'autres migrations locales en attente.
--   4. Après approbation explicite, appliquer uniquement le SQL de cette
--      migration, puis vérifier les privilèges effectifs des quatre rôles.
--
-- ROLLBACK (si nécessaire; rétablit l'exposition préexistante)
-- ------------------------
--   GRANT EXECUTE ON FUNCTION public.get_order_by_email(TEXT, TEXT) TO anon;
--   GRANT EXECUTE ON FUNCTION public.get_order_by_email(TEXT, TEXT) TO authenticated;
-- ============================================================================

-- Supprime tout accès client, y compris les comptes authentifiés.
REVOKE ALL ON FUNCTION public.get_order_by_email(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- La route de récupération utilise le client serveur privilégié.
GRANT EXECUTE ON FUNCTION public.get_order_by_email(TEXT, TEXT) TO service_role;

DO $$
BEGIN
    IF has_function_privilege('public', 'public.get_order_by_email(text,text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.get_order_by_email(text,text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.get_order_by_email(text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'get_order_by_email must not be executable by PUBLIC or client roles';
    END IF;

    IF NOT has_function_privilege('service_role', 'public.get_order_by_email(text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'service_role must be able to execute get_order_by_email';
    END IF;
END
$$;