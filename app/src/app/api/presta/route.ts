import { NextRequest, NextResponse } from "next/server";
import { Vertical, getVerticalRules } from "@/lib/verticals";

const vertical = Vertical.PRESTA;
const rules = getVerticalRules(vertical);
const todo = [
  "POST /api/presta/listings (publish service listing)",
  "POST /api/presta/bookings (customer booking flow)",
  "PATCH /api/presta/bookings/:id/status (provider lifecycle)",
  "POST /api/presta/disputes (service issue handling)",
  "POST /api/presta/payouts/sync (provider payout orchestration)",
];

function notImplementedPayload() {
  return {
    message: "Not implemented",
    vertical,
    rules,
    todo,
  };
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(notImplementedPayload(), { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(notImplementedPayload(), { status: 501 });
}
