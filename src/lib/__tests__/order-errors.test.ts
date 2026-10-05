import { getOrderCreationError } from '@/lib/order-errors';

describe('order creation error handling', () => {
  it('explains when the Supabase create_order function is missing', () => {
    const failure = getOrderCreationError({
      code: 'PGRST202',
      message: 'Could not find the function public.create_order',
    });

    expect(failure.status).toBe(503);
    expect(failure.message).toContain('supabase db push');
  });

  it('explains the known delivery total constraint failure', () => {
    const failure = getOrderCreationError({
      message: 'Erreur creation commande : violates orders_total_split_check',
    });

    expect(failure.status).toBe(503);
    expect(failure.message).toContain('migrations Supabase');
  });

  it('returns a retryable conflict when stock changed after checkout loaded', () => {
    const failure = getOrderCreationError({
      message: 'Erreur creation commande : Stock insuffisant pour "Robe"',
    });

    expect(failure.status).toBe(409);
    expect(failure.message).toContain('Actualisez le panier');
  });

  it('does not expose unexpected database details to customers', () => {
    const failure = getOrderCreationError({
      code: 'XX000',
      message: 'secret internal database detail',
    });

    expect(failure.status).toBe(500);
    expect(failure.message).not.toContain('secret');
  });
});
