import AdminSellersBoard from "@/components/admin/AdminSellersBoard";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

export default async function AdminSellersPage() {
  const session = await getServerSession(authOptions);
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
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-zinc-200 hover:border-white/50"
          >
            Dashboard admin
          </Link>
          <Link
            href="/admin/payouts"
            className="rounded-full border border-emerald-300/40 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-300/70"
          >
            Payouts
          </Link>
        </div>
        <AdminSellersBoard />
      </main>
      <Footer />
    </div>
  );
}
