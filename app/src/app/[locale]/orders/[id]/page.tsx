import OrderDetail from "@/components/orders/OrderDetail";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0b0f12] text-white">
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">Connexion requise</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Connecte-toi pour acceder au detail de ta commande.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              Se connecter
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f12] text-white">
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-12">
        <OrderDetail orderId={id} />
      </section>
      <Footer />
    </div>
  );
}
