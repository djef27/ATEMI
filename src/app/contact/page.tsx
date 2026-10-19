'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle } from 'lucide-react';
import { getContactConfig } from '@/lib/site-config';

export default function ContactPage() {
  const contact = getContactConfig();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Erreur lors de l\'envoi');
      }
    } catch {
      setError('Une erreur inattendue est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1919] mb-4">Contactez-nous</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Une question ? Écrivez-nous.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1919] text-sm">Téléphone</h3>
                <a href={`tel:${contact.phoneDisplay.replace(/\s/g, '')}`} className="text-sm text-gray-600 hover:text-primary-700">{contact.phoneDisplay}</a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1919] text-sm">Email</h3>
                {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="text-sm text-gray-600 hover:text-primary-700">{contact.email}</a>
                  ) : (
                    <p className="text-sm text-gray-500">Non configuré pour le moment</p>
                  )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1919] text-sm">Adresse</h3>
                <p className="text-sm text-gray-600">{contact.city}, {contact.country}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2">
            {sent ? (
              <div className="bg-white rounded-2xl border border-primary-100 p-8 shadow-sm text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="font-serif text-xl font-bold text-[#1A1919] mb-2">Message envoyé</h2>
                <p className="text-gray-600">Merci ! On vous répond.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="Votre nom" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      placeholder="votre@email.com" />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Sujet *</label>
                  <input id="subject" type="text" required value={subject} onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    placeholder="Objet de votre message" />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea id="message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-primary-200 text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 resize-none"
                    placeholder="Décrivez votre demande…" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
