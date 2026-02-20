import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import ImmoMyDashboard from "@/components/immo/ImmoMyDashboard";
import { hasAnyUserRole } from "@/lib/userRoles";

export default async function ImmoMyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/immo/my`);
  }

  const listings = await prisma.immoListing.findMany({
    where: { ownerId: session.user.id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      imageUrls: true,
      status: true,
      isFeatured: true,
      featuredUntil: true,
      boostUntil: true,
      publisherId: true,
      createdAt: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
        },
      },
    },
  });

  const agencies = await prisma.immoPublisherMember.findMany({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      publisher: {
        status: "ACTIVE",
        type: "AGENCY",
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
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
  });

  const agencyIds = agencies.map((item) => item.publisher.id);
  const listingIds = listings.map((item) => item.id);
  const recentPurchases = agencyIds.length || listingIds.length
    ? await prisma.immoMonetizationPurchase.findMany({
        where: {
          OR: [
            ...(agencyIds.length ? [{ publisherId: { in: agencyIds } }] : []),
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
    : [];

  const publishedCounts = agencyIds.length
    ? await prisma.immoListing.groupBy({
        by: ["publisherId"],
        where: {
          publisherId: { in: agencyIds },
          status: "PUBLISHED",
        },
        _count: {
          _all: true,
        },
      })
    : [];

  const publishedCountByPublisher = new Map(
    publishedCounts.map((item) => [item.publisherId ?? "", item._count._all])
  );

  const canPublish = hasAnyUserRole(session.user, ["SELLER", "IMMO_AGENT", "ADMIN"]);

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex gap-3">
          <Link href="/immo" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
            {locale === "fr" ? "Voir les annonces" : "View listings"}
          </Link>
        </div>

        {!canPublish ? (
          <div className="mb-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">
            {locale === "fr"
              ? "Publication reservee aux roles SELLER ou IMMO_AGENT."
              : "Publishing requires SELLER or IMMO_AGENT role."}
          </div>
        ) : null}

        <ImmoMyDashboard
          locale={locale}
          listings={listings.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
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
          agencies={agencies.map((item) => ({
            id: item.publisher.id,
            name: item.publisher.name,
            slug: item.publisher.slug,
            verified: item.publisher.verified,
            city: item.publisher.city,
            country: item.publisher.country,
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
