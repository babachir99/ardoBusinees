"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  parent?: { id: string; name: string } | null;
  _count: {
    children: number;
    products: number;
    stores: number;
  };
};

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  isActive: boolean;
};

const initialForm: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  isActive: true,
};

export default function AdminCategoriesBoard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [createForm, setCreateForm] = useState<CategoryFormState>(initialForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormState>(initialForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const parents = useMemo(
    () => categories.filter((item) => !item.parentId),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (activeFilter === "active") params.set("active", "1");
      if (activeFilter === "inactive") params.set("active", "0");

      const response = await fetch(`/api/admin/categories?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de charger les categories");
      }

      const payload = (await response.json()) as Category[];
      setCategories(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger les categories"
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, query]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug || undefined,
          description: createForm.description || undefined,
          parentId: createForm.parentId || null,
          isActive: createForm.isActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de creer la categorie");
      }

      setCreateForm(initialForm);
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de creer la categorie"
      );
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
      isActive: category.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          slug: editForm.slug,
          description: editForm.description,
          parentId: editForm.parentId || null,
          isActive: editForm.isActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de modifier la categorie");
      }

      cancelEdit();
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de modifier la categorie"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (category: Category) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !category.isActive }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de changer le statut");
      }

      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de changer le statut");
    }
  };

  const removeCategory = async (category: Category) => {
    const confirmed = window.confirm(
      `Supprimer ${category.name} ? Cette action est irreversible.`
    );
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Suppression impossible");
      }

      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Ajout, edition et suppression des categories et sous-categories.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCategories}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          Rafraichir
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs sm:grid-cols-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder="Recherche nom/slug"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
        >
          <option value="all">Toutes</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
        </select>
        <button
          type="button"
          onClick={loadCategories}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          Appliquer
        </button>
      </div>

      <form
        onSubmit={onCreate}
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Nouvelle categorie
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder="Nom"
            value={createForm.name}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder="Slug (optionnel)"
            value={createForm.slug}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, slug: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            value={createForm.parentId}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, parentId: event.target.value }))
            }
          >
            <option value="">Categorie racine</option>
            {parents.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            Active
          </label>
        </div>
        <textarea
          className="min-h-20 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder="Description (optionnelle)"
          value={createForm.description}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />
        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
        >
          {creating ? "Creation..." : "Ajouter la categorie"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">Chargement...</p>}

      <div className="mt-6 grid gap-4">
        {categories.map((category) => {
          const isEditing = editingId === category.id;
          return (
            <div
              key={category.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{category.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">/{category.slug}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Parent: {category.parent?.name ?? "Racine"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                        Sous-cat: {category._count.children}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                        Produits: {category._count.products}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                        Boutiques: {category._count.stores}
                      </span>
                    </div>
                  </div>
                  {category.description && (
                    <p className="mt-3 text-xs text-zinc-300">{category.description}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(category)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      {category.isActive ? "Desactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCategory(category)}
                      className="rounded-full border border-rose-400/40 px-4 py-2 text-xs text-rose-300"
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <input
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.slug}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, slug: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.parentId}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, parentId: event.target.value }))
                      }
                    >
                      <option value="">Categorie racine</option>
                      {parents
                        .filter((item) => item.id !== category.id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-zinc-200">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))
                        }
                      />
                      Active
                    </label>
                  </div>
                  <textarea
                    className="min-h-20 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                    >
                      {savingEdit ? "Sauvegarde..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
