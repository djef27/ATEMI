/**
 * Email abstraction layer — Brevo (Sendinblue) provider.
 *
 * BREVO_API_KEY must be set in .env.local for production.
 * In development, emails are logged to console.
 */

import { formatPrice } from '@/lib/utils';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Brevo provider
// ---------------------------------------------------------------------------

async function sendViaBrevo(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('[EMAIL][BREVO] No API key — logging instead');
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    return { success: true, messageId: 'dev-logged' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: process.env.EMAIL_FROM_NAME || 'Atémi',
          email: process.env.EMAIL_FROM_ADDRESS || 'noreply@atemi.bj',
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text || options.html.replace(/<[^>]+>/g, ''),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[EMAIL][BREVO] Error:', err);
      return { success: false, error: 'Email send failed' };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error('[EMAIL][BREVO] Exception:', err);
    return { success: false, error: 'Email send failed' };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  return sendViaBrevo(options);
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function orderConfirmationEmail(data: {
  orderNumber: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  deposit: number;
  remaining: number;
  deliveryAddress?: string;
  trackingToken: string;
}): { subject: string; html: string } {
  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatPrice(i.price * i.quantity)}</td></tr>`
    )
    .join('');

  const subject = `Commande #${data.orderNumber} confirmée — Atémi`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1A1919">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="font-size:24px;margin:0">Atémi</h1>
    <p style="color:#666;margin:4px 0 0">Commande confirmée</p>
  </div>

  <p>Bonjour <strong>${data.customerName}</strong>,</p>
  <p>Votre commande <strong>#${data.orderNumber}</strong> a été enregistrée avec succès.</p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Produit</th><th style="padding:8px;text-align:center">Qté</th><th style="padding:8px;text-align:right">Prix</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Acompte payé :</strong> ${formatPrice(data.deposit)}</p>
    <p style="margin:0"><strong>Solde à la livraison :</strong> ${formatPrice(data.remaining)}</p>
  </div>

  ${data.deliveryAddress ? `<p><strong>Livraison :</strong> ${data.deliveryAddress}</p>` : ''}

  <p style="margin-top:24px">
    <a href="${BASE_URL}/suivi?order=${data.orderNumber}&token=${data.trackingToken}" style="display:inline-block;padding:12px 24px;background:#1A1919;color:white;text-decoration:none;border-radius:8px">Suivre ma commande</a>
    <a href="${BASE_URL}/mes-commandes" style="display:inline-block;margin-left:8px;padding:12px 24px;border:1px solid #1A1919;color:#1A1919;text-decoration:none;border-radius:8px">Mes commandes</a>
  </p>

  <p style="color:#999;font-size:12px;margin-top:32px">
    Atémi — Mode, chaussures et accessoires au Bénin<br>
    <a href="${BASE_URL}" style="color:#999">${BASE_URL}</a>
  </p>
</body>
</html>`;

  return { subject, html };
}

export function orderStatusEmail(data: {
  orderNumber: string;
  customerName: string;
  status: string;
  trackingToken: string;
}): { subject: string; html: string } {
  const statusLabels: Record<string, string> = {
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    vendor_processing: 'En préparation',
    ready_for_delivery: 'Prête pour la livraison',
    assigned_to_driver: 'Assignée à un livreur',
    out_for_delivery: 'En cours de livraison',
    completed: 'Terminée',
  };

  const subject = `Commande #${data.orderNumber} — ${statusLabels[data.status] || data.status}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1A1919">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="font-size:24px;margin:0">Atémi</h1>
  </div>

  <p>Bonjour <strong>${data.customerName}</strong>,</p>
  <p>Le statut de votre commande <strong>#${data.orderNumber}</strong> a été mis à jour :</p>

  <div style="background:#f0fdf4;padding:16px;border-radius:8px;text-align:center;margin:20px 0">
    <p style="margin:0;font-size:18px;font-weight:bold;color:#16a34a">${statusLabels[data.status] || data.status}</p>
  </div>

  <p style="margin-top:24px">
    <a href="${BASE_URL}/suivi?order=${data.orderNumber}&token=${data.trackingToken}" style="display:inline-block;padding:12px 24px;background:#1A1919;color:white;text-decoration:none;border-radius:8px">Voir ma commande</a>
    <a href="${BASE_URL}/mes-commandes" style="display:inline-block;margin-left:8px;padding:12px 24px;border:1px solid #1A1919;color:#1A1919;text-decoration:none;border-radius:8px">Mes commandes</a>
  </p>

  <p style="color:#999;font-size:12px;margin-top:32px">
    Atémi — <a href="${BASE_URL}" style="color:#999">${BASE_URL}</a>
  </p>
</body>
</html>`;

  return { subject, html };
}

export function paymentConfirmationEmail(data: {
  orderNumber: string;
  customerName: string;
  receiptNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  depositPaid: number;
  transactionReference: string;
  deliveryAddress?: string;
  trackingToken: string;
}): { subject: string; html: string } {
  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatPrice(i.price * i.quantity)}</td></tr>`
    )
    .join('');

  const subject = `Paiement confirmé — Commande #${data.orderNumber} — Atémi`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1A1919">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="font-size:24px;margin:0">Atémi</h1>
    <p style="color:#16a34a;margin:4px 0 0;font-weight:bold">Paiement confirmé</p>
  </div>

  <p>Bonjour <strong>${data.customerName}</strong>,</p>
  <p>Votre paiement a été confirmé avec succès.</p>

  <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:20px 0;text-align:center">
    <p style="margin:0 0 4px;color:#666;font-size:12px">NUMÉRO DE REÇU</p>
    <p style="margin:0;font-size:18px;font-weight:bold;color:#16a34a;font-family:monospace">${data.receiptNumber}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Produit</th><th style="padding:8px;text-align:center">Qté</th><th style="padding:8px;text-align:right">Prix</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Acompte payé :</strong> ${formatPrice(data.depositPaid)}</p>
    ${data.transactionReference ? `<p style="margin:0 0 8px"><strong>Référence :</strong> ${data.transactionReference}</p>` : ''}
    <p style="margin:0"><strong>Statut :</strong> <span style="color:#16a34a">PAYÉ</span></p>
  </div>

  ${data.deliveryAddress ? `<p><strong>Livraison :</strong> ${data.deliveryAddress}</p>` : ''}

  <p style="margin-top:24px">
    <a href="${BASE_URL}/recu?order=${data.orderNumber}&token=${data.trackingToken}" style="display:inline-block;padding:12px 24px;background:#1A1919;color:white;text-decoration:none;border-radius:8px">Voir mon reçu</a>
  </p>

  <p style="color:#999;font-size:12px;margin-top:32px">
    Atémi — Mode, chaussures et accessoires au Bénin<br>
    <a href="${BASE_URL}" style="color:#999">${BASE_URL}</a>
  </body>
</html>`;

  return { subject, html };
}

