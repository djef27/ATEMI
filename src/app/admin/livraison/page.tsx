'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Loader2, Plus, X, Pencil, Trash2, Check, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import type { DeliveryZone } from '@/types';
import type { DeliveryZoneCreateInput, DeliveryZoneUpdateInput } from '@/lib/validations';
import { useToast } from '@/components/toast-provider';
import { formatPrice } from '@/lib/utils';

interface CityGroup {
  city: string;
  zones: DeliveryZone[];
}

const COUNTRY = 'BJ';

function groupByCity(zones: DeliveryZone[]): CityGroup[] {
  const groups = new Map<string, DeliveryZone[]>();
  for (const zone of zones) {
    const list = groups.get(zone.city) ?? [];
    list.push(zone);
    groups.set(zone.city, list);
  }
  return Array.from(groups.entries())
    .map(([city, list]) => ({ city, zones: list }))
    .sort((a, b) => a.city.localeCompare(b.city, 'fr'));
}

const emptyForm: DeliveryZoneCreateInput = {
  country: COUNTRY,
  city: '',
  zone_name: '',
  delivery_fee: 0,
  is_available: true,
};

export default function AdminDeliveryZonesPage() {
  const { showToast } = useToast();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<DeliveryZoneCreateInput>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [editForm, setEditForm] = useState<DeliveryZoneUpdateInput | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchZones = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/delivery-zones?country=${COUNTRY}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setZones([]);
        setLoadError(data.error || 'Erreur lors du chargement des zones');
        return;
      }

      setZones((data.data as DeliveryZone[]) || []);
    } catch {
      setZones([]);
      setLoadError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const existingCities = Array.from(new Set(zones.map((z) => z.city))).sort((a, b) => a.localeCompare(b, 'fr'));
  const searchNorm = search.trim().toLowerCase();
  const groups = groupByCity(
    zones.filter((z) => !searchNorm || z.city.toLowerCase().includes(searchNorm) || z.zone_name.toLowerCase().includes(searchNorm))
  );
  const activeCount = zones.filter((z) => z.is_active).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, delivery_fee: Number(form.delivery_fee) }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Erreur lors de la création');
        return;
      }

      showToast('Zone ajoutée');
      setShowCreate(false);
      setForm(emptyForm);
      await fetchZones();
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditError(null);
    setEditing(zone);
    setEditForm({
      city: zone.city,
      zone_name: zone.zone_name,
      delivery_fee: zone.delivery_fee,
      is_available: zone.is_available,
      is_active: zone.is_active,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/admin/delivery-zones/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, delivery_fee: Number(editForm.delivery_fee) }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }

      showToast('Zone modifiée');
      setEditing(null);
      setEditForm(null);
      await fetchZones();
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const patchZone = async (zone: DeliveryZone, patch: DeliveryZoneUpdateInput, successMsg: string) => {
    setTaskLoading(zone.id);
    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la modification', 'error');
        return;
      }
      showToast(successMsg);
      await fetchZones();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setTaskLoading(null);
    }
  };

  const toggleAvailable = (zone: DeliveryZone) =>
    patchZone(zone, { is_available: !zone.is_available }, zone.is_available ? 'Livraison indisponible' : 'Livraison disponible');

  const toggleActive = (zone: DeliveryZone) =>
    patchZone(zone, { is_active: !zone.is_active }, zone.is_active ? 'Zone désactivée' : 'Zone activée');

  const removeZone = async (zone: DeliveryZone) => {
    if (!window.confirm(`Désactiver la zone « ${zone.zone_name} » (${zone.city}) ?`)) return;
    setTaskLoading(zone.id);
    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la suppression', 'error');
        return;
      }
      showToast(data.message || 'Zone désactivée');
      await fetchZones();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setTaskLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zones de livraison</h1>
          <p className="text-sm text-gray-500 mt-1">
            {zones.length} zones · {existingCities.length} villes · {activeCount} actives
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle zone
        </button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ville ou zone…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
        />
      </div>

      {loadError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-red-100 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Chargement impossible</h2>
          <p className="text-sm text-gray-500 mb-4">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchZones();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune zone</h2>
          <p className="text-sm text-gray-500">Ajoutez votre première zone de livraison.</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <p className="text-sm text-gray-500">Aucun résultat pour « {search} ».</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.city} className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-primary-100 bg-primary-50/50">
                <MapPin className="w-4 h-4 text-primary-700" />
                <h2 className="text-sm font-semibold text-gray-900">{group.city}</h2>
                <span className="text-xs text-gray-500">{group.zones.length} zone{group.zones.length > 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {group.zones.map((zone) => (
                    <tr key={zone.id} className={`border-b border-gray-50 last:border-0 ${!zone.is_active ? 'bg-gray-50/60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${zone.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {zone.zone_name}
                          </span>
                          {!zone.is_active && (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-medium uppercase tracking-wide">
                              inactivée
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(zone.delivery_fee)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleAvailable(zone)}
                          disabled={taskLoading === zone.id}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                            zone.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {zone.is_available ? 'Disponible' : 'Indisponible'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(zone)}
                          disabled={taskLoading === zone.id}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                            zone.is_active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {zone.is_active ? 'Active' : 'Désactivée'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(zone)}
                            title="Modifier"
                            className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeZone(zone)}
                            disabled={taskLoading === zone.id}
                            title="Désactiver"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {taskLoading === zone.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !formLoading && setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle zone de livraison</h2>
              <button onClick={() => !formLoading && setShowCreate(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                <input
                  type="text"
                  required
                  list="delivery-cities"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  placeholder="Ex: Cotonou"
                />
                <datalist id="delivery-cities">
                  {existingCities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier / zone *</label>
                <input
                  type="text"
                  required
                  value={form.zone_name}
                  onChange={(e) => setForm({ ...form, zone_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  placeholder="Ex: Centre-Ville"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frais de livraison (FCFA) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step={50}
                  value={form.delivery_fee}
                  onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  placeholder="Ex: 1000"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={form.is_available}
                  onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus-visible:ring-primary-500"
                />
                <label htmlFor="is_available" className="text-sm font-medium text-gray-700">
                  Zone disponible à la livraison
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={formLoading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !editLoading && setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Modifier la zone</h2>
              <button onClick={() => !editLoading && setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                <input
                  type="text"
                  required
                  list="delivery-cities-edit"
                  value={editForm.city || ''}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                />
                <datalist id="delivery-cities-edit">
                  {existingCities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier / zone *</label>
                <input
                  type="text"
                  required
                  value={editForm.zone_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, zone_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frais de livraison (FCFA)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step={50}
                  value={editForm.delivery_fee}
                  onChange={(e) => setEditForm({ ...editForm, delivery_fee: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_available}
                    onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus-visible:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Disponible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus-visible:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={editLoading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}