import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPresenceForUser,
  recordMessagesPresence,
  serializePresence,
} from "@/lib/messages/presence";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await recordMessagesPresence(session.user.id);
  const presence = serializePresence(await getPresenceForUser(session.user.id));

  return NextResponse.json({ presence });
}
