import { Link } from "@/i18n/navigation";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-zinc-950/40 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 text-xs text-zinc-400 md:flex-row md:items-center">
        <p>(c) {new Date().getFullYear()} JONTAADO</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="hover:text-white">
            A propos
          </Link>
          <Link href="/stores" className="hover:text-white">
            Sous-boutiques
          </Link>
          <Link href="/shop" className="hover:text-white">
            Boutique
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact
          </Link>
          <Link href="/trust" className="hover:text-white">
            Trust Center
          </Link>
          <Link href="/trust/privacy" className="hover:text-white">
            Confidentialite
          </Link>
          <Link href="/trust/terms" className="hover:text-white">
            Conditions
          </Link>
          <Link href="/trust/cookies" className="hover:text-white">
            Cookies
          </Link>
          <Link href="/trust/legal-notices" className="hover:text-white">
            Mentions legales
          </Link>
          <Link href="/trust/report" className="hover:text-white">
            Signaler
          </Link>
        </div>
      </div>
    </footer>
  );
}

