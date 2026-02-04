"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function NewProductForm() {
  const t = useTranslations("SellerProduct");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    sellerId: "",
    storeId: "",
    title: "",
    slug: "",
    description: "",
    priceCents: "",
    type: "LOCAL",
    preorderLeadDays: "",
    dropshipSupplier: "",
    stockQuantity: "0",
    pickupLocation: "",
    deliveryOptions: "",
    imageUrl: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setFileState = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    if (file) {
      setForm((prev) => ({ ...prev, imageUrl: "" }));
    }
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
            const json = JSON.parse(request.responseText) as { url?: string; error?: string };
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

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      let imageUrl = form.imageUrl || undefined;

      if (imageFile) {
        if (!allowedTypes.includes(imageFile.type)) {
          throw new Error(
            t("errors.fileType", {
              formats: "JPG, PNG, WEBP, GIF",
            })
          );
        }
        if (imageFile.size > 2 * 1024 * 1024) {
          throw new Error(t("errors.fileSize", { max: "2MB" }));
        }
        imageUrl = await uploadFile(imageFile);
      }

      const payload = {
        sellerId: form.sellerId,
        storeId: form.storeId || undefined,
        title: form.title,
        slug: form.slug,
        description: form.description || undefined,
        priceCents: Number(form.priceCents),
        type: form.type,
        preorderLeadDays: form.preorderLeadDays
          ? Number(form.preorderLeadDays)
          : undefined,
        dropshipSupplier: form.dropshipSupplier || undefined,
        stockQuantity: form.stockQuantity
          ? Number(form.stockQuantity)
          : undefined,
        pickupLocation: form.pickupLocation || undefined,
        deliveryOptions: form.deliveryOptions || undefined,
        imageUrl,
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Error");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("sellerId")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.sellerId}
            onChange={(e) => handleChange("sellerId")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("storeId")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.storeId}
            onChange={(e) => handleChange("storeId")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("titleLabel")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.title}
            onChange={(e) => handleChange("title")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("slug")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.slug}
            onChange={(e) => handleChange("slug")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("description")}</label>
          <textarea
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.description}
            onChange={(e) => handleChange("description")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("price")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.priceCents}
            onChange={(e) => handleChange("priceCents")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("type")}</label>
          <select
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.type}
            onChange={(e) => handleChange("type")(e.target.value)}
          >
            <option value="LOCAL">{t("types.local")}</option>
            <option value="PREORDER">{t("types.preorder")}</option>
            <option value="DROPSHIP">{t("types.dropship")}</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("preorderLeadDays")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.preorderLeadDays}
            onChange={(e) => handleChange("preorderLeadDays")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("dropshipSupplier")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.dropshipSupplier}
            onChange={(e) => handleChange("dropshipSupplier")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("stockQuantity")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.stockQuantity}
            onChange={(e) => handleChange("stockQuantity")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("pickupLocation")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.pickupLocation}
            onChange={(e) => handleChange("pickupLocation")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("deliveryOptions")}</label>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.deliveryOptions}
            onChange={(e) => handleChange("deliveryOptions")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("imageFile")}</label>
          <div
            className={`rounded-2xl border border-dashed px-4 py-6 text-center text-xs transition ${
              dragActive
                ? "border-emerald-300/80 bg-emerald-300/10"
                : "border-white/15 bg-zinc-950/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                setFileState(file);
              }
            }}
          >
            <p className="text-zinc-300">{t("dropzone")}</p>
            <input
              type="file"
              accept="image/*"
              className="mt-3 block w-full text-xs text-zinc-300"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setFileState(file);
              }}
            />
          </div>
          {uploadProgress !== null && (
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="min-w-[48px] text-right">
                {t("uploading", { percent: uploadProgress })}
              </span>
            </div>
          )}
          {imagePreview && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-40 w-full object-cover"
              />
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("imageUrl")}</label>
          <input
            placeholder="https://..."
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={form.imageUrl}
            onChange={(e) => handleChange("imageUrl")(e.target.value)}
            disabled={Boolean(imageFile)}
          />
          {imageFile && (
            <p className="text-[11px] text-zinc-500">{t("imageUrlDisabled")}</p>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {status === "success" && (
        <p className="mt-4 text-sm text-emerald-300">{t("success")}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {status === "loading" ? t("loading") : t("submit")}
      </button>
    </form>
  );
}
