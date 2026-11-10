import { act, fireEvent, render, screen } from '@testing-library/react';
import PhoneInput from '@/components/PhoneInput';

describe('PhoneInput', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves the cursor to the end of the formatted value on focus', () => {
    jest.useFakeTimers();
    render(<PhoneInput value="12345678" onChange={jest.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    const setSelectionRange = jest.spyOn(input, 'setSelectionRange');

    fireEvent.focus(input);
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(setSelectionRange).toHaveBeenCalledWith(11, 11);
  });
});
