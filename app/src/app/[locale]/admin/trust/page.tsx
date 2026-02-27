import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasUserRole } from "@/lib/userRoles";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AdminTrustModerationPanel from "@/components/trust/AdminTrustModerationPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminTrustPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; focus?: string }>; }) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await getServerSession(authOptions);
  const isFr = locale === "fr";

  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">{isFr ? "Acces admin requis" : "Admin access required"}</h1>
            <p className="mt-2 text-sm text-zinc-300">{isFr ? "Cette page est reservee a la moderation Trust." : "This page is restricted to Trust moderation."}</p>
            <Link href="/login" className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950">{isFr ? "Se connecter" : "Sign in"}</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const db = prisma as any;
  const trustReady = Boolean(db?.report && db?.trustDispute);
  const [reports, disputes] = trustReady
    ? await Promise.all([
        db.report.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { reporter: { select: { id: true, name: true } }, reported: { select: { id: true, name: true } }, assignedAdmin: { select: { id: true, name: true } } } }),
        db.trustDispute.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { id: true, name: true } }, assignedAdmin: { select: { id: true, name: true } } } }),
      ])
    : [[], []];

  const normalizeDisputeStatus = (status: string) => (status === "IN_REVIEW" ? "UNDER_REVIEW" : status);
  const initialTab = resolvedSearchParams?.tab === "disputes" ? "disputes" : "reports";
  const focusId = typeof resolvedSearchParams?.focus === "string" && resolvedSearchParams.focus.trim() ? resolvedSearchParams.focus.trim() : null;

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-24 pt-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-rose-300/10 via-zinc-900 to-zinc-900 p-8">
          <h1 className="text-3xl font-semibold">{isFr ? "Moderation Trust" : "Trust moderation"}</h1>
          <p className="mt-2 text-sm text-zinc-300">{isFr ? "Signalements comptes, plaintes utilisateurs et traitement admin (V0.1)." : "Account reports, user disputes and admin handling (V0.1)."}</p>
        </section>
        {!trustReady ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{isFr ? "Trust Center indisponible (Prisma client non regenere). Lancez `npx prisma generate` puis redemarrez." : "Trust Center unavailable (Prisma client not regenerated). Run `npx prisma generate` and restart."}</div>
        ) : (
          <AdminTrustModerationPanel
            locale={locale}
            initialTab={initialTab}
            focusId={focusId}
            currentAdminId={session.user.id}
            initialReports={reports.map((item: any) => ({ id: item.id, reporterId: item.reporterId, reportedId: item.reportedId, reporter: item.reporter ? { id: item.reporter.id, name: item.reporter.name ?? null } : undefined, reported: item.reported ? { id: item.reported.id, name: item.reported.name ?? null } : undefined, assignedAdminId: item.assignedAdminId ?? null, assignedAdmin: item.assignedAdmin ? { id: item.assignedAdmin.id, name: item.assignedAdmin.name ?? null } : undefined, reason: item.reason, description: item.description ?? null, proofUrls: Array.isArray(item.proofUrls) ? item.proofUrls : [], status: item.status, resolutionCode: item.resolutionCode ?? null, internalNote: item.internalNote ?? null, reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))}
            initialDisputes={disputes.map((item: any) => ({ id: item.id, userId: item.userId, user: item.user ? { id: item.user.id, name: item.user.name ?? null } : undefined, assignedAdminId: item.assignedAdminId ?? null, assignedAdmin: item.assignedAdmin ? { id: item.assignedAdmin.id, name: item.assignedAdmin.name ?? null } : undefined, orderId: item.orderId ?? null, vertical: item.vertical, reason: item.reason, description: item.description, proofUrls: Array.isArray(item.proofUrls) ? item.proofUrls : [], status: normalizeDisputeStatus(item.status), resolutionCode: item.resolutionCode ?? null, internalNote: item.internalNote ?? null, reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
