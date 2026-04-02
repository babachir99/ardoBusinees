"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";

type SellerProfile = {
  id: string;
  displayName: string;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  discountPercent?: number | null;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  isActive: boolean;
  stockQuantity?: number | null;
  pickupLocation?: string | null;
  deliveryOptions?: string | null;
  preorderLeadDays?: number | null;
  dropshipSupplier?: string | null;
  boostStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | null;
  boostedUntil?: string | null;
  images: { id: string; url: string; alt?: string | null }[];
};

export default function SellerProductsPanel() {
  const t = useTranslations("SellerSpace");
  const locale = useLocale();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>(
    {}
  );
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priceCents: "",
    stockQuantity: "",
    pickupLocation: "",
    deliveryOptions: "",
    type: "LOCAL",
    isActive: true,
  });
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const maxFileSize = 4 * 1024 * 1024;
  const maxFiles = 5;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sellerRes = await fetch("/api/seller/me");
      if (!sellerRes.ok) {
        throw new Error(t("errors.seller"));
      }
      const sellerData = (await sellerRes.json()) as SellerProfile;
      setSeller(sellerData);

      const productsRes = await fetch(
        `/api/products?sellerId=${sellerData.id}&take=50`
      );
      if (!productsRes.ok) {
        throw new Error(t("errors.loadProducts"));
      }
      const products = (await productsRes.json()) as Product[];
      setItems(products);
      setDiscountDrafts(
        Object.fromEntries(
          products.map((product) => [
            product.id,
            product.discountPercent ? String(product.discountPercent) : "",
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadProducts"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  const updateProduct = async (
    id: string,
    payload: Record<string, unknown>
  ) => {
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.loadProducts"));
      }
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadProducts"));
      return false;
    } finally {
      setActionId(null);
    }
  };

  const applyDiscount = (id: string) => {
    const raw = discountDrafts[id] ?? "";
    const parsed = raw === "" ? 0 : Number(raw);
    updateProduct(id, { discountPercent: parsed });
  };

  const requestBoost = (id: string) => {
    updateProduct(id, { requestBoost: true });
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateProduct(id, { isActive });
  };
  const removeProduct = async (product: Product) => {
    const confirmed = window.confirm(
      t("products.deleteConfirm", { title: product.title })
    );
    if (!confirmed) {
      return;
    }

    setActionId(product.id);
    setError(null);
    setSuccessToast(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t("products.errors.delete"));
      }

      await load();
      setSuccessToast(t("products.deleteSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("products.errors.delete"));
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (product: Product) => {
    setEditId(product.id);
    setEditForm({
      title: product.title ?? "",
      description: product.description ?? "",
      priceCents: String(product.priceCents ?? ""),
      stockQuantity:
        product.stockQuantity === null || product.stockQuantity === undefined
          ? ""
          : String(product.stockQuantity),
      pickupLocation: product.pickupLocation ?? "",
      deliveryOptions: product.deliveryOptions ?? "",
      type: product.type ?? "LOCAL",
      isActive: product.isActive ?? true,
    });
    setEditFiles([]);
    setEditPreviews([]);
    setRemovedImageIds([]);
  };

  const closeEdit = () => {
    setEditId(null);
    setEditFiles([]);
    setEditPreviews([]);
    setRemovedImageIds([]);
    setUploadProgress(null);
  };

  const setEditImages = (files: File[]) => {
    setEditFiles(files);
    setEditPreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const removeNewImageAt = (index: number) => {
    setEditFiles((prev) => prev.filter((_, i) => i !== index));
    setEditPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleRemoveImage = (id: string) => {
    setRemovedImageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const uploadFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const data = new FormData();
      data.append("file", file);
      const request = new XMLHttpRequest();
      request.open("POST", "/api/upload");
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onload = () => {
        setUploadProgress(null);
        if (request.status >= 200 && request.status < 300) {
          try {
            const json = JSON.parse(request.responseText) as {
              url?: string;
              error?: string;
            };
            if (json?.url) {
              resolve(json.url);
              return;
            }
            reject(new Error(json?.error || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
          return;
        }
        reject(new Error("Upload failed"));
      };
      request.onerror = () => {
        setUploadProgress(null);
        reject(new Error("Upload failed"));
      };
      request.send(data);
    });

  const validateImage = async (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(t("products.errors.fileType"));
    }
  };

  const compressImage = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", 0.85);
    });

    if (!blob) {
      return file;
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setError(null);
    try {
      const addImageUrls: string[] = [];
      if (editFiles.length > 0) {
        for (const file of editFiles) {
          await validateImage(file);
          const processed =
            file.size > maxFileSize ? await compressImage(file) : file;
          if (processed.size > maxFileSize) {
            throw new Error(t("products.errors.fileSize"));
          }
          const uploadedUrl = await uploadFile(processed);
          addImageUrls.push(uploadedUrl);
        }
      }

      const payload: Record<string, unknown> = {
        title: editForm.title,
        description: editForm.description || undefined,
        priceCents: Number(editForm.priceCents),
        type: editForm.type,
        stockQuantity: editForm.stockQuantity
          ? Number(editForm.stockQuantity)
          : null,
        pickupLocation: editForm.pickupLocation || undefined,
        deliveryOptions: editForm.deliveryOptions || undefined,
        isActive: editForm.isActive,
        addImageUrls: addImageUrls.length > 0 ? addImageUrls : undefined,
        removeImageIds:
          removedImageIds.length > 0 ? removedImageIds : undefined,
      };

      const ok = await updateProduct(editId, payload);
      if (ok) {
        closeEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadProducts"));
    }
  };

  const filteredItems = items.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      product.title.toLowerCase().includes(query) ||
      (product.description ?? "").toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);
    const matchesType =
      typeFilter === "all" ||
      product.type.toLowerCase() === typeFilter;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" &&
        product.type === "LOCAL" &&
        (product.stockQuantity ?? 0) <= 5);
    return matchesQuery && matchesStatus && matchesType && matchesStock;
  });

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      {successToast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-zinc-900/95 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.25)] backdrop-blur [animation:toastSlideIn_220ms_ease-out]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M5 10.5L8.5 14L15 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {successToast}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("products.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">
            {t("products.subtitle", { name: seller?.displayName ?? "JONTAADO" })}
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("products.cta")}
        </Link>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-4">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder={t("products.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t("products.filters.allStatus")}</option>
          <option value="active">{t("products.filters.active")}</option>
          <option value="inactive">{t("products.filters.inactive")}</option>
        </select>
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">{t("products.filters.allTypes")}</option>
          <option value="local">{t("products.types.local")}</option>
          <option value="preorder">{t("products.types.preorder")}</option>
          <option value="dropship">{t("products.types.dropship")}</option>
        </select>
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="all">{t("products.filters.allStock")}</option>
          <option value="low">{t("products.filters.lowStock")}</option>
        </select>
      </div>

      {filteredItems.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("products.empty")}</p>
      )}

      {filteredItems.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
            >
              <Link
                href={`/shop/${product.slug}`}
                className="block"
                aria-label={`${t("products.view")}: ${product.title}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[10px] text-zinc-100">
                    {t(`products.types.${product.type.toLowerCase()}`)}
                  </span>
                  {product.boostStatus === "APPROVED" && (
                    <span
                      className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-400/20 text-orange-200"
                      title={t("products.boosted")}
                      aria-label={t("products.boosted")}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M11.2 1.9L4.5 10h3.9l-1 8.1L15.5 9h-4l-.3-7.1z" />
                      </svg>
                    </span>
                  )}
                </div>
              </Link>
              <h3 className="mt-3 text-sm font-semibold text-white">
                {product.title}
              </h3>
              {product.discountPercent ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-emerald-200">
                    {formatMoney(
                      getDiscountedPrice(
                        product.priceCents,
                        product.discountPercent
                      ),
                      product.currency,
                      locale
                    )}
                  </span>
                  <span className="text-xs text-zinc-500 line-through">
                    {formatMoney(product.priceCents, product.currency, locale)}
                  </span>
                  <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                    -{product.discountPercent}%
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-emerald-200">
                  {formatMoney(product.priceCents, product.currency, locale)}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span
                  className={`rounded-full px-3 py-1 ${
                    product.isActive
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "bg-rose-400/15 text-rose-200"
                  }`}
                >
                  {product.isActive
                    ? t("products.active")
                    : t("products.inactive")}
                </span>
                <Link
                  href={`/shop/${product.slug}`}
                  className="text-emerald-200 transition hover:text-emerald-100"
                >
                  {t("products.view")}
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-white/40"
                >
                  {t("products.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(product.id, !product.isActive)}
                  disabled={actionId === product.id}
                  className="rounded-full border border-emerald-300/40 px-3 py-1 text-emerald-200 transition hover:border-emerald-300/70 disabled:opacity-60"
                >
                  {product.isActive
                    ? t("products.deactivate")
                    : t("products.activate")}
                </button>
                <button
                  type="button"
                  onClick={() => removeProduct(product)}
                  disabled={actionId === product.id}
                  className="rounded-full border border-rose-300/40 px-3 py-1 text-rose-200 transition hover:border-rose-300/70 disabled:opacity-60"
                >
                  {t("products.delete")}
                </button>
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-zinc-950/50 p-3 text-[11px] text-zinc-300">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400">
                    {t("products.discountLabel")}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    placeholder="0"
                    value={discountDrafts[product.id] ?? ""}
                    onChange={(e) =>
                      setDiscountDrafts((prev) => ({
                        ...prev,
                        [product.id]: e.target.value,
                      }))
                    }
                    className="w-16 rounded-lg border border-white/10 bg-zinc-900/70 px-2 py-1 text-[11px] text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => applyDiscount(product.id)}
                    disabled={actionId === product.id}
                    className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    {t("products.discountApply")}
                  </button>
                  {product.discountPercent ? (
                    <button
                      type="button"
                      onClick={() => updateProduct(product.id, { discountPercent: 0 })}
                      disabled={actionId === product.id}
                      className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white disabled:opacity-60"
                    >
                      {t("products.discountRemove")}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400">
                    {t("products.boostLabel")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      product.boostStatus === "APPROVED"
                        ? "bg-emerald-400/20 text-emerald-200"
                        : product.boostStatus === "PENDING"
                        ? "bg-amber-400/20 text-amber-200"
                        : product.boostStatus === "REJECTED"
                        ? "bg-rose-400/20 text-rose-200"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {t(
                      `products.boostStatus.${(
                        product.boostStatus ?? "NONE"
                      ).toLowerCase()}`
                    )}
                  </span>
                  {(product.boostStatus === "NONE" ||
                    product.boostStatus === "REJECTED" ||
                    !product.boostStatus) && (
                    <button
                      type="button"
                      onClick={() => requestBoost(product.id)}
                      disabled={actionId === product.id}
                      className="rounded-full border border-emerald-300/40 px-3 py-1 text-[10px] text-emerald-200 disabled:opacity-60"
                    >
                      {t("products.boostRequest")}
                    </button>
                  )}
                  {product.boostStatus === "APPROVED" &&
                    product.boostedUntil && (
                      <span className="text-[10px] text-zinc-400">
                        {t("products.boostUntil", {
                          date: new Date(
                            product.boostedUntil
                          ).toLocaleDateString(locale),
                        })}
                      </span>
                    )}
                </div>
              </div>
              {editId === product.id && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-xs text-zinc-300">
                  <div className="grid gap-2">
                    <label className="text-[11px] text-zinc-400">
                      {t("products.fields.title")}
                    </label>
                    <input
                      className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] text-zinc-400">
                      {t("products.fields.description")}
                    </label>
                    <textarea
                      className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-[11px] text-zinc-400">
                        {t("products.fields.price")}
                      </label>
                      <input
                        className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                        value={editForm.priceCents}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            priceCents: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] text-zinc-400">
                        {t("products.fields.stock")}
                      </label>
                      <input
                        className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                        value={editForm.stockQuantity}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            stockQuantity: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-[11px] text-zinc-400">
                        {t("products.fields.pickup")}
                      </label>
                      <input
                        className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                        value={editForm.pickupLocation}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            pickupLocation: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] text-zinc-400">
                        {t("products.fields.delivery")}
                      </label>
                      <input
                        className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                        value={editForm.deliveryOptions}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            deliveryOptions: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-[11px] text-zinc-400">
                        {t("products.fields.type")}
                      </label>
                      <select
                        className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-white"
                        value={editForm.type}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            type: e.target.value as "LOCAL" | "PREORDER" | "DROPSHIP",
                          }))
                        }
                      >
                        <option value="LOCAL">{t("products.types.local")}</option>
                        <option value="PREORDER">{t("products.types.preorder")}</option>
                        <option value="DROPSHIP">{t("products.types.dropship")}</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            isActive: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-white/20 bg-zinc-900"
                      />
                      <span>{t("products.fields.active")}</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] text-zinc-400">
                      {t("products.fields.images")}
                    </label>
                    {product.images.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {product.images.map((image) => {
                          const marked = removedImageIds.includes(image.id);
                          return (
                            <button
                              type="button"
                              key={image.id}
                              onClick={() => toggleRemoveImage(image.id)}
                              className={`relative overflow-hidden rounded-xl border text-left ${
                                marked
                                  ? "border-rose-400/40 opacity-50"
                                  : "border-white/10"
                              }`}
                            >
                              <img
                                src={image.url}
                                alt={image.alt ?? product.title}
                                className="h-20 w-full object-cover"
                              />
                              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                                {marked
                                  ? t("products.removeImage")
                                  : t("products.keepImage")}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="block w-full text-[11px] text-zinc-300"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const remaining = Math.max(0, maxFiles - editFiles.length);
                        const next = [...editFiles, ...files.slice(0, remaining)];
                        if (files.length > remaining) {
                          setError(t("products.errors.maxFiles"));
                        }
                        setEditImages(next);
                        e.target.value = "";
                      }}
                    />
                    {uploadProgress !== null && (
                      <div className="flex items-center gap-3 text-[11px] text-zinc-300">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <span className="min-w-[48px] text-right">
                          {t("products.uploading", { percent: uploadProgress })}
                        </span>
                      </div>
                    )}
                    {editPreviews.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {editPreviews.map((preview, index) => (
                          <div
                            key={preview}
                            className="relative overflow-hidden rounded-xl border border-white/10"
                          >
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="h-20 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewImageAt(index)}
                              className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white"
                            >
                              {t("products.removeImage")}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={actionId === product.id}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 disabled:opacity-60"
                    >
                      {t("products.save")}
                    </button>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="rounded-full border border-white/20 px-4 py-2 text-[11px] text-white"
                    >
                      {t("products.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


