"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type ProductForm = {
  sellerId: string;
  storeId: string;
  title: string;
  slug: string;
  description: string;
  priceCents: string;
  discountPercent: string;
  type: "LOCAL" | "PREORDER" | "DROPSHIP";
  preorderLeadDays: string;
  dropshipSupplier: string;
  stockQuantity: string;
  pickupLocation: string;
  deliveryOptions: string;
  imageUrl: string;
  colorOptions: string;
  sizeOptions: string;
  requestBoost: boolean;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  label?: string;
};

type StoreOption = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description?: string | null;
};

type CategorySuggestionResponse = {
  categorie_suggeree: string | null;
  confiance: number;
  mots_cles_detectes: string[];
  categories_alternatives: string[];
  explication: string;
  suggestions: Array<{
    id: string;
    label: string;
    score: number;
  }>;
};

type AttributeField = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
};

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseCommaOptions(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function inferAttributeFields(category?: CategoryOption): AttributeField[] {
  if (!category) return [];

  const currentSlug = category.slug.toLowerCase();
  const currentName = category.name.toLowerCase();
  const parentSlug = (category.parent?.slug ?? "").toLowerCase();
  const parentName = (category.parent?.name ?? "").toLowerCase();
  const bag = `${currentSlug} ${currentName} ${parentSlug} ${parentName}`;

  const isRealEstateRoot = currentSlug === "immobilier" || parentSlug === "immobilier";
  const isRealEstateLeaf = [
    "immo",
    "immobilier",
    "appartement",
    "terrain",
    "location",
    "colocation",
    "bureau",
    "commerce",
    "villa",
    "studio",
  ].some((keyword) => currentSlug.includes(keyword) || currentName.includes(keyword));

  if (isRealEstateRoot || isRealEstateLeaf) {
    return [
      { key: "surface", label: "Surface", placeholder: "Ex: 120 m2" },
      { key: "rooms", label: "Pieces", placeholder: "Ex: 4" },
      { key: "location", label: "Zone", placeholder: "Ex: Dakar - Almadies", required: true },
      { key: "condition", label: "Etat", placeholder: "Ex: Renove" },
    ];
  }

  const isVehicleCategory = [
    "voiture",
    "vehicule",
    "vehicle",
    "cars",
    "auto",
    "moto",
    "utilitaire",
    "camion",
  ].some((keyword) => bag.includes(keyword));

  if (isVehicleCategory) {
    return [
      { key: "brand", label: "Marque", placeholder: "Ex: Toyota", required: true },
      { key: "model", label: "Modele", placeholder: "Ex: Corolla", required: true },
      { key: "year", label: "Annee", placeholder: "Ex: 2020" },
      { key: "mileage", label: "Kilometrage", placeholder: "Ex: 120000 km" },
      { key: "fuel", label: "Carburant", placeholder: "Ex: Essence" },
      { key: "condition", label: "Etat", placeholder: "Ex: Bon etat" },
    ];
  }

  const isFashionCategory =
    bag.includes("vetement") ||
    bag.includes("mode") ||
    bag.includes("fashion") ||
    bag.includes("chaussure");

  if (isFashionCategory) {
    return [
      { key: "brand", label: "Marque", placeholder: "Ex: Zara" },
      { key: "condition", label: "Etat", placeholder: "Ex: Neuf avec etiquette", required: true },
      { key: "material", label: "Matiere", placeholder: "Ex: Coton" },
      { key: "gender", label: "Genre", placeholder: "Ex: Homme / Femme" },
      { key: "collection", label: "Collection", placeholder: "Ex: Hiver 2026" },
    ];
  }

  return [
    { key: "brand", label: "Marque", placeholder: "Ex: Samsung" },
    { key: "condition", label: "Etat", placeholder: "Ex: Neuf" },
    { key: "warranty", label: "Garantie", placeholder: "Ex: 12 mois" },
  ];
}

export default function NewProductForm() {
  const t = useTranslations("SellerProduct");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sellerReady, setSellerReady] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categorySelectionTouched, setCategorySelectionTouched] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestionResponse | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showAdvancedBasics, setShowAdvancedBasics] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  const [form, setForm] = useState<ProductForm>({
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
    colorOptions: "",
    sizeOptions: "",
    requestBoost: false,
  });

  const [attributes, setAttributes] = useState<Record<string, string>>({});

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const addInputRef = useRef<HTMLInputElement | null>(null);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const maxFileSize = 2 * 1024 * 1024;
  const maxFiles = 5;
  const titleMax = 200;

  const isLocal = form.type === "LOCAL";
  const isPreorder = form.type === "PREORDER";
  const isDropship = form.type === "DROPSHIP";

  const steps = [t("wizard.basics"), t("wizard.media"), t("wizard.details"), t("wizard.publish")];

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      const label =
        category.label ||
        (category.parent ? `${category.parent.name} > ${category.name}` : category.name);
      map.set(category.id, label);
    }
    return map;
  }, [categories]);

  const selectableCategories = useMemo(() => {
    const nonRootCategories = categories.filter((category) => Boolean(category.parent));
    return nonRootCategories.length > 0 ? nonRootCategories : categories;
  }, [categories]);

  const selectedCategory = useMemo(
    () => selectableCategories.find((category) => category.id === selectedCategoryId),
    [selectableCategories, selectedCategoryId]
  );

  const selectedCategoryLabel = selectedCategoryId
    ? categoryLabelById.get(selectedCategoryId) ?? ""
    : "";

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim();
    if (!query) return selectableCategories;

    const token = toSlug(query);
    return selectableCategories.filter((category) => {
      const bag = toSlug(
        `${category.parent?.name ?? ""} ${category.name} ${category.slug} ${category.label ?? ""}`
      );
      return bag.includes(token);
    });
  }, [categorySearch, selectableCategories]);

  const groupedSelectableCategories = useMemo(() => {
    const groups = new Map<string, CategoryOption[]>();

    for (const category of filteredCategories) {
      const groupLabel = category.parent?.name ?? "Autres";
      if (!groups.has(groupLabel)) groups.set(groupLabel, []);
      groups.get(groupLabel)!.push(category);
    }

    return Array.from(groups.entries())
      .map(([label, options]) => ({
        label,
        options: [...options].sort((a, b) => a.name.localeCompare(b.name, "fr")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [filteredCategories]);

  const attributeFields = useMemo(() => inferAttributeFields(selectedCategory), [selectedCategory]);
  const parsedColorOptions = useMemo(() => parseCommaOptions(form.colorOptions), [form.colorOptions]);
  const parsedSizeOptions = useMemo(() => parseCommaOptions(form.sizeOptions), [form.sizeOptions]);
  const titleKeywords = useMemo(
    () =>
      toSlug(form.title)
        .split("-")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
        .slice(0, 5),
    [form.title]
  );

  useEffect(() => {
    setAttributes((prev) => {
      const next: Record<string, string> = {};
      for (const field of attributeFields) next[field.key] = prev[field.key] ?? "";
      return next;
    });
  }, [attributeFields]);

  const localCategorySuggestions = useMemo(() => {
    if (selectableCategories.length === 0) return [] as CategoryOption[];

    const tokens = toSlug(form.title)
      .split("-")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);

    if (tokens.length === 0) return selectableCategories.slice(0, 6);

    const scored = selectableCategories
      .map((category) => {
        const bag = toSlug(`${category.parent?.name ?? ""} ${category.name} ${category.slug}`);
        let score = 0;
        for (const token of tokens) {
          if (bag.includes(token)) score += 2;
          if (category.slug.includes(token)) score += 2;
          if (bag.startsWith(token)) score += 1;
        }
        return { category, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.category);

    return scored.length > 0 ? scored : selectableCategories.slice(0, 6);
  }, [form.title, selectableCategories]);

  const smartCategorySuggestions = useMemo(() => {
    if (!categorySuggestion?.suggestions?.length) return [] as CategoryOption[];
    const byId = new Map(selectableCategories.map((category) => [category.id, category]));

    return categorySuggestion.suggestions
      .map((entry) => byId.get(entry.id))
      .filter((entry): entry is CategoryOption => Boolean(entry));
  }, [categorySuggestion, selectableCategories]);

  const categorySuggestions = useMemo(() => {
    const byId = new Map<string, CategoryOption>();

    for (const entry of smartCategorySuggestions) {
      byId.set(entry.id, entry);
    }

    for (const entry of localCategorySuggestions) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, entry);
      }
    }

    return Array.from(byId.values()).slice(0, 8);
  }, [localCategorySuggestions, smartCategorySuggestions]);

  const suggestionConfidence = categorySuggestion?.confiance ?? 0;
  const suggestionDetectedKeywords = categorySuggestion?.mots_cles_detectes ?? [];
  const suggestionAlternatives = categorySuggestion?.categories_alternatives ?? [];
  const suggestionExplanation = categorySuggestion?.explication ?? "";

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

    const loadStores = async () => {
      try {
        setStoresLoading(true);
        const res = await fetch("/api/stores?take=100", { cache: "no-store" });
        if (!res.ok) {
          setStores([]);
          return;
        }

        const data = (await res.json()) as StoreOption[];
        const nextStores = Array.isArray(data) ? data : [];
        setStores(nextStores);

        if (nextStores.length > 0) {
          setForm((prev) => {
            if (prev.storeId) return prev;

            const defaultStore =
              nextStores.find((store) => store.slug === "marketplace") ??
              nextStores.find((store) => store.type === "MARKETPLACE") ??
              nextStores[0];

            return { ...prev, storeId: defaultStore.id };
          });
        }
      } catch {
        setStores([]);
      } finally {
        setStoresLoading(false);
      }
    };

    loadSeller();
    loadStores();
  }, [t]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);

        const query = form.storeId
          ? `/api/categories?take=400&leafOnly=1&storeId=${encodeURIComponent(form.storeId)}`
          : "/api/categories?take=400&leafOnly=1";

        const res = await fetch(query, { cache: "no-store" });
        if (!res.ok) {
          setCategories([]);
          return;
        }

        const data = (await res.json()) as CategoryOption[];
        let nextCategories = Array.isArray(data) ? data : [];

        // Always merge global categories so a seller is not locked to a tiny mapped list.
        if (form.storeId) {
          const fallbackRes = await fetch("/api/categories?take=400&leafOnly=1", {
            cache: "no-store",
          });
          if (fallbackRes.ok) {
            const fallbackData = (await fallbackRes.json()) as CategoryOption[];
            const fallbackCategories = Array.isArray(fallbackData) ? fallbackData : [];
            const byId = new Map<string, CategoryOption>();

            for (const category of nextCategories) byId.set(category.id, category);
            for (const category of fallbackCategories) {
              if (!byId.has(category.id)) {
                byId.set(category.id, category);
              }
            }

            nextCategories = Array.from(byId.values());
          }
        }

        setCategories(nextCategories);

        if (selectedCategoryId) {
          const selectablePool = nextCategories.filter((category) => Boolean(category.parent));
          const pool = selectablePool.length > 0 ? selectablePool : nextCategories;
          if (!pool.some((category) => category.id === selectedCategoryId)) {
            setSelectedCategoryId("");
            setCategorySelectionTouched(false);
            setCategorySearch("");
          }
        }
      } catch {
        setCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, [form.storeId, selectedCategoryId]);

  useEffect(() => {
    if (!slugTouched) {
      setForm((prev) => ({ ...prev, slug: toSlug(prev.title) }));
    }
  }, [form.title, slugTouched]);

  useEffect(() => {
    const title = form.title.trim();

    if (title.length < 2) {
      setCategorySuggestion(null);
      setShowAllCategories(false);
      setSuggestionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSuggestionLoading(true);
        const categoryQuery = form.storeId
          ? `/api/categories/suggest?title=${encodeURIComponent(title)}&leafOnly=1&storeId=${encodeURIComponent(form.storeId)}`
          : `/api/categories/suggest?title=${encodeURIComponent(title)}&leafOnly=1`;

        const response = await fetch(categoryQuery, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setCategorySuggestion(null);
      setShowAllCategories(false);
          return;
        }

        const data = (await response.json()) as CategorySuggestionResponse;
        setCategorySuggestion(data);

        if (!categorySelectionTouched && !selectedCategoryId && data.confiance >= 70 && data.suggestions.length > 0) {
          setSelectedCategoryId(data.suggestions[0].id);
          setCategorySearch("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setCategorySuggestion(null);
      setShowAllCategories(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionLoading(false);
        }
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [categorySelectionTouched, form.storeId, form.title, selectedCategoryId]);

  useEffect(() => {
    const nextPreviews = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles]);

  const handleChange =
    <K extends keyof ProductForm>(field: K) =>
    (value: ProductForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleAttributeChange = (key: string, value: string) => {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  };

  const removeOptionValue = (field: "colorOptions" | "sizeOptions", valueToRemove: string) => {
    const current = field === "colorOptions" ? parsedColorOptions : parsedSizeOptions;
    const next = current.filter((value) => value.toLowerCase() !== valueToRemove.toLowerCase());
    handleChange(field)(next.join(", "));
  };

  const removeImageAt = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImageFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const clearImages = () => {
    setImageFiles([]);
  };

  const addMoreImages = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const remainingSlots = Math.max(0, maxFiles - imageFiles.length);

    if (remainingSlots === 0) {
      setError(t("errors.maxFiles", { max: String(maxFiles) }));
      return;
    }

    const next = [...imageFiles, ...incoming.slice(0, remainingSlots)];
    setImageFiles(next);
    if (next.length > 0) {
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

  const canGoNext = () => {
    if (step === 0) return Boolean(form.title.trim()) && Boolean(selectedCategoryId) && Number(form.priceCents) > 0;
    if (step === 1) return imageFiles.length > 0 || Boolean(form.imageUrl.trim());
    if (step === 2) {
      if (isPreorder) {
        const d = Number(form.preorderLeadDays);
        if (!Number.isFinite(d) || d < 1 || d > 365) return false;
      }
      if (isDropship && !form.dropshipSupplier.trim()) return false;
      if (isLocal) {
        if (Number(form.stockQuantity) < 0) return false;
        if (!form.pickupLocation.trim()) return false;
      }
      const missingAttribute = attributeFields.some((f) => f.required && !String(attributes[f.key] ?? "").trim());
      return !missingAttribute;
    }
    return true;
  };

  const nextStep = () => {
    if (canGoNext()) {
      setError(null);
      setStep((prev) => Math.min(prev + 1, steps.length - 1));
      return;
    }

    if (step === 0) {
      if (!form.title.trim()) setError(t("errors.titleRequired"));
      else if (!selectedCategoryId) setError(t("errors.categoryRequired"));
      else setError(t("errors.priceRequired"));
      return;
    }

    if (step === 1) {
      setError(t("errors.imageRequired"));
      return;
    }

    if (step === 2) {
      const missingField = attributeFields.find((f) => f.required && !String(attributes[f.key] ?? "").trim());
      if (missingField) {
        setError(t("errors.attributeRequired", { field: missingField.label }));
        return;
      }
      if (isPreorder) {
        setError(t("errors.preorderLeadDays"));
        return;
      }
      if (isDropship) {
        setError(t("errors.dropshipSupplierRequired"));
        return;
      }
      if (isLocal && !form.pickupLocation.trim()) setError(t("errors.pickupRequired"));
    }
  };

  const previousStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!sellerReady) return;

    setStatus("loading");
    setError(null);

    try {
      const title = form.title.trim();
      if (!title) throw new Error(t("errors.titleRequired"));
      if (!selectedCategoryId) throw new Error(t("errors.categoryRequired"));

      const priceCents = Number(form.priceCents);
      if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error(t("errors.priceRequired"));

      const slug = toSlug(form.slug || form.title);
      if (!slug) throw new Error(t("errors.slugRequired"));

      if (isPreorder) {
        const preorderLeadDays = Number(form.preorderLeadDays);
        if (!Number.isFinite(preorderLeadDays) || preorderLeadDays < 1 || preorderLeadDays > 365) {
          throw new Error(t("errors.preorderLeadDays"));
        }
      }

      if (isDropship && !form.dropshipSupplier.trim()) throw new Error(t("errors.dropshipSupplierRequired"));

      if (isLocal) {
        const stockQuantity = Number(form.stockQuantity);
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) throw new Error(t("errors.stockInvalid"));
        if (!form.pickupLocation.trim()) throw new Error(t("errors.pickupRequired"));
      }

      const missingAttribute = attributeFields.find(
        (field) => field.required && !String(attributes[field.key] ?? "").trim()
      );
      if (missingAttribute) throw new Error(t("errors.attributeRequired", { field: missingAttribute.label }));

      if (imageFiles.length === 0 && !form.imageUrl.trim()) throw new Error(t("errors.imageRequired"));

      const colorOptions = parseCommaOptions(form.colorOptions);
      const sizeOptions = parseCommaOptions(form.sizeOptions);
      const baseDescription = form.description.trim();

      const attributeEntries = Object.entries(attributes)
        .map(([key, raw]) => [String(key).trim(), String(raw ?? "").trim()] as const)
        .filter(([key, value]) => key.length > 0 && value.length > 0);

      const normalizedAttributes =
        attributeEntries.length > 0
          ? Object.fromEntries(attributeEntries)
          : undefined;

      let imageUrls: string[] | undefined;

      if (imageFiles.length > 0) {
        imageUrls = [];
        for (const file of imageFiles) {
          await validateImage(file);
          const processed = file.size > maxFileSize ? await compressImage(file) : file;

          if (processed.size > maxFileSize) throw new Error(t("errors.fileSize", { max: "2MB" }));

          const uploadedUrl = await uploadFile(processed);
          imageUrls.push(uploadedUrl);
        }
      } else if (form.imageUrl.trim()) {
        imageUrls = [form.imageUrl.trim()];
      }

      const payload = {
        sellerId: form.sellerId,
        storeId: form.storeId.trim() || undefined,
        title,
        slug,
        description: baseDescription || undefined,
        priceCents,
        discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined,
        type: form.type,
        preorderLeadDays: isPreorder ? Number(form.preorderLeadDays) : undefined,
        dropshipSupplier: isDropship ? form.dropshipSupplier.trim() || undefined : undefined,
        stockQuantity: isLocal ? Number(form.stockQuantity) : undefined,
        pickupLocation: isLocal ? form.pickupLocation.trim() || undefined : undefined,
        deliveryOptions: isLocal ? form.deliveryOptions.trim() || undefined : undefined,
        imageUrls,
        categoryIds: [selectedCategoryId],
        colorOptions,
        sizeOptions,
        attributes: normalizedAttributes,
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
      setStep(0);
      setForm((prev) => ({
        ...prev,
        title: "",
        slug: "",
        description: "",
        priceCents: "",
        discountPercent: "",
        preorderLeadDays: "",
        dropshipSupplier: "",
        stockQuantity: "0",
        pickupLocation: "",
        deliveryOptions: "",
        colorOptions: "",
        sizeOptions: "",
        imageUrl: "",
        requestBoost: false,
      }));
      setAttributes({});
      setSelectedCategoryId("");
      setCategorySelectionTouched(false);
      setCategorySuggestion(null);
      setShowAllCategories(false);
      setCategorySearch("");
      setSlugTouched(false);
      clearImages();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="grid gap-6">
        {!sellerReady && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-100">
            {t("errors.sellerMissing")}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("wizard.title")}</p>
            <p className="text-xs text-zinc-500">{t("wizard.step", { current: step + 1, total: steps.length })}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {steps.map((label, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <div
                  key={label}
                  className={`rounded-xl border px-3 py-2 text-xs transition ${
                    active
                      ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                      : done
                      ? "border-white/20 bg-white/5 text-zinc-200"
                      : "border-white/10 bg-zinc-950/40 text-zinc-400"
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </section>

        {step === 0 && (
          <section className="grid gap-5 rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("sections.basics")}</p>
              <p className="text-[11px] text-zinc-500">{t("requiredHint")}</p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-zinc-400">{t("titleLabel")}</label>
                <span className="text-[11px] text-zinc-500">{form.title.length}/{titleMax}</span>
              </div>
              <input
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                value={form.title}
                maxLength={titleMax}
                onChange={(e) => handleChange("title")(e.target.value)}
              />
            </div>

            {titleKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {titleKeywords.map((token) => (
                  <span
                    key={token}
                    className="rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-zinc-300"
                  >
                    {token}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-zinc-400">{t("storeLabel")}</label>
                {storesLoading && <span className="text-[11px] text-zinc-500">{t("storesLoading")}</span>}
              </div>
              <select
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                value={form.storeId}
                onChange={(e) => handleChange("storeId")(e.target.value)}
                disabled={storesLoading || stores.length === 0}
              >
                <option value="">{t("storePlaceholder")}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              {!storesLoading && stores.length === 0 && (
                <p className="text-[11px] text-zinc-500">{t("noStores")}</p>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-zinc-200">{t("categoriesSuggested")}</p>
                {suggestionLoading && (
                  <span className="text-[11px] text-zinc-500">{t("categoryEngineLoading")}</span>
                )}
              </div>
              {categorySuggestion && (
                <div className="grid gap-2 rounded-lg border border-white/10 bg-zinc-900/50 p-2.5 text-[11px] text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">{t("categoryEngineConfidence")}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        suggestionConfidence >= 70
                          ? "bg-emerald-400/20 text-emerald-200"
                          : "bg-amber-300/20 text-amber-100"
                      }`}
                    >
                      {suggestionConfidence}%
                    </span>
                  </div>

                  {suggestionDetectedKeywords.length > 0 && (
                    <div className="grid gap-1">
                      <span className="text-zinc-400">{t("categoryEngineDetected")}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestionDetectedKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-white/10 bg-zinc-950/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestionAlternatives.length > 0 && (
                    <p className="text-zinc-400">
                      {t("categoryEngineAlternatives")}: {suggestionAlternatives.join(" - ")}
                    </p>
                  )}

                  {suggestionExplanation && (
                    <p className="text-zinc-400">
                      {t("categoryEngineExplain")}: {suggestionExplanation}
                    </p>
                  )}
                </div>
              )}
              {categoriesLoading ? (
                <p className="text-[11px] text-zinc-500">{t("categoriesLoading")}</p>
              ) : categorySuggestions.length > 0 ? (
                <div className="grid gap-2">
                  {categorySuggestions.map((category) => {
                    const label = categoryLabelById.get(category.id) ?? category.name;
                    const active = selectedCategoryId === category.id;
                    return (
                      <label
                        key={category.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                          active
                            ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                            : "border-white/10 text-zinc-300 hover:border-white/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="categorySuggested"
                          checked={active}
                          onChange={() => {
                            setCategorySelectionTouched(true);
                            setSelectedCategoryId(category.id);
                            setShowAllCategories(false);
                            setCategorySearch("");
                          }}
                          className="h-4 w-4 border-white/30 bg-zinc-900"
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">{t("noCategoryMatch")}</p>
              )}
            </div>

            <div className="grid gap-2 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-zinc-400">{t("allCategoriesLabel")}</label>
                <div className="flex items-center gap-2">
                  {!categoriesLoading && selectableCategories.length > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      {t("categoriesCount", { count: filteredCategories.length })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((prev) => !prev)}
                    className="rounded-lg border border-white/15 bg-zinc-950/70 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-white/35"
                  >
                    {showAllCategories ? t("hideAllCategories") : t("showAllCategories")}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500">{t("categoryPickHint")}</p>

              {showAllCategories && (
                <>
                  <input
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                    placeholder={t("categorySearchPlaceholder")}
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />

                  <div className="max-h-72 overflow-y-auto pr-1">
                    {groupedSelectableCategories.map((group) => (
                      <div key={group.label} className="mb-3 last:mb-0">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                          {group.label}
                        </p>
                        <div className="grid gap-2">
                          {group.options.map((category) => {
                            const label = categoryLabelById.get(category.id) ?? category.name;
                            const active = selectedCategoryId === category.id;

                            return (
                              <label
                                key={category.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                                  active
                                    ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                                    : "border-white/10 text-zinc-300 hover:border-white/30"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="categoryCatalog"
                                  checked={active}
                                  onChange={() => {
                                    setCategorySelectionTouched(true);
                                    setSelectedCategoryId(category.id);
                                  }}
                                  className="h-4 w-4 border-white/30 bg-zinc-900"
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCategoryLabel && (
                    <p className="text-[11px] text-emerald-200">
                      {t("selectedCategory")}: {selectedCategoryLabel}
                    </p>
                  )}
                  {!categoriesLoading && filteredCategories.length === 0 && (
                    <p className="text-[11px] text-zinc-500">{t("noCategories")}</p>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-zinc-400">{t("description")}</label>
              <textarea
                rows={4}
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                value={form.description}
                onChange={(e) => handleChange("description")(e.target.value)}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("price")}</label>
                <input
                  type="number"
                  min="1"
                  className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                  value={form.priceCents}
                  onChange={(e) => handleChange("priceCents")(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedBasics((prev) => !prev)}
                className="rounded-xl border border-white/15 bg-zinc-950/60 px-4 py-3 text-xs font-semibold text-zinc-200 transition hover:border-white/40"
              >
                {showAdvancedBasics ? t("advanced.hide") : t("advanced.show")}
              </button>
            </div>

            {showAdvancedBasics && (
              <div className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                <div className="grid gap-2">
                  <label className="text-xs text-zinc-400">{t("slug")}</label>
                  <input
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      handleChange("slug")(e.target.value);
                    }}
                  />
                  {!slugTouched && <p className="text-[11px] text-zinc-500">{t("slugAuto")}</p>}
                </div>
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("sections.media")}</p>

            <div
              className={`rounded-2xl border border-dashed px-4 py-6 text-center text-xs transition ${
                dragActive ? "border-emerald-300/80 bg-emerald-300/10" : "border-white/15 bg-zinc-950/40"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.length) addMoreImages(e.dataTransfer.files);
              }}
            >
              <p className="text-zinc-300">{t("dropzone")}</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-3 block w-full text-xs text-zinc-300"
                onChange={(e) => {
                  if (e.target.files) {
                    addMoreImages(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {uploadProgress !== null && (
              <div className="flex items-center gap-3 text-xs text-zinc-300">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="min-w-[48px] text-right">{t("uploading", { percent: uploadProgress })}</span>
              </div>
            )}

            <div className="grid gap-2 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>{t("photosCount")}</span>
                <span>{imageFiles.length}/{maxFiles}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: maxFiles }).map((_, index) => {
                  const filled = index < imageFiles.length;
                  const isCover = index === 0 && filled;
                  return (
                    <div
                      key={`slot-${index}`}
                      className={`flex h-12 items-center justify-center rounded-lg border text-[10px] ${
                        filled
                          ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                          : "border-white/10 bg-zinc-900/60 text-zinc-500"
                      }`}
                    >
                      {isCover ? t("coverPhoto") : filled ? `${index + 1}` : "+"}
                    </div>
                  );
                })}
              </div>
              {imageFiles.length < 3 && (
                <p className="text-[11px] text-zinc-500">{t("mediaTip")}</p>
              )}
            </div>

            {imagePreviews.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {imagePreviews.map((preview, index) => (
                  <div key={preview} className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/40">
                    {index === 0 && (
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-emerald-300/90 px-2 py-1 text-[10px] font-semibold text-zinc-900">
                        {t("coverPhoto")}
                      </span>
                    )}
                    <img src={preview} alt={`Preview ${index + 1}`} className="h-36 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-40">
                          {t("moveLeft")}
                        </button>
                        <button type="button" onClick={() => moveImage(index, 1)} disabled={index === imagePreviews.length - 1} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-40">
                          {t("moveRight")}
                        </button>
                      </div>
                      <button type="button" onClick={() => removeImageAt(index)} className="rounded-lg border border-rose-300/30 px-2 py-1 text-[11px] text-rose-200 transition hover:bg-rose-300/10">
                        {t("removeImage")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => addInputRef.current?.click()} className="rounded-2xl border border-dashed border-white/15 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-300 transition hover:border-white/30">
                {t("addMoreImages")}
              </button>

              <button type="button" onClick={clearImages} className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-200 transition hover:border-white/20">
                {t("clearImages")}
              </button>
            </div>

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

            <div className="grid gap-2">
              <label className="text-xs text-zinc-400">{t("imageUrl")}</label>
              <input
                placeholder="https://..."
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={form.imageUrl}
                onChange={(e) => handleChange("imageUrl")(e.target.value)}
                disabled={imageFiles.length > 0}
              />
              {imageFiles.length > 0 && <p className="text-[11px] text-zinc-500">{t("imageUrlDisabled")}</p>}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("sections.saleModel")}</p>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("type")}</label>
                <select className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.type} onChange={(e) => handleChange("type")(e.target.value as ProductForm["type"])}>
                  <option value="LOCAL">{t("types.local")}</option>
                  <option value="PREORDER">{t("types.preorder")}</option>
                  <option value="DROPSHIP">{t("types.dropship")}</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("discountPercent")}</label>
                <input type="number" min="0" max="90" className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.discountPercent} onChange={(e) => handleChange("discountPercent")(e.target.value)} />
                <p className="text-[11px] text-zinc-500">{t("discountHint")}</p>
              </div>
            </div>

            {isPreorder && (
              <div className="grid gap-2 sm:max-w-xs">
                <label className="text-xs text-zinc-400">{t("preorderLeadDays")}</label>
                <input type="number" min="1" max="365" className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.preorderLeadDays} onChange={(e) => handleChange("preorderLeadDays")(e.target.value)} />
              </div>
            )}

            {isDropship && (
              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("dropshipSupplier")}</label>
                <input className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.dropshipSupplier} onChange={(e) => handleChange("dropshipSupplier")(e.target.value)} />
              </div>
            )}

            {isLocal && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-xs text-zinc-400">{t("stockQuantity")}</label>
                  <input type="number" min="0" className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.stockQuantity} onChange={(e) => handleChange("stockQuantity")(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-xs text-zinc-400">{t("pickupLocation")}</label>
                  <input className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.pickupLocation} onChange={(e) => handleChange("pickupLocation")(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-3">
                  <label className="text-xs text-zinc-400">{t("deliveryOptions")}</label>
                  <input className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" value={form.deliveryOptions} onChange={(e) => handleChange("deliveryOptions")(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("colorOptions")}</label>
                <input
                  className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                  placeholder={t("colorOptionsPlaceholder")}
                  value={form.colorOptions}
                  onChange={(e) => handleChange("colorOptions")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-zinc-400">{t("sizeOptions")}</label>
                <input
                  className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                  placeholder={t("sizeOptionsPlaceholder")}
                  value={form.sizeOptions}
                  onChange={(e) => handleChange("sizeOptions")(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-wrap gap-2">
                {parsedColorOptions.length > 0 ? (
                  parsedColorOptions.map((color) => (
                    <button
                      type="button"
                      key={`color-${color}`}
                      onClick={() => removeOptionValue("colorOptions", color)}
                      className="rounded-full border border-white/15 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:border-rose-300/40 hover:text-rose-200"
                    >
                      {color} x
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-zinc-500">{t("emptyColor")}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {parsedSizeOptions.length > 0 ? (
                  parsedSizeOptions.map((size) => (
                    <button
                      type="button"
                      key={`size-${size}`}
                      onClick={() => removeOptionValue("sizeOptions", size)}
                      className="rounded-full border border-white/15 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:border-rose-300/40 hover:text-rose-200"
                    >
                      {size} x
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-zinc-500">{t("emptySize")}</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">{t("optionsHint")}</p>

            {attributeFields.length > 0 && (
              <div className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs font-semibold text-zinc-200">{t("categoryDetails")}</p>
                {attributeFields.map((field) => (
                  <div key={field.key} className="grid gap-2">
                    <label className="text-xs text-zinc-400">
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    <input className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none" placeholder={field.placeholder} value={attributes[field.key] ?? ""} onChange={(e) => handleAttributeChange(field.key, e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("wizard.publish")}</p>

            <div className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-400">{t("titleLabel")}</span><span className="font-medium text-zinc-100">{form.title || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-400">{t("selectedCategory")}</span><span className="font-medium text-zinc-100">{selectedCategoryLabel || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-400">{t("price")}</span><span className="font-medium text-zinc-100">{form.priceCents || "0"} CFA</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-400">{t("type")}</span><span className="font-medium text-zinc-100">{t(`types.${form.type.toLowerCase()}`)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-400">{t("photosCount")}</span><span className="font-medium text-zinc-100">{imageFiles.length || (form.imageUrl ? 1 : 0)}</span></div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
              <input type="checkbox" checked={form.requestBoost} onChange={(e) => handleChange("requestBoost")(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-zinc-900" />
              <div>
                <p className="text-sm font-semibold text-white">{t("boostRequest")}</p>
                <p className="text-[11px] text-zinc-400">{t("boostHint")}</p>
              </div>
            </div>
          </section>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {status === "success" && <p className="mt-4 text-sm text-emerald-300">{t("success")}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={previousStep} className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-white/40">
            {t("wizard.prev")}
          </button>
        )}

        {step < steps.length - 1 ? (
          <button type="button" onClick={nextStep} className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950">
            {t("wizard.next")}
          </button>
        ) : (
          <button type="submit" disabled={status === "loading" || !sellerReady} className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {status === "loading" ? t("loading") : t("submit")}
          </button>
        )}
      </div>
    </form>
  );
}






































