import AuthPanel from "@/components/auth/AuthPanel";
import Footer from "@/components/layout/Footer";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
        <AuthPanel defaultMode="signup" />
      </main>
      <Footer />
    </div>
  );
}
