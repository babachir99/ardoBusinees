import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import InquiryChatThread from "@/components/messages/InquiryChatThread";
import InquiryOffersPanel from "@/components/messages/InquiryOffersPanel";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";
import { parseMessageBody } from "@/lib/message-attachments";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isFr = locale === "fr";
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const where =
    session.user.role === "ADMIN"
      ? { id }
      : {
          id,
          OR: [{ buyerId: session.user.id }, { seller: { userId: session.user.id } }],
        };

  const inquiry = await prisma.productInquiry.findFirst({
    where,
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          currency: true,
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { url: true, alt: true },
          },
        },
      },
      buyer: {
        select: { id: true, name: true, email: true },
      },
      seller: {
        select: { id: true, displayName: true, userId: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      offers: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { offers: true, messages: true } },
    },
  });

  if (!inquiry) {
    notFound();
  }

  if (session.user.role !== "ADMIN") {
    const readUpdate =
      inquiry.buyerId === session.user.id
        ? getInquiryReadTrackingUpdate("buyer", new Date())
        : inquiry.seller?.userId === session.user.id
        ? getInquiryReadTrackingUpdate("seller", new Date())
        : {};

    if (Object.keys(readUpdate).length > 0) {
      await prisma.productInquiry.update({
        where: { id: inquiry.id },
        data: readUpdate,
      });
    }
  }

  const iAmBuyer = inquiry.buyerId === session.user.id;
  const counterpart = iAmBuyer
    ? inquiry.seller?.displayName || (isFr ? "Vendeur" : "Seller")
    : inquiry.buyer?.name || inquiry.buyer?.email || (isFr ? "Client" : "Customer");

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {isFr ? "Messagerie" : "Messages"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{inquiry.product.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isFr ? "Discussion avec" : "Conversation with"}: {counterpart}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/messages"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
            >
              {isFr ? "Retour messagerie" : "Back to inbox"}
            </Link>
            <Link
              href={`/shop/${inquiry.product.slug}`}
              className="rounded-full border border-emerald-300/40 px-4 py-2 text-sm text-emerald-200 transition hover:border-emerald-300/70"
            >
              {isFr ? "Voir le produit" : "View product"}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <InquiryChatThread
            locale={locale}
            inquiryId={inquiry.id}
            meId={session.user.id}
            initialMessages={inquiry.messages.map((message) => {
              const parsed = parseMessageBody(message.body);
              return {
                id: message.id,
                body: parsed.body,
                attachmentUrl: parsed.attachmentUrl,
                createdAt: message.createdAt.toISOString(),
                senderId: message.senderId,
                sender: message.sender,
              };
            })}
          />

          <div className="space-y-6">
            <aside className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                {inquiry.product.images[0]?.url ? (
                  <img
                    src={inquiry.product.images[0].url}
                    alt={inquiry.product.images[0].alt ?? inquiry.product.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-44 place-items-center text-xs text-zinc-500">
                    {isFr ? "Image indisponible" : "Image unavailable"}
                  </div>
                )}
              </div>

              <p className="mt-4 text-sm font-semibold text-white">{inquiry.product.title}</p>

              <div className="mt-3 space-y-2 text-xs text-zinc-400">
                <p>
                  {isFr ? "Messages" : "Messages"}: {inquiry._count.messages}
                </p>
                <p>
                  {isFr ? "Offres" : "Offers"}: {inquiry._count.offers}
                </p>
                <p>
                  {isFr ? "Statut" : "Status"}: {inquiry.status === "OPEN" ? (isFr ? "Ouverte" : "Open") : isFr ? "Fermee" : "Closed"}
                </p>
                <p>
                  {isFr ? "Derniere activite" : "Last activity"}: {new Date(inquiry.lastMessageAt).toLocaleString(locale)}
                </p>
              </div>
            </aside>

            <InquiryOffersPanel
              locale={locale}
              inquiryId={inquiry.id}
              meId={session.user.id}
              isSeller={inquiry.seller?.userId === session.user.id}
              product={{
                id: inquiry.product.id,
                slug: inquiry.product.slug,
                title: inquiry.product.title,
                type: inquiry.product.type,
                currency: inquiry.product.currency,
              }}
              sellerName={inquiry.seller?.displayName}
              initialOffers={inquiry.offers.map((offer) => ({
                id: offer.id,
                amountCents: offer.amountCents,
                currency: offer.currency,
                quantity: offer.quantity,
                note: offer.note,
                status: offer.status,
                createdAt: offer.createdAt.toISOString(),
                resolvedAt: offer.resolvedAt ? offer.resolvedAt.toISOString() : null,
                buyerId: offer.buyerId,
                buyer: offer.buyer,
              }))}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
