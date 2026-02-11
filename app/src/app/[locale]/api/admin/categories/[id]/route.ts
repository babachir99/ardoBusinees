import { NextRequest } from "next/server";
import {
  PATCH as corePATCH,
  DELETE as coreDELETE,
} from "@/app/api/admin/categories/[id]/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return corePATCH(request, { params: Promise.resolve({ id }) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { id } = await params;
  return coreDELETE(request, { params: Promise.resolve({ id }) });
}