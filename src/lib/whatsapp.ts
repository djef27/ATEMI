/**
 * WhatsApp notification abstraction.
 *
 * Providers:
 *   - mock: Logs to console (development)
 *   - meta: Meta WhatsApp Cloud API (production)
 *
 * Architecture:
 *   - SQL functions (confirm_deposit_payment) INSERT notifications into the DB
 *   - This module provides sendWhatsAppMessage() for dispatch
 *   - Notifications dispatcher reads pending rows and calls this module
 *
 * SECURITY:
 *   - WHATSAPP_API_TOKEN must NEVER be exposed to the frontend
 *   - This file must ONLY be imported server-side (API routes, server components, cron)
 *   - NEVER use NEXT_PUBLIC_ prefix for WhatsApp secrets
 */

export type WhatsAppProviderName = 'mock' | 'meta';

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryAfter?: number; // seconds to wait before retry (from Meta rate limit)
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const META_SEND_TIMEOUT_MS = 10_000;
const META_MAX_RETRIES = 2;

/**
 * Validate WhatsApp configuration at startup.
 * Returns null if valid, or an error message string.
 */
export function validateWhatsAppConfig(): string | null {
  const provider = getWhatsAppProviderName();

  if (provider === 'mock') return null;

  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!url) return 'WHATSAPP_API_URL manquant pour le provider meta';
  if (!token) return 'WHATSAPP_API_TOKEN manquant pour le provider meta';

  // Basic URL format check
  if (!url.startsWith('https://graph.facebook.com/')) {
    return 'WHATSAPP_API_URL doit commencer par https://graph.facebook.com/';
  }

  return null;
}

/**
 * Get the configured WhatsApp provider name.
 */
export function getWhatsAppProviderName(): WhatsAppProviderName {
  const raw = process.env.WHATSAPP_PROVIDER?.toLowerCase().trim();
  if (raw === 'meta') return 'meta';
  return 'mock';
}

// ---------------------------------------------------------------------------
// Phone number formatting
// ---------------------------------------------------------------------------

/**
 * Clean a phone number to digits only for Meta API.
 * Meta expects country code + number without spaces, dashes, or plus sign.
 * Example: "+229 01 02 03 04" -> "22901020304"
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API implementation
// ---------------------------------------------------------------------------

async function sendViaMeta(
  to: string,
  message: string,
  retryCount = 0
): Promise<WhatsAppSendResult> {
  const apiUrl = process.env.WHATSAPP_API_URL!;
  const token = process.env.WHATSAPP_API_TOKEN!;
  const cleanTo = cleanPhoneNumber(to);

  if (cleanTo.length < 8) {
    return { success: false, error: `Numéro invalide: ${to}` };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), META_SEND_TIMEOUT_MS);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    // Rate limit handling
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
      if (retryCount < META_MAX_RETRIES) {
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return sendViaMeta(to, message, retryCount + 1);
      }
      return {
        success: false,
        error: `Rate limit Meta atteint. Réessayez dans ${retryAfter}s.`,
        retryAfter,
      };
    }

    // Token expired / invalid
    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        error: `Token Meta invalide ou expiré (HTTP ${response.status})`,
      };
    }

    // Phone number not registered on WhatsApp Business
    if (response.status === 400 && data.error?.code === 131047) {
      return {
        success: false,
        error: `Le numéro ${to} n'est pas inscrit sur WhatsApp Business`,
      };
    }

    // Generic API error
    if (!response.ok) {
      const errMsg = data.error?.message || data.error?.error_submessage || `HTTP ${response.status}`;
      console.error(`[WhatsApp Meta] Erreur API: ${errMsg}`);
      return { success: false, error: `Meta API: ${errMsg}` };
    }

    // Success
    const messageId = data.messages?.[0]?.id;
    console.log(`[WhatsApp Meta] Envoyé à ${cleanTo}, messageId: ${messageId}`);
    return { success: true, messageId };

  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Timeout: Meta API ne répond pas' };
    }
    console.error(`[WhatsApp Meta] Erreur réseau:`, err);
    return { success: false, error: `Erreur réseau: ${String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function sendViaMock(to: string, message: string): WhatsAppSendResult {
  console.log(`\n========== WhatsApp MOCK ==========`);
  console.log(`To: ${to}`);
  console.log(`Message:\n${message}`);
  console.log(`===================================\n`);
  return { success: true, messageId: `mock_${Date.now()}` };
}

// ---------------------------------------------------------------------------
// Order notification formatting
// ---------------------------------------------------------------------------

export type OrderNotificationType = 'new_order_vendor' | 'new_order_admin' | 'new_order_customer';

export interface OrderNotificationData {
  order_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  products?: string;
  delivery_city?: string | null;
  delivery_required?: string | boolean;
  delivery_address?: string | null;
  delivery_balance?: string | number;
  subtotal?: string | number;
  delivery_fee?: string | number;
  total_amount?: string | number;
  deposit_amount?: string | number;
  receipt_number?: string | null;
  tracking_link?: string | null;
}

/**
 * Format a WhatsApp message for an order notification type.
 * Mirrors the message templates produced by the SQL functions
 * (confirm_deposit_payment / prepare_*_notification) so the
 * dispatch path and direct-send path stay coherent.
 */
export function formatOrderNotification(
  type: OrderNotificationType,
  data: OrderNotificationData
): string {
  const n = (v: string | number | undefined | null) => (v == null ? '' : String(v));

  switch (type) {
    case 'new_order_vendor':
      return [
        '🛍️ NOUVELLE COMMANDE',
        '',
        `Commande : ${data.order_number}`,
        '',
        `Client : ${data.customer_name || ''}`,
        data.customer_phone ? `Téléphone : ${data.customer_phone}` : '',
        '',
        data.products ? `📦 VOS PRODUITS\n${data.products}` : '',
        '📍 LIVRAISON',
        data.delivery_required
          ? `Ville : ${data.delivery_city || ''}`
          : 'Mode : Retrait client',
        data.delivery_required && data.delivery_address
          ? `Adresse : ${data.delivery_address}`
          : '',
        '',
        `💰 RESTE À PAYER À LA LIVRAISON : ${data.delivery_balance || ''} FCFA`,
        '',
        'Statut : COMMANDE CONFIRMÉE',
      ]
        .filter(Boolean)
        .join('\n');

    case 'new_order_admin':
      return [
        '🔔 NOUVELLE COMMANDE CONFIRMÉE',
        '',
        `Commande : ${data.order_number}`,
        '',
        '👤 CLIENT',
        `Nom : ${data.customer_name || ''}`,
        data.customer_phone ? `Téléphone : ${data.customer_phone}` : '',
        '',
        data.products ? `📦 PRODUITS\n${data.products}` : '',
        '',
        '💰 RÉCAPITULATIF FINANCIER',
        `Sous-total : ${data.subtotal || ''} FCFA`,
        `Livraison : ${data.delivery_fee || ''} FCFA`,
        `Total : ${data.total_amount || ''} FCFA`,
        `Acompte payé : ${data.deposit_amount || ''} FCFA`,
        `Solde produit : ${data.delivery_balance || ''} FCFA`,
        '',
        '📍 LIVRAISON',
        data.delivery_required
          ? `Ville : ${data.delivery_city || ''}`
          : 'Mode : Retrait client',
        data.delivery_required && data.delivery_address
          ? `Adresse : ${data.delivery_address}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

    case 'new_order_customer':
      return [
        '✅ CONFIRMATION DE COMMANDE',
        '',
        `Merci ${data.customer_name ? `cher(e) ${data.customer_name}` : 'pour votre achat'} ! 🎉`,
        '',
        `Votre commande n°${data.order_number} est confirmée.`,
        '',
        data.products ? `📦 VOS ARTICLES\n${data.products}` : '',
        '',
        `Total : ${data.total_amount || ''} FCFA`,
        `Acompte payé : ${data.deposit_amount || ''} FCFA`,
        `Reste à payer à la livraison : ${data.delivery_balance || ''} FCFA`,
        data.receipt_number ? `N° de reçu : ${data.receipt_number}` : '',
        data.tracking_link ? `Suivi : ${data.tracking_link}` : '',
      ]
        .filter(Boolean)
        .join('\n');

    default:
      return `Commande : ${data.order_number}`;
  }
}

/**
 * Send an order notification for a specific type (vendor / admin / customer).
 * Used by tests and direct-send paths; the production notification queue
 * (SQL + dispatcher) uses the same formatting.
 */
export async function sendOrderNotification(
  to: string,
  type: OrderNotificationType,
  data: OrderNotificationData
): Promise<WhatsAppSendResult> {
  if (!['new_order_vendor', 'new_order_admin', 'new_order_customer'].includes(type)) {
    return { success: false, error: `Type de notification non supporté: ${type}` };
  }
  const message = formatOrderNotification(type, data);
  return sendWhatsAppMessage(to, message);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp message via the configured provider.
 *
 * IMPORTANT: This function is called AFTER payment confirmation + receipt generation.
 * It should NEVER be called before payment is confirmed.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppSendResult> {
  if (!to || !message) {
    return { success: false, error: 'Destinataire ou message manquant' };
  }

  const provider = getWhatsAppProviderName();

  switch (provider) {
    case 'meta':
      return sendViaMeta(to, message);
    case 'mock':
    default:
      return sendViaMock(to, message);
  }
}

