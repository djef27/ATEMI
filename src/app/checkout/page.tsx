'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { normalizeCity } from '@/lib/delivery-zones';
import { checkoutCustomerFieldsSchema } from '@/lib/validations';
import PhoneInput, { PhoneCountry, getFullPhoneNumber, AFRICAN_COUNTRIES } from '@/components/PhoneInput';
import { groupCountriesByContinent } from '@/lib/geography';
import type { GeographyCountry, GeographyCity, GeographySubdivision } from '@/lib/geography';
import { useGeographyCities, useGeographyCountries, useGeographyRegions } from '@/hooks/use-geography';

type CheckoutCustomerField = keyof typeof checkoutCustomerFieldsSchema.shape;

function isCheckoutCustomerField(value: unknown): value is CheckoutCustomerField {
  return value === 'customer_name' ||
    value === 'customer_phone' ||
    value === 'customer_whatsapp' ||
    value === 'customer_email' ||
    value === 'delivery_address' ||
    value === 'delivery_city' ||
    value === 'customer_notes';
}

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
  region_code?: string | null;
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

const OTHER_DELIVERY_CITIES_REGION = '__other_configured_cities__';

function generateIdempotencyToken(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { items, getSubtotal, getDeposit, getRemaining, getVendorId } = useCart();
  const { user, profile } = useAuth();
  const router = useRouter();
  const countryCatalog = useGeographyCountries();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry | null>(null);
  const [phoneCountryManuallySelected, setPhoneCountryManuallySelected] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappCountry, setWhatsappCountry] = useState<PhoneCountry | null>(null);
  const [whatsappCountryManuallySelected, setWhatsappCountryManuallySelected] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('BJ');
  const [countrySearch, setCountrySearch] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const geographyRegions = useGeographyRegions(country);
  const geographyCities = useGeographyCities(
    country,
    region === OTHER_DELIVERY_CITIES_REGION ? '' : region,
    !geographyRegions.error &&
      (Boolean(region && region !== OTHER_DELIVERY_CITIES_REGION) ||
        (!geographyRegions.loading && geographyRegions.data.length === 0))
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryZonesLoading, setDeliveryZonesLoading] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState<string | null>(null);
  const [deliveryZonesRetry, setDeliveryZonesRetry] = useState(0);
  const [deliveryZonesKey, setDeliveryZonesKey] = useState('');
  const [deliveryCities, setDeliveryCities] = useState<CityInfo[]>([]);
  const [deliveryCitiesLoading, setDeliveryCitiesLoading] = useState(false);
  const [deliveryCitiesError, setDeliveryCitiesError] = useState<string | null>(null);
  const [deliveryCitiesRetry, setDeliveryCitiesRetry] = useState(0);
  const [regionSearch, setRegionSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [paymentMethodsRetry, setPaymentMethodsRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutCustomerField, string>>>({});
  const [loading, setLoading] = useState(false);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

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
  const countryGroups = useMemo(
    () => groupCountriesByContinent(countryCatalog.data.filter((item) => {
      const query = normalizeCity(countrySearch);
      const callingCodeQuery = countrySearch.replace(/\D/g, '');
      return !query ||
        normalizeCity(item.name).includes(query) ||
        normalizeCity(item.internationalName).includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (callingCodeQuery.length > 0 && item.callingCode.includes(callingCodeQuery));
    })),
    [countryCatalog.data, countrySearch]
  );
  const phoneCountries = useMemo<PhoneCountry[]>(
    () => countryCatalog.data
      .filter((item) => item.callingCode.length > 0)
      .map((item: GeographyCountry) => ({
        code: item.code,
        name: item.name,
        internationalName: item.internationalName,
        callingCode: item.callingCode,
        flag: item.flag,
        mask: AFRICAN_COUNTRIES.find((countryOption) => countryOption.code === item.code)?.mask,
      })),
    [countryCatalog.data]
  );
  useEffect(() => {
    if (!phoneCountryManuallySelected) {
      setPhoneCountry(phoneCountries.find((item) => item.code === country) || null);
    }
    if (!whatsappCountryManuallySelected) {
      setWhatsappCountry(phoneCountries.find((item) => item.code === country) || null);
    }
  }, [country, phoneCountries, phoneCountryManuallySelected, whatsappCountryManuallySelected]);
  const knownRegionCodes = useMemo(
    () => new Set(geographyRegions.data.map((item) => item.code)),
    [geographyRegions.data]
  );
  const hasUnmappedDeliveryCities = deliveryCities.some(
    (deliveryCity) => !deliveryCity.region_code || !knownRegionCodes.has(deliveryCity.region_code)
  );
  const availableRegions = useMemo<GeographySubdivision[]>(() => [
    ...geographyRegions.data,
    ...(geographyRegions.data.length > 0 && hasUnmappedDeliveryCities
      ? [{
          code: OTHER_DELIVERY_CITIES_REGION,
          name: 'Autres villes desservies (division non référencée)',
        }]
      : []),
  ], [geographyRegions.data, hasUnmappedDeliveryCities]);
  const availableCities = useMemo(() => {
    const geographicCities = geographyCities.data.map((city: GeographyCity) => ({
      name: city.name,
      min_fee: 0,
      zones_count: 0,
      region_code: city.regionCode,
    }));
    const configuredCities = availableRegions.length > 0
      ? deliveryCities.filter((deliveryCity) => region === OTHER_DELIVERY_CITIES_REGION
        ? !deliveryCity.region_code || !knownRegionCodes.has(deliveryCity.region_code)
        : deliveryCity.region_code === region)
      : deliveryCities;
    const citiesByName = new Map<string, CityInfo>();

    for (const city of [...geographicCities, ...configuredCities]) {
      const key = normalizeCity(city.name);
      const existing = citiesByName.get(key);
      citiesByName.set(key, existing
        ? {
            ...existing,
            min_fee: city.zones_count > 0 ? city.min_fee : existing.min_fee,
            zones_count: Math.max(existing.zones_count, city.zones_count),
          }
        : city);
    }

    return Array.from(citiesByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [availableRegions.length, deliveryCities, geographyCities.data, knownRegionCodes, region]);

  // Pre-fill form when auth profile loads (async)
  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
    if (profile?.phone && !phone && phoneCountries.length > 0) {
      const rawPhone = profile.phone.trim();
      const digits = rawPhone.replace(/\D/g, '');
      const matchingCountries = rawPhone.startsWith('+')
        ? phoneCountries
          .filter((item) => digits.startsWith(item.callingCode))
          .sort((left, right) => right.callingCode.length - left.callingCode.length)
        : [];
      const longestPrefix = matchingCountries[0]?.callingCode;
      const inferredCountries = matchingCountries.filter((item) => item.callingCode === longestPrefix);
      if (inferredCountries.length === 1 && longestPrefix) {
        setPhoneCountry(inferredCountries[0]);
        setPhoneCountryManuallySelected(true);
        setPhone(digits.slice(longestPrefix.length));
      } else {
        setPhone(digits);
      }
    }
    if (user?.email && !email) setEmail(user.email);
  }, [profile, user, fullName, phone, email, phoneCountries]);

  const knownCity = availableCities.find(
    (c) => normalizeCity(c.name) === normalizeCity(city)
  );

  // Load only cities with active delivery zones for the selected country.
  useEffect(() => {
    const controller = new AbortController();
    setDeliveryCities([]);
    setDeliveryCitiesLoading(true);
    setDeliveryCitiesError(null);
    fetch(`/api/delivery-zones?cities=1&country=${encodeURIComponent(country)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.error || 'Impossible de charger les villes desservies.');
        }
        return result.data as CityInfo[];
      })
      .then(setDeliveryCities)
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setDeliveryCities([]);
          setDeliveryCitiesError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Impossible de charger les villes desservies.'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDeliveryCitiesLoading(false);
      });
    return () => controller.abort();
  }, [country, deliveryCitiesRetry]);

  // Fetch delivery zones
  useEffect(() => {
    const requestKey = `${country}:${normalizeCity(city)}`;
    if (!deliveryRequired || !city.trim()) {
      setDeliveryZones([]);
      setDeliveryZonesKey(requestKey);
      setDeliveryZoneId(null);
      setDeliveryZonesLoading(false);
      setDeliveryZonesError(null);
      return;
    }
    const controller = new AbortController();
    setDeliveryZonesLoading(true);
    setDeliveryZonesError(null);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/delivery-zones?city=${encodeURIComponent(city.trim())}&country=${encodeURIComponent(country)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.data)) {
          throw new Error(data.error || 'Impossible de vérifier la zone de livraison.');
        }

        setDeliveryZonesKey(requestKey);
        setDeliveryZones(data.data);
        setDeliveryZoneId((prev) => {
          if (prev && !data.data.some((z: DeliveryZone) => z.id === prev)) {
            return data.data.length === 1 ? data.data[0].id : null;
          }
          return prev || (data.data.length === 1 ? data.data[0].id : null);
        });
      } catch (fetchError) {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setDeliveryZonesKey(requestKey);
          setDeliveryZones([]);
          setDeliveryZoneId(null);
          setDeliveryZonesError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Impossible de vérifier la zone de livraison. Réessayez.'
          );
        }
      } finally {
        if (!controller.signal.aborted) setDeliveryZonesLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [city, country, deliveryRequired, deliveryZonesRetry]);

  const currentDeliveryZonesKey = `${country}:${normalizeCity(city)}`;
  const currentDeliveryZones = deliveryZonesKey === currentDeliveryZonesKey ? deliveryZones : [];
  const currentDeliveryZonesLoading = deliveryRequired && city.trim() &&
    (deliveryZonesLoading || deliveryZonesKey !== currentDeliveryZonesKey);
  const currentDeliveryZonesError = deliveryZonesKey === currentDeliveryZonesKey
    ? deliveryZonesError
    : null;

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

  const selectedZone = currentDeliveryZones.find((z) => z.id === deliveryZoneId);
  const deliveryFee = selectedZone?.fee || 0;
  const totalDeposit = deposit + (deliveryRequired ? deliveryFee : 0);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    errorRef.current?.focus({ preventScroll: true });
  }, [error]);

  useEffect(() => {
    const controller = new AbortController();
    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);
    fetch(`/api/payment/methods?country=${country}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Moyens de paiement indisponibles');
        }
        if (!Array.isArray(result.data?.paymentMethods)) {
          throw new Error('La réponse des moyens de paiement est invalide.');
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
          setPaymentMethodsError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Impossible de charger les moyens de paiement. Réessayez.'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false);
      });
    return () => controller.abort();
  }, [country, paymentMethodsRetry]);

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
    setFieldErrors({});

    const customerFields = checkoutCustomerFieldsSchema.safeParse({
      customer_name: fullName,
      customer_phone: phoneCountry ? getFullPhoneNumber(phone, phoneCountry) : phone,
      customer_whatsapp: whatsappCountry && whatsapp.trim()
        ? getFullPhoneNumber(whatsapp, whatsappCountry)
        : whatsapp.trim() || null,
      customer_email: email.trim() || null,
      delivery_address: address.trim() || null,
      delivery_city: city.trim() || null,
      customer_notes: notes.trim() || null,
    });

    if (!customerFields.success) {
      const validationErrors: Partial<Record<CheckoutCustomerField, string>> = {};
      for (const issue of customerFields.error.issues) {
        const field = issue.path[0];
        if (isCheckoutCustomerField(field)) {
          validationErrors[field] = issue.message;
        }
      }
      setFieldErrors(validationErrors);
      return;
    }
    if (deliveryRequired && !address.trim()) {
      setFieldErrors({ delivery_address: 'L’adresse de livraison est requise.' });
      return;
    }
    if (deliveryRequired && countryCatalog.loading) {
      setError('Chargement de la liste des pays en cours. Veuillez patienter.');
      return;
    }
    if (deliveryRequired && countryCatalog.error) {
      setError(countryCatalog.error);
      return;
    }
    if (deliveryRequired && (geographyRegions.loading || deliveryCitiesLoading)) {
      setError('Chargement des régions et des localités en cours. Veuillez patienter.');
      return;
    }
    if (deliveryRequired && geographyRegions.error) {
      setError(geographyRegions.error);
      return;
    }
    if (deliveryRequired && geographyCities.loading) {
      setError('Chargement des villes de la région en cours. Veuillez patienter.');
      return;
    }
    if (deliveryRequired && geographyCities.error) {
      setError(geographyCities.error);
      return;
    }
    if (deliveryRequired && availableRegions.length === 0 && availableCities.length === 0) {
      setError(
        deliveryCitiesError ||
          'Aucune ville de référence ni zone de livraison n’est configurée pour ce pays. Choisissez le retrait ou contactez-nous.'
      );
      return;
    }
    if (deliveryRequired && geographyRegions.data.length > 0 && !region) {
      setError('Veuillez sélectionner une région ou un département.');
      return;
    }
    if (deliveryRequired && !city.trim()) {
      setFieldErrors({ delivery_city: 'La ville est requise.' });
      return;
    }
    if (deliveryRequired && !availableCities.some((c) => normalizeCity(c.name) === normalizeCity(city))) {
      setError('Cette ville n\'est pas couverte pour la livraison dans ce pays. Modifiez la ville ou choisissez le retrait.');
      return;
    }
    if (deliveryRequired && currentDeliveryZonesLoading) { setError('Vérification de la zone de livraison en cours. Veuillez patienter.'); return; }
    if (deliveryRequired && currentDeliveryZonesError) { setError(currentDeliveryZonesError); return; }
    if (deliveryRequired && currentDeliveryZones.length > 0 && !deliveryZoneId) { setError('Veuillez sélectionner une zone de livraison'); return; }
    if (deliveryRequired && city.trim() && currentDeliveryZones.length === 0 && !deliveryZoneId) { setError('Aucune zone de livraison disponible pour cette ville. Modifiez la ville ou choisissez le retrait.'); return; }
    if (stockIssues.length > 0) { setError('Certains articles ne sont plus disponibles en quantité suffisante. Modifiez votre panier.'); return; }
    if (paymentMethodsLoading) { setError('Chargement du moyen de paiement en cours. Veuillez patienter.'); return; }
    if (paymentMethodsError) { setError(paymentMethodsError); return; }
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

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const serverField = result?.field;
        if (isCheckoutCustomerField(serverField) && typeof result?.error === 'string') {
          setFieldErrors({ [serverField]: result.error });
        } else {
          setError(
            result?.error ||
              `La commande n’a pas pu être créée (erreur ${response.status}). Vérifiez vos informations et réessayez.`
          );
        }
        setLoading(false);
        return;
      }

      const data = result.data;
      if (
        data &&
        typeof data === 'object' &&
        'order_id' in data &&
        typeof data.order_number === 'string' &&
        typeof data.tracking_token === 'string'
      ) {
        const orderNum = data.order_number;
        const trackingToken = data.tracking_token;
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
          <div
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-8">
            {/* Personal info */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Informations personnelles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                  <input id="fullName" name="name" type="text" autoComplete="name" required value={fullName} onChange={(e) => {
                    setFullName(e.target.value);
                    setFieldErrors((current) => ({ ...current, customer_name: undefined }));
                  }}
                    aria-invalid={Boolean(fieldErrors.customer_name)}
                    aria-describedby={fieldErrors.customer_name ? 'fullName-error' : undefined}
                    className={`w-full px-4 py-3 rounded-lg border text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${fieldErrors.customer_name ? 'border-rose-300' : 'border-primary-200'}`}
                    placeholder="Prénom et Nom" />
                  {fieldErrors.customer_name && <p id="fullName-error" className="mt-1.5 text-sm text-rose-600" role="alert">{fieldErrors.customer_name}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((current) => ({ ...current, customer_email: undefined }));
                  }}
                    aria-invalid={Boolean(fieldErrors.customer_email)}
                    aria-describedby={fieldErrors.customer_email ? 'email-error' : undefined}
                    className={`w-full px-4 py-3 rounded-lg border text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${fieldErrors.customer_email ? 'border-rose-300' : 'border-primary-200'}`}
                    placeholder="email@exemple.com" />
                  {fieldErrors.customer_email && <p id="email-error" className="mt-1.5 text-sm text-rose-600" role="alert">{fieldErrors.customer_email}</p>}
                </div>
                <div>
                  <PhoneInput
                    id="phone"
                    name="tel"
                    label="Téléphone"
                    value={phone}
                    onChange={(val, c) => {
                      setPhone(val);
                      setPhoneCountry(c);
                      setFieldErrors((current) => ({ ...current, customer_phone: undefined }));
                    }}
                    country={phoneCountry?.code}
                    onCountryChange={(selectedCountry) => {
                      setPhoneCountry(selectedCountry);
                      setPhoneCountryManuallySelected(true);
                    }}
                    countries={phoneCountries.length > 0 ? phoneCountries : AFRICAN_COUNTRIES}
                    required
                    error={fieldErrors.customer_phone}
                    autoComplete="tel"
                    placeholder={undefined}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PhoneInput
                    id="whatsapp"
                    name="whatsapp"
                    label="WhatsApp"
                    value={whatsapp}
                    onChange={(val, c) => {
                      setWhatsapp(val);
                      setWhatsappCountry(c);
                      setFieldErrors((current) => ({ ...current, customer_whatsapp: undefined }));
                    }}
                    country={whatsappCountry?.code}
                    onCountryChange={(selectedCountry) => {
                      setWhatsappCountry(selectedCountry);
                      setWhatsappCountryManuallySelected(true);
                    }}
                    countries={phoneCountries.length > 0 ? phoneCountries : AFRICAN_COUNTRIES}
                    error={fieldErrors.customer_whatsapp}
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
                <label htmlFor="country-search" className="block text-sm font-medium text-gray-700 mb-1">Rechercher un pays</label>
                <input
                  id="country-search"
                  type="search"
                  autoComplete="off"
                  value={countrySearch}
                  onChange={(event) => setCountrySearch(event.target.value)}
                  disabled={countryCatalog.loading || Boolean(countryCatalog.error)}
                  placeholder="Nom, code ISO ou indicatif"
                  className="w-full mb-2 px-4 py-2.5 rounded-lg border border-primary-200 text-[#1A1919] disabled:bg-gray-50"
                />
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Pays *</label>
                <select id="country" name="country" autoComplete="country" value={country}
                  disabled={countryCatalog.loading || Boolean(countryCatalog.error)}
                  onChange={(e) => {
                  const nextCountry = e.target.value;
                  setCountry(nextCountry);
                  setCountrySearch('');
                  setRegion('');
                  setCity('');
                  setRegionSearch('');
                  setCitySearch('');
                  setZoneSearch('');
                  setDeliveryCities([]);
                  setDeliveryZones([]);
                  setDeliveryZonesKey('');
                  setDeliveryZoneId(null);
                  setError(null);
                  setFieldErrors((current) => ({ ...current, delivery_city: undefined }));
                }}
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                  {countryCatalog.loading && <option value={country}>Chargement des pays…</option>}
                  {countryGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.countries.map((locationCountry) => (
                        <option key={locationCountry.code} value={locationCountry.code}>{locationCountry.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {countryCatalog.error && (
                  <p role="alert" className="mt-1.5 text-sm text-rose-600">
                    {countryCatalog.error}{' '}
                    <button type="button" onClick={countryCatalog.retry} className="underline">Réessayer</button>
                  </p>
                )}
                {!countryCatalog.loading && !countryCatalog.error && countryGroups.length === 0 && (
                  <p role="status" className="mt-1.5 text-sm text-gray-500">Aucun pays ne correspond à cette recherche.</p>
                )}
                <div className="mt-4">
                  <p className="block text-sm font-medium text-gray-700 mb-2">Moyen disponible *</p>
                  {paymentMethodsLoading ? (
                    <p role="status" aria-live="polite" className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      Chargement des moyens de paiement…
                    </p>
                  ) : paymentMethodsError ? (
                    <div role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">
                      <p>{paymentMethodsError}</p>
                      <button
                        type="button"
                        onClick={() => setPaymentMethodsRetry((attempt) => attempt + 1)}
                        className="mt-2 font-medium underline underline-offset-2"
                      >
                        Réessayer
                      </button>
                    </div>
                  ) : paymentMethods.length === 0 ? (
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
                  {geographyRegions.loading && (
                    <p role="status" aria-live="polite" className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      Chargement des régions de ce pays…
                    </p>
                  )}
                  {geographyRegions.error && (
                    <div role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">
                      <p>{geographyRegions.error}</p>
                      <button type="button" onClick={geographyRegions.retry} className="mt-2 font-medium underline">
                        Réessayer
                      </button>
                    </div>
                  )}
                  {!geographyRegions.loading && !geographyRegions.error && geographyRegions.data.length === 0 && (
                    <p role="status" className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      Aucune subdivision n’est référencée pour ce pays. Vous pouvez sélectionner une ville directement.
                    </p>
                  )}
                  {availableRegions.length > 0 && (
                    <div>
                      <label htmlFor="region-search" className="block text-sm font-medium text-gray-700 mb-1">Rechercher une région</label>
                      <input id="region-search" type="search" value={regionSearch} onChange={(e) => setRegionSearch(e.target.value)}
                        placeholder="Rechercher une région" className="w-full mb-2 px-4 py-2.5 rounded-lg border border-primary-200 text-[#1A1919]" />
                      <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Région / Département *</label>
                      <select id="region" name="region" autoComplete="address-level1" required value={region} onChange={(e) => {
                        setRegion(e.target.value);
                        setCity('');
                        setCitySearch('');
                        setZoneSearch('');
                        setDeliveryZones([]);
                        setDeliveryZonesKey('');
                        setDeliveryZoneId(null);
                        setError(null);
                        setFieldErrors((current) => ({ ...current, delivery_city: undefined }));
                      }}
                        className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                        <option value="">Sélectionnez une région</option>
                        {availableRegions
                          .filter((item) =>
                            item.code === region ||
                            normalizeCity(item.name).includes(normalizeCity(regionSearch))
                          )
                          .map((item) => (
                            <option key={item.code} value={item.code}>{item.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                  {geographyRegions.data.length > 0 && !region && !geographyRegions.loading && !geographyRegions.error && (
                    <p role="status" className="text-sm text-gray-500">
                      Sélectionnez une région pour charger ses villes.
                    </p>
                  )}
                  {((geographyRegions.data.length === 0 &&
                    !geographyRegions.loading &&
                    !geographyRegions.error) || Boolean(region)) && (
                    <>
                      {geographyCities.loading && (
                        <p role="status" aria-live="polite" className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                          Chargement des villes…
                        </p>
                      )}
                      {geographyCities.error && (
                        <div role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">
                          <p>{geographyCities.error}</p>
                          <button type="button" onClick={geographyCities.retry} className="mt-2 font-medium underline">
                            Réessayer
                          </button>
                        </div>
                      )}
                      {!geographyCities.loading && !geographyCities.error && availableCities.length > 0 ? (
                    <div>
                      <label htmlFor="city-search" className="block text-sm font-medium text-gray-700 mb-1">Rechercher une ville</label>
                      <input id="city-search" type="search" value={citySearch} onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Rechercher une ville"
                        className="w-full mb-2 px-4 py-2.5 rounded-lg border border-primary-200 text-[#1A1919] disabled:bg-gray-50" />
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                      <select id="city" name="address-level2" autoComplete="address-level2" required value={city}
                        disabled={geographyCities.loading || Boolean(geographyCities.error)}
                        onChange={(e) => {
                          setCity(e.target.value);
                          setZoneSearch('');
                          setDeliveryZones([]);
                          setDeliveryZonesKey('');
                          setDeliveryZoneId(null);
                          setFieldErrors((current) => ({ ...current, delivery_city: undefined }));
                        }}
                        aria-invalid={Boolean(fieldErrors.delivery_city)}
                        aria-describedby={fieldErrors.delivery_city ? 'city-error' : undefined}
                        className={`w-full px-4 py-3 rounded-lg border text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:bg-gray-50 ${fieldErrors.delivery_city ? 'border-rose-300' : 'border-primary-200'}`}>
                        <option value="">Sélectionnez une ville</option>
                        {availableCities
                          .filter((item) =>
                            item.name === city ||
                            normalizeCity(item.name).includes(normalizeCity(citySearch))
                          )
                          .map((item) => (
                            <option key={normalizeCity(item.name)} value={item.name}>{item.name}</option>
                          ))}
                      </select>
                      {availableCities.filter((item) =>
                        normalizeCity(item.name).includes(normalizeCity(citySearch))
                      ).length === 0 && (
                        <p role="status" className="mt-1.5 text-sm text-gray-500">Aucune ville ne correspond à cette recherche.</p>
                      )}
                      {fieldErrors.delivery_city && <p id="city-error" className="mt-1.5 text-sm text-rose-600" role="alert">{fieldErrors.delivery_city}</p>}
                      {knownCity && currentDeliveryZones.length > 0 && (
                        <p role="status" aria-live="polite" className="mt-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                        Livraison disponible à {knownCity.name} — à partir de {formatPrice(knownCity.min_fee)} selon la zone.
                        </p>
                      )}
                    </div>
                      ) : !geographyCities.loading && !geographyCities.error && !deliveryCitiesLoading && (
                        <p role="status" className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                          Aucune ville n’est référencée ou desservie dans cette région. Choisissez une autre région ou le retrait.
                        </p>
                      )}
                      {deliveryCitiesError && !deliveryCitiesLoading && (
                        <p role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">
                          {deliveryCitiesError}{' '}
                          <button type="button" onClick={() => setDeliveryCitiesRetry((attempt) => attempt + 1)}
                            className="font-medium underline">Réessayer</button>
                        </p>
                      )}
                    </>
                  )}
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Adresse complète *</label>
                    <textarea id="address" name="street-address" autoComplete="street-address" required rows={2} value={address} onChange={(e) => {
                      setAddress(e.target.value);
                      setFieldErrors((current) => ({ ...current, delivery_address: undefined }));
                    }}
                      aria-invalid={Boolean(fieldErrors.delivery_address)}
                      aria-describedby={fieldErrors.delivery_address ? 'address-error' : undefined}
                      className={`w-full px-4 py-3 rounded-lg border text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none ${fieldErrors.delivery_address ? 'border-rose-300' : 'border-primary-200'}`}
                      placeholder="Rue, quartier, point de repère (ex: en face de la pharmacie du quartier)" />
                    {fieldErrors.delivery_address && <p id="address-error" className="mt-1.5 text-sm text-rose-600" role="alert">{fieldErrors.delivery_address}</p>}
                  </div>
                  {currentDeliveryZones.length > 0 && (
                    <div>
                      <label htmlFor="zone-search" className="block text-sm font-medium text-gray-700 mb-1">Zone de livraison</label>
                      <input id="zone-search" type="search" value={zoneSearch}
                        onChange={(e) => setZoneSearch(e.target.value)}
                        placeholder="Rechercher un quartier ou une zone"
                        className="w-full mb-2 px-4 py-2.5 rounded-lg border border-primary-200 text-[#1A1919]" />
                      <div className="space-y-2">
                        {currentDeliveryZones
                          .filter((zone) => normalizeCity(zone.name).includes(normalizeCity(zoneSearch)))
                          .map((zone) => (
                          <label key={zone.id} className="flex items-center gap-3 p-3 rounded-lg border border-primary-100 hover:bg-primary-50 cursor-pointer">
                            <input type="radio" name="deliveryZone" value={zone.id} checked={deliveryZoneId === zone.id}
                              onChange={() => setDeliveryZoneId(zone.id)} className="text-primary-800 focus-visible:ring-primary-300" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-[#1A1919]">{zone.name}</span>
                              <span className="text-sm text-gray-500 ml-2">— {formatPrice(zone.fee)}</span>
                            </div>
                          </label>
                        ))}
                        {currentDeliveryZones.filter((zone) =>
                          normalizeCity(zone.name).includes(normalizeCity(zoneSearch))
                        ).length === 0 && (
                          <p role="status" className="text-sm text-gray-500">Aucune zone ne correspond à cette recherche.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {city.trim() && currentDeliveryZonesLoading && (
                    <p role="status" aria-live="polite" className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      Vérification des zones de livraison…
                    </p>
                  )}
                  {city.trim() && currentDeliveryZonesError && !currentDeliveryZonesLoading && (
                    <div role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">
                      <p>{currentDeliveryZonesError}</p>
                      <button
                        type="button"
                        onClick={() => setDeliveryZonesRetry((attempt) => attempt + 1)}
                        className="mt-2 font-medium underline underline-offset-2"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}
                  {city.trim() && !currentDeliveryZonesLoading && !currentDeliveryZonesError && currentDeliveryZones.length === 0 && (
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
              <textarea id="notes" name="order-notes" autoComplete="off" value={notes} onChange={(e) => {
                setNotes(e.target.value);
                setFieldErrors((current) => ({ ...current, customer_notes: undefined }));
              }} rows={3}
                aria-invalid={Boolean(fieldErrors.customer_notes)}
                aria-describedby={fieldErrors.customer_notes ? 'notes-error' : undefined}
                className={`w-full px-4 py-3 rounded-lg border text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none ${fieldErrors.customer_notes ? 'border-rose-300' : 'border-primary-200'}`}
                aria-label="Instructions spéciales pour la commande"
                placeholder="Instructions spéciales (optionnel)" />
              {fieldErrors.customer_notes && <p id="notes-error" className="mt-1.5 text-sm text-rose-600" role="alert">{fieldErrors.customer_notes}</p>}
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

              <button type="submit" disabled={loading || stockIssues.length > 0 || paymentMethodsLoading || Boolean(currentDeliveryZonesLoading)}
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
