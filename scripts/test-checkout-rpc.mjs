import pg from 'pg';

const { Client } = pg;
const defaultDatabaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const databaseUrl = process.env.LOCAL_SUPABASE_DATABASE_URL || defaultDatabaseUrl;
const databaseHost = new URL(databaseUrl).hostname;

if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(databaseHost)) {
  throw new Error('Ce test accepte uniquement une base Supabase locale.');
}

const customerName = 'Jean-Baptiste Dupont de la Vallée';
const customerPhone = '+229 97 12 34 56 78 90 12';
const customerEmail = 'checkout.integration@example.test';

if (customerName.length <= 20 || customerPhone.length <= 20 || customerPhone.length > 25) {
  throw new Error('Les données de test ne couvrent pas les limites longues du checkout.');
}

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});

async function main() {
  let connected = false;
  let transactionOpen = false;

  try {
    await client.connect();
    connected = true;
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query('SET LOCAL ROLE service_role');

    const { rows: products } = await client.query(`
      SELECT id, stock
      FROM public.products
      WHERE status = 'active'
        AND deleted_at IS NULL
        AND stock > 0
      ORDER BY id
      LIMIT 1
      FOR UPDATE
    `);
    const product = products[0];
    if (!product) {
      throw new Error('Aucun produit actif en stock. Ajoutez un produit de test local puis relancez.');
    }

    const { rows } = await client.query(
      `SELECT public.create_order(
        NULL::uuid,
        $1::text,
        $2::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::uuid,
        false,
        'Test RPC checkout (sera annulé)',
        $3::jsonb,
        $4::text,
        'kkiapay'::text
      ) AS result`,
      [
        customerName,
        customerPhone,
        JSON.stringify([{ product_id: product.id, quantity: 1 }]),
        customerEmail,
      ]
    );
    const result = rows[0]?.result;

    if (!result?.success || !result.order_id) {
      throw new Error('La RPC create_order n’a pas renvoyé une commande valide.');
    }

    const { rows: orders } = await client.query(
      `SELECT customer_name, customer_phone, customer_email, status, delivery_address, delivery_city
       FROM public.orders
       WHERE id = $1::uuid`,
      [result.order_id]
    );
    const order = orders[0];
    if (
      !order ||
      order.customer_name !== customerName ||
      order.customer_phone !== customerPhone ||
      order.customer_email !== customerEmail ||
      order.status !== 'pending_payment' ||
      order.delivery_address !== null ||
      order.delivery_city !== null
    ) {
      throw new Error('Les champs client ou le statut de la commande ne correspondent pas.');
    }

    const { rows: payments } = await client.query(
      `SELECT status, provider
       FROM public.payments
       WHERE order_id = $1::uuid
         AND payment_type = 'deposit'`,
      [result.order_id]
    );
    if (payments.length !== 1 || payments[0].status !== 'pending' || payments[0].provider !== 'kkiapay') {
      throw new Error('Le paiement initial devrait exister en attente, sans avoir été initié.');
    }

    const { rows: stockRows } = await client.query(
      'SELECT stock FROM public.products WHERE id = $1::uuid',
      [product.id]
    );
    if (Number(stockRows[0]?.stock) !== Number(product.stock) - 1) {
      throw new Error('Le stock du produit n’a pas été décrémenté comme attendu.');
    }

    await client.query('ROLLBACK');
    transactionOpen = false;
    console.log('PASS : RPC create_order, coordonnées >20 caractères, paiement en attente et stock vérifiés.');
    console.log('PASS : transaction annulée ; aucune commande, aucun paiement ni changement de stock conservé.');
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK');
      transactionOpen = false;
    }
    throw error;
  } finally {
    if (connected) {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('Échec du test d’intégration checkout :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
