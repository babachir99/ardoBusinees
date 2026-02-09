import { NextRequest } from "next/server";
import { GET as coreGET, POST as corePOST } from "@/app/api/products/[id]/offers/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return coreGET(request, { params: Promise.resolve({ id }) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return corePOST(request, { params: Promise.resolve({ id }) });
}
