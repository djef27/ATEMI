'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { normalizeCity } from '@/lib/delivery-zones';
import PhoneInput, { PhoneCountry, getFullPhoneNumber, AFRICAN_COUNTRIES } from '@/components/PhoneInput';
import { getRegionsForCountry, getCitiesForRegion, Region, City } from '@/lib/regions';

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  city: string;
}

interface CityInfo {
  name: string;
  min_fee: number;
  zones_count: number;
}

interface StockIssue {
  product_id: string;
  name: string;
  requested: number;
  available: number;
}

interface PaymentMethod {
  id: string;
  displayName: string;
}

function generateIdempotencyToken(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { items, getSubtotal, getDeposit, getRemaining, getVendorId } = useCart();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappCountry, setWhatsappCountry] = useState<PhoneCountry | null>(null);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('BJ');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [availableCities, setAvailableCities] = useState<CityInfo[]>([]);
  const [availableRegions, setAvailableRegions] = useState<Region[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);

  // Idempotency: reuse the SAME key for a given order payload so that a
  // double-tap or a retry after a network error is deduplicated server-side
  // (no duplicate orders). A new key is minted only when the payload changes,
  // so a genuinely edited cart can still place a new order.
  const orderSignature = useMemo(
    () =>
      JSON.stringify({
        items: items.map((i) => [i.product_id, i.quantity]),
        fullName,
        phone,
        whatsapp,
        email,
        address,
        city,
        country,
        paymentMethod,
        notes,
        deliveryRequired,
        deliveryZoneId,
      }),
    [
      items,
      fullName,
      phone,
      whatsapp,
      email,
      address,
      city,
      country,
      paymentMethod,
      notes,
      deliveryRequired,
      deliveryZoneId,
    ]
  );
  const idempotencyTokenRef = useRef<string>(generateIdempotencyToken());
  useEffect(() => {
    idempotencyTokenRef.current = generateIdempotencyToken();
  }, [orderSignature]);

  const subtotal = getSubtotal();
  const deposit = getDeposit();
  const remaining = getRemaining();
  const vendorId = getVendorId();

  // Pre-fill form when auth profile loads (async)
  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
    if (profile?.phone && !phone) {
      // Profile phone might be in international format (+229...) or national
      const rawPhone = profile.phone;
      let nationalPhone = rawPhone.replace(/^\+?\d{1,3}\s*/, '').replace(/\D/g, '');
      setPhone(nationalPhone);
      // Try to infer country from the phone prefix
      const callingCodeMatch = rawPhone.match(/^\+?(\d{1,3})/);
      if (callingCodeMatch) {
        const callingCode = callingCodeMatch[1];
        const inferredCountry = AFRICAN_COUNTRIES.find(c => c.callingCode === callingCode);
        if (inferredCountry) setPhoneCountry(inferredCountry);
      }
    }
    if (user?.email && !email) setEmail(user.email);
  }, [profile, user, fullName, phone, email]);

  const knownCity = availableCities.find(
    (c) => normalizeCity(c.name) === normalizeCity(city)
  );

  // Load the list of regions for the selected country
  useEffect(() => {
    const regions = getRegionsForCountry(country);
    setAvailableRegions(regions);
    setRegion(''); // Reset region when country changes
    setCity(''); // Reset city when country changes
  }, [country]);

  // Load the list of cities for the selected region
  useEffect(() => {
    if (!region) {
      setAvailableCities([]);
      setCity('');
      return;
    }
    const cities = getCitiesForRegion(country, region);
    const cityInfos: CityInfo[] = cities.map((c) => ({ name: c.name, min_fee: 0, zones_count: 0 }));
    setAvailableCities(cityInfos);
    setCity(''); // Reset city when region changes
  }, [country, region]);

  // Auto-correct the city once fully typed (case / accents / spaces)
  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed || availableCities.length === 0) return;
    const matches = availableCities.filter((c) => normalizeCity(c.name) === normalizeCity(trimmed));
    if (matches.length === 1 && matches[0].name !== trimmed) {
      setCity(matches[0].name);
    }
  }, [city, availableCities]);

  // Fetch delivery zones
  useEffect(() => {
    if (!deliveryRequired || !city.trim()) {
      setDeliveryZones([]);
      setDeliveryZoneId(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetch(`/api/delivery-zones?city=${encodeURIComponent(city.trim())}&country=${encodeURIComponent(country)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setDeliveryZones(data.data);
            setDeliveryZoneId((prev) => {
              if (prev && !data.data.some((z: DeliveryZone) => z.id === prev)) {
                return data.data.length === 1 ? data.data[0].id : null;
              }
              return prev || (data.data.length === 1 ? data.data[0].id : null);
            });
          } else {
            setDeliveryZones([]);
            setDeliveryZoneId(null);
          }
        })
        .catch(() => {
          setDeliveryZones([]);
          setDeliveryZoneId(null);
        });
    }, 400);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [city, country, deliveryRequired]);

  // Validate stock on mount
  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();
    fetch('/api/products/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.issues)) {
          setStockIssues(data.issues);
        } else if (data.issues) {
          setStockIssues(data.issues);
        }
      })
      .catch(() => {
        setStockIssues([]);
      });
    return () => controller.abort();
  }, [items]);

  const selectedZone = deliveryZones.find((z) => z.id === deliveryZoneId);
  const deliveryFee = selectedZone?.fee || 0;
  const totalDeposit = deposit + (deliveryRequired ? deliveryFee : 0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/payment/methods?country=${country}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Moyens de paiement indisponibles');
        }
        return result.data.paymentMethods as PaymentMethod[];
      })
      .then((methods) => {
        setPaymentMethods(methods);
        setPaymentMethod((current) => methods.some((method) => method.id === current) ? current : methods[0]?.id || '');
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setPaymentMethods([]);
          setPaymentMethod('');
        }
      });
    return () => controller.abort();
  }, [country]);

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="font-serif text-2xl font-bold text-[#1A1919] mb-4">Panier vide</h1>
          <p className="text-gray-600 mb-6">Ajoutez des produits avant de passer commande.</p>
          <Link href="/products" className="inline-block px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800">
            Voir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  if (!vendorId) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="font-serif text-2xl font-bold text-[#1A1919] mb-4">Erreur</h1>
          <p className="text-gray-600">Impossible d&apos;identifier le vendeur.</p>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError('Le nom est requis'); return; }
    if (!phone.trim()) { setError('Le numéro de téléphone est requis'); return; }
    if (deliveryRequired && !address.trim()) { setError('L\'adresse de livraison est requise'); return; }
    if (deliveryRequired && !city.trim()) { setError('La ville est requise'); return; }
    if (deliveryRequired && !availableCities.some((c) => normalizeCity(c.name) === normalizeCity(city))) {
      setError('Cette ville n\'est pas couverte pour la livraison dans ce pays. Modifiez la ville ou choisissez le retrait.');
      return;
    }
    if (deliveryRequired && deliveryZones.length > 0 && !deliveryZoneId) { setError('Veuillez sélectionner une zone de livraison'); return; }
    if (deliveryRequired && city.trim() && deliveryZones.length === 0 && !deliveryZoneId) { setError('Aucune zone de livraison disponible pour cette ville. Modifiez la ville ou choisissez le retrait.'); return; }
    if (stockIssues.length > 0) { setError('Certains articles ne sont plus disponibles en quantité suffisante. Modifiez votre panier.'); return; }
    if (!paymentMethod) { setError('Aucun moyen de paiement disponible pour ce pays.'); return; }

    setLoading(true);

    // Payload-stable idempotency token (minted once per distinct order payload,
    // reused on retry / double-tap so the server can dedupe — see ref above).
    const idempotencyToken = idempotencyTokenRef.current;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `order-${idempotencyToken}`,
        },
        body: JSON.stringify({
          customer_name: fullName.trim(),
          customer_phone: phoneCountry ? getFullPhoneNumber(phone, phoneCountry) : phone.trim(),
          customer_email: email.trim() || null,
          delivery_address: address.trim() || null,
          delivery_city: city.trim() || null,
          items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
          customer_whatsapp: whatsappCountry && whatsapp.trim()
            ? getFullPhoneNumber(whatsapp, whatsappCountry)
            : whatsapp.trim() || null,
          delivery_zone_id: deliveryZoneId || null,
          delivery_required: deliveryRequired,
          customer_notes: notes.trim() || null,
          country,
          payment_method: paymentMethod,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Une erreur est survenue lors de la création de la commande');
        setLoading(false);
        return;
      }

      const data = result.data;
      if (data && typeof data === 'object' && 'order_id' in data) {
        const orderNum = (data as { order_number: string }).order_number;
        const trackingToken = (data as { tracking_token: string }).tracking_token;
        router.replace(
          `/paiement?order=${encodeURIComponent(orderNum)}&token=${encodeURIComponent(trackingToken)}` +
          `&country=${encodeURIComponent(country)}&payment_method=${encodeURIComponent(paymentMethod)}`
        );
      } else {
        setError('Réponse inattendue du serveur');
        setLoading(false);
      }
    } catch {
      setError('Une erreur inattendue est survenue');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/cart" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1A1919] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour au panier
        </Link>

        <h1 className="font-serif text-2xl font-bold text-[#1A1919] mb-2">Passer la commande</h1>
        <p className="text-sm text-gray-500 mb-6">
          Aucun compte n&apos;est requis. Complétez vos informations pour finaliser votre commande.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <span className="flex items-center gap-1.5 text-primary-700 font-medium">
            <span className="w-6 h-6 rounded-full bg-primary-900 text-white text-xs flex items-center justify-center">1</span>
            Panier
          </span>
          <span className="w-8 h-px bg-primary-200" />
          <span className="flex items-center gap-1.5 text-primary-900 font-semibold">
            <span className="w-6 h-6 rounded-full bg-primary-900 text-white text-xs flex items-center justify-center">2</span>
            Commande
          </span>
          <span className="w-8 h-px bg-primary-200" />
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center">3</span>
            Paiement
          </span>
        </div>

        {/* Stock warnings */}
        {stockIssues.length > 0 && (
          <div role="alert" className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            <div className="flex items-center gap-2 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              Problème de stock
            </div>
            {stockIssues.map((issue) => (
              <p key={issue.product_id}>
                {issue.name} — demandé: {issue.requested}, disponible: {issue.available}
              </p>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" aria-live="assertive" className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-8">
            {/* Personal info */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Informations personnelles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                  <input id="fullName" name="name" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    placeholder="Prénom et Nom" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    placeholder="email@exemple.com" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                  <PhoneInput
                    id="phone"
                    name="tel"
                    label="Téléphone *"
                    value={phone}
                    onChange={(val, c) => { setPhone(val); setPhoneCountry(c); }}
                    country={phoneCountry?.code}
                    onCountryChange={setPhoneCountry}
                    required
                    autoComplete="tel"
                    placeholder={undefined}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <PhoneInput
                    id="whatsapp"
                    name="whatsapp"
                    label="WhatsApp"
                    value={whatsapp}
                    onChange={(val, c) => { setWhatsapp(val); setWhatsappCountry(c); }}
                    country={whatsappCountry?.code}
                    onCountryChange={setWhatsappCountry}
                    autoComplete="tel"
                    placeholder="Optionnel — pour suivre votre commande via WhatsApp"
                  />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Livraison</h2>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="deliveryMethod" value="delivery" checked={deliveryRequired} onChange={() => setDeliveryRequired(true)} className="text-primary-800 focus-visible:ring-primary-300" />
                  <span className="text-sm text-gray-700">Livraison à domicile</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="deliveryMethod" value="pickup" checked={!deliveryRequired} onChange={() => setDeliveryRequired(false)} className="text-primary-800 focus-visible:ring-primary-300" />
                  <span className="text-sm text-gray-700">Retrait</span>
                </label>
              </div>

              {/* Payment country and method */}
              <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
                <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Paiement</h2>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Pays *</label>
                <select id="country" name="country" autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                  <option value="BJ">Bénin</option>
                  <option value="CI">Côte d&apos;Ivoire</option>
                  <option value="TG">Togo</option>
                </select>
                <div className="mt-4">
                  <p className="block text-sm font-medium text-gray-700 mb-2">Moyen disponible *</p>
                  {paymentMethods.length === 0 ? (
                    <p role="status" aria-live="polite" className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      Aucun moyen n&apos;est configuré pour ce pays.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {paymentMethods.map((method) => (
                        <label key={method.id} className="flex items-center gap-3 p-3 rounded-lg border border-primary-100 hover:bg-primary-50 cursor-pointer">
                          <input type="radio" name="paymentMethod" value={method.id} checked={paymentMethod === method.id}
                            onChange={() => setPaymentMethod(method.id)} className="text-primary-800 focus-visible:ring-primary-300" />
                          <span className="text-sm text-[#1A1919]">{method.displayName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {deliveryRequired && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Région / Département *</label>
                    <select id="region" name="region" autoComplete="address-level2" required value={region} onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                      <option value="">Sélectionnez une région</option>
                      {availableRegions.map((r) => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                    <select id="city" name="address-level2" autoComplete="address-level2" required value={city} onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                      <option value="">Sélectionnez une ville</option>
                      {availableCities.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {knownCity && deliveryZones.length > 0 && (
                      <p role="status" aria-live="polite" className="mt-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                        Livraison disponible à {knownCity.name} — à partir de {formatPrice(knownCity.min_fee)} selon la zone.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Adresse complète *</label>
                    <textarea id="address" name="street-address" autoComplete="street-address" required rows={2} value={address} onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none"
                      placeholder="Rue, quartier, point de repère (ex: en face de la pharmacie du quartier)" />
                  </div>
                  {deliveryZones.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Zone de livraison</label>
                      <div className="space-y-2">
                        {deliveryZones.map((zone) => (
                          <label key={zone.id} className="flex items-center gap-3 p-3 rounded-lg border border-primary-100 hover:bg-primary-50 cursor-pointer">
                            <input type="radio" name="deliveryZone" value={zone.id} checked={deliveryZoneId === zone.id}
                              onChange={() => setDeliveryZoneId(zone.id)} className="text-primary-800 focus-visible:ring-primary-300" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-[#1A1919]">{zone.name}</span>
                              <span className="text-sm text-gray-500 ml-2">— {formatPrice(zone.fee)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {city.trim() && deliveryZones.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      Aucune zone de livraison disponible pour cette ville. Modifiez la ville ou choisissez le retrait.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Notes</h2>
              <textarea id="notes" name="order-notes" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none"
                aria-label="Instructions spéciales pour la commande"
                placeholder="Instructions spéciales (optionnel)" />
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Résumé de la commande</h2>
              <div className="space-y-3 text-sm mb-6">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between">
                    <span className="text-gray-600">{item.name} × {item.quantity}</span>
                    <span className="font-medium text-[#1A1919]">{formatPrice(item.selling_price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-primary-100 pt-3 flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-medium text-[#1A1919]">{formatPrice(subtotal)}</span>
                </div>
                {deliveryRequired && deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Frais de livraison ({selectedZone?.name})</span>
                    <span>{formatPrice(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-primary-700">
                  <span className="font-medium">Acompte à payer maintenant</span>
                  <span className="font-bold">{formatPrice(totalDeposit)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Solde à la livraison</span>
                  <span>{formatPrice(remaining + (deliveryRequired ? deliveryFee : 0))}</span>
                </div>
              </div>

              <button type="submit" disabled={loading || stockIssues.length > 0}
                className="w-full py-3 px-4 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {loading ? (
                  <span role="status" aria-live="polite" className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />Redirection vers le paiement…</span>
                ) : (
                  `Confirmer — Acompte ${formatPrice(totalDeposit)}`
                )}
              </button>

              {!user && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  Vous pourrez créer un compte après votre commande pour retrouver votre historique.
                </p>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
