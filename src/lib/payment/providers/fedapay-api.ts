export interface FedaPayTransaction {
  id: string;
  reference: string;
  status: string | null;
  paymentUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTransaction(payload: unknown): FedaPayTransaction {
  if (!isRecord(payload)) {
    throw new Error('FedaPay a retourné une transaction invalide');
  }

  const transaction = isRecord(payload['v1/transaction'])
    ? payload['v1/transaction']
    : payload;
  const id = transaction.id;
  const reference = transaction.reference;
  if (
    (typeof id !== 'number' && typeof id !== 'string') ||
    !/^\d+$/.test(String(id)) ||
    typeof reference !== 'string' ||
    !reference
  ) {
    throw new Error('FedaPay a retourné une référence de transaction invalide');
  }

  return {
    id: String(id),
    reference,
    status: typeof transaction.status === 'string' ? transaction.status : null,
    paymentUrl: typeof transaction.payment_url === 'string' ? transaction.payment_url : null,
  };
}

async function requestFedaPay(
  path: string,
  apiSecret: string,
  baseUrl: string,
  init?: RequestInit
): Promise<unknown> {
  const response = await fetch(`${baseUrl}/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiSecret}`,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`FedaPay API a répondu avec le statut HTTP ${response.status}`);
  }
  return response.json();
}

export function getFedaPayBaseUrl(apiSecret: string): string {
  return apiSecret.startsWith('sk_live_')
    ? 'https://api.fedapay.com'
    : 'https://sandbox-api.fedapay.com';
}

export async function createFedaPayTransaction(
  input: {
    apiSecret: string;
    baseUrl: string;
    body: Record<string, unknown>;
  }
): Promise<FedaPayTransaction> {
  const payload = await requestFedaPay('/transactions', input.apiSecret, input.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.body),
  });
  return parseTransaction(payload);
}

export async function getFedaPayTransaction(
  transactionId: string,
  apiSecret: string,
  baseUrl: string
): Promise<FedaPayTransaction> {
  if (!/^\d+$/.test(transactionId)) {
    throw new Error('L’identifiant de transaction FedaPay est invalide');
  }
  const payload = await requestFedaPay(
    `/transactions/${encodeURIComponent(transactionId)}`,
    apiSecret,
    baseUrl
  );
  return parseTransaction(payload);
}

export async function createFedaPayPaymentUrl(
  transactionId: string,
  apiSecret: string,
  baseUrl: string
): Promise<string> {
  if (!/^\d+$/.test(transactionId)) {
    throw new Error('L’identifiant de transaction FedaPay est invalide');
  }
  const payload = await requestFedaPay(
    `/transactions/${encodeURIComponent(transactionId)}/token`,
    apiSecret,
    baseUrl,
    { method: 'POST' }
  );
  const url = isRecord(payload) ? payload.url : null;
  if (typeof url !== 'string') {
    throw new Error('FedaPay n’a pas retourné de lien de paiement');
  }

  let paymentUrl: URL;
  try {
    paymentUrl = new URL(url);
  } catch {
    throw new Error('FedaPay a retourné un lien de paiement invalide');
  }
  if (paymentUrl.protocol !== 'https:') {
    throw new Error('FedaPay a retourné un lien de paiement non sécurisé');
  }
  return paymentUrl.toString();
}
