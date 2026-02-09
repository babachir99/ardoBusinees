import ProductActionCardClient from "@/components/shop/ProductActionCardClient";

type PurchaseInfoPanelProps = {
  locale: string;
  productId: string;
  productType: "PREORDER" | "DROPSHIP" | "LOCAL";
  preorderLeadDays?: number | null;
  deliveryOptions?: string | null;
  pickupLocation?: string | null;
  sellerName?: string;
  sellerRating?: number | null;
  sellerAvatarUrl?: string | null;
  sellerProductsCount?: number;
  sellerPhoneHref?: string;
  sellerEmailHref?: string;
  sellerWhatsappHref?: string;
  buyHref?: string;
  isAuthenticated?: boolean;
  isSellerOwner?: boolean;
};

export default function PurchaseInfoPanel({
  locale,
  productId,
  productType,
  preorderLeadDays,
  deliveryOptions,
  pickupLocation,
  sellerName,
  sellerRating,
  sellerAvatarUrl,
  sellerProductsCount,
  sellerPhoneHref,
  sellerEmailHref,
  sellerWhatsappHref,
  buyHref,
  isAuthenticated,
  isSellerOwner,
}: PurchaseInfoPanelProps) {
  const isFr = locale === "fr";
  const leadDays = preorderLeadDays ?? 14;

  const deliveryLabel =
    productType === "PREORDER"
      ? isFr
        ? `Precommande: ${leadDays} jours estimes`
        : `Preorder: around ${leadDays} days`
      : productType === "LOCAL"
      ? isFr
        ? "Disponible localement"
        : "Available locally"
      : isFr
      ? "Dropshipping 7 a 15 jours"
      : "Dropshipping 7 to 15 days";

  const deliveryDetail =
    productType === "LOCAL"
      ? deliveryOptions ||
        (isFr
          ? "Retrait ou livraison selon la zone"
          : "Pickup or local delivery depending on area")
      : isFr
      ? "Suivi de commande mis a jour en temps reel"
      : "Order tracking updated in real time";

  const sellerDisplay = sellerName || (isFr ? "Vendeur" : "Seller");
  const ratingValue =
    sellerRating && Number.isFinite(sellerRating)
      ? sellerRating.toFixed(1)
      : isFr
      ? "Nouveau"
      : "New";

  const sellerCountLabel = isFr
    ? `${sellerProductsCount ?? 0} annonces actives`
    : `${sellerProductsCount ?? 0} active listings`;

  const responseLabel =
    sellerRating && sellerRating >= 4.7
      ? isFr
        ? "Reponse rapide"
        : "Fast response"
      : isFr
      ? "Reponse standard"
      : "Standard response";

  const trustLabel =
    sellerRating && sellerRating >= 4.7
      ? isFr
        ? "Fiabilite elevee"
        : "High reliability"
      : isFr
      ? "Fiabilite en progression"
      : "Growing reliability";

  return (
    <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/70 p-5 md:p-6 fade-up">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
            {sellerAvatarUrl ? (
              <img
                src={sellerAvatarUrl}
                alt={sellerDisplay}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl font-semibold text-zinc-200">
                {sellerDisplay.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white">{sellerDisplay}</p>
            <p className="text-sm text-zinc-300">
              {isFr ? "Note" : "Rating"} {ratingValue}
            </p>
            <p className="text-xs text-zinc-400">{sellerCountLabel}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-center text-emerald-200">
            {responseLabel}
          </span>
          <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-center text-sky-200">
            {trustLabel}
          </span>
        </div>

        <ProductActionCardClient
          locale={locale}
          productId={productId}
          buyHref={buyHref ?? "#purchase-actions"}
          isAuthenticated={Boolean(isAuthenticated)}
          isSellerOwner={Boolean(isSellerOwner)}
          sellerPhoneHref={sellerPhoneHref}
          sellerEmailHref={sellerEmailHref}
          sellerWhatsappHref={sellerWhatsappHref}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {isFr ? "Protection achat" : "Buyer protection"}
        </p>
        <ul className="mt-3 space-y-2 text-xs text-zinc-300">
          <li className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
            {isFr ? "Paiement securise sur la plateforme" : "Secure payment handled on platform"}
          </li>
          <li className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
            {isFr ? "Messagerie interne pour preuve des echanges" : "Internal messaging for clear conversation history"}
          </li>
          <li className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
            {isFr ? "Support en cas de litige" : "Support available in case of dispute"}
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {isFr ? "Livraison" : "Delivery"}
        </p>
        <p className="mt-2 text-sm font-semibold text-white">{deliveryLabel}</p>
        <p className="mt-1 text-xs text-zinc-400">{deliveryDetail}</p>
        {pickupLocation && (
          <p className="mt-3 text-xs text-zinc-300">
            {isFr ? "Retrait" : "Pickup"}: {pickupLocation}
          </p>
        )}
      </div>
    </aside>
  );
}
