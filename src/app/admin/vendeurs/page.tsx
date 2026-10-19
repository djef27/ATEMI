'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Loader2, Plus, X, Pencil, Trash2, Eye, Check, Ban } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import type { Vendor } from '@/types';
import type { VendorCreateInput } from '@/lib/validations';
import PhoneInput, { PhoneCountry, AFRICAN_COUNTRIES } from '@/components/PhoneInput';

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-700' },
  inactive: { label: 'Inactif', color: 'bg-gray-100 text-gray-700' },
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
};

const emptyForm: VendorCreateInput & { phoneCountry?: PhoneCountry; whatsappCountry?: PhoneCountry } = {
  name: '',
  phone: null,
  phoneCountry: AFRICAN_COUNTRIES[0],
  whatsapp_number: null,
  whatsappCountry: AFRICAN_COUNTRIES[0],
  email: null,
  address: null,
  city: 'Cotonou',
  country: 'BJ',
  status: 'active',
};

interface VendorWithStats extends Vendor {
  product_count?: number;
  order_count?: number;
}

export default function AdminVendeursPage() {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState<VendorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<VendorCreateInput>(emptyForm);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(AFRICAN_COUNTRIES[0]);
  const [whatsappCountry, setWhatsappCountry] = useState<PhoneCountry>(AFRICAN_COUNTRIES[0]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Edit state
  const [editVendor, setEditVendor] = useState<VendorWithStats | null>(null);
  const [editForm, setEditForm] = useState<Partial<VendorCreateInput>>({});
  const [editPhoneCountry, setEditPhoneCountry] = useState<PhoneCountry>(AFRICAN_COUNTRIES[0]);
  const [editWhatsappCountry, setEditWhatsappCountry] = useState<PhoneCountry>(AFRICAN_COUNTRIES[0]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<VendorWithStats | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();

  const fetchVendors = useCallback(async () => {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });

    const vendorsList = (data as VendorWithStats[]) || [];

    // Fetch product counts for each vendor
    if (vendorsList.length > 0) {
      const vendorIds = vendorsList.map(v => v.id);
      const { data: productCounts } = await supabase
        .from('products')
        .select('vendor_id')
        .in('vendor_id', vendorIds);

      const countMap = new Map<string, number>();
      for (const row of productCounts || []) {
        countMap.set(row.vendor_id, (countMap.get(row.vendor_id) || 0) + 1);
      }
      for (const v of vendorsList) {
        v.product_count = countMap.get(v.id) || 0;
      }
    }

    setVendors(vendorsList);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/vendeurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Erreur lors de la création');
        return;
      }

      setShowCreate(false);
      setForm(emptyForm);
      await fetchVendors();
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (vendor: VendorWithStats) => {
    setEditVendor(vendor);
    setEditForm({
      name: vendor.name,
      phone: vendor.phone,
      whatsapp_number: vendor.whatsapp_number,
      email: vendor.email,
      address: vendor.address,
      city: vendor.city,
      country: vendor.country,
      status: vendor.status as VendorCreateInput['status'],
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendor) return;

    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/admin/vendeurs/${editVendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }

      setEditVendor(null);
      setEditForm({});
      await fetchVendors();
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteVendor) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/vendeurs/${deleteVendor.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la désactivation', 'error');
        return;
      }

      setDeleteVendor(null);
      await fetchVendors();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleStatus = async (vendor: VendorWithStats, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/vendeurs/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchVendors();
      }
    } catch {
      // Silent fail
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.phone && v.phone.includes(search)) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendeurs</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
          <span className="text-sm text-gray-500">{filteredVendors.length} vendeur{filteredVendors.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau vendeur
          </button>
        </div>
      </div>

      {filteredVendors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {search ? 'Aucun résultat' : 'Aucun vendeur'}
          </h2>
          <p className="text-sm text-gray-500">
            {search ? 'Modifiez votre recherche' : 'Aucun vendeur enregistré.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Produits</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Inscrit le</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => {
                  const status = statusLabels[vendor.status] || statusLabels.inactive;
                  return (
                    <tr key={vendor.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{vendor.name}</p>
                          {vendor.email && <p className="text-xs text-gray-500">{vendor.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="text-xs">
                          {vendor.phone && <p>{vendor.phone}</p>}
                          {vendor.whatsapp_number && <p className="text-gray-500">WA: {vendor.whatsapp_number}</p>}
                          {!vendor.phone && !vendor.whatsapp_number && '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{vendor.city}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{vendor.product_count || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(vendor.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(vendor)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {vendor.status === 'active' ? (
                            <button
                              onClick={() => toggleStatus(vendor, 'suspended')}
                              className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Suspendre"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : vendor.status === 'suspended' ? (
                            <button
                              onClick={() => toggleStatus(vendor, 'active')}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Réactiver"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => setDeleteVendor(vendor)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Désactiver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CREATE MODAL ===== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !formLoading && setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Nouveau vendeur</h2>
              <button onClick={() => !formLoading && setShowCreate(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <PhoneInput
                    id="phone"
                    label="Téléphone"
                    value={form.phone || ''}
                    onChange={(val, c) => { setForm({ ...form, phone: val || null }); setPhoneCountry(c); }}
                    country={phoneCountry.code}
                    onCountryChange={setPhoneCountry}
                    placeholder={undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <PhoneInput
                    id="whatsapp"
                    label="WhatsApp"
                    value={form.whatsapp_number || ''}
                    onChange={(val, c) => { setForm({ ...form, whatsapp_number: val || null }); setWhatsappCountry(c); }}
                    country={whatsappCountry.code}
                    onCountryChange={setWhatsappCountry}
                    placeholder={undefined}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                  <input type="text" value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} disabled={formLoading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={formLoading}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !editLoading && setEditVendor(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Modifier — {editVendor.name}</h2>
              <button onClick={() => !editLoading && setEditVendor(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input type="text" value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value || null })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input type="tel" value={editForm.whatsapp_number || ''}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value || null })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={editForm.status || 'active'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as VendorCreateInput['status'] })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent">
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditVendor(null)} disabled={editLoading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={editLoading}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {deleteVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleteLoading && setDeleteVendor(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Désactiver ce vendeur ?</h2>
            <p className="text-sm text-gray-600 mb-2">
              Le vendeur <strong>{deleteVendor.name}</strong> sera désactivé.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Ses produits seront masqués de la boutique. Les commandes existantes ne seront pas affectées.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteVendor(null)} disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
