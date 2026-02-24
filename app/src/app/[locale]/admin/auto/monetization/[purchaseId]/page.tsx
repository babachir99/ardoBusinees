import { getServerSession } from "next-auth";
import { forbidden, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import PrintButton from "@/components/immo/PrintButton";
import { hasAnyUserRole } from "@/lib/userRoles";

type Params = {
  locale: string;
  purchaseId: string;
};

export default async function AdminAutoReceiptPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, purchaseId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user || !hasAnyUserRole(session.user, ["ADMIN"])) {
    forbidden();
  }

  const purchase = await prisma.autoMonetizationPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      createdAt: true,
      kind: true,
      status: true,
      amountCents: true,
      currency: true,
      listingId: true,
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
          provider: true,
          providerIntentId: true,
          contextId: true,
          contextType: true,
        },
      },
    },
  });

  if (!purchase) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-3xl">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 print:border-zinc-700 print:bg-white print:text-zinc-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Link href="/admin/auto/monetization" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
              {locale === "fr" ? "Retour" : "Back"}
            </Link>
            <PrintButton
              label={locale === "fr" ? "Imprimer" : "Print"}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white"
            />
          </div>

          <h1 className="text-2xl font-semibold">{locale === "fr" ? "Recu monetization AUTO" : "AUTO monetization receipt"}</h1>
          <p className="mt-1 text-xs text-zinc-400 print:text-zinc-600">{purchase.id}</p>

          <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">{locale === "fr" ? "Date" : "Date"}</p>
              <p>{purchase.createdAt.toLocaleString(locale)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">Kind</p>
              <p>{purchase.kind}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">{locale === "fr" ? "Statut" : "Status"}</p>
              <p>{purchase.status}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">{locale === "fr" ? "Montant" : "Amount"}</p>
              <p>{formatMoney(purchase.amountCents, purchase.currency, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">Publisher</p>
              <p>{purchase.publisher.name} ({purchase.publisher.slug}){purchase.publisher.verified ? " - verified" : ""}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">Listing ID</p>
              <p>{purchase.listingId ?? "-"}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4 text-sm print:border-zinc-300">
            <h2 className="text-base font-semibold">Ledger</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">ID:</span> {purchase.paymentLedger.id}</p>
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">Status:</span> {purchase.paymentLedger.status}</p>
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">Provider:</span> {purchase.paymentLedger.provider}</p>
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">Reference:</span> {purchase.paymentLedger.providerIntentId ?? "-"}</p>
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">Context:</span> {purchase.paymentLedger.contextType}</p>
              <p><span className="text-xs text-zinc-400 print:text-zinc-600">Context ID:</span> {purchase.paymentLedger.contextId}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
