import LoginForm from "@/components/auth/LoginForm";
import Footer from "@/components/layout/Footer";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
        <LoginForm />
      </main>
      <Footer />
    </div>
  );
}
