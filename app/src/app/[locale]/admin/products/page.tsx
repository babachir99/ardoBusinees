import AdminProductReportsPanel from "@/components/admin/AdminProductReportsPanel";
import AdminProductsBoard from "@/components/admin/AdminProductsBoard";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { getProductReportCounts } from "@/lib/productReports";
import Image from "next/image";

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [session, reportCounts] = await Promise.all([
    getServerSession(authOptions),
    getProductReportCounts(),
  ]);

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">Acces refuse</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Connecte-toi avec un compte admin.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              Se connecter
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[115px] w-auto md:h-[135px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/kyc"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            KYC
          </Link>
          <Link
            href="/admin/users"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            Utilisateurs
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12">
        <AdminProductReportsPanel locale={locale} />
        <div className="mt-8">
        <AdminProductsBoard pendingReportsCount={reportCounts.pending} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
