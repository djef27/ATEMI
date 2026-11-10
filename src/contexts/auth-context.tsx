'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());
  const profileRequestId = useRef(0);
  const activeUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestId.current;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (requestId !== profileRequestId.current) return;
      if (error) {
        console.error('[AUTH_PROFILE_ERROR]', error.message, error.code);
        setProfile(null);
        return;
      }

      setProfile(data as Profile | null);
    } catch (error) {
      if (requestId === profileRequestId.current) {
        setProfile(null);
      }
      console.error('[AUTH_PROFILE_ERROR]', error);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[AUTH_USER_ERROR]', error.message);
      profileRequestId.current++;
      setProfile(null);
      return;
    }

    if (currentUser?.id !== activeUserId.current) return;
    if (currentUser) {
      await fetchProfile(currentUser.id);
    } else {
      profileRequestId.current++;
      setProfile(null);
    }
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    profileRequestId.current++;
    activeUserId.current = null;
    setUser(null);
    setProfile(null);
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    let authEventVersion = 0;
    const currentProfileRequestId = profileRequestId.current;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        authEventVersion++;
        const eventVersion = authEventVersion;
        const newUser = session?.user ?? null;
        profileRequestId.current++;
        activeUserId.current = newUser?.id ?? null;
        setUser(newUser);
        setProfile(null);

        if (!newUser) {
          setLoading(false);
          return;
        }

        // Defer Supabase queries until the auth callback and its internal lock have returned.
        window.setTimeout(async () => {
          if (!isMounted || eventVersion !== authEventVersion) return;
          await fetchProfile(newUser.id);
          if (isMounted && eventVersion === authEventVersion) {
            setLoading(false);
          }
        }, 0);
      }
    );

    const initialAuthEventVersion = authEventVersion;
    const loadCurrentUser = async () => {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      if (!isMounted || authEventVersion !== initialAuthEventVersion) return;

      if (error) {
        console.error('[AUTH_USER_ERROR]', error.message);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      activeUserId.current = currentUser?.id ?? null;
      if (currentUser) {
        await fetchProfile(currentUser.id);
      }
      if (isMounted && authEventVersion === initialAuthEventVersion) {
        setLoading(false);
      }
    };

    void loadCurrentUser();

    return () => {
      isMounted = false;
      profileRequestId.current = currentProfileRequestId + 1;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const value = useMemo(
    () => ({ user, profile, loading, signOut, refreshProfile }),
    [user, profile, loading, signOut, refreshProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
