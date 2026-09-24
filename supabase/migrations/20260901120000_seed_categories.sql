-- Seed categories for the marketplace
-- Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent

INSERT INTO public.categories (id, name, slug, description, is_active) VALUES
  (extensions.uuid_generate_v4(), 'Mode', 'mode', 'Vêtements, looks et tendances', true),
  (extensions.uuid_generate_v4(), 'Perruques', 'perruques', 'Perruques naturelles et artificielles', true),
  (extensions.uuid_generate_v4(), 'Accessoires', 'accessoires', 'Bags, écharpes, ceintures et autres', true),
  (extensions.uuid_generate_v4(), 'Chaussures', 'chaussures', 'Sandals, sneakers, talons et plus', true),
  (extensions.uuid_generate_v4(), 'Beaute', 'beaute', 'Maquillage, soins et produits beauté', true),
  (extensions.uuid_generate_v4(), 'Sacs', 'sacs', 'Sacs à main, sacs à dos et trousses', true),
  (extensions.uuid_generate_v4(), 'Bijoux', 'bijoux', 'Colliers, bagues, boucles d''oreilles', true),
  (extensions.uuid_generate_v4(), 'Maison', 'maison', 'Décoration et articles de maison', true),
  (extensions.uuid_generate_v4(), 'Électronique', 'electronique', 'Gadgets et accessoires tech', true),
  (extensions.uuid_generate_v4(), 'Autres', 'autres', 'Autres produits', true)
ON CONFLICT (slug) DO NOTHING;
