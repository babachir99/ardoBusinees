"use client";

import { useEffect, useRef, useState } from "react";
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
    discountPercent: "",
    type: "LOCAL",
    preorderLeadDays: "",
    dropshipSupplier: "",
    stockQuantity: "0",
    pickupLocation: "",
    deliveryOptions: "",
    imageUrl: "",
    requestBoost: false,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sellerReady, setSellerReady] = useState(false);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const maxFileSize = 2 * 1024 * 1024;
  const maxFiles = 5;

  useEffect(() => {
    const loadSeller = async () => {
      try {
        const res = await fetch("/api/seller/me");
        if (!res.ok) {
          setSellerReady(false);
          setError(t("errors.sellerMissing"));
          return;
        }
        const data = (await res.json()) as { id: string };
        setForm((prev) => ({ ...prev, sellerId: data.id }));
        setSellerReady(true);
      } catch {
        setSellerReady(false);
        setError(t("errors.sellerMissing"));
      }
    };
    loadSeller();
  }, [t]);

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setFilesState = (files: File[]) => {
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    if (files.length > 0) {
      setForm((prev) => ({ ...prev, imageUrl: "" }));
    }
  };

  const removeImageAt = (index: number) => {
    const nextFiles = imageFiles.filter((_, i) => i !== index);
    setImageFiles(nextFiles);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImageFiles([]);
    setImagePreviews([]);
  };

  const addMoreImages = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const remainingSlots = Math.max(0, maxFiles - imageFiles.length);
    if (remainingSlots === 0) {
      setError(t("errors.maxFiles", { max: String(maxFiles) }));
      return;
    }
    const next = [...imageFiles, ...incoming.slice(0, remainingSlots)];
    setFilesState(next);
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

  const validateImage = async (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        t("errors.fileType", {
          formats: "JPG, PNG, WEBP, GIF",
        })
      );
    }
    const bitmap = await createImageBitmap(file);
    if (bitmap.width < 800 || bitmap.height < 800) {
      bitmap.close();
      throw new Error(t("errors.dimensions", { min: "800x800" }));
    }
    bitmap.close();
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
      canvas.toBlob(
        (b) => resolve(b),
        "image/webp",
        0.85
      );
    });

    if (!blob) {
      return file;
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      let imageUrl = form.imageUrl || undefined;

      let imageUrls: string[] | undefined;

      if (imageFiles.length > 0) {
        imageUrls = [];
        for (const file of imageFiles) {
          await validateImage(file);
          const processed =
            file.size > maxFileSize ? await compressImage(file) : file;
          if (processed.size > maxFileSize) {
            throw new Error(t("errors.fileSize", { max: "2MB" }));
          }
          const uploadedUrl = await uploadFile(processed);
          imageUrls.push(uploadedUrl);
        }
      } else if (imageUrl) {
        imageUrls = [imageUrl];
      }

      const payload = {
        sellerId: form.sellerId,
        storeId: form.storeId || undefined,
        title: form.title,
        slug: form.slug,
        description: form.description || undefined,
        priceCents: Number(form.priceCents),
        discountPercent: form.discountPercent
          ? Number(form.discountPercent)
          : undefined,
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
        imageUrls,
        requestBoost: form.requestBoost,
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
        {!sellerReady && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-100">
            {t("errors.sellerMissing")}
          </div>
        )}
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
          <label className="text-xs text-zinc-400">
            {t("discountPercent")}
          </label>
          <input
            type="number"
            min="0"
            max="90"
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
            value={form.discountPercent}
            onChange={(e) => handleChange("discountPercent")(e.target.value)}
          />
          <p className="text-[11px] text-zinc-500">{t("discountHint")}</p>
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
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={form.requestBoost}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, requestBoost: e.target.checked }))
            }
            className="h-4 w-4 rounded border-white/20 bg-zinc-900"
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {t("boostRequest")}
            </p>
            <p className="text-[11px] text-zinc-400">
              {t("boostHint")}
            </p>
          </div>
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
              const files = Array.from(e.dataTransfer.files || []).slice(
                0,
                maxFiles
              );
              if (files.length > 0) {
                setFilesState(files);
              }
            }}
          >
            <p className="text-zinc-300">{t("dropzone")}</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-3 block w-full text-xs text-zinc-300"
              onChange={(e) => {
                const files = Array.from(e.target.files || []).slice(
                  0,
                  maxFiles
                );
                setFilesState(files);
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
          {imagePreviews.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {imagePreviews.map((preview, index) => (
                <div
                  key={preview}
                  className="relative overflow-hidden rounded-2xl border border-white/10"
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="h-36 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImageAt(index)}
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white transition hover:bg-black"
                  >
                    {t("removeImage")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={clearImages}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-200 transition hover:border-white/20"
              >
                {t("clearImages")}
              </button>
              <button
                type="button"
                onClick={() => addInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-white/15 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-300 transition hover:border-white/30"
              >
                {t("addMoreImages")}
              </button>
            </div>
          )}
          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                addMoreImages(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-zinc-400">{t("imageUrl")}</label>
          <input
            placeholder="https://..."
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={form.imageUrl}
            onChange={(e) => handleChange("imageUrl")(e.target.value)}
            disabled={imageFiles.length > 0}
          />
          {imageFiles.length > 0 && (
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
        disabled={status === "loading" || !sellerReady}
        className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {status === "loading" ? t("loading") : t("submit")}
      </button>
    </form>
  );
}
