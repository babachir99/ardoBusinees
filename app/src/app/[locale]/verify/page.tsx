import VerifyForm from "@/components/auth/VerifyForm";
import Footer from "@/components/layout/Footer";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
        <VerifyForm
          initialEmail={params.email ?? ""}
          initialToken={params.token ?? ""}
        />
      </main>
      <Footer />
    </div>
  );
}
