import { prisma } from "@/lib/prisma";
import { NotificationVertical } from "@prisma/client";

export type ContactTemplateContext = {
  itemTitle?: string;
  contextRef?: string;
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

type ContactTemplateDefault = {
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

export const CONTACT_TEMPLATE_DEFAULTS: ContactTemplateDefault[] = [
  {
    key: "SHOP_CONTACT_SELLER",
    vertical: "SHOP",
    subject: "Question sur {{productTitle}}",
    body: "Bonjour, je vous contacte au sujet de {{productTitle}}.",
  },
  {
    key: "PRESTA_CONTACT_PROVIDER",
    vertical: "PRESTA",
    subject: "Demande de service {{serviceTitle}}",
    body: "Bonjour, je souhaite discuter de {{serviceTitle}}.",
  },
  {
    key: "GP_CONTACT_TRANSPORTER",
    vertical: "GP",
    subject: "Question transport {{orderRef}}",
    body: "Bonjour, je vous contacte pour le transport {{orderRef}}.",
  },
  {
    key: "TIAK_CONTACT_COURIER",
    vertical: "TIAK",
    subject: "Course {{orderRef}}",
    body: "Bonjour, je vous contacte au sujet de la course {{orderRef}}.",
  },
  {
    key: "IMMO_CONTACT_AGENCY",
    vertical: "IMMO",
    subject: "Interet pour {{listingTitle}}",
    body: "Bonjour, je suis interesse par {{listingTitle}}.",
  },
  {
    key: "CARS_CONTACT_DEALER",
    vertical: "CARS",
    subject: "Question sur {{listingTitle}}",
    body: "Bonjour, je souhaite plus d'informations sur {{listingTitle}}.",
  },
  {
    key: "GENERIC_CONTACT",
    vertical: "GENERIC",
    subject: "Nouveau contact JONTAADO",
    body: "Bonjour, je vous contacte via JONTAADO.",
  },
];

const DEFAULT_BY_KEY = CONTACT_TEMPLATE_DEFAULTS.reduce<Record<string, ContactTemplateDefault>>(
  (accumulator, template) => {
    accumulator[template.key] = template;
    return accumulator;
  },
  {}
);

let defaultsAttempted = false;

function coalesce(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function normalizeTemplateContext(context: ContactTemplateContext): ContactTemplateContext {
  const itemTitle = coalesce(
    context.itemTitle,
    context.productTitle,
    context.serviceTitle,
    context.listingTitle
  );
  const contextRef = coalesce(context.contextRef, context.orderRef);

  return {
    ...context,
    itemTitle,
    contextRef,
    productTitle: coalesce(context.productTitle, itemTitle),
    serviceTitle: coalesce(context.serviceTitle, itemTitle),
    listingTitle: coalesce(context.listingTitle, itemTitle),
    orderRef: coalesce(context.orderRef, contextRef),
    proposedDates: coalesce(context.proposedDates),
    phoneOptional: coalesce(context.phoneOptional),
  };
}

function interpolate(value: string, context: ContactTemplateContext): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey as keyof ContactTemplateContext;
    const replacement = context[key];
    return typeof replacement === "string" && replacement.trim().length > 0
      ? replacement.trim()
      : "";
  });
}

async function ensureContactTemplateDefaults() {
  if (defaultsAttempted) return;
  defaultsAttempted = true;

  try {
    await prisma.messageTemplate.createMany({
      data: CONTACT_TEMPLATE_DEFAULTS.map((template) => ({
        key: template.key,
        vertical: template.vertical,
        subjectDefault: template.subject,
        bodyDefault: template.body,
      })),
      skipDuplicates: true,
    });
  } catch {
    // Keep runtime fallback templates working even if seeding fails.
  }
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
  const key = CONTACT_TEMPLATE_KEY_BY_VERTICAL[vertical];
  const context = normalizeTemplateContext(params.context ?? {});

  await ensureContactTemplateDefaults();

  const stored = await prisma.messageTemplate.findUnique({
    where: { key },
    select: {
      key: true,
      vertical: true,
      subjectDefault: true,
      bodyDefault: true,
    },
  });

  const fallback = DEFAULT_BY_KEY[key] ?? DEFAULT_BY_KEY.GENERIC_CONTACT;
  const subjectRaw = stored?.subjectDefault || fallback.subject;
  const bodyRaw = stored?.bodyDefault || fallback.body;

  return {
    key,
    vertical: stored?.vertical ?? fallback.vertical,
    subject: interpolate(subjectRaw, context).trim() || interpolate(fallback.subject, context).trim(),
    body: interpolate(bodyRaw, context).trim() || interpolate(fallback.body, context).trim(),
  };
}

export function resolveContactTemplateKey(vertical?: string | null): string {
  return CONTACT_TEMPLATE_KEY_BY_VERTICAL[normalizeVertical(vertical)];
}
