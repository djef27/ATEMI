'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Tag, Loader2, Plus, X, Pencil, Trash2, Check } from 'lucide-react';
import type { Category } from '@/types';
import type { CategoryCreateInput } from '@/lib/validations';
import { useToast } from '@/components/toast-provider';

const emptyForm: CategoryCreateInput = {
  name: '',
  description: null,
  image_url: null,
  is_active: true,
};

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CategoryCreateInput>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CategoryCreateInput | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const supabase = createClient();

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });

    setCategories((data as Category[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/categories', {
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
      await fetchCategories();
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (category: Category) => {
    setEditError(null);
    setEditing(category);
    setEditForm({
      name: category.name,
      description: category.description,
      image_url: category.image_url,
      is_active: category.is_active,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/admin/categories/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || 'Erreur lors de la modification');
        return;
      }

      showToast('Catégorie modifiée');
      setEditing(null);
      setEditForm(null);
      await fetchCategories();
    } catch {
      setEditError('Erreur réseau');
    } finally {
      setEditLoading(false);
    }
  };

  const toggleActive = async (category: Category) => {
    setTaskLoading(category.id);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !category.is_active }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors du changement de statut', 'error');
        return;
      }
      showToast(category.is_active ? 'Catégorie désactivée' : 'Catégorie activée');
      await fetchCategories();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setTaskLoading(null);
    }
  };

  const removeCategory = async (category: Category) => {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;
    setTaskLoading(category.id);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Erreur lors de la suppression', 'error');
        return;
      }
      showToast(data.message || 'Catégorie supprimée');
      await fetchCategories();
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{categories.length} catégorie{categories.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle catégorie
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune catégorie</h2>
          <p className="text-sm text-gray-500">Aucune catégorie enregistrée.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{category.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{category.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(category)}
                          title="Modifier"
                          className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(category)}
                          disabled={taskLoading === category.id}
                          title={category.is_active ? 'Désactiver' : 'Activer'}
                          className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {taskLoading === category.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => removeCategory(category)}
                          disabled={taskLoading === category.id}
                          title="Supprimer"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !formLoading && setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-primary-100">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle catégorie</h2>
              <button
                onClick={() => !formLoading && setShowCreate(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Téléphones & Tablets"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de l&apos;image</label>
                <input
                  type="url"
                  value={form.image_url || ''}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Catégorie active
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
              <h2 className="text-lg font-semibold text-gray-900">Modifier la catégorie</h2>
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
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value || null })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de l&apos;image</label>
                <input
                  type="url"
                  value={editForm.image_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                  Catégorie active
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