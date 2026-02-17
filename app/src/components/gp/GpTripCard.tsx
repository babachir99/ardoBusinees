import { Link } from "@/i18n/navigation";
import GpTripBookingForm from "@/components/gp/GpTripBookingForm";
import GpTripDetailsPopover from "@/components/gp/GpTripDetailsPopover";

type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";

type TripCardTrip = {
  id: string;
  transporterId: string;
  originCity: string;
  destinationCity: string;
  originAddress: string;
  destinationAddress: string;
  flightDate: Date;
  deliveryStartAt: Date | null;
  deliveryEndAt: Date | null;
  availableKg: number;
  pricePerKgCents: number;
  currency: string;
  maxPackages: number | null;
  notes: string | null;
  acceptedPaymentMethods: PaymentMethod[];
  transporter: {
    id: string;
    name: string | null;
    transporterRating: number;
    transporterReviewCount: number;
  };
};

type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "ACCEPTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "DELIVERED"
  | "CANCELED"
  | "REJECTED";

type GpTripCardProps = {
  locale: string;
  trip: TripCardTrip;
  bookingStatus: BookingStatus | null;
  isLoggedIn: boolean;
  viewerUserId?: string;
};

const paymentMethodMeta: Record<string, { fr: string; en: string; icon: string }> = {
  WAVE: { fr: "Wave", en: "Wave", icon: "W" },
  ORANGE_MONEY: { fr: "Orange Money", en: "Orange Money", icon: "OM" },
  CARD: { fr: "Carte", en: "Card", icon: "CARD" },
  CASH: { fr: "Especes", en: "Cash", icon: "CASH" },
};

const currencyLabelMap: Record<string, string> = {
  XOF: "FCFA",
  EUR: "EUR",
  USD: "$",
};

function formatDateOnly(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

function formatDateTime(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default function GpTripCard({
  locale,
  trip,
  bookingStatus,
  isLoggedIn,
  viewerUserId,
}: GpTripCardProps) {
  const tripCurrencyLabel = currencyLabelMap[trip.currency] ?? "FCFA";
  const isOwner = viewerUserId === trip.transporterId;

  return (
    <article className="group relative rounded-3xl border border-white/12 bg-gradient-to-br from-zinc-900/90 via-zinc-900/78 to-slate-950/82 p-5 shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_18px_42px_rgba(8,145,178,0.2)] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="space-y-3">
        <div className="mt-0.5 flex items-center gap-3 text-base tracking-tight text-white">
          <span className="flex-1 break-words text-base font-bold leading-tight text-zinc-50 drop-shadow-[0_1px_8px_rgba(255,255,255,0.08)] transition-colors duration-200 group-hover:text-white sm:text-lg">{trip.originCity}</span>
          <span className="relative flex min-w-[96px] max-w-[128px] flex-1 items-center justify-center" aria-hidden>
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-cyan-300/25 via-cyan-200/70 to-cyan-300/25 opacity-70 transition-all duration-300 group-hover:opacity-100 group-hover:via-cyan-100 group-focus-within:opacity-100 motion-reduce:transition-none" />
            <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 border-t border-dotted border-cyan-100/35 transition-colors duration-300 group-hover:border-cyan-100/60 motion-reduce:transition-none" />
            <span className="relative z-[1] rounded-full bg-zinc-900/85 p-1.5 ring-1 ring-cyan-200/20">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-cyan-100 drop-shadow-[0_0_8px_rgba(103,232,249,0.45)] transition-transform duration-300 group-hover:translate-x-[3px] group-focus-within:translate-x-[3px] motion-reduce:transform-none motion-reduce:transition-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label={locale === "fr" ? "Itineraire" : "Route"}
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </span>
          </span>
          <span className="flex-1 break-words text-right text-base font-bold leading-tight text-zinc-50 drop-shadow-[0_1px_8px_rgba(255,255,255,0.08)] transition-colors duration-200 group-hover:text-white sm:text-lg">{trip.destinationCity}</span>
        </div>

        <p className="text-xs text-zinc-400">
          {locale === "fr" ? "Depart" : "Departure"}: {formatDateOnly(locale, trip.flightDate)}
        </p>

        <div className="flex items-center gap-2 max-[340px]:flex-wrap">
          <span className="shrink-0 rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition-all duration-200 group-hover:border-cyan-300/60 group-hover:bg-cyan-300/16 motion-reduce:transition-none">
            {trip.availableKg} kg {locale === "fr" ? "dispo" : "available"}
          </span>
          {trip.maxPackages ? (
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition-all duration-200 hover:border-cyan-200/40 hover:bg-white/10 motion-reduce:transition-none">
              {locale === "fr" ? "Max colis" : "Max parcels"}: {trip.maxPackages}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="text-xl font-bold tracking-tight text-emerald-200 md:text-2xl">
          {trip.pricePerKgCents} {tripCurrencyLabel}
          <span className="ml-1 text-sm font-semibold text-emerald-100/90">/ kg</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {trip.acceptedPaymentMethods.map((method) => {
          const methodMeta = paymentMethodMeta[method] ?? {
            fr: method,
            en: method,
            icon: "?",
          };

          return (
            <span
              key={method}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100 transition-all duration-200 hover:border-cyan-300/60 hover:bg-cyan-300/16 motion-reduce:transition-none"
            >
              <span className="text-[10px] opacity-90">{methodMeta.icon}</span>
              {locale === "fr" ? methodMeta.fr : methodMeta.en}
            </span>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/10 pt-3 text-xs text-zinc-300">
        <p className="truncate">
          {locale === "fr" ? "Transporteur" : "Transporter"}: {trip.transporter.name ?? "-"}
        </p>
        <p className="mt-1 text-[11px] text-amber-200">
          {"\u2605"} {trip.transporter.transporterRating.toFixed(1)} ({trip.transporter.transporterReviewCount} {locale === "fr" ? "avis" : "reviews"})
        </p>
      </div>

      <GpTripBookingForm
        tripId={trip.id}
        locale={locale}
        isLoggedIn={isLoggedIn}
        isOwner={isOwner}
        initialStatus={bookingStatus}
        actionRowClassName="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        secondaryActions={
          <>
            <GpTripDetailsPopover
              locale={locale}
              originAddress={trip.originAddress}
              destinationAddress={trip.destinationAddress}
              arrivalDate={trip.deliveryEndAt ? formatDateOnly(locale, trip.deliveryEndAt) : null}
              deliveryStart={trip.deliveryStartAt ? formatDateTime(locale, trip.deliveryStartAt) : null}
              notes={trip.notes}
            />
            <Link
              href={`/transporters/${trip.transporter.id}`}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-cyan-300/60 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label={locale === "fr" ? "Voir les avis du transporteur" : "View transporter reviews"}
            >
              {locale === "fr" ? "Avis" : "Reviews"}
            </Link>
          </>
        }
      />
    </article>
  );
}





