/* eslint-disable @next/next/no-img-element */

import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInboxUnreadCount } from "@/lib/inboxCount";
import CartHeaderButton from "@/components/cart/CartHeaderButton";
import SignOutIconButton from "@/components/auth/SignOutIconButton";

type UserHeaderActionsProps = {
  locale: string;
  className?: string;
  showSellerLink?: boolean;
  showAdminLink?: boolean;
  showAdminTodoCount?: boolean;
  sellerHref?: string;
  showCart?: boolean;
  showNotificationsLink?: boolean;
  iconOnly?: boolean;
  showInboxCount?: boolean;
};

export default async function UserHeaderActions({
  locale,
  className,
  showSellerLink = false,
  showAdminLink = true,
  showAdminTodoCount = true,
  sellerHref = "/seller",
  showCart = true,
  showNotificationsLink = false,
  iconOnly = false,
  showInboxCount = true,
}: UserHeaderActionsProps) {
  const session = await getServerSession(authOptions);
  const inboxCount = session?.user?.id && showInboxCount
    ? await getInboxUnreadCount(session.user.id)
    : 0;

  let adminTodoCount = 0;
  if (showAdminLink && showAdminTodoCount && session?.user?.role === "ADMIN") {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const [pendingKyc, openDisputes, failedPayments7d, trustReportsPending, trustDisputesActive] =
      await Promise.all([
        prisma.kycSubmission.count({ where: { status: "PENDING" } }).catch(() => 0),
        prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }).catch(() => 0),
        prisma.paymentLedger
          .count({ where: { status: "FAILED", createdAt: { gte: last7Days } } })
          .catch(() => 0),
        prisma.report.count({ where: { status: "PENDING" } }).catch(() => 0),
        prisma.trustDispute
          .count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } })
          .catch(() => 0),
      ]);

    adminTodoCount =
      pendingKyc +
      openDisputes +
      failedPayments7d +
      trustReportsPending +
      trustDisputesActive;
  }

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
  const notificationsLabel = locale === "fr" ? "Notifications" : "Notifications";
  const sellLabel = locale === "fr" ? "Vendre" : "Sell";
  const cartLabel = locale === "fr" ? "Panier" : "Cart";
  const logoutLabel = locale === "fr" ? "Se deconnecter" : "Sign out";
  const iconButtonClass = iconOnly
    ? "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-base text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-emerald-300/35 hover:bg-white/10 hover:text-white"
    : "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900/70 text-base text-zinc-100 transition hover:border-white/50";
  const profileButtonClass = iconOnly
    ? "inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-emerald-300/20 bg-emerald-400/90 text-xs font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-emerald-300"
    : "inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-400 text-xs font-semibold text-zinc-950";
  const loginButtonClass = iconOnly
    ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400 text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-emerald-300"
    : "rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950";

  return (
    <div className={className ?? "flex items-center gap-2 text-sm"}>
      {showAdminLink && session?.user?.role === "ADMIN" && (
        <Link
          href="/admin"
          className="relative inline-flex items-center rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/70"
          title={
            locale === "fr"
              ? `${adminTodoCount} dossier${adminTodoCount > 1 ? "s" : ""} a traiter`
              : `${adminTodoCount} items to review`
          }
        >
          <span>Admin</span>
          {showAdminTodoCount ? (
            <span
              className={`absolute -right-1.5 -top-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-zinc-950 ${
                adminTodoCount > 5
                  ? "bg-rose-400 shadow-[0_2px_8px_rgba(244,63,94,0.45)]"
                  : "bg-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.45)]"
              }`}
            >
              {adminTodoCount > 99 ? "99+" : adminTodoCount}
            </span>
          ) : null}
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
          className={iconButtonClass}
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
          {showInboxCount && inboxCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-emerald-400 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-zinc-950">
              {inboxCount > 99 ? "99+" : inboxCount}
            </span>
          )}
        </Link>
      )}

      {showNotificationsLink && session ? (
        <Link
          href="/activity"
          className={iconButtonClass}
          aria-label={notificationsLabel}
          title={notificationsLabel}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
          >
            <path d="M14.5 18a2.5 2.5 0 0 1-5 0" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M6 9a6 6 0 1 1 12 0v4.1c0 .7.24 1.38.68 1.93l.97 1.2a1 1 0 0 1-.78 1.63H5.13a1 1 0 0 1-.78-1.63l.97-1.2A3.1 3.1 0 0 0 6 13.1V9Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : null}

      {showCart ? <CartHeaderButton label={cartLabel} /> : null}

      {session ? (
        <Link
          href="/profile"
          className={profileButtonClass}
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
          className={loginButtonClass}
          aria-label={loginLabel}
          title={loginLabel}
        >
          {iconOnly ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            loginLabel
          )}
        </Link>
      )}

      {session && <SignOutIconButton label={logoutLabel} className={iconButtonClass} />}
    </div>
  );
}
