import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CheckoutPage from '../page';

const mockReplace = jest.fn();
const mockFetch = jest.fn();
const mockCartItems = [{
  product_id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Produit test',
  slug: 'produit-test',
  image: null,
  selling_price: 4000,
  supplier_price: 2000,
  deposit_rate: 50,
  deposit_amount: 2000,
  remaining_amount: 2000,
  quantity: 1,
  stock: 10,
  vendor_id: '550e8400-e29b-41d4-a716-446655440001',
  vendor_name: 'Vendeur test',
}];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    items: mockCartItems,
    getSubtotal: () => 4000,
    getDeposit: () => 2000,
    getRemaining: () => 2000,
    getVendorId: () => '550e8400-e29b-41d4-a716-446655440001',
  }),
}));

jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, profile: null }),
}));

describe('checkout form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/geography/countries') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [
                { code: 'BJ', name: 'Bénin', internationalName: 'Benin', callingCode: '229', flag: '🇧🇯', continent: 'Afrique', subregion: "Afrique de l'Ouest" },
                { code: 'TG', name: 'Togo', internationalName: 'Togo', callingCode: '228', flag: '🇹🇬', continent: 'Afrique', subregion: "Afrique de l'Ouest" },
                { code: 'GH', name: 'Ghana', internationalName: 'Ghana', callingCode: '233', flag: '🇬🇭', continent: 'Afrique', subregion: "Afrique de l'Ouest" },
                { code: 'SG', name: 'Singapour', internationalName: 'Singapore', callingCode: '65', flag: '🇸🇬', continent: 'Asie', subregion: 'Asie du Sud-Est' },
                { code: 'FR', name: 'France', internationalName: 'France', callingCode: '33', flag: '🇫🇷', continent: 'Europe', subregion: 'Europe de l’Ouest' },
                { code: 'GF', name: 'Guyane française', internationalName: 'French Guiana', callingCode: '594', flag: '🇬🇫', continent: 'Amériques', subregion: 'Amérique du Sud' },
              ],
            }),
          });
        }
        if (url.startsWith('/api/geography/regions?country=')) {
          const country = new URLSearchParams(url.split('?')[1]).get('country');
          const regions: Record<string, Array<{ code: string; name: string }>> = {
            BJ: [{ code: 'LI', name: 'Littoral' }],
            TG: [{ code: 'M', name: 'Maritime' }],
            GH: [{ code: 'AA', name: 'Greater Accra' }],
            SG: [{ code: '01', name: 'Central Singapore Community Development Council' }],
            FR: [{ code: 'IDF', name: 'Île-de-France' }],
            GF: [],
          };
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: regions[country || ''] || [] }),
          });
        }
        if (url.startsWith('/api/geography/cities?country=')) {
          const params = new URLSearchParams(url.split('?')[1]);
          const key = `${params.get('country')}:${params.get('region') || ''}`;
          const cities: Record<string, Array<{ id: string; name: string; regionCode: string | null }>> = {
            'BJ:LI': [{ id: 'BJ-LI-cotonou', name: 'Cotonou', regionCode: 'LI' }],
            'TG:M': [{ id: 'TG-M-lome', name: 'Lomé', regionCode: 'M' }],
            'GH:AA': [{ id: 'GH-AA-accra', name: 'Accra', regionCode: 'AA' }],
            'SG:01': [{ id: 'SG-01-singapore', name: 'Singapore', regionCode: '01' }],
            'FR:IDF': [{ id: 'FR-IDF-paris', name: 'Paris', regionCode: 'IDF' }],
            'GF:': [],
          };
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: cities[key] || [] }),
          });
        }
        if (url.startsWith('/api/payment/methods')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { paymentMethods: [{ id: 'test-provider', displayName: 'Test paiement' }] } }),
          });
        }
        if (url.startsWith('/api/delivery-zones?cities=1&country=')) {
          const country = new URLSearchParams(url.split('?')[1]).get('country');
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: country === 'BJ'
                ? [{ name: 'Cotonou', min_fee: 2000, zones_count: 1 }]
                : [],
            }),
          });
        }
        if (url.startsWith('/api/delivery-zones?city=')) {
          const params = new URLSearchParams(url.split('?')[1]);
          const hasBeninCotonou = params.get('country') === 'BJ' && params.get('city') === 'Cotonou';
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: hasBeninCotonou
                ? [{ id: 'zone-cotonou', name: 'Centre-Ville', fee: 2000, city: 'Cotonou' }]
                : [],
            }),
          });
        }
        if (url === '/api/products/stock') {
          return Promise.resolve({ json: async () => ({ success: true, issues: [] }) });
        }
        if (url === '/api/orders') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                order_id: '550e8400-e29b-41d4-a716-446655440003',
                order_number: 'CMD-TEST',
                tracking_token: '550e8400-e29b-41d4-a716-446655440004',
              },
            }),
          });
        }
        throw new Error(`Unexpected checkout request: ${url}`);
      }),
    });
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('shows required-field errors below inputs and keeps entered values', () => {
    const { container } = render(<CheckoutPage />);
    fireEvent.click(screen.getByLabelText('Retrait'));
    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByText('Veuillez saisir votre nom complet.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez saisir un numéro de téléphone valide.')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith('/api/orders', expect.anything());

    fireEvent.change(screen.getByLabelText('Nom complet *'), { target: { value: 'Jean-Baptiste Dupont de la Vallée' } });
    expect(screen.getByLabelText('Nom complet *')).toHaveValue('Jean-Baptiste Dupont de la Vallée');
    expect(screen.queryByText('Veuillez saisir votre nom complet.')).not.toBeInTheDocument();
  });

  it('accepts a name longer than 20 characters and proceeds to payment after order creation', async () => {
    const { container } = render(<CheckoutPage />);
    fireEvent.click(screen.getByLabelText('Retrait'));
    await screen.findByRole('radio', { name: 'Test paiement' });
    fireEvent.change(screen.getByLabelText('Nom complet *'), {
      target: { value: 'Jean-Baptiste Dupont de la Vallée' },
    });
    fireEvent.change(container.querySelector('#phone')!, { target: { value: '01020304' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/paiement?order=CMD-TEST'));
    });
    const orderRequest = mockFetch.mock.calls.find(([url]) => url === '/api/orders');
    expect(JSON.parse(orderRequest[1].body)).toMatchObject({
      customer_name: 'Jean-Baptiste Dupont de la Vallée',
      customer_phone: '+229 01 02 03 04',
      delivery_required: false,
    });
  });

  it('shows only the selected country’s cities and does not imply Togo or Ghana delivery is configured', async () => {
    const { container } = render(<CheckoutPage />);
    const countrySelect = container.querySelector('#country') as HTMLSelectElement;
    await waitFor(() => expect(countrySelect).not.toBeDisabled());
    let regionSelect = await screen.findByLabelText('Région / Département *') as HTMLSelectElement;
    let citySelect = container.querySelector('#city') as HTMLSelectElement;

    fireEvent.change(regionSelect, { target: { value: 'LI' } });
    expect(regionSelect).toHaveValue('LI');
    await waitFor(() => expect(mockFetch.mock.calls.map(([url]) => String(url)))
      .toContain('/api/geography/cities?country=BJ&region=LI'));
    citySelect = await screen.findByLabelText('Ville *') as HTMLSelectElement;
    fireEvent.change(citySelect, { target: { value: 'Cotonou' } });
    expect(await screen.findByText(/Livraison disponible à Cotonou/)).toBeInTheDocument();

    fireEvent.change(countrySelect, { target: { value: 'TG' } });
    await waitFor(() => {
      expect(container.querySelector('#city')).not.toBeInTheDocument();
    });
    regionSelect = await screen.findByLabelText('Région / Département *') as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: 'M' } });
    citySelect = await screen.findByLabelText('Ville *') as HTMLSelectElement;
    fireEvent.change(citySelect, { target: { value: 'Lomé' } });
    expect(await screen.findByText(/Aucune zone de livraison disponible pour cette ville/)).toBeInTheDocument();
    expect(screen.queryByText(/Livraison disponible à Lomé/)).not.toBeInTheDocument();

    fireEvent.change(countrySelect, { target: { value: 'GH' } });
    await waitFor(() => {
      expect(container.querySelector('#city')).not.toBeInTheDocument();
    });
    regionSelect = await screen.findByLabelText('Région / Département *') as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: 'AA' } });
    citySelect = await screen.findByLabelText('Ville *') as HTMLSelectElement;
    expect(Array.from(citySelect.options).map((option) => option.value)).toContain('Accra');
    expect(Array.from(citySelect.options).map((option) => option.value)).not.toContain('Cotonou');
    fireEvent.change(citySelect, { target: { value: 'Accra' } });
    expect(await screen.findByText(/Aucune zone de livraison disponible pour cette ville/)).toBeInTheDocument();
  });

  it('loads real Singapore subdivisions and city data without implying configured delivery', async () => {
    const { container } = render(<CheckoutPage />);
    const countrySelect = container.querySelector('#country') as HTMLSelectElement;
    await waitFor(() => expect(countrySelect).not.toBeDisabled());
    fireEvent.change(countrySelect, { target: { value: 'SG' } });

    const regionSelect = await screen.findByLabelText('Région / Département *') as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: '01' } });
    await waitFor(() => expect(mockFetch.mock.calls.map(([url]) => String(url)))
      .toContain('/api/geography/cities?country=SG&region=01'));
    const citySelect = await screen.findByLabelText('Ville *') as HTMLSelectElement;
    expect(Array.from(citySelect.options).map((option) => option.value)).toContain('Singapore');
    fireEvent.change(citySelect, { target: { value: 'Singapore' } });
    expect(await screen.findByText(/Aucune zone de livraison disponible pour cette ville/)).toBeInTheDocument();
    expect(screen.queryByText(/Livraison disponible à Singapore/)).not.toBeInTheDocument();
  });

  it('adapts the dialing code when the country changes and permits countries without subdivisions', async () => {
    const { container } = render(<CheckoutPage />);
    const countrySelect = container.querySelector('#country') as HTMLSelectElement;
    await waitFor(() => expect(countrySelect).not.toBeDisabled());
    fireEvent.change(countrySelect, { target: { value: 'FR' } });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Sélectionner le pays' })[0]).toHaveTextContent('+33');
    });

    fireEvent.change(countrySelect, { target: { value: 'GF' } });
    expect(await screen.findByText(/Aucune subdivision n’est référencée/)).toBeInTheDocument();
    expect(await screen.findByText(/Aucune ville n’est référencée ou desservie/)).toBeInTheDocument();
    expect(container.querySelector('#region')).not.toBeInTheDocument();
    expect(container.querySelector('#city')).not.toBeInTheDocument();
  });
});
