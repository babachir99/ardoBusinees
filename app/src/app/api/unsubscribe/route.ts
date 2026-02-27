import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";

function htmlResponse(status: number, title: string, message: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:Arial,sans-serif;padding:24px;"><h2>${title}</h2><p>${message}</p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return htmlResponse(400, "Lien invalide", "Le lien de desabonnement est invalide ou expire.");
  }

  const updateData =
    payload.scope === "price_drop"
      ? { priceDropEmailEnabled: false }
      : payload.scope === "deals"
        ? { dealsEmailEnabled: false }
        : {
            marketingEmailEnabled: false,
            priceDropEmailEnabled: false,
            dealsEmailEnabled: false,
          };

  await prisma.notificationPreference.upsert({
    where: { userId: payload.userId },
    update: updateData,
    create: {
      userId: payload.userId,
      transactionalEmailEnabled: true,
      marketingEmailEnabled: false,
      priceDropEmailEnabled: false,
      dealsEmailEnabled: false,
      messageAutoEnabled: true,
    },
  });

  return htmlResponse(
    200,
    "Desabonnement confirme",
    "Vos preferences ont ete mises a jour. Vous pouvez fermer cette page."
  );
}
