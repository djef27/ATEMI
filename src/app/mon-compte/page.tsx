'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Package, FileText, LogOut, Loader2, Save, Key, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function MonComptePage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/mon-compte');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </main>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSavingProfile(false);
    if (!error) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caract\u00e8res');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-8">Mon compte</h1>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1A1919] font-serif">
                {profile.full_name}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Link
              href="/mes-commandes"
              className="flex items-center gap-3 p-4 rounded-lg border border-primary-100 hover:bg-primary-50 transition-colors"
            >
              <Package className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Mes commandes</p>
                <p className="text-xs text-gray-500">Consulter l&apos;historique</p>
              </div>
            </Link>

            <Link
              href="/recu"
              className="flex items-center gap-3 p-4 rounded-lg border border-primary-100 hover:bg-primary-50 transition-colors"
            >
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Mes re&ccedil;us</p>
                <p className="text-xs text-gray-500">T&eacute;l&eacute;charger un re&ccedil;u</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Edit profile */}
        <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Informations personnelles</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-primary-200 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">T&eacute;l&eacute;phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-primary-200 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent"
                placeholder="+229 01 02 03 04"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
            {profileSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Enregistr&eacute;
              </span>
            )}
          </div>
        </form>

        {/* Change password */}
        <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4" /> Changer le mot de passe
          </h3>
          {passwordError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {passwordError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-primary-200 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-primary-200 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Modifier
            </button>
            {passwordSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Mot de passe modifi&eacute;
              </span>
            )}
          </div>
        </form>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          D&eacute;connexion
        </button>
      </div>
    </main>
  );
}
