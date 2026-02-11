"use client";

import { FormEvent, useEffect, useState } from "react";

type SellerStatus = "PENDING" | "APPROVED" | "SUSPENDED";

type SellerItem = {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  status: SellerStatus;
  commissionRate: number;
  payoutAccountRef?: string | null;
  rating: number;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    isActive: boolean;
  };
  _count: {
    products: number;
    orders: number;
    services: number;
  };
};

type UserOption = {
  id: string;
  email: string;
  name?: string | null;
};

type SellerCreateForm = {
  userId: string;
  displayName: string;
  slug: string;
  status: SellerStatus;
  commissionRate: number;
};

type SellerEditForm = {
  displayName: string;
  slug: string;
  status: SellerStatus;
  commissionRate: number;
  payoutAccountRef: string;
  rating: number;
  userRole: string;
  userIsActive: boolean;
};

const statuses: SellerStatus[] = ["PENDING", "APPROVED", "SUSPENDED"];

const initialCreateForm: SellerCreateForm = {
  userId: "",
  displayName: "",
  slug: "",
  status: "PENDING",
  commissionRate: 10,
};

const initialEditForm: SellerEditForm = {
  displayName: "",
  slug: "",
  status: "PENDING",
  commissionRate: 10,
  payoutAccountRef: "",
  rating: 5,
  userRole: "SELLER",
  userIsActive: true,
};

export default function AdminSellersBoard() {
  const [sellers, setSellers] = useState<SellerItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [createForm, setCreateForm] = useState<SellerCreateForm>(initialCreateForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SellerEditForm>(initialEditForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadUsers = async () => {
    const response = await fetch("/api/admin/users");
    if (!response.ok) throw new Error("Impossible de charger les utilisateurs");
    const payload = (await response.json()) as Array<{
      id: string;
      email: string;
      name?: string | null;
    }>;
    setUsers(payload);
  };

  const loadSellers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());

      const response = await fetch(`/api/admin/sellers?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de charger les vendeurs");
      }

      const payload = (await response.json()) as SellerItem[];
      setSellers(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les vendeurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([loadSellers(), loadUsers()]).catch((err) => {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    });
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Creation impossible");
      }

      setCreateForm(initialCreateForm);
      await loadSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation impossible");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (seller: SellerItem) => {
    setEditingId(seller.id);
    setEditForm({
      displayName: seller.displayName,
      slug: seller.slug,
      status: seller.status,
      commissionRate: seller.commissionRate,
      payoutAccountRef: seller.payoutAccountRef ?? "",
      rating: seller.rating,
      userRole: seller.user.role,
      userIsActive: seller.user.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialEditForm);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    setSavingEdit(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/sellers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Mise a jour impossible");
      }

      cancelEdit();
      await loadSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible");
    } finally {
      setSavingEdit(false);
    }
  };

  const removeSeller = async (seller: SellerItem) => {
    const confirmed = window.confirm(
      `Supprimer le profil vendeur ${seller.displayName} ?`
    );
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/sellers/${seller.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Suppression impossible");
      }

      await loadSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vendeurs</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Creez, modifiez ou supprimez les profils vendeurs.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSellers}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          Rafraichir
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs sm:grid-cols-[1fr_auto]">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder="Rechercher vendeur / email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          onClick={loadSellers}
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
          Nouveau vendeur
        </p>
        <select
          required
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={createForm.userId}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, userId: event.target.value }))
          }
        >
          <option value="">Choisir un utilisateur</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email}
              {user.name ? ` - ${user.name}` : ""}
            </option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder="Nom public"
            value={createForm.displayName}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))
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
            value={createForm.status}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                status: event.target.value as SellerStatus,
              }))
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder="Commission (%)"
            value={createForm.commissionRate}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                commissionRate: Number(event.target.value || 0),
              }))
            }
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
        >
          {creating ? "Creation..." : "Ajouter le vendeur"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">Chargement...</p>}

      <div className="mt-6 grid gap-4">
        {sellers.map((seller) => {
          const isEditing = editingId === seller.id;

          return (
            <div
              key={seller.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{seller.displayName}</p>
                      <p className="mt-1 text-xs text-zinc-500">/{seller.slug}</p>
                      <p className="mt-1 text-xs text-zinc-400">{seller.user.email}</p>
                    </div>
                    <div className="text-right text-xs text-zinc-300">
                      <p>{seller.status}</p>
                      <p className="mt-1">Commission: {seller.commissionRate}%</p>
                      <p className="mt-1">Note: {seller.rating.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                      Produits: {seller._count.products}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                      Commandes: {seller._count.orders}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-200">
                      Services: {seller._count.services}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(seller)}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSeller(seller)}
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
                      value={editForm.displayName}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          displayName: event.target.value,
                        }))
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
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          status: event.target.value as SellerStatus,
                        }))
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.commissionRate}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          commissionRate: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      placeholder="Payout ref"
                      value={editForm.payoutAccountRef}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          payoutAccountRef: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.rating}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rating: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-white"
                      value={editForm.userRole}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          userRole: event.target.value,
                        }))
                      }
                    >
                      <option value="SELLER">SELLER</option>
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="TRANSPORTER">TRANSPORTER</option>
                      <option value="COURIER">COURIER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-zinc-200">
                      <input
                        type="checkbox"
                        checked={editForm.userIsActive}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            userIsActive: event.target.checked,
                          }))
                        }
                      />
                      Utilisateur actif
                    </label>
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