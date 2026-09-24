import { formatPrice } from '../utils';

describe('formatPrice', () => {
  it('formats zero correctly', () => {
    expect(formatPrice(0)).toBe('0 FCFA');
  });

  it('formats integer prices and ends with FCFA', () => {
    const result = formatPrice(1000);
    expect(result).toMatch(/FCFA$/);
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('formats decimal prices with comma separator', () => {
    const result = formatPrice(1500.50);
    expect(result).toMatch(/,5\s*FCFA$/);
  });

  it('formats large numbers correctly', () => {
    const result = formatPrice(100000);
    expect(result).toMatch(/FCFA$/);
    expect(result).toContain('100');
  });

  it('formats small numbers correctly', () => {
    const result = formatPrice(50);
    expect(result).toBe('50 FCFA');
  });

  it('uses French number formatting', () => {
    const result = formatPrice(1234567.89);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('567');
    expect(result).toContain(',89');
    expect(result).toMatch(/FCFA$/);
  });
});
