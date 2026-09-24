'use client';

import { useState, useEffect } from 'react';
import { Clock, Send, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface QueueItem {
  id: string;
  platform: string;
  caption: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-600' },
  ready: { label: 'Prêt', color: 'bg-blue-100 text-blue-700' },
  scheduled: { label: 'Programmé', color: 'bg-amber-100 text-amber-700' },
  publishing: { label: 'Publication...', color: 'bg-purple-100 text-purple-700' },
  published: { label: 'Publié', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Échoué', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
};

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  tiktok: { label: 'TikTok', color: 'bg-black text-white' },
  instagram: { label: 'Instagram', color: 'bg-pink-500 text-white' },
  facebook: { label: 'Facebook', color: 'bg-blue-600 text-white' },
  youtube: { label: 'YouTube', color: 'bg-red-600 text-white' },
};

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch('/api/content-engine/queue');
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function publishItem(id: string) {
    setPublishing(id);
    try {
      const res = await fetch('/api/content-engine/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemId: id }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Publié avec succès !');
        fetchQueue();
      } else {
        alert(data.error || 'Erreur lors de la publication');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setPublishing(null);
    }
  }

  const filteredItems = filter === 'all'
    ? items
    : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#1A1919]">File d&apos;attente</h2>
          <p className="text-sm text-gray-500 mt-1">Contenu prêt à publier</p>
        </div>
        <button
          onClick={fetchQueue}
          className="p-2 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'ready', 'scheduled', 'published', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-primary-900 text-white'
                : 'bg-white text-gray-600 border border-primary-100 hover:bg-primary-50'
            }`}
          >
            {status === 'all' ? 'Tout' : STATUS_LABELS[status]?.label || status}
          </button>
        ))}
      </div>

      {/* Queue Items */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-primary-100">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun élément dans la file</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.draft;
            const platformInfo = PLATFORM_LABELS[item.platform] || { label: item.platform, color: 'bg-gray-100 text-gray-600' };

            return (
              <div key={item.id} className="bg-white rounded-2xl border border-primary-100 p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Platform Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${platformInfo.color}`}>
                    {platformInfo.label}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A1919] line-clamp-2">
                      {item.caption || 'Pas de légende'}
                    </p>
                    {item.hashtags && item.hashtags.length > 0 && (
                      <p className="text-xs text-primary-600 mt-1">
                        {item.hashtags.slice(0, 5).join(' ')}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {item.scheduled_at && (
                        <span>📅 {new Date(item.scheduled_at).toLocaleString('fr-FR')}</span>
                      )}
                      {item.published_at && (
                        <span>✅ {new Date(item.published_at).toLocaleString('fr-FR')}</span>
                      )}
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>

                    {item.status === 'ready' && (
                      <button
                        onClick={() => publishItem(item.id)}
                        disabled={publishing === item.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
                      >
                        {publishing === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Publier
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
