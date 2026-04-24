import Image from "next/image";
import { Link } from "@/i18n/navigation";
import SearchBar from "@/components/search/SearchBar";
import UserHeaderActions from "@/components/layout/UserHeaderActions";
import { authOptions } from "@/lib/auth";
import { getHeaderSearchSnapshot } from "@/lib/catalogSnapshots";
import { getServerSession } from "next-auth";

type AppHeaderProps = {
  locale: string;
  containerClassName?: string;
};

export default async function AppHeader({
  locale,
  containerClassName = "max-w-7xl",
}: AppHeaderProps) {
  const [{ categories, recentProducts }, session] = await Promise.all([
    getHeaderSearchSnapshot(),
    getServerSession(authOptions),
  ]);

  return (
    <header className="fixed left-0 top-0 z-50 w-full box-border bg-transparent pt-3">
      <div className={`mx-auto w-full px-4 sm:px-6 ${containerClassName}`}>
        <div className="flex w-full items-center gap-3 rounded-[1.5rem] border border-white/10 bg-[rgba(15,15,15,0.5)] px-3 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-md sm:gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="JONTAADO logo"
              width={160}
              height={160}
              className="h-[48px] w-auto sm:h-[54px]"
              priority
            />
          </Link>

          <div className="min-w-0 flex-1">
            <SearchBar
              locale={locale}
              compact
              categories={categories}
              suggestions={recentProducts.map((item) => item.title)}
              className="mx-auto w-full max-w-[500px]"
              targetPath="/shop"
              autoNavigateOnFilters={false}
              clearNavigates={false}
              storageScope={session?.user?.id ?? null}
            />
          </div>

          <UserHeaderActions
            locale={locale}
            className="flex items-center gap-2.5 sm:gap-3"
            showAdminLink={false}
            showCart={false}
            showNotificationsLink
            iconOnly
            showInboxCount={false}
          />
        </div>
      </div>
    </header>
  );
}
