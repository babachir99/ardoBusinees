export type NotificationTemplateRender = {
  subject: string;
  html: string;
  text: string;
};

export type NotificationTemplatePayload = Record<string, unknown>;

type TemplateBuilder = (payload: NotificationTemplatePayload) => NotificationTemplateRender;

function valueAsString(payload: NotificationTemplatePayload, key: string, fallback = ""): string {
  const raw = payload[key];
  if (raw === null || raw === undefined) return fallback;
  return String(raw);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function interpolate(template: string, payload: NotificationTemplatePayload): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => valueAsString(payload, key, ""));
}

function paragraphFromText(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\n/g, "<br />");
}

function buildSimpleTemplate(subjectTpl: string, bodyTpl: string): TemplateBuilder {
  return (payload) => {
    const subject = interpolate(subjectTpl, payload).trim() || "Notification";
    const text = interpolate(bodyTpl, payload).trim();
    const html = `<p>${paragraphFromText(text)}</p>`;
    return { subject, text, html };
  };
}

function buildDealsDigest(payload: NotificationTemplatePayload): NotificationTemplateRender {
  const subject = "Bons plans de la semaine";
  const deals = Array.isArray(payload.deals) ? payload.deals : [];
  const items = deals
    .map((item) => {
      const title = escapeHtml(String((item as { title?: unknown }).title ?? "Produit"));
      const current = escapeHtml(String((item as { price?: unknown }).price ?? "-"));
      const previous = escapeHtml(String((item as { oldPrice?: unknown }).oldPrice ?? "-"));
      const url = String((item as { url?: unknown }).url ?? "").trim();
      if (!url) {
        return `<li><strong>${title}</strong> - ${current} (avant ${previous})</li>`;
      }
      const safeUrl = escapeHtml(url);
      return `<li><a href="${safeUrl}">${title}</a> - ${current} (avant ${previous})</li>`;
    })
    .join("");

  const unsubscribeUrl = escapeHtml(valueAsString(payload, "unsubscribeUrl", ""));

  const textLines = deals.map((item) => {
    const title = String((item as { title?: unknown }).title ?? "Produit");
    const price = String((item as { price?: unknown }).price ?? "-");
    const oldPrice = String((item as { oldPrice?: unknown }).oldPrice ?? "-");
    return `- ${title}: ${price} (avant ${oldPrice})`;
  });

  const text = [
    "Top bons plans de la semaine:",
    ...textLines,
    unsubscribeUrl ? `\nSe desabonner: ${unsubscribeUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<p>Top bons plans de la semaine:</p><ul>${items || "<li>Aucun bon plan cette semaine.</li>"}</ul>${
    unsubscribeUrl ? `<p><a href="${unsubscribeUrl}">Se desabonner</a></p>` : ""
  }`;

  return { subject, html, text };
}

const TEMPLATE_BUILDERS: Record<string, TemplateBuilder> = {
  order_confirmed: buildSimpleTemplate(
    "Commande {{orderId}} confirmee",
    "Votre commande {{orderId}} a ete confirmee. Suivi: {{link}}"
  ),
  order_paid: buildSimpleTemplate(
    "Paiement confirme pour {{orderId}}",
    "Le paiement de la commande {{orderId}} est confirme. Voir: {{link}}"
  ),
  order_shipped: buildSimpleTemplate(
    "Expedition en cours {{orderId}}",
    "Votre commande {{orderId}} est en cours d'expedition. Etape: {{trackingStep}}. Suivi: {{link}}"
  ),
  delivery_update: buildSimpleTemplate(
    "Mise a jour livraison {{orderId}}",
    "Nouveau statut pour {{orderId}}: {{trackingStep}}. ETA: {{eta}}. Suivi: {{link}}"
  ),
  delivery_reminder: buildSimpleTemplate(
    "Rappel livraison {{orderId}}",
    "Rappel: votre livraison {{orderId}} est attendue bientot. Suivi: {{link}}"
  ),
  payment_reminder: buildSimpleTemplate(
    "Rappel paiement {{orderId}}",
    "Votre commande {{orderId}} est en attente de paiement depuis 24h. Lien: {{link}}"
  ),
  price_drop: buildSimpleTemplate(
    "Baisse de prix: {{productTitle}}",
    "Bonne nouvelle: {{productTitle}} passe de {{oldPrice}} a {{newPrice}}. Voir: {{link}}\nSe desabonner: {{unsubscribeUrl}}"
  ),
  deals_digest: buildDealsDigest,
  contact_ack: buildSimpleTemplate(
    "Message recu sur JONTAADO",
    "Nous avons bien recu votre message pour {{contextLabel}}. Reponse attendue sous 24-48h."
  ),
};


const TEMPLATE_KEYS = new Set(Object.keys(TEMPLATE_BUILDERS));

export function isKnownNotificationTemplateKey(templateKey: string): boolean {
  const normalized = String(templateKey ?? "").trim().toLowerCase();
  return normalized.length > 0 && TEMPLATE_KEYS.has(normalized);
}

export function renderNotificationTemplate(
  templateKey: string,
  payload: NotificationTemplatePayload
): NotificationTemplateRender {
  const key = templateKey.trim().toLowerCase();
  const builder = TEMPLATE_BUILDERS[key] ?? buildSimpleTemplate(
    "Notification JONTAADO",
    "Vous avez une nouvelle notification JONTAADO."
  );
  return builder(payload);
}
