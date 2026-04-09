import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

function getMetadataBase() {
  const raw =
    process.env.PUBLIC_APP_ORIGIN ||
    process.env.BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

function buildLocalizedPath(locale: string, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function buildStoreMetadata({
  locale,
  path,
  title,
  description,
  imagePath,
  noIndex = false,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  imagePath: string;
  noIndex?: boolean;
}): Metadata {
  const metadataBase = getMetadataBase();
  const canonicalPath = buildLocalizedPath(locale, path);
  const canonicalUrl = new URL(canonicalPath, metadataBase).toString();
  const imageUrl = new URL(imagePath, metadataBase).toString();

  const languages = Object.fromEntries(
    routing.locales.map((supportedLocale) => [
      supportedLocale,
      new URL(buildLocalizedPath(supportedLocale, path), metadataBase).toString(),
    ])
  );

  return {
    metadataBase,
    title,
    description,
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      type: "website",
      siteName: "JONTAADO",
      title,
      description,
      url: canonicalUrl,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
