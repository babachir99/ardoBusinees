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
    <article className="group rounded-3xl border border-white/10 bg-zinc-900/70 p-5 transition hover:border-indigo-300/30 hover:bg-zinc-900/90">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">
            {trip.originCity} {"->"} {trip.destinationCity}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr" ? "Depart" : "Departure"}: {formatDateOnly(locale, trip.flightDate)}
          </p>
        </div>
        <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-medium text-cyan-100">
          {trip.availableKg} kg {locale === "fr" ? "dispo" : "available"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-300">
          {locale === "fr" ? "Tarif" : "Price"}{" "}
          <span className="text-base font-semibold text-emerald-200">
            {trip.pricePerKgCents} {tripCurrencyLabel}
          </span>
        </p>
        {trip.maxPackages && (
          <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-300">
            {locale === "fr" ? "Max colis" : "Max parcels"}: {trip.maxPackages}
          </span>
        )}
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
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100"
            >
              <span className="text-[10px]">{methodMeta.icon}</span>
              {locale === "fr" ? methodMeta.fr : methodMeta.en}
            </span>
          );
        })}
      </div>

      <div className="mt-4 border-t border-white/10 pt-3 text-xs text-zinc-400">
        <p>
          {locale === "fr" ? "Transporteur" : "Transporter"}: {trip.transporter.name ?? "-"}
        </p>
        <p className="mt-1 text-[11px] text-amber-200">
          * {trip.transporter.transporterRating.toFixed(1)} ({trip.transporter.transporterReviewCount})
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="[&>div]:!mt-0 [&>div]:contents [&_.text-zinc-500]:hidden [&_.text-emerald-300]:hidden [&_.text-rose-300]:hidden">
          <GpTripBookingForm
            tripId={trip.id}
            locale={locale}
            isLoggedIn={isLoggedIn}
            isOwner={isOwner}
            initialStatus={bookingStatus}
          />
        </div>
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
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
        >
          {locale === "fr" ? "Avis transporteur" : "Transporter reviews"}
        </Link>
      </div>
    </article>
  );
}
