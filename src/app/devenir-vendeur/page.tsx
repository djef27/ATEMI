'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Store, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function VendorRegistrationPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    city: 'Cotonou',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Create vendor with pending status
      const { error: insertError } = await supabase
        .from('vendors')
        .insert({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          whatsapp_number: form.whatsapp_number.trim() || null,
          email: form.email.trim() || null,
          city: form.city.trim(),
          country: 'BJ',
          status: 'inactive',
        });

      if (insertError) {
        setError('Erreur lors de l\'inscription. Veuillez réessayer.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Une erreur inattendue est survenue');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1A1919] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;accueil
        </Link>

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <Store className="w-7 h-7 text-primary-700" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#1A1919] mb-2">Devenir vendeur</h1>
          <p className="text-gray-600">
            Rejoignez une marketplace qui met en lumière les talents africains. Les inscriptions vendeurs sont actuellement ouvertes au Bénin ; l’ouverture à d’autres marchés se fera progressivement.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 p-8 shadow-sm">
          {sent ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="font-serif text-xl font-bold text-[#1A1919] mb-2">Demande envoyée</h2>
              <p className="text-sm text-gray-600 mb-6">
                Votre demande de vendeur a été enregistrée. Un administrateur vérifiera votre compte sous 24-48h.
              </p>
              <Link href="/" className="inline-block px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800">
                Retour à l&apos;accueil
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-6">Informations du vendeur</h2>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique *</label>
                  <input id="name" type="text" required value={form.name} onChange={(e) => update('name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    placeholder="Ex: Boutique Élégance" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="+229 01 02 03 04" />
                  </div>
                  <div>
                    <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                    <input id="whatsapp" type="tel" value={form.whatsapp_number} onChange={(e) => update('whatsapp_number', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="+229 01 02 03 04" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="contact@boutique.com" />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">Ville au Bénin *</label>
                    <input id="city" type="text" required value={form.city} onChange={(e) => update('city', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="Cotonou" />
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description de votre boutique</label>
                  <textarea id="description" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none"
                    placeholder="Décrivez vos produits et votre spécialité (optionnel)" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  Soumettre ma demande
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
