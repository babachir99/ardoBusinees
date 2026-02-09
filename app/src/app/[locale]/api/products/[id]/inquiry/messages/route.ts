import { NextRequest } from "next/server";
import { POST as corePOST } from "@/app/api/products/[id]/inquiry/messages/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return corePOST(request, { params: Promise.resolve({ id }) });
}
