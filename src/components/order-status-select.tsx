'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import { getOrderStatusLabel } from '@/lib/order-status';
import type { OrderStatus } from '@/types';

interface OrderStatusSelectProps {
  orderId: string;
  value: OrderStatus;
  statuses: OrderStatus[];
  endpoint: string;
  disabled?: boolean;
  onChanged?: () => void;
}

export default function OrderStatusSelect({
  orderId,
  value,
  statuses,
  endpoint,
  disabled = false,
  onChanged,
}: OrderStatusSelectProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as OrderStatus;
    if (status === value) return;

    setLoading(true);
    try {
      const res = await fetch(`${endpoint}/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || "Impossible de modifier le statut", 'error');
        return;
      }
      showToast(`Statut mis à jour : ${getOrderStatusLabel(status)}`);
      onChanged?.();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled || loading}
        aria-label="Statut de la commande"
        aria-busy={loading}
        className="appearance-none pr-8 pl-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {getOrderStatusLabel(s)}
          </option>
        ))}
      </select>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-primary-600 absolute right-2 pointer-events-none" aria-hidden="true" />
      ) : (
        <svg
          className="w-4 h-4 text-gray-400 absolute right-2 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  );
}