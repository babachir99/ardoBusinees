import { prisma } from "@/lib/prisma";

export const MESSAGES_PRESENCE_ACTION = "MESSAGES_PRESENCE_PING";
const PRESENCE_FALLBACK_ACTIONS = [MESSAGES_PRESENCE_ACTION, "USER_SIGNIN"] as const;
const MESSAGES_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const MESSAGES_PING_THROTTLE_MS = 60 * 1000;

export type MessagePresenceSummary = {
  userId: string;
  online: boolean;
  lastSeenAt: string | Date | null;
};

function uniqueUserIds(userIds: Array<string | null | undefined>) {
  return [...new Set(userIds.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

export function serializePresence(
  presence: MessagePresenceSummary | null
): MessagePresenceSummary | null {
  if (!presence) return null;

  return {
    ...presence,
    lastSeenAt:
      presence.lastSeenAt instanceof Date
        ? presence.lastSeenAt.toISOString()
        : presence.lastSeenAt,
  };
}

export async function getPresenceMap(userIds: Array<string | null | undefined>) {
  const ids = uniqueUserIds(userIds);
  const result = new Map<string, MessagePresenceSummary>();

  if (ids.length === 0) {
    return result;
  }

  const rows = await prisma.activityLog.findMany({
    where: {
      userId: { in: ids },
      action: { in: [...PRESENCE_FALLBACK_ACTIONS] },
    },
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
    select: {
      userId: true,
      action: true,
      createdAt: true,
    },
  });

  const latestByUserId = new Map<
    string,
    {
      action: string;
      createdAt: Date;
    }
  >();

  for (const row of rows) {
    if (!latestByUserId.has(row.userId)) {
      latestByUserId.set(row.userId, { action: row.action, createdAt: row.createdAt });
    }
  }

  const now = Date.now();
  for (const userId of ids) {
    const latest = latestByUserId.get(userId);
    result.set(userId, {
      userId,
      online: Boolean(
        latest &&
          latest.action === MESSAGES_PRESENCE_ACTION &&
          now - latest.createdAt.getTime() <= MESSAGES_ONLINE_WINDOW_MS
      ),
      lastSeenAt: latest?.createdAt ?? null,
    });
  }

  return result;
}

export async function getPresenceForUser(userId: string | null | undefined) {
  if (!userId) return null;
  const presenceMap = await getPresenceMap([userId]);
  return presenceMap.get(userId) ?? null;
}

export async function recordMessagesPresence(userId: string) {
  const cutoff = new Date(Date.now() - MESSAGES_PING_THROTTLE_MS);
  const latest = await prisma.activityLog.findFirst({
    where: {
      userId,
      action: MESSAGES_PRESENCE_ACTION,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
    },
  });

  if (latest && latest.createdAt >= cutoff) {
    return latest.createdAt;
  }

  const created = await prisma.activityLog.create({
    data: {
      userId,
      action: MESSAGES_PRESENCE_ACTION,
      entityType: "MESSAGES",
      metadata: { source: "messages" },
    },
    select: {
      createdAt: true,
    },
  });

  return created.createdAt;
}
