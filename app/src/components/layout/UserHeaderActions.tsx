import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/lib/auth";
import { getInboxUnreadCount } from "@/lib/inboxCount";
import CartHeaderButton from "@/components/cart/CartHeaderButton";
import SignOutIconButton from "@/components/auth/SignOutIconButton";

type UserHeaderActionsProps = {
  locale: string;
  className?: string;
  showSellerLink?: boolean;
  showAdminLink?: boolean;
  sellerHref?: string;
};

export default async function UserHeaderActions({
  locale,
  className,
  showSellerLink = false,
  showAdminLink = true,
  sellerHref = "/seller",
}: UserHeaderActionsProps) {
  const session = await getServerSession(authOptions);
  const inboxCount = session?.user?.id
    ? await getInboxUnreadCount(session.user.id)
    : 0;
  const profileInitial = (
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    "?"
  )
    .slice(0, 1)
    .toUpperCase();

  const loginLabel =
    locale === "fr" ? "Se connecter / S'inscrire" : "Sign in / Sign up";
  const profileLabel = locale === "fr" ? "Profil" : "Profile";
  const inboxLabel = locale === "fr" ? "Messagerie" : "Messages";
  const sellLabel = locale === "fr" ? "Vendre" : "Sell";
  const cartLabel = locale === "fr" ? "Panier" : "Cart";

  return (
    <div className={className ?? "flex items-center gap-2 text-sm"}>
      {showAdminLink && session?.user?.role === "ADMIN" && (
        <Link
          href="/admin"
          className="rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/70"
        >
          Admin
        </Link>
      )}

      {showSellerLink && (
        <Link
          href={sellerHref}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-white/50 hover:text-white"
        >
          {sellLabel}
        </Link>
      )}

      {session && (
        <Link
          href="/messages"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900/70 text-base text-zinc-100 transition hover:border-white/50"
          aria-label={inboxLabel}
          title={inboxLabel}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
          >
            <path d="M7 10h10M7 14h6" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M21 11.5c0 5-4 8.5-9 8.5-1.5 0-3-.3-4.2-.9L3 20l1.1-3.8C3.4 14.8 3 13.2 3 11.5 3 6.5 7 3 12 3s9 3.5 9 8.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {inboxCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-emerald-400 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-zinc-950">
              {inboxCount > 99 ? "99+" : inboxCount}
            </span>
          )}
        </Link>
      )}

      <CartHeaderButton label={cartLabel} />

      {session ? (
        <Link
          href="/profile"
          className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-400 text-xs font-semibold text-zinc-950"
          aria-label={profileLabel}
          title={profileLabel}
        >
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? profileLabel}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{profileInitial}</span>
          )}
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {loginLabel}
        </Link>
      )}

      {session && <SignOutIconButton />}
    </div>
  );
}
