'use client';

import { useId, useState } from 'react';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

export default function NewsletterSignup() {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setValue('');
      } else {
        setError(data.error || 'Erreur');
      }
    } catch {
      setError('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative py-16 sm:py-20 bg-[#1A1919] overflow-hidden texture-noise">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-primary-800/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-accent-900/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <ScrollReveal>
          <div className="max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-primary-300 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-900/30">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
              Restez informé(e)
            </h2>
            <p className="text-gray-300 mb-8">
              Recevez nos nouveautés et offres exclusives par email ou WhatsApp.
            </p>

            {submitted ? (
              <div role="status" className="flex items-center justify-center gap-2 text-primary-400">
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">Merci ! Vous serez informé(e) de nos nouveautés.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label htmlFor={emailId} className="sr-only">Adresse email</label>
                {error && (
                  <p role="alert" className="text-sm text-rose-400 w-full">{error}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id={emailId}
                  type="email"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Votre email ou numéro WhatsApp"
                  required
                  className="flex-1 px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:border-transparent text-sm transition-colors duration-300 focus-visible:bg-white/15"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3.5 rounded-xl bg-white text-[#1A1919] font-semibold text-sm hover:bg-gray-100 transition-[background-color,box-shadow] duration-300 hover:shadow-lg shrink-0 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "S'inscrire"}
                </button>
                </div>
              </form>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
