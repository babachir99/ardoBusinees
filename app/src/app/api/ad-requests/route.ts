import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitAdRequest } from "@/lib/adRequests";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null);

  try {
    const requestId = await submitAdRequest(body ?? {}, session?.user?.id);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AD_REQUEST") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to submit ad request" }, { status: 500 });
  }
}
