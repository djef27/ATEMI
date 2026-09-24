'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle } from 'lucide-react';

interface BrandConfig {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultLanguage: string;
  defaultCTA: string;
}

interface CostLimits {
  maxDailyCost: number;
  maxMonthlyCost: number;
  maxDailyGenerations: number;
  maxMonthlyGenerations: number;
}

export default function SettingsPage() {
  const [brand, setBrand] = useState<BrandConfig>({
    brandName: 'Atémi',
    primaryColor: '#C5A880',
    secondaryColor: '#1A1919',
    accentColor: '#D4A0A0',
    defaultLanguage: 'fr',
    defaultCTA: 'Commandez maintenant',
  });
  const [limits, setLimits] = useState<CostLimits>({
    maxDailyCost: 5,
    maxMonthlyCost: 50,
    maxDailyGenerations: 100,
    maxMonthlyGenerations: 2000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/content-engine/settings');
      const data = await res.json();
      if (data.success) {
        if (data.data.brand) setBrand(data.data.brand);
        if (data.data.cost?.limits) setLimits(data.data.cost.limits);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch('/api/content-engine/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, limits }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#1A1919]">Paramètres</h2>
          <p className="text-sm text-gray-500 mt-1">Configuration du Content Engine</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Brand Settings */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Identité visuelle</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom de la marque</label>
            <input
              type="text"
              value={brand.brandName}
              onChange={(e) => setBrand({ ...brand, brandName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Langue par défaut</label>
            <select
              value={brand.defaultLanguage}
              onChange={(e) => setBrand({ ...brand, defaultLanguage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Couleur principale</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={brand.primaryColor}
                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-primary-100 cursor-pointer"
              />
              <input
                type="text"
                value={brand.primaryColor}
                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA par défaut</label>
            <input
              type="text"
              value={brand.defaultCTA}
              onChange={(e) => setBrand({ ...brand, defaultCTA: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
      </div>

      {/* Budget Limits */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Limites de budget</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Budget max journalier (USD)</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={limits.maxDailyCost}
              onChange={(e) => setLimits({ ...limits, maxDailyCost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Budget max mensuel (USD)</label>
            <input
              type="number"
              step="5"
              min="0"
              value={limits.maxMonthlyCost}
              onChange={(e) => setLimits({ ...limits, maxMonthlyCost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Générations max/jour</label>
            <input
              type="number"
              step="10"
              min="0"
              value={limits.maxDailyGenerations}
              onChange={(e) => setLimits({ ...limits, maxDailyGenerations: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Générations max/mois</label>
            <input
              type="number"
              step="100"
              min="0"
              value={limits.maxMonthlyGenerations}
              onChange={(e) => setLimits({ ...limits, maxMonthlyGenerations: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
      </div>

      {/* API Keys Info */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Clés API (configurées via .env)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${process.env.OPENAI_API_KEY ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-gray-600">OpenAI (texte + images)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${process.env.ELEVENLABS_API_KEY ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-gray-600">ElevenLabs (voix)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${process.env.TIKTOK_CLIENT_KEY ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-gray-600">TikTok API</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${process.env.FACEBOOK_APP_ID ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-gray-600">Facebook/Instagram API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
