import { prisma } from "./src/lib/prisma.ts";

type LoginResult = {
  email: string;
  userId: string;
};

class QaHttpClient {
  baseUrl: string;
  cookies = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setCookiesFromResponse(response: Response) {
    const values = response.headers.getSetCookie?.() ?? [];
    for (const raw of values) {
      const pair = String(raw).split(";")[0];
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async request(pathname: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {});
    const cookie = this.getCookieHeader();
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    this.setCookiesFromResponse(response);
    return response;
  }

  async json<T = unknown>(pathname: string, init: RequestInit = {}) {
    const response = await this.request(pathname, init);
    const data = (await response.json().catch(() => null)) as T | null;
    return { response, data };
  }
}

async function login(client: QaHttpClient, email: string, password: string): Promise<LoginResult> {
  const { response: csrfRes, data: csrfData } = await client.json<{ csrfToken?: string }>("/api/auth/csrf");
  if (!csrfRes.ok || !csrfData?.csrfToken) {
    throw new Error(`csrf_failed:${csrfRes.status}`);
  }

  const body = new URLSearchParams({
    csrfToken: String(csrfData.csrfToken),
    email,
    password,
    callbackUrl: `${client.baseUrl}/fr`,
    json: "true",
  });

  const authRes = await client.request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (authRes.status !== 200 && authRes.status !== 302) {
    throw new Error(`login_failed:${authRes.status}`);
  }

  const { response: profileRes, data: profileData } = await client.json<{ id?: string }>("/api/profile");
  if (!profileRes.ok || !profileData?.id) {
    throw new Error(`profile_failed:${profileRes.status}`);
  }

  return { email, userId: profileData.id };
}

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const nowTag = Date.now().toString(36).toUpperCase();
const note = `QA GP thread message ${nowTag}`;
let shipmentId: string | null = null;

try {
  const [amy, ibou, transporter] = await Promise.all([
    prisma.user.findUnique({ where: { email: "amy@gmail.com" }, select: { id: true, email: true, name: true } }),
    prisma.user.findUnique({ where: { email: "ibou@gmail.com" }, select: { id: true, email: true, name: true } }),
    prisma.user.findUnique({ where: { email: "transporter@ardobusiness.com" }, select: { id: true, email: true, name: true } }),
  ]);

  if (!amy?.id || !ibou?.id || !transporter?.id) {
    throw new Error("missing_test_users");
  }

  const shipment = await prisma.gpShipment.create({
    data: {
      code: `GP-TST-${nowTag}`,
      senderId: amy.id,
      receiverId: ibou.id,
      transporterId: transporter.id,
      fromCity: "Paris",
      toCity: "Dakar",
      weightKg: 2,
      status: "DROPPED_OFF",
      note: "Codex QA flow",
      events: {
        create: {
          status: "DROPPED_OFF",
          note: "Initial shipment event",
          actorId: transporter.id,
        },
      },
    },
    select: { id: true, code: true },
  });

  shipmentId = shipment.id;

  const client = new QaHttpClient(baseUrl);
  const actor = await login(client, "amy@gmail.com", "123456");

  const post = await client.json<{
    mode?: string;
    event?: { id?: string; note?: string | null; actorId?: string | null };
  }>(`/api/gp/shipments/${shipment.id}/timeline`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note }),
  });

  if (post.response.status !== 201 || post.data?.mode !== "comment") {
    throw new Error(`post_failed:${post.response.status}:${JSON.stringify(post.data)}`);
  }

  const timeline = await client.json<{ events?: Array<{ note?: string | null }> }>(`/api/gp/shipments/${shipment.id}/timeline?take=10`);
  if (!timeline.response.ok || !timeline.data?.events?.some((event) => event.note === note)) {
    throw new Error(`timeline_missing:${timeline.response.status}`);
  }

  const outbox = await prisma.emailOutbox.findMany({
    where: {
      templateKey: "gp_thread_message",
      dedupeKey: { startsWith: `gp_thread_message:${shipment.id}:` },
    },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      toEmail: true,
      templateKey: true,
      payloadJson: true,
      dedupeKey: true,
      status: true,
    },
  });

  const recipientIds = new Set(outbox.map((row) => row.userId).filter((value): value is string => Boolean(value)));
  const expectedRecipients = new Set([ibou.id, transporter.id]);
  const exactRecipients = recipientIds.size === expectedRecipients.size && Array.from(expectedRecipients).every((id) => recipientIds.has(id));

  if (!exactRecipients) {
    throw new Error(`unexpected_recipients:${JSON.stringify(outbox)}`);
  }

  if (outbox.some((row) => row.userId === amy.id)) {
    throw new Error(`sender_notified:${JSON.stringify(outbox)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    actor,
    shipment: { id: shipment.id, code: shipment.code },
    postStatus: post.response.status,
    notifications: outbox,
  }, null, 2));
} finally {
  if (shipmentId) {
    await prisma.emailOutbox.deleteMany({ where: { dedupeKey: { startsWith: `gp_thread_message:${shipmentId}:` } } }).catch(() => null);
    await prisma.gpShipment.delete({ where: { id: shipmentId } }).catch(() => null);
  }
  await prisma.$disconnect();
}
