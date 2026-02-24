import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import AutoMyDashboard from "@/components/auto/AutoMyDashboard";

export default async function AutoMyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/auto/my`);
  }

  const [listings, dealerMemberships] = await Promise.all([
    prisma.autoListing.findMany({
      where: { ownerId: session.user.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        currency: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        mileageKm: true,
        fuelType: true,
        gearbox: true,
        status: true,
        isFeatured: true,
        featuredUntil: true,
        boostUntil: true,
        createdAt: true,
        updatedAt: true,
        publisherId: true,
        publisher: {
          select: {
            id: true,
            name: true,
            slug: true,
            verified: true,
            city: true,
            country: true,
            logoUrl: true,
          },
        },
      },
    }),
    prisma.autoPublisherMember.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        publisher: {
          status: "ACTIVE",
          type: "DEALER",
        },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        role: true,
        publisher: {
          select: {
            id: true,
            name: true,
            slug: true,
            verified: true,
            city: true,
            country: true,
            logoUrl: true,
            includedPublishedQuota: true,
            extraSlots: true,
            monetizationBalance: {
              select: {
                boostCredits: true,
                featuredCredits: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const dealerIds = dealerMemberships.map((item) => item.publisher.id);
  const listingIds = listings.map((item) => item.id);

  const [recentPurchases, publishedCounts] = await Promise.all([
    dealerIds.length || listingIds.length
      ? prisma.autoMonetizationPurchase.findMany({
          where: {
            OR: [
              ...(dealerIds.length ? [{ publisherId: { in: dealerIds } }] : []),
              ...(listingIds.length ? [{ listingId: { in: listingIds } }] : []),
            ],
          },
          orderBy: [{ createdAt: "desc" }],
          take: 120,
          select: {
            id: true,
            listingId: true,
            publisherId: true,
            kind: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    dealerIds.length
      ? prisma.autoListing.groupBy({
          by: ["publisherId"],
          where: {
            publisherId: { in: dealerIds },
            status: "PUBLISHED",
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const publishedCountByPublisher = new Map(
    publishedCounts.map((item) => [item.publisherId ?? "", item._count._all])
  );

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex gap-3">
          <Link href="/auto" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
            {locale === "fr" ? "Voir les annonces" : "View listings"}
          </Link>
          <Link href="/auto/dealers" className="rounded-full border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-200">
            {locale === "fr" ? "Concessionnaires" : "Dealers"}
          </Link>
        </div>

        <AutoMyDashboard
          locale={locale}
          listings={listings.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            featuredUntil: item.featuredUntil?.toISOString() ?? null,
            boostUntil: item.boostUntil?.toISOString() ?? null,
          }))}
          recentPurchases={recentPurchases.map((item) => ({
            id: item.id,
            listingId: item.listingId,
            publisherId: item.publisherId,
            kind: item.kind,
            status: item.status,
            createdAt: item.createdAt.toISOString(),
          }))}
          dealers={dealerMemberships.map((item) => ({
            id: item.publisher.id,
            name: item.publisher.name,
            slug: item.publisher.slug,
            verified: item.publisher.verified,
            city: item.publisher.city,
            country: item.publisher.country,
            logoUrl: item.publisher.logoUrl,
            role: item.role,
            includedPublishedQuota: item.publisher.includedPublishedQuota,
            extraSlots: item.publisher.extraSlots,
            usedPublishedCount: publishedCountByPublisher.get(item.publisher.id) ?? 0,
            boostCredits: item.publisher.monetizationBalance?.boostCredits ?? 0,
            featuredCredits: item.publisher.monetizationBalance?.featuredCredits ?? 0,
          }))}
        />
      </main>
    </div>
  );
}
