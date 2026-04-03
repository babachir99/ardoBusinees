import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import SearchBar from "@/components/search/SearchBar";
import UserHeaderActions from "@/components/layout/UserHeaderActions";

type AppHeaderProps = {
  locale: string;
};

export default async function AppHeader({ locale }: AppHeaderProps) {
  const [categories, recentProducts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 24,
      select: { name: true, slug: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { title: true },
    }),
  ]);

  return (
    <header className="sticky top-3 z-40 px-4 pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-white/10 bg-zinc-950/72 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="JONTAADO logo"
              width={160}
              height={160}
              className="h-[54px] w-auto sm:h-[60px]"
              priority
            />
          </Link>

          <div className="min-w-0">
            <SearchBar
              locale={locale}
              compact
              categories={categories}
              suggestions={recentProducts.map((item) => item.title)}
              className="flex w-full items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-zinc-950/80 via-zinc-950/65 to-zinc-950/80 px-2 py-1.5 text-xs text-zinc-300 shadow-none"
            />
          </div>

          <UserHeaderActions
            locale={locale}
            className="flex items-center gap-2"
            showAdminLink={false}
            showCart={false}
            showNotificationsLink
            iconOnly
          />
        </div>
      </div>
    </header>
  );
}
