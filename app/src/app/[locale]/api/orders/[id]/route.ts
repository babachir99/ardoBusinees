import { NextRequest } from "next/server";
import { GET as coreGET } from "@/app/api/orders/[id]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return coreGET(request, { params: Promise.resolve({ id }) });
}
