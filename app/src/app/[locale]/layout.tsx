import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import IdleSessionGuard from "@/components/auth/IdleSessionGuard";
import { routing } from "@/i18n/routing";
import { authOptions } from "@/lib/auth";
import { CartProvider } from "@/components/cart/CartProvider";
import InternalNavigationHeader from "@/components/layout/InternalNavigationHeader";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JONTAADO",
  description: "Marketplace & services.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function isValidLocale(
  value: string
): value is (typeof routing.locales)[number] {
  return routing.locales.includes(value as (typeof routing.locales)[number]);
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const [messages, session] = await Promise.all([
    getMessages(),
    getServerSession(authOptions),
  ]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <IdleSessionGuard locale={locale} userId={session?.user?.id ?? null} />
            <InternalNavigationHeader locale={locale} />
            {children}
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
