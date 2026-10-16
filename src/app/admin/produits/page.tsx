'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package, Loader2, Plus, X, Check, Pencil, Trash2 } from 'lucide-react';
import type { Product, Vendor, Category } from '@/types';
import type { ProductCreateInput } from '@/lib/validations';
import type { UploadedMedia } from '@/components/media-upload';
import MediaUpload from '@/components/media-upload';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';

interface ProductWithVendor extends Product {
  vendor_name?: string;
  vendors?: { name: string } | null;
}

interface EditForm {
  name: string;
  description: string;
  category_id: string;
  supplier_price: number;
  selling_price: number;
  deposit_rate: number;
  stock: number;
  status: Product['status'];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  inactive: { label: 'Inactif', color: 'bg-yellow-100 text-yellow-700' },
  out_of_stock: { label: 'Rupture', color: 'bg-red-100 text-red-700' },
};

const emptyForm: ProductCreateInput = {
  vendor_id: '',
  category_id: '',
  name: '',
  description: null,
  supplier_price: 0,
  selling_price: 0,
  deposit_rate: 50,
  stock: 0,
  status: 'draft',
};

export default function AdminProduitsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ProductCreateInput>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [editing, setEditing] = useState<ProductWithVendor | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const supabase = createClient();

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, vendors(name)')
      .eq('deleted_at', null)
      .order('created_at', { ascending: false });

    const formatted: ProductWithVendor[] = (data || []).map((p) => ({
      ...p,
      vendor_name: p.vendors && !Array.isArray(p.vendors) ? p.vendors.name : undefined,
    }));

    setProducts(formatted);
    setLoading(false);
  }, [supabase]);

  const fetchFormData = useCallback(async () => {
    try {
      const [vendorsRes, categoriesRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('status', 'active').order('name'),
        supabase.from('categories').select('*').order('name'),
      ]);

      if (categoriesRes.error) {
        console.error('Error fetching categories:', categoriesRes.error);
      }
      setVendors((vendorsRes.data as Vendor[]) || []);
      setCategories((categoriesRes.data as Category[]) || []);
    } catch (err) {
      console.error('Error fetching form data:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (showCreate || editing) {
      fetchFormData();
    }
  }, [showCreate, editing, fetchFormData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Erreur lors de la création');
        return;
      }

      setCreatedProductId(data.data.id);
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveMedia = async () => {
    if (media.length === 0 || !createdProductId) {
      finalizeCreate();
      return;
    }

    setMediaSaving(true);
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: createdProductId,
          media: media.map(m => ({
            image_url: m.url,
            alt_text: m.alt_text || '',
            sort_order: m.sort_order,
            is_primary: m.is_primary,
            media_type: m.media_type,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Erreur lors de la sauvegarde des médias');
        return;
      }

      finalizeCreate();
    } catch {
      setFormError('Erreur réseau lors de la sauvegarde des médias');
    } finally {
      setMediaSaving(false);
    }
  };

  const finalizeCreate = () => {
    setShowCreate(false);
    setForm(emptyForm);
    setCreatedProductId(null);
    setMedia([]);
    fetchProducts();
  };

  const openEdit = (product: ProductWithVendor) => {
    setEditError(null);
    setEditing(product);
    setEditForm({
      name: product.name,
      description: product.description || '',
      category_id: product.category_id,
      supplier_price: product.supplier_price,
      selling_price: product.selling_price,
      deposit_rate: product.deposit_rate,
      stock: product.stock,
      status: product.status,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/admin/produits/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          description: editForm.description || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }

      showToast('Produit modifié');
      setEditing(null);
      setEditForm(null);
      await fetchProducts();
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const toggleStatus = async (product: ProductWithVendor) => {
    const next = product.status === 'active' ? 'inactive' : 'active';
    setTaskLoading(product.id);
    try {
      const res = await fetch(`/api/admin/produits/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors du changement de statut', 'error');
        return;
      }
      showToast(next === 'active' ? 'Produit activé' : 'Produit désactivé');
      await fetchProducts();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setTaskLoading(null);
    }
  };

  const removeProduct = async (product: ProductWithVendor) => {
    if (!window.confirm(`Supprimer « ${product.name} » ? Le produit sera envoyé dans la corbeille.`)) return;
    setTaskLoading(product.id);
    try {
      const res = await fetch(`/api/admin/produits/${product.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la suppression', 'error');
        return;
      }
      showToast(data.message || 'Produit supprimé');
      await fetchProducts();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setTaskLoading(null);
    }
  };

  const remaining = editForm
    ? editForm.selling_price - Math.round(editForm.selling_price * editForm.deposit_rate / 100)
    : 0;

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
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{products.length} produit{products.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau produit
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucun produit</h2>
          <p className="text-sm text-gray-500 mb-4">Commencez par ajouter votre premier produit.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un produit
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Produit</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Vendeur</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const status = statusLabels[product.status] || statusLabels.draft;
                  return (
                    <tr key={product.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-gray-700">{product.vendor_name || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(product.selling_price)}</td>
                      <td className="px-4 py-3 text-gray-700">{product.stock}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            title="Modifier"
                            className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(product)}
                            disabled={taskLoading === product.id}
                            title={product.status === 'active' ? 'Désactiver' : 'Activer'}
                            className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {taskLoading === product.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => removeProduct(product)}
                            disabled={taskLoading === product.id}
                            title="Mettre à la corbeille"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !formLoading && !mediaSaving && setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {createdProductId ? 'Photos & Vidéos' : 'Nouveau produit'}
              </h2>
              <button
                onClick={() => !formLoading && !mediaSaving && setShowCreate(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!createdProductId ? (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendeur *</label>
                    <select
                      required
                      value={form.vendor_id}
                      onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    >
                      <option value="">Sélectionner un vendeur</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={form.category_id || ''}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix fournisseur (FCFA) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.supplier_price || ''}
                      onChange={(e) => setForm({ ...form, supplier_price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.selling_price || ''}
                      onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acompte (%) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="1"
                      value={form.deposit_rate ?? 50}
                      onChange={(e) => setForm({ ...form, deposit_rate: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Solde à la livraison</label>
                    <div className="px-4 py-2.5 rounded-lg border border-gray-200 bg-primary-50 text-sm text-gray-600">
                      {remaining >= 0 ? formatPrice(remaining) : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.stock || ''}
                      onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as ProductCreateInput['status'] })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                    >
                      <option value="draft">Brouillon</option>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
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
                    Suivant
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Produit créé. Ajoutez des photos et éventuellement une mini-vidéo.
                </p>

                <MediaUpload
                  productId={createdProductId}
                  onMediaChange={setMedia}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={finalizeCreate}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    Passer
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMedia}
                    disabled={mediaSaving}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {mediaSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !editLoading && setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Modifier le produit</h2>
              <button
                onClick={() => !editLoading && setEditing(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie <span className="text-red-500">*</span></label>
                <select
                  required
                  value={editForm.category_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix fournisseur (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={editForm.supplier_price || ''}
                    onChange={(e) => setEditForm({ ...editForm, supplier_price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={editForm.selling_price || ''}
                    onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acompte (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="1"
                    value={editForm.deposit_rate}
                    onChange={(e) => setEditForm({ ...editForm, deposit_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Solde à la livraison</label>
                  <div className="px-4 py-2.5 rounded-lg border border-gray-200 bg-primary-50 text-sm text-gray-600">
                    {remaining >= 0 ? formatPrice(remaining) : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={editForm.stock || ''}
                    onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Product['status'] })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="out_of_stock">Rupture</option>
                  </select>
                </div>
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