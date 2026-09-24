-- ============================================================================
-- URGENT FIX: remove ambiguous create_order overload
-- La migration 20260831010000 a recree create_order() avec un ordre de
-- parametres different au lieu de remplacer la fonction existante (meme noms
-- de parametres, ordre different = signature differente en PostgreSQL).
-- Resultat : deux fonctions create_order coexistent, PostgREST ne peut plus
-- choisir laquelle appeler (PGRST203). Checkout casse pour tout le monde.
-- On supprime la version cassee (celle qui reference des colonnes orders
-- inexistantes : vendor_id, remaining_amount, payment_status...) et on
-- restaure la version d'origine, fonctionnelle.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_order(text,text,text,text,jsonb,text,uuid,boolean,text,uuid);