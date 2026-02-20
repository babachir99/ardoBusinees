import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type SearchParams = {
  status?: string;
  kind?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  take?: string;
};

const STATUS_VALUES = ["PENDING", "CONFIRMED", "FAILED", "EXPIRED"] as const;
const KIND_VALUES = [
  "FEATURED",
  "BOOST",
  "BOOST_PACK_10",
  "FEATURED_PACK_4",
  "EXTRA_SLOTS_10",
] as const;

function parseDateStart(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseDateEnd(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeTake(value: string | undefined) {
  const parsed = Number(value ?? "80");
  if (!Number.isFinite(parsed)) return 80;
  return Math.min(Math.max(Math.trunc(parsed), 10), 200);
}

export default async function AdminImmoMonetizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect(`/${locale}/admin`);
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const status = STATUS_VALUES.includes((query.status ?? "") as (typeof STATUS_VALUES)[number])
    ? (query.status as (typeof STATUS_VALUES)[number])
    : "";

  const kind = KIND_VALUES.includes((query.kind ?? "") as (typeof KIND_VALUES)[number])
    ? (query.kind as (typeof KIND_VALUES)[number])
    : "";

  const publisherId = (query.publisherId ?? "").trim();
  const from = parseDateStart(query.from) ?? defaultFrom;
  const to = parseDateEnd(query.to);
  const take = normalizeTake(query.take);

  const where: {
    status?: (typeof STATUS_VALUES)[number];
    kind?: (typeof KIND_VALUES)[number];
    publisherId?: string;
    createdAt: { gte?: Date; lte?: Date };
  } = {
    createdAt: {
      gte: from,
      ...(to ? { lte: to } : {}),
    },
  };

  if (status) where.status = status;
  if (kind) where.kind = kind;
  if (publisherId) where.publisherId = publisherId;

  const purchases = await prisma.immoMonetizationPurchase.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      listingId: true,
      publisherId: true,
      kind: true,
      status: true,
      amountCents: true,
      currency: true,
      createdAt: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
        },
      },
      paymentLedger: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const t = {
    title: locale === "fr" ? "IMMO monetization ops" : "IMMO monetization ops",
    subtitle:
      locale === "fr"
        ? "Suivi des achats IMMO sur 30 jours (ou plage filtree)."
        : "IMMO purchases over the last 30 days (or filtered range).",
    back: locale === "fr" ? "Retour admin" : "Back to admin",
    status: locale === "fr" ? "Statut" : "Status",
    kind: locale === "fr" ? "Type" : "Kind",
    publisherId: locale === "fr" ? "Publisher ID" : "Publisher ID",
    from: locale === "fr" ? "Du" : "From",
    to: locale === "fr" ? "Au" : "To",
    take: locale === "fr" ? "Limite" : "Limit",
    apply: locale === "fr" ? "Filtrer" : "Filter",
    tableDate: locale === "fr" ? "Date" : "Date",
    tableKind: locale === "fr" ? "Type" : "Kind",
    tableStatus: locale === "fr" ? "Statut" : "Status",
    tableAmount: locale === "fr" ? "Montant" : "Amount",
    tablePublisher: locale === "fr" ? "Agence" : "Publisher",
    tableListing: locale === "fr" ? "Listing" : "Listing",
    tableLedger: locale === "fr" ? "Ledger" : "Ledger",
    tableActions: locale === "fr" ? "Actions" : "Actions",
    empty: locale === "fr" ? "Aucun achat pour ces filtres." : "No purchases for current filters.",
    openOps: locale === "fr" ? "Voir Ops" : "Open ops",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
              <p className="mt-1 text-sm text-zinc-300">{t.subtitle}</p>
            </div>
            <Link href="/admin" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
              {t.back}
            </Link>
          </div>

          <form className="mt-5 grid gap-2 md:grid-cols-6">
            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
            >
              <option value="">{t.status}</option>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              name="kind"
              defaultValue={kind}
              className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
            >
              <option value="">{t.kind}</option>
              {KIND_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              name="publisherId"
              defaultValue={publisherId}
              placeholder={t.publisherId}
              className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
            />
            <input
              type="date"
              name="from"
              defaultValue={query.from ?? ""}
              className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
              aria-label={t.from}
            />
            <input
              type="date"
              name="to"
              defaultValue={query.to ?? ""}
              className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
              aria-label={t.to}
            />
            <div className="flex gap-2">
              <input
                name="take"
                defaultValue={String(take)}
                className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs"
                aria-label={t.take}
              />
              <button className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950">
                {t.apply}
              </button>
            </div>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-zinc-400">
                <tr>
                  <th className="px-3 py-2">{t.tableDate}</th>
                  <th className="px-3 py-2">{t.tableKind}</th>
                  <th className="px-3 py-2">{t.tableStatus}</th>
                  <th className="px-3 py-2">{t.tableAmount}</th>
                  <th className="px-3 py-2">{t.tablePublisher}</th>
                  <th className="px-3 py-2">{t.tableListing}</th>
                  <th className="px-3 py-2">{t.tableLedger}</th>
                  <th className="px-3 py-2 text-right">{t.tableActions}</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-zinc-400" colSpan={8}>
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-t border-white/10">
                      <td className="px-3 py-2 text-zinc-300">{purchase.createdAt.toLocaleString(locale)}</td>
                      <td className="px-3 py-2 text-white">{purchase.kind}</td>
                      <td className="px-3 py-2 text-zinc-200">{purchase.status}</td>
                      <td className="px-3 py-2 text-emerald-200">{formatMoney(purchase.amountCents, purchase.currency, locale)}</td>
                      <td className="px-3 py-2 text-zinc-300">
                        {purchase.publisher.name}
                        {purchase.publisher.verified ? " - verified" : ""}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{purchase.listingId ?? "-"}</td>
                      <td className="px-3 py-2 text-zinc-300">{purchase.paymentLedger.status}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={{ pathname: "/admin", query: { opsFilter: "IMMO_MONETIZATION", focus: purchase.id } }}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white"
                          >
                            {t.openOps}
                          </Link>
                          <Link
                            href={`/admin/immo/monetization/${purchase.id}`}
                            className="rounded-full border border-emerald-300/40 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                          >
                            {locale === "fr" ? "Recu" : "Receipt"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
