"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const roles = ["ADMIN", "SELLER", "CUSTOMER", "TRANSPORTER", "COURIER"];

export default function AdminUsersBoard() {
  const t = useTranslations("AdminUsers");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (emailFilter) params.set("email", emailFilter);
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateRole = async (userId: string, role: string) => {
    setSavingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    setSavingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder={t("filters.email")}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">{t("filters.all")}</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role.toLowerCase()}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadUsers}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("filters.apply")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">{t("loading")}</p>}

      {users.length > 0 && (
        <div className="mt-6 grid gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("labels.user")}</p>
                  <p className="text-sm font-semibold text-white">
                    {user.name || t("labels.noName")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
                    defaultValue={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    disabled={savingId === user.id}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {t(`roles.${role.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => toggleActive(user.id, !user.isActive)}
                    disabled={savingId === user.id}
                    className="rounded-full border border-white/20 px-4 py-2 text-[11px] text-white transition hover:border-white/40 disabled:opacity-60"
                  >
                    {user.isActive ? t("actions.block") : t("actions.unblock")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
