"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type StoreType = "MARKETPLACE" | "IMMO" | "CARS" | "PRESTA" | "TIAK_TIAK" | "GP";

const storeTypes: StoreType[] = [
  "MARKETPLACE",
  "IMMO",
  "CARS",
  "PRESTA",
  "TIAK_TIAK",
  "GP",
];

type CategoryOption = {
  id: string;
  name: string;
};

type StoreItem = {
  id: string;
  name: string;
  slug: string;
  type: StoreType;
  description?: string | null;
  isActive: boolean;
  categories: { category: { id: string; name: string; slug: string } }[];
  _count: { products: number };
};

type StoreFormState = {
  name: string;
  slug: string;
  type: StoreType;
  description: string;
  isActive: boolean;
  categoryIds: string[];
};

const initialForm: StoreFormState = {
  name: "",
  slug: "",
  type: "MARKETPLACE",
  description: "",
  isActive: true,
  categoryIds: [],
};

export default function AdminStoresBoard() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [createForm, setCreateForm] = useState<StoreFormState>(initialForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoreFormState>(initialForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/admin/categories?active=1");
    if (!response.ok) throw new Error("Impossible de charger les categories");
    const payload = (await response.json()) as Array<{ id: string; name: string }>;
    setCategories(payload.map((item) => ({ id: item.id, name: item.name })));
  }, []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());

      const response = await fetch(`/api/admin/stores?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de charger les sous-boutiques");
      }

      const payload = (await response.json()) as StoreItem[];
      setStores(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les sous-boutiques"
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    Promise.all([loadStores(), loadCategories()]).catch((err) => {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    });
  }, [loadCategories, loadStores]);

  const toggleCategory = (
    categoryId: string,
    mode: "create" | "edit"
  ) => {
    if (mode === "create") {
      setCreateForm((prev) => ({
        ...prev,
        categoryIds: prev.categoryIds.includes(categoryId)
          ? prev.categoryIds.filter((id) => id !== categoryId)
          : [...prev.categoryIds, categoryId],
      }));
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Creation impossible");
      }

      setCreateForm(initialForm);
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation impossible");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (store: StoreItem) => {
    setEditingId(store.id);
    setEditForm({
      name: store.name,
      slug: store.slug,
      type: store.type,
      description: store.description ?? "",
      isActive: store.isActive,
      categoryIds: store.categories.map((entry) => entry.category.id),
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
      const response = await fetch(`/api/admin/stores/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Mise a jour impossible");
      }

      cancelEdit();
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible");
    } finally {
      setSavingEdit(false);
    }
  };

  const removeStore = async (store: StoreItem) => {
    const confirmed = window.confirm(`Supprimer ${store.name} ?`);
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/stores/${store.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Suppression impossible");
      }
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sous-boutiques</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Gerez les verticales JONTAADO et leurs categories.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStores}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          Rafraichir
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs sm:grid-cols-[1fr_auto]">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder="Rechercher nom/slug"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          onClick={loadStores}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          Filtrer
        </button>
      </div>

      <form
        onSubmit={onCreate}
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Nouvelle sous-boutique
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
            value={createForm.type}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                type: event.target.value as StoreType,
              }))
            }
          >
            {storeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
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
          placeholder="Description"
          value={createForm.description}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />

        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <p className="mb-2 text-xs text-zinc-400">Categories associees</p>
          <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <label
                key={category.id}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={createForm.categoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id, "create")}
                />
                {category.name}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
        >
          {creating ? "Creation..." : "Ajouter la sous-boutique"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">Chargement...</p>}

      <div className="mt-6 grid gap-4">
        {stores.map((store) => {
          const isEditing = editingId === store.id;

          return (
            <div
              key={store.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{store.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">/{store.slug}</p>
                      <p className="mt-1 text-xs text-zinc-300">Type: {store.type}</p>
                    </div>
                    <div className="text-xs text-zinc-300">
                      Produits lies: {store._count.products}
                    </div>
                  </div>
                  {store.description && (
                    <p className="mt-3 text-xs text-zinc-300">{store.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {store.categories.map((entry) => (
                      <span
                        key={entry.category.id}
                        className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-zinc-200"
                      >
                        {entry.category.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(store)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void fetch(`/api/admin/stores/${store.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !store.isActive }),
                        }).then(async (response) => {
                          if (!response.ok) {
                            const payload = await response.json().catch(() => null);
                            throw new Error(payload?.error || "Mise a jour impossible");
                          }
                          await loadStores();
                        }).catch((err) => {
                          setError(
                            err instanceof Error ? err.message : "Mise a jour impossible"
                          );
                        })
                      }
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      {store.isActive ? "Desactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStore(store)}
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
                      value={editForm.type}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          type: event.target.value as StoreType,
                        }))
                      }
                    >
                      {storeTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
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

                  <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
                    <p className="mb-2 text-xs text-zinc-400">Categories associees</p>
                    <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto pr-1">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-200"
                        >
                          <input
                            type="checkbox"
                            checked={editForm.categoryIds.includes(category.id)}
                            onChange={() => toggleCategory(category.id, "edit")}
                          />
                          {category.name}
                        </label>
                      ))}
                    </div>
                  </div>

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
