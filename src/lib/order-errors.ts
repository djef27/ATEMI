interface OrderRpcError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

const DATABASE_MIGRATION_ERROR =
  'La base de données doit être mise à jour pour accepter cette commande. Exécutez les migrations Supabase en attente (supabase db push), puis réessayez.';

export function getOrderCreationError(error: OrderRpcError): { message: string; status: number } {
  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    error.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('orders_total_split_check') ||
    message.includes('function public.create_order')
  ) {
    return { message: DATABASE_MIGRATION_ERROR, status: 503 };
  }

  if (message.includes('stock insuffisant')) {
    return { message: 'Le stock disponible a changé. Actualisez le panier puis réessayez.', status: 409 };
  }
  if (
    message.includes('produit introuvable') ||
    message.includes('produit invalide') ||
    message.includes('n’est plus disponible') ||
    message.includes("n'est plus disponible")
  ) {
    return { message: 'Un produit du panier n’est plus disponible. Actualisez le panier puis réessayez.', status: 409 };
  }
  if (message.includes('zone de livraison indisponible')) {
    return { message: 'Cette zone de livraison n’est plus disponible. Sélectionnez une autre zone puis réessayez.', status: 409 };
  }
  if (message.includes('le nom du client est obligatoire')) {
    return { message: 'Le nom est requis.', status: 400 };
  }
  if (message.includes('le numero de telephone est obligatoire')) {
    return { message: 'Le numéro de téléphone est requis.', status: 400 };
  }
  if (message.includes('adresse de livraison est obligatoire')) {
    return { message: 'L’adresse de livraison est requise.', status: 400 };
  }
  if (message.includes('la ville de livraison est obligatoire')) {
    return { message: 'La ville de livraison est requise.', status: 400 };
  }

  return {
    message: 'Erreur lors de la création de la commande. Réessayez dans quelques instants.',
    status: 500,
  };
}
