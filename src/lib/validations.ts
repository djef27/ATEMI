import { z } from 'zod';

// ---------------------------------------------------------------------------
// Payment confirmation
// ---------------------------------------------------------------------------

export const paymentConfirmSchema = z.object({
  payment_id: z
    .string()
    .uuid('payment_id invalide'),

  transaction_reference: z
    .string()
    .max(100, 'transaction_reference trop longue')
    .regex(
      /^[a-zA-Z0-9\-_. ]*$/,
      'transaction_reference contient des caractères non autorisés'
    )
    .nullable()
    .optional(),

  payment_method: z
    .enum(['mobile_money', 'bank_transfer', 'cash', 'admin_manual'], {
      message: 'mode de paiement invalide',
    })
    .nullable()
    .optional(),
});

export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;

// ---------------------------------------------------------------------------
// Order creation (for future API route)
// ---------------------------------------------------------------------------

export const orderItemSchema = z.object({
  product_id: z.string().uuid('product_id invalide'),
  quantity: z
    .number()
    .int('quantité invalide')
    .min(1, 'quantité minimale: 1')
    .max(999, 'quantité maximale: 999'),
});

const phoneNumberSchema = z
  .string({ invalid_type_error: 'Veuillez saisir un numéro de téléphone valide.' })
  .trim()
  .min(1, 'Veuillez saisir un numéro de téléphone valide.')
  .max(25, 'Le numéro de téléphone ne doit pas dépasser 25 caractères.')
  .regex(/^(?:\+?[0-9](?:[0-9 .-]*[0-9])?)?$/, 'Veuillez saisir un numéro de téléphone valide.')
  .refine((phone) => {
    const digitCount = phone.replace(/\D/g, '').length;
    return digitCount >= 7 && digitCount <= 15;
  }, 'Veuillez saisir un numéro de téléphone valide.');

export const checkoutCustomerFieldsSchema = z.object({
  customer_name: z
    .string({ invalid_type_error: 'Veuillez saisir votre nom complet.' })
    .trim()
    .min(1, 'Veuillez saisir votre nom complet.')
    .max(100, 'Votre nom complet ne doit pas dépasser 100 caractères.'),
  customer_phone: phoneNumberSchema.refine(
    (phone) => phone.length > 0,
    'Veuillez saisir un numéro de téléphone valide.'
  ),
  customer_whatsapp: phoneNumberSchema.nullable().optional(),
  customer_email: z
    .string({ invalid_type_error: 'Veuillez saisir une adresse email valide.' })
    .trim()
    .max(254, 'Votre adresse email ne doit pas dépasser 254 caractères.')
    .email('Veuillez saisir une adresse email valide.')
    .nullable()
    .optional()
    .or(z.literal('')),
  delivery_address: z
    .string({ invalid_type_error: 'Votre adresse doit être du texte.' })
    .trim()
    .max(250, 'Votre adresse ne doit pas dépasser 250 caractères.')
    .nullable()
    .optional(),
  delivery_city: z
    .string({ invalid_type_error: 'Le nom de la ville doit être du texte.' })
    .trim()
    .max(100, 'Le nom de la ville ne doit pas dépasser 100 caractères.')
    .nullable()
    .optional(),
  customer_notes: z
    .string({ invalid_type_error: 'Les instructions de livraison doivent être du texte.' })
    .trim()
    .max(500, 'Les instructions de livraison ne doivent pas dépasser 500 caractères.')
    .nullable()
    .optional(),
});

export const orderCreateSchema = z.object({
  p_customer_name: checkoutCustomerFieldsSchema.shape.customer_name,
  p_customer_phone: checkoutCustomerFieldsSchema.shape.customer_phone,
  p_customer_whatsapp: checkoutCustomerFieldsSchema.shape.customer_whatsapp,
  p_delivery_address: checkoutCustomerFieldsSchema.shape.delivery_address,
  p_delivery_city: checkoutCustomerFieldsSchema.shape.delivery_city,

  p_delivery_zone_id: z
    .string()
    .trim()
    .uuid('zone invalide')
    .nullable()
    .optional(),

  p_delivery_required: z.boolean().default(true),

  p_customer_notes: checkoutCustomerFieldsSchema.shape.customer_notes,

  p_items: z
    .array(orderItemSchema)
    .min(1, 'panier vide')
    .max(50, 'trop d\'articles'),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

// ---------------------------------------------------------------------------
// Webhook payload (for future payment provider)
// ---------------------------------------------------------------------------

export const webhookEventSchema = z.object({
  id: z.string().min(1, 'event id requis'),
  type: z.string().min(1, 'event type requis'),
  data: z.object({
    object: z.record(z.unknown()),
  }),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
});

export type WebhookEventInput = z.infer<typeof webhookEventSchema>;

// ---------------------------------------------------------------------------
// Vendor creation (admin)
// ---------------------------------------------------------------------------

export const vendorCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'nom requis')
    .max(200, 'nom trop long'),

  phone: z
    .string()
    .trim()
    .max(25, 'téléphone trop long')
    .regex(/^(?:\+?[0-9](?:[0-9 .-]*[0-9])?)?$/, 'format de téléphone invalide')
    .nullable()
    .optional(),

  whatsapp_number: z
    .string()
    .trim()
    .max(25, 'whatsapp trop long')
    .regex(/^(?:\+?[0-9](?:[0-9 .-]*[0-9])?)?$/, 'format whatsapp invalide')
    .nullable()
    .optional(),

  email: z
    .string()
    .email('email invalide')
    .max(200, 'email trop long')
    .nullable()
    .optional(),

  address: z
    .string()
    .max(500, 'adresse trop longue')
    .nullable()
    .optional(),

  city: z
    .string()
    .max(100, 'ville trop longue')
    .default('Cotonou'),

  country: z
    .string()
    .max(10, 'pays trop long')
    .default('BJ'),

  status: z
    .enum(['active', 'inactive', 'suspended'], {
      message: 'statut invalide',
    })
    .default('active'),
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;

// ---------------------------------------------------------------------------
// Category creation (admin)
// ---------------------------------------------------------------------------

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'nom requis')
    .max(100, 'nom trop long'),

  description: z
    .string()
    .max(1000, 'description trop longue')
    .nullable()
    .optional(),

  image_url: z
    .string()
    .url('URL invalide')
    .max(500, 'URL trop longue')
    .nullable()
    .optional(),

  is_active: z.boolean().default(true),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

// ---------------------------------------------------------------------------
// Product creation (admin)
// ---------------------------------------------------------------------------

export const productCreateSchema = z.object({
  vendor_id: z
    .string()
    .uuid('vendor_id invalide'),

  category_id: z
    .string()
    .uuid('category_id invalide'),

  name: z
    .string()
    .min(1, 'nom requis')
    .max(200, 'nom trop long'),

  description: z
    .string()
    .max(2000, 'description trop longue')
    .nullable()
    .optional(),

  supplier_price: z
    .number()
    .positive('prix fournisseur invalide'),

  selling_price: z
    .number()
    .positive('prix de vente invalide'),

  deposit_rate: z
    .number()
    .min(0, 'taux d\'acompte minimum: 0%')
    .max(100, 'taux d\'acompte maximum: 100%')
    .default(50),

  stock: z
    .number()
    .int('stock invalide')
    .min(0, 'stock invalide'),

  status: z
    .enum(['draft', 'active', 'inactive', 'out_of_stock'], {
      message: 'statut invalide',
    })
    .default('active'),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

// ---------------------------------------------------------------------------
// Product update (vendor)
// ---------------------------------------------------------------------------

export const productUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'nom requis')
    .max(200, 'nom trop long')
    .optional(),

  description: z
    .string()
    .max(2000, 'description trop longue')
    .nullable()
    .optional(),

  category_id: z
    .string()
    .uuid('category_id invalide')
    .nullable()
    .optional(),

  supplier_price: z
    .number()
    .positive('prix fournisseur invalide')
    .optional(),

  selling_price: z
    .number()
    .positive('prix de vente invalide')
    .optional(),

  deposit_rate: z
    .number()
    .min(0, 'taux d\'acompte minimum: 0%')
    .max(100, 'taux d\'acompte maximum: 100%')
    .optional(),

  stock: z
    .number()
    .int('stock invalide')
    .min(0, 'stock invalide')
    .optional(),

  status: z
    .enum(['draft', 'active', 'inactive', 'out_of_stock'], {
      message: 'statut invalide',
    })
    .optional(),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// ---------------------------------------------------------------------------
// Delivery zone management (admin)
// ---------------------------------------------------------------------------

export const deliveryZoneCreateSchema = z.object({
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().length(2, 'pays invalide'))
    .default('BJ'),

  city: z
    .string()
    .trim()
    .min(1, 'ville requise')
    .max(100, 'ville trop longue'),

  zone_name: z
    .string()
    .trim()
    .min(1, 'nom de zone requis')
    .max(100, 'nom de zone trop long'),

  delivery_fee: z
    .number()
    .min(0, 'frais invalide')
    .max(1_000_000, 'frais trop élevée')
    .default(0),

  is_available: z.boolean().default(true),
});

export type DeliveryZoneCreateInput = z.infer<typeof deliveryZoneCreateSchema>;

export const deliveryZoneUpdateSchema = z.object({
  city: z
    .string()
    .trim()
    .min(1, 'ville requise')
    .max(100, 'ville trop longue')
    .optional(),

  zone_name: z
    .string()
    .trim()
    .min(1, 'nom de zone requis')
    .max(100, 'nom de zone trop long')
    .optional(),

  delivery_fee: z
    .number()
    .min(0, 'frais invalide')
    .max(1_000_000, 'frais trop élevée')
    .optional(),

  is_available: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type DeliveryZoneUpdateInput = z.infer<typeof deliveryZoneUpdateSchema>;

// ---------------------------------------------------------------------------
// Payment initiation (guest/customer facing, order_number + tracking_token)
// ---------------------------------------------------------------------------

export const paymentInitiateSchema = z.object({
  order_number: z.string().min(1, 'order_number requis').max(50),
  tracking_token: z.string().uuid('tracking_token invalide'),
  country: z.string().length(2).optional(),
  payment_method: z.string().max(50).optional(),
});

export type PaymentInitiateInput = z.infer<typeof paymentInitiateSchema>;

export const kkiapayVerifySchema = paymentInitiateSchema.extend({
  transaction_id: z
    .string()
    .min(1, 'transaction_id requis')
    .max(100, 'transaction_id trop longue')
    .regex(/^[a-zA-Z0-9_-]+$/, 'transaction_id invalide'),
});

export const orderRecoverySchema = z.object({
  order_number: z
    .string()
    .trim()
    .min(1, 'Numéro de commande requis')
    .max(40, 'Numéro de commande trop long'),
  email: z
    .string()
    .trim()
    .min(1, 'Adresse e-mail requise')
    .email('Adresse e-mail invalide'),
});

export type OrderRecoveryInput = z.infer<typeof orderRecoverySchema>;
