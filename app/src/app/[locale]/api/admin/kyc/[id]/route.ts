import { NextRequest } from "next/server";
import { PATCH as corePATCH } from "@/app/api/admin/kyc/[id]/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return corePATCH(request, { params: Promise.resolve({ id }) });
}
