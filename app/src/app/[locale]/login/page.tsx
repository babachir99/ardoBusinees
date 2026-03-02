import AuthPanel from "@/components/auth/AuthPanel";
import Footer from "@/components/layout/Footer";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_80%_15%,rgba(34,211,238,0.12),transparent_38%)]" />
      <main className="relative mx-auto flex min-h-[calc(100vh-140px)] w-full items-center px-4 py-10 sm:px-6">
        <AuthPanel defaultMode="login" />
      </main>
      <Footer />
    </div>
  );
}
