import { fireEvent, render, screen } from '@testing-library/react';
import AddToCartButton from '@/components/add-to-cart-button';

const mockAddItem = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/hooks/use-cart', () => ({
  useCart: (selector: (state: { addItem: typeof mockAddItem }) => unknown) =>
    selector({ addItem: mockAddItem }),
}));

jest.mock('@/components/toast-provider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const product = {
  product_id: 'product-1',
  name: 'Sac Atémi',
  slug: 'sac-atemi',
  image: null,
  selling_price: 10000,
  supplier_price: 5000,
  deposit_rate: 50,
  deposit_amount: 5000,
  remaining_amount: 5000,
  quantity: 1,
  stock: 5,
  vendor_id: 'vendor-1',
  vendor_name: 'Boutique Atémi',
};

describe('AddToCartButton', () => {
  beforeEach(() => {
    mockAddItem.mockClear();
    mockShowToast.mockClear();
  });

  it('adds the selected quantity in one cart update', () => {
    render(<AddToCartButton product={product} />);

    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la quantité' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au panier' }));

    expect(mockAddItem).toHaveBeenCalledTimes(1);
    expect(mockAddItem).toHaveBeenCalledWith({ ...product, quantity: 2 });
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  it('does not allow adding an out-of-stock product', () => {
    render(<AddToCartButton product={{ ...product, stock: 0 }} />);

    expect(screen.getByRole('button', { name: 'Ajouter au panier' }).hasAttribute('disabled')).toBe(true);
  });
});
