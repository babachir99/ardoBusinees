import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import CarsMyDashboard from "@/components/cars/CarsMyDashboard";

export default async function CarsMyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/cars/my`);
  }

  const [listings, dealerMemberships] = await Promise.all([
    prisma.carListing.findMany({
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
    prisma.carPublisherMember.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        publisher: { status: "ACTIVE", type: "DEALER" },
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
          },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex gap-3">
          <Link href="/cars" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
            {locale === "fr" ? "Voir les annonces" : "View listings"}
          </Link>
          <Link href="/cars/dealers" className="rounded-full border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-200">
            {locale === "fr" ? "Concessionnaires" : "Dealers"}
          </Link>
        </div>

        <CarsMyDashboard
          locale={locale}
          listings={listings.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))}
          dealers={dealerMemberships.map((item) => ({
            id: item.publisher.id,
            name: item.publisher.name,
            slug: item.publisher.slug,
            verified: item.publisher.verified,
            city: item.publisher.city,
            country: item.publisher.country,
            role: item.role,
          }))}
        />
      </main>
    </div>
  );
}
