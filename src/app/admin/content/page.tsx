'use client';

import { useState, useEffect } from 'react';
import { Package, FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Play, Pause, RefreshCw, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface Stats {
  totalProducts: number;
  analyzedProducts: number;
  totalConcepts: number;
  queuedItems: number;
  publishedToday: number;
  dailyCost: number;
}

interface AutopilotStatus {
  status: 'stopped' | 'running' | 'paused';
  config: {
    enabled: boolean;
    autoPublish: boolean;
    requireApproval: boolean;
  };
  lastRun: string | null;
  nextRun: string | null;
}

export default function ContentDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [settingsRes, autopilotRes] = await Promise.all([
        fetch('/api/content-engine/settings'),
        fetch('/api/content-engine/autopilot'),
      ]);

      const settingsData = await settingsRes.json();
      const autopilotData = await autopilotRes.json();

      if (settingsData.success) {
        setStats({
          totalProducts: 0,
          analyzedProducts: 0,
          totalConcepts: 0,
          queuedItems: 0,
          publishedToday: 0,
          dailyCost: settingsData.data.cost?.dailyCost || 0,
        });
      }

      if (autopilotData.success) {
        setAutopilot(autopilotData.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function runAutopilotCycle() {
    setRunningCycle(true);
    try {
      const res = await fetch('/api/content-engine/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Cycle terminé !\n${data.data.productsProcessed} produits traités\n${data.data.conceptsGenerated} concepts générés\n${data.data.itemsQueued} items en file`);
        fetchData();
      } else {
        alert(data.error || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setRunningCycle(false);
    }
  }

  async function toggleAutopilot() {
    if (!autopilot) return;
    const action = autopilot.status === 'running' ? 'pause' : 'resume';
    try {
      await fetch('/api/content-engine/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchData();
    } catch {
      // ignore
    }
  }

  const statCards = [
    { label: 'Produits analysés', value: stats?.analyzedProducts || 0, icon: Package, color: 'bg-blue-50 text-blue-700' },
    { label: 'Concepts générés', value: stats?.totalConcepts || 0, icon: FileText, color: 'bg-purple-50 text-purple-700' },
    { label: 'En file d\'attente', value: stats?.queuedItems || 0, icon: Clock, color: 'bg-amber-50 text-amber-700' },
    { label: 'Publiés aujourd\'hui', value: stats?.publishedToday || 0, icon: CheckCircle, color: 'bg-green-50 text-green-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#1A1919]">Vue d&apos;ensemble</h2>
        <p className="text-sm text-gray-500 mt-1">Statut du système de contenu automatique</p>
      </div>

      {/* Autopilot Card */}
      <div className={`rounded-2xl border p-6 shadow-sm ${
        autopilot?.status === 'running'
          ? 'bg-green-50 border-green-200'
          : autopilot?.status === 'paused'
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-primary-100'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${
              autopilot?.status === 'running'
                ? 'bg-green-100'
                : autopilot?.status === 'paused'
                ? 'bg-amber-100'
                : 'bg-gray-100'
            }`}>
              {autopilot?.status === 'running' ? (
                <Play className="w-6 h-6 text-green-700" />
              ) : autopilot?.status === 'paused' ? (
                <Pause className="w-6 h-6 text-amber-700" />
              ) : (
                <AlertCircle className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-[#1A1919]">
                Autopilot
              </h3>
              <p className="text-sm text-gray-500">
                {autopilot?.status === 'running'
                  ? `Actif · Prochain run: ${autopilot.nextRun ? new Date(autopilot.nextRun).toLocaleTimeString('fr-FR') : 'N/A'}`
                  : autopilot?.status === 'paused'
                  ? 'Mis en pause'
                  : 'Arrêté'}
              </p>
              {autopilot?.lastRun && (
                <p className="text-xs text-gray-400 mt-1">
                  Dernier run: {new Date(autopilot.lastRun).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runAutopilotCycle}
              disabled={runningCycle}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
            >
              {runningCycle ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Exécuter un cycle
            </button>

            <button
              onClick={toggleAutopilot}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                autopilot?.status === 'running'
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {autopilot?.status === 'running' ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Activer
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-primary-100 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-[#1A1919]">
              {loading ? '...' : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Cost Card */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-700" />
          </div>
          <h3 className="font-medium text-[#1A1919]">Budget aujourd&apos;hui</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#1A1919]">
            {loading ? '...' : formatPrice(stats?.dailyCost || 0)}
          </span>
          <span className="text-sm text-gray-500">FCFA</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Limite quotidienne: 5.00 USD (~3,000 FCFA)</p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Actions rapides</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/admin/content/products"
            className="flex items-center gap-3 p-4 rounded-xl border border-primary-100 hover:bg-primary-50 transition-colors"
          >
            <Package className="w-5 h-5 text-primary-700" />
            <div>
              <div className="text-sm font-medium text-[#1A1919]">Analyser un produit</div>
              <div className="text-xs text-gray-500">Lancer l&apos;analyse IA</div>
            </div>
          </a>
          <a
            href="/admin/content/queue"
            className="flex items-center gap-3 p-4 rounded-xl border border-primary-100 hover:bg-primary-50 transition-colors"
          >
            <Clock className="w-5 h-5 text-primary-700" />
            <div>
              <div className="text-sm font-medium text-[#1A1919]">Voir la file</div>
              <div className="text-xs text-gray-500">Contenu en attente</div>
            </div>
          </a>
          <a
            href="/admin/content/settings"
            className="flex items-center gap-3 p-4 rounded-xl border border-primary-100 hover:bg-primary-50 transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-primary-700" />
            <div>
              <div className="text-sm font-medium text-[#1A1919]">Paramètres</div>
              <div className="text-xs text-gray-500">Configurer le système</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
