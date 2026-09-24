'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ScheduleItem {
  time: string;
  platform: string;
  productName: string;
  status: string;
}

interface ScheduleConfig {
  postsPerDay: number;
  postingTimes: string[];
  platforms: string[];
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-black text-white',
  instagram: 'bg-pink-500 text-white',
  facebook: 'bg-blue-600 text-white',
  youtube: 'bg-red-600 text-white',
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedule();
  }, []);

  async function fetchSchedule() {
    try {
      const res = await fetch('/api/content-engine/schedule');
      const data = await res.json();
      if (data.success) {
        setSchedule(data.data.schedule || []);
        setConfig(data.data.config);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const timeSlots = config?.postingTimes || ['08:00', '14:00', '20:00'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#1A1919]">Calendrier</h2>
        <p className="text-sm text-gray-500 mt-1">Programmation des publications</p>
      </div>

      {/* Config Card */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500">Publications/jour</label>
            <p className="text-2xl font-bold text-[#1A1919]">{config?.postsPerDay || 3}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Horaires</label>
            <div className="flex gap-2 mt-1">
              {timeSlots.map((time) => (
                <span key={time} className="px-3 py-1 bg-primary-50 rounded-full text-sm font-medium text-primary-700">
                  {time}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Plateformes</label>
            <div className="flex gap-2 mt-1">
              {(config?.platforms || []).map((platform) => (
                <span key={platform} className={`px-3 py-1 rounded-full text-xs font-medium ${PLATFORM_COLORS[platform] || 'bg-gray-100 text-gray-600'}`}>
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Aujourd&apos;hui</h3>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
          </div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune programmation aujourd&apos;hui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-primary-50">
                <div className="flex items-center gap-2 w-20">
                  <Clock className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-primary-700">{item.time}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${PLATFORM_COLORS[item.platform] || 'bg-gray-100'}`}>
                  {item.platform}
                </span>
                <span className="flex-1 text-sm text-[#1A1919]">{item.productName}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.status === 'published' ? '✅ Publié' : '⏰ En attente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty time slots */}
      <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
        <h3 className="font-medium text-[#1A1919] mb-4">Créneaux disponibles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {timeSlots.map((time) => {
            const isOccupied = schedule.some((s) => s.time === time);
            return (
              <div
                key={time}
                className={`p-4 rounded-xl border-2 border-dashed transition-colors ${
                  isOccupied
                    ? 'border-green-300 bg-green-50'
                    : 'border-primary-200 bg-primary-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-[#1A1919]">{time}</span>
                </div>
                {isOccupied ? (
                  <p className="text-xs text-green-600">✅ Programmé</p>
                ) : (
                  <p className="text-xs text-gray-500">Disponible</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
