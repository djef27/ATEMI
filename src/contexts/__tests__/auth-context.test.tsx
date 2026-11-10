import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { User } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

function AuthSnapshot() {
  const { user, profile, loading } = useAuth();

  return (
    <output>
      {user?.id ?? 'anonymous'}:{profile?.full_name ?? 'no profile'}:{String(loading)}
    </output>
  );
}

describe('AuthProvider', () => {
  it('does not let a previous user profile overwrite the current user profile', async () => {
    const userA = { id: 'user-a' } as User;
    const userB = { id: 'user-b' } as User;
    const profileA = {
      id: userA.id,
      full_name: 'Ancien compte',
      phone: null,
      whatsapp_number: null,
      role: 'customer',
      is_active: true,
      created_at: '',
      updated_at: '',
    };
    const profileB = { ...profileA, id: userB.id, full_name: 'Compte actuel' };
    const pendingProfiles = new Map<
      string,
      (result: { data: typeof profileA | null; error: null }) => void
    >();
    let notifyAuthStateChange: (event: string, session: { user: User } | null) => void = () => {};

    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: userA },
          error: null,
        }),
        onAuthStateChange: jest.fn((callback: typeof notifyAuthStateChange) => {
          notifyAuthStateChange = callback;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
      from: jest.fn(() => ({
        select: () => ({
          eq: (_column: string, userId: string) => ({
            single: () =>
              new Promise((resolve) => {
                pendingProfiles.set(userId, resolve);
              }),
          }),
        }),
      })),
    };

    mockCreateClient.mockReturnValue(supabase);
    render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>
    );

    await waitFor(() => expect(pendingProfiles.has(userA.id)).toBe(true));

    act(() => notifyAuthStateChange('SIGNED_IN', { user: userB }));
    await waitFor(() => expect(pendingProfiles.has(userB.id)).toBe(true));

    await act(async () => {
      pendingProfiles.get(userB.id)?.({ data: profileB, error: null });
    });
    await waitFor(() => expect(screen.getByText(/Compte actuel/)).toBeInTheDocument());

    await act(async () => {
      pendingProfiles.get(userA.id)?.({ data: profileA, error: null });
    });

    expect(screen.getByText(/user-b:Compte actuel:false/)).toBeInTheDocument();
  });
});
