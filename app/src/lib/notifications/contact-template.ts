import { prisma } from "@/lib/prisma";
import { NotificationVertical } from "@prisma/client";

export type ContactTemplateContext = {
  listingTitle?: string;
  productTitle?: string;
  serviceTitle?: string;
  orderRef?: string;
  proposedDates?: string;
  phoneOptional?: string;
};

type ContactTemplateResult = {
  key: string;
  vertical: NotificationVertical;
  subject: string;
  body: string;
};

const CONTACT_TEMPLATE_KEY_BY_VERTICAL: Record<NotificationVertical, string> = {
  GENERIC: "GENERIC_CONTACT",
  SHOP: "SHOP_CONTACT_SELLER",
  PRESTA: "PRESTA_CONTACT_PROVIDER",
  GP: "GP_CONTACT_TRANSPORTER",
  TIAK: "TIAK_CONTACT_COURIER",
  IMMO: "IMMO_CONTACT_AGENCY",
  CARS: "CARS_CONTACT_DEALER",
};

const FALLBACK_TEMPLATE: Record<string, { subject: string; body: string }> = {
  SHOP_CONTACT_SELLER: {
    subject: "Question sur {{productTitle}}",
    body: "Bonjour, je vous contacte au sujet de {{productTitle}}.",
  },
  PRESTA_CONTACT_PROVIDER: {
    subject: "Demande de service {{serviceTitle}}",
    body: "Bonjour, je souhaite discuter de {{serviceTitle}}.",
  },
  GP_CONTACT_TRANSPORTER: {
    subject: "Question transport {{orderRef}}",
    body: "Bonjour, je vous contacte pour le transport {{orderRef}}.",
  },
  TIAK_CONTACT_COURIER: {
    subject: "Course {{orderRef}}",
    body: "Bonjour, je vous contacte au sujet de la course {{orderRef}}.",
  },
  IMMO_CONTACT_AGENCY: {
    subject: "Interet pour {{listingTitle}}",
    body: "Bonjour, je suis interesse par {{listingTitle}}.",
  },
  CARS_CONTACT_DEALER: {
    subject: "Question sur {{listingTitle}}",
    body: "Bonjour, je souhaite plus d'informations sur {{listingTitle}}.",
  },
  GENERIC_CONTACT: {
    subject: "Nouveau contact JONTAADO",
    body: "Bonjour, je vous contacte via JONTAADO.",
  },
};

function interpolate(value: string, context: ContactTemplateContext): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey as keyof ContactTemplateContext;
    const replacement = context[key];
    return typeof replacement === "string" && replacement.trim().length > 0
      ? replacement.trim()
      : "";
  });
}

function normalizeVertical(value: string | null | undefined): NotificationVertical {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "SHOP") return "SHOP";
  if (normalized === "PRESTA") return "PRESTA";
  if (normalized === "GP") return "GP";
  if (normalized === "TIAK") return "TIAK";
  if (normalized === "IMMO") return "IMMO";
  if (normalized === "CARS") return "CARS";
  return "GENERIC";
}

export async function getContactTemplate(params: {
  vertical?: string | null;
  context?: ContactTemplateContext;
}): Promise<ContactTemplateResult> {
  const vertical = normalizeVertical(params.vertical);
  const context = params.context ?? {};
  const key = CONTACT_TEMPLATE_KEY_BY_VERTICAL[vertical];

  const stored = await prisma.messageTemplate.findUnique({
    where: { key },
    select: {
      key: true,
      vertical: true,
      subjectDefault: true,
      bodyDefault: true,
    },
  });

  const fallback = FALLBACK_TEMPLATE[key] ?? FALLBACK_TEMPLATE.GENERIC_CONTACT;
  const subjectRaw = stored?.subjectDefault || fallback.subject;
  const bodyRaw = stored?.bodyDefault || fallback.body;

  return {
    key,
    vertical: stored?.vertical ?? vertical,
    subject: interpolate(subjectRaw, context).trim() || interpolate(fallback.subject, context),
    body: interpolate(bodyRaw, context).trim() || interpolate(fallback.body, context),
  };
}

export function resolveContactTemplateKey(vertical?: string | null): string {
  return CONTACT_TEMPLATE_KEY_BY_VERTICAL[normalizeVertical(vertical)];
}
