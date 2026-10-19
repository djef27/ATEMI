-- 7. Commandes "retrait" (delivery_required = false) impossibles
-- ----------------------------------------------------------------------------
-- Symptome en production :
--   [ORDER_RPC_ERROR] null value in column "delivery_address" of relation
--   "orders" violates not-null constraint
--
-- Cause :
--   public.create_order force NULL pour delivery_address ET delivery_city
--   quand p_delivery_required est false :
--       case when p_delivery_required then trim(p_delivery_address) else null end
--   alors que les colonnes orders.delivery_address / orders.delivery_city sont
--   NOT NULL. Toute commande sans livraison echoue donc au niveau base,
--   quel que soit le client.
--
-- Incoherence du schema : delivery_zone_id est deja nullable (correct pour un
-- retrait), pas les deux autres. Le front suppose egalement nullable
-- (src/types/index.ts : delivery_address: string | null) et gere le null
-- (admin/commandes, dispatch, whatsapp).
--
-- Correction : aligner delivery_address / delivery_city sur delivery_zone_id
-- en supprimant la contrainte NOT NULL. Non destructif : aucune donnee
-- existante n'est modifiee ni supprimee, seule la contrainte est relaxee.
--
-- NOTE : a appliquer cote distant uniquement apres sauvegarde/PITR actives
-- (voir docs/PRODUCTION_READINESS.md), comme toute migration de ce depot.

ALTER TABLE public.orders
  ALTER COLUMN delivery_address DROP NOT NULL;

ALTER TABLE public.orders
  ALTER COLUMN delivery_city DROP NOT NULL;
