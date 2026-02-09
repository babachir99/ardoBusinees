import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import type { Prisma } from "@prisma/client";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const where: Prisma.ProductInquiryWhereInput = {
    OR: [
      { buyerId: session.user.id },
      ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : []),
    ],
  };

  const inquiries = await prisma.productInquiry.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 60,
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
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
        select: { id: true, displayName: true },
      },
      _count: {
        select: {
          messages: true,
          offers: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {isFr ? "Espace client" : "Customer area"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {isFr ? "Messagerie" : "Messages"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isFr
                ? "Ouvre une fiche produit puis clique sur Contacter le vendeur pour continuer l'echange."
                : "Open a product page and click Contact seller to continue the conversation."}
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
          >
            {isFr ? "Retour accueil" : "Back home"}
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-center text-zinc-400">
            {isFr ? "Aucune discussion pour le moment." : "No conversation yet."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {inquiries.map((item) => {
              const iamBuyer = item.buyerId === session.user.id;
              const counterpart = iamBuyer
                ? item.seller?.displayName || (isFr ? "Vendeur" : "Seller")
                : item.buyer?.name || item.buyer?.email || (isFr ? "Client" : "Customer");

              return (
                <Link
                  key={item.id}
                  href={`/shop/${item.product.slug}`}
                  className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4 transition hover:border-emerald-300/50"
                >
                  <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                      {item.product.images[0]?.url ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.images[0].alt ?? item.product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{item.product.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {isFr ? "Avec" : "With"}: {counterpart}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {isFr ? "Messages" : "Messages"}: {item._count.messages}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {isFr ? "Offres" : "Offers"}: {item._count.offers}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {item.status === "OPEN"
                            ? isFr
                              ? "Ouverte"
                              : "Open"
                            : isFr
                            ? "Fermee"
                            : "Closed"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {new Date(item.lastMessageAt).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
