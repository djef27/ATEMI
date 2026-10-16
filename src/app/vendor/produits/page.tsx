'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { Package, Plus, Loader2, X, Check, Pencil, Trash2, ImageIcon, RotateCcw, Clock } from 'lucide-react';
import type { PublicProduct, Category } from '@/types';
import type { ProductCreateInput } from '@/lib/validations';
import type { UploadedMedia, MediaUploadHandle } from '@/components/media-upload';
import MediaUpload from '@/components/media-upload';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  inactive: { label: 'Inactif', color: 'bg-yellow-100 text-yellow-700' },
  out_of_stock: { label: 'Rupture', color: 'bg-red-100 text-red-700' },
};

interface ProductWithImage extends PublicProduct {
  image_url?: string | null;
  images?: Array<{ id: string; image_url: string; is_primary: boolean; media_type: string; sort_order: number }>;
  categories?: { id: string; name: string; slug: string } | null;
  deleted_at: string | null;
}

function getTimeRemaining(deletedAt: string): string {
  const deleted = new Date(deletedAt).getTime();
  const deadline = deleted + 48 * 60 * 60 * 1000;
  const now = Date.now();
  const remaining = deadline - now;

  if (remaining <= 0) return 'Expiré';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export default function VendorProduitsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductWithImage[]>([]);
  const [trashedProducts, setTrashedProducts] = useState<ProductWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ProductCreateInput>({
    vendor_id: '',
    category_id: '',
    name: '',
    description: null,
    supplier_price: 0,
    selling_price: 0,
    deposit_rate: 50,
    stock: 0,
    status: 'draft',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [mediaSaving, setMediaSaving] = useState(false);
  const mediaUploadRef = useRef<MediaUploadHandle>(null);

  // Edit state
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editMedia, setEditMedia] = useState<UploadedMedia[]>([]);
  const [editMediaSaving, setEditMediaSaving] = useState(false);

  // Delete state
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Restore state
  const [restoreProductId, setRestoreProductId] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const supabase = createClient();

  const fetchProducts = useCallback(async (vid: string) => {
    // Fetch active + draft products
    const { data } = await supabase
      .from('products')
      .select('id, name, slug, selling_price, stock, status, created_at, description, vendor_id, category_id, deposit_amount, remaining_amount, deposit_rate, supplier_price, updated_at, deleted_at, categories(id, name, slug)')
      .eq('vendor_id', vid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const productsList = (data as unknown as ProductWithImage[]) || [];

    // Fetch primary images
    if (productsList.length > 0) {
      const productIds = productsList.map(p => p.id);
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_primary, media_type, sort_order')
        .in('product_id', productIds)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });

      if (images) {
        const imageMap = new Map<string, string>();
        for (const img of images) {
          if (!imageMap.has(img.product_id)) {
            imageMap.set(img.product_id, img.image_url);
          }
        }
        for (const product of productsList) {
          product.image_url = imageMap.get(product.id) || null;
        }
      }
    }

    setProducts(productsList);
    setLoading(false);
  }, [supabase]);

  const fetchTrashedProducts = useCallback(async (vid: string) => {
    const { data } = await supabase
      .from('products')
      .select('id, name, slug, selling_price, stock, status, created_at, description, vendor_id, category_id, deposit_amount, remaining_amount, deposit_rate, supplier_price, updated_at, deleted_at, categories(id, name, slug)')
      .eq('vendor_id', vid)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    const trashList = (data as unknown as ProductWithImage[]) || [];

    if (trashList.length > 0) {
      const productIds = trashList.map(p => p.id);
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_primary, media_type, sort_order')
        .in('product_id', productIds)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });

      if (images) {
        const imageMap = new Map<string, string>();
        for (const img of images) {
          if (!imageMap.has(img.product_id)) {
            imageMap.set(img.product_id, img.image_url);
          }
        }
        for (const product of trashList) {
          product.image_url = imageMap.get(product.id) || null;
        }
      }
    }

    setTrashedProducts(trashList);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!vendor) {
        setLoading(false);
        return;
      }

      setVendorId(vendor.id);
      setForm(prev => ({ ...prev, vendor_id: vendor.id }));
      await fetchProducts(vendor.id);
      await fetchTrashedProducts(vendor.id);
    };

    init();
  }, [user, supabase, fetchProducts, fetchTrashedProducts]);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
      }
      setCategories((data as Category[]) || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [supabase]);

  useEffect(() => {
    if (showCreate || editProductId) {
      fetchCategories();
    }
  }, [showCreate, editProductId, fetchCategories]);

  // ---------------------
  // CREATE
  // ---------------------

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const ref = mediaUploadRef.current;
    if (!ref) return;

    const hasMedia = ref.getMediaCount() > 0 || ref.hasPendingUploads();
    if (!hasMedia) {
      setFormError('Ajoutez au moins une photo avant de sauvegarder');
      return;
    }

    setFormLoading(true);
    setMediaSaving(true);

    try {
      let uploadedMedia: UploadedMedia[] = media;

      if (ref.hasPendingUploads()) {
        uploadedMedia = await ref.uploadFiles();
        setMedia(uploadedMedia);
      }

      if (uploadedMedia.length === 0) {
        setFormError('L\'upload a échoué. Réessayez.');
        return;
      }

      const res = await fetch('/api/vendor/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Erreur lors de la création');
        return;
      }

      const productId = data.data.id;

      const mediaRes = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          media: uploadedMedia.map(m => ({
            image_url: m.url,
            alt_text: m.alt_text || '',
            sort_order: m.sort_order,
            is_primary: m.is_primary,
            media_type: m.media_type,
          })),
        }),
      });

      const mediaData = await mediaRes.json();

      if (!mediaRes.ok || !mediaData.success) {
        setFormError(mediaData.error || 'Produit créé mais erreur sauvegarde médias');
        return;
      }

      finalizeCreate();
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormLoading(false);
      setMediaSaving(false);
    }
  };

  const finalizeCreate = () => {
    setShowCreate(false);
    setForm({
      vendor_id: vendorId || '',
      category_id: '',
      name: '',
      description: null,
      supplier_price: 0,
      selling_price: 0,
      deposit_rate: 50,
      stock: 0,
      status: 'draft',
    });
    setMedia([]);
    if (vendorId) {
      fetchProducts(vendorId);
      fetchTrashedProducts(vendorId);
    }
  };

  // ---------------------
  // EDIT
  // ---------------------

  const openEdit = async (productId: string) => {
    setEditProductId(productId);
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/vendor/produits/${productId}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors du chargement');
        setEditLoading(false);
        return;
      }

      const product = data.data;
      setEditForm({
        name: product.name || '',
        description: product.description || '',
        category_id: product.category_id || '',
        supplier_price: product.supplier_price || 0,
        selling_price: product.selling_price || 0,
        deposit_rate: product.deposit_rate ?? 50,
        stock: product.stock || 0,
        status: product.status || 'draft',
      });

      if (product.images && product.images.length > 0) {
        setEditMedia(product.images.map((img: { image_url: string; alt_text?: string; sort_order: number; is_primary: boolean; media_type: string }) => ({
          url: img.image_url,
          alt_text: img.alt_text || '',
          sort_order: img.sort_order,
          is_primary: img.is_primary,
          media_type: img.media_type as 'image' | 'video',
        })));
      } else {
        setEditMedia([]);
      }
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductId) return;

    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/vendor/produits/${editProductId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }

      await saveEditMedia();
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const saveEditMedia = async () => {
    if (!editProductId) return;

    setEditMediaSaving(true);
    try {
      const currentImageUrls = editMedia.map(m => m.url);
      const originalRes = await fetch(`/api/vendor/produits/${editProductId}`);
      const originalData = await originalRes.json();

      if (originalData.success && originalData.data.images) {
        for (const img of originalData.data.images) {
          if (!currentImageUrls.includes(img.image_url)) {
            await fetch(`/api/media/${img.id}`, { method: 'DELETE' });
          }
        }
      }

      const newMedia = editMedia.filter(m => !m.url.startsWith('http') || !m.url.includes('supabase'));
      if (newMedia.length > 0) {
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: editProductId,
            media: newMedia.map(m => ({
              image_url: m.url,
              alt_text: m.alt_text || '',
              sort_order: m.sort_order,
              is_primary: m.is_primary,
              media_type: m.media_type,
            })),
          }),
        });

        const data = await res.json();
        if (!data.success) {
          setEditError(data.error || 'Erreur lors de la sauvegarde des médias');
          return;
        }
      }

      finalizeEdit();
    } catch {
      setEditError('Erreur réseau lors de la sauvegarde des médias');
    } finally {
      setEditMediaSaving(false);
    }
  };

  const finalizeEdit = () => {
    setEditProductId(null);
    setEditForm({});
    setEditMedia([]);
    setEditError(null);
    if (vendorId) {
      fetchProducts(vendorId);
      fetchTrashedProducts(vendorId);
    }
  };

  // ---------------------
  // DELETE (trash)
  // ---------------------

  const handleDelete = async () => {
    if (!deleteProductId) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/vendor/produits/${deleteProductId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la suppression', 'error');
        return;
      }

      setDeleteProductId(null);
      if (vendorId) {
        await fetchProducts(vendorId);
        await fetchTrashedProducts(vendorId);
      }
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------------------
  // RESTORE
  // ---------------------

  const handleRestore = async () => {
    if (!restoreProductId) return;

    setRestoreLoading(true);
    try {
      const res = await fetch(`/api/vendor/produits/${restoreProductId}/restore`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la restauration', 'error');
        return;
      }

      setRestoreProductId(null);
      if (vendorId) {
        await fetchProducts(vendorId);
        await fetchTrashedProducts(vendorId);
      }
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setRestoreLoading(false);
    }
  };

  // ---------------------
  // RENDER
  // ---------------------

  const remaining = form.selling_price - Math.round(form.selling_price * form.deposit_rate / 100);
  const editRemaining = (editForm.selling_price as number || 0) - Math.round((editForm.selling_price as number || 0) * (editForm.deposit_rate as number || 50) / 100);

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
        <h1 className="text-2xl font-bold text-gray-900">Mes produits</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau produit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Produits ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'trash'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Corbeille ({trashedProducts.length})
        </button>
      </div>

      {/* Active Products */}
      {activeTab === 'active' && (
        <>
          {products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucun produit</h2>
              <p className="text-sm text-gray-500">Vous n&apos;avez pas encore de produits.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Produit</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Catégorie</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Prix</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Stock</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Modifié</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const status = statusLabels[product.status] || statusLabels.draft;
                      const categoryName = product.categories?.name || '—';
                      return (
                        <tr key={product.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                {product.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 text-gray-300" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{product.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{categoryName}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {formatPrice(product.selling_price)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{product.stock}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {product.updated_at ? new Date(product.updated_at).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(product.id)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteProductId(product.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
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
        </>
      )}

      {/* Trashed Products */}
      {activeTab === 'trash' && (
        <>
          {trashedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
              <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Corbeille vide</h2>
              <p className="text-sm text-gray-500">Les produits supprimés apparaîtront ici pendant 48h.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Les produits dans la corbeille sont supprimés définitivement après <strong>48 heures</strong>.
                  Vous pouvez les restaurer pendant ce délai.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Produit</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Prix</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Supprimé le</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Reste</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashedProducts.map((product) => (
                      <tr key={product.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatPrice(product.selling_price)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {product.deleted_at ? new Date(product.deleted_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {product.deleted_at ? (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                              <Clock className="w-3 h-3" />
                              {getTimeRemaining(product.deleted_at)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setRestoreProductId(product.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              title="Restaurer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restaurer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== CREATE MODAL ===== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !formLoading && setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Nouveau produit</h2>
              <button
                onClick={() => !formLoading && setShowCreate(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent"
                  placeholder="Nom du produit" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value || null })} rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                  placeholder="Description du produit (optionnel)" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie <span className="text-red-500">*</span></label>
                <select required value={form.category_id || ''} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent">
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix fournisseur (FCFA) *</label>
                  <input type="number" required min="0" step="1" value={form.supplier_price || ''}
                    onChange={(e) => setForm({ ...form, supplier_price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
                  <input type="number" required min="0" step="1" value={form.selling_price || ''}
                    onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acompte (%) *</label>
                  <input type="number" required min="0" max="100" step="1" value={form.deposit_rate ?? 50}
                    onChange={(e) => setForm({ ...form, deposit_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Solde à la livraison</label>
                  <div className="px-4 py-2.5 rounded-lg border border-primary-100 bg-[#FAFAF8] text-sm text-gray-600">
                    {remaining >= 0 ? formatPrice(remaining) : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <input type="number" required min="0" step="1" value={form.stock || ''}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductCreateInput['status'] })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent">
                    <option value="draft">Brouillon</option>
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-primary-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos & Vidéos <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Au moins une photo est obligatoire. Les fichiers sont compressés et uploadés automatiquement.</p>
                <MediaUpload ref={mediaUploadRef} productId="pending" existingMedia={media} onMediaChange={setMedia} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} disabled={formLoading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={formLoading || mediaSaving}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {(formLoading || mediaSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !editLoading && !editMediaSaving && finalizeEdit()} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Modifier le produit</h2>
              <button onClick={() => !editLoading && !editMediaSaving && finalizeEdit()}
                className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoading && !editForm.name ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                {editError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" required value={editForm.name as string || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={editForm.description as string || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value || null })} rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie <span className="text-red-500">*</span></label>
                  <select required value={editForm.category_id as string || ''} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent">
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix fournisseur (FCFA)</label>
                    <input type="number" min="0" step="1" value={editForm.supplier_price as number || ''}
                      onChange={(e) => setEditForm({ ...editForm, supplier_price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
                    <input type="number" required min="0" step="1" value={editForm.selling_price as number || ''}
                      onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acompte (%)</label>
                    <input type="number" min="0" max="100" step="1" value={editForm.deposit_rate as number ?? 50}
                      onChange={(e) => setEditForm({ ...editForm, deposit_rate: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Solde à la livraison</label>
                    <div className="px-4 py-2.5 rounded-lg border border-primary-100 bg-[#FAFAF8] text-sm text-gray-600">
                      {editRemaining >= 0 ? formatPrice(editRemaining) : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                    <input type="number" required min="0" step="1" value={editForm.stock as number || ''}
                      onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <select value={editForm.status as string || 'draft'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent">
                      <option value="draft">Brouillon</option>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>

                {/* Media section */}
                <div className="pt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Images & Vidéos</label>
                  <MediaUpload productId={editProductId} existingMedia={editMedia} onMediaChange={setEditMedia} disabled={editLoading} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={finalizeEdit} disabled={editLoading || editMediaSaving}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={editLoading || editMediaSaving}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {(editLoading || editMediaSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleteLoading && setDeleteProductId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Supprimer ce produit ?</h2>
            <p className="text-sm text-gray-600 mb-2">
              Le produit sera déplacé vers la corbeille.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Il sera supprimé définitivement dans <strong>48 heures</strong>. Vous pourrez le restaurer pendant ce délai.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteProductId(null)} disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RESTORE CONFIRMATION MODAL ===== */}
      {restoreProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !restoreLoading && setRestoreProductId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Restaurer ce produit ?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Le produit sera remis dans votre catalogue et redeviendra visible dans la boutique.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRestoreProductId(null)} disabled={restoreLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleRestore} disabled={restoreLoading}
                className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {restoreLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Restaurer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
