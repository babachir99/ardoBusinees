import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKycRequirements, normalizeKycRole } from "@/lib/kyc/requirements";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = normalizeKycRole(searchParams.get("role"));
  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const requirement = getKycRequirements(role);
  if (!requirement) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  return NextResponse.json({
    roleRequested: requirement.roleRequested,
    kycType: requirement.kycType,
    kycLevel: requirement.kycLevel,
    requiredFields: requirement.requiredFields,
    optionalFields: requirement.optionalFields,
  });
}
