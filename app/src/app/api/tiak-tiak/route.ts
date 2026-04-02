import { NextRequest, NextResponse } from "next/server";
import { Vertical, getVerticalRules } from "@/lib/verticals";

const vertical = Vertical.TIAK_TIAK;
const rules = getVerticalRules(vertical);
void NextRequest;
const todo = [
  "POST /api/tiak-tiak/deliveries (publish delivery mission)",
  "POST /api/tiak-tiak/bookings (request a courier)",
  "PATCH /api/tiak-tiak/bookings/:id/status (pickup > in_transit > delivered)",
  "POST /api/tiak-tiak/tracking (proof + timeline events)",
  "POST /api/tiak-tiak/disputes (incident management)",
  "POST /api/tiak-tiak/payouts/sync (courier payout orchestration)",
];

function notImplementedPayload() {
  return {
    message: "Not implemented",
    vertical,
    rules,
    todo,
  };
}

export async function GET() {
  return NextResponse.json(notImplementedPayload(), { status: 501 });
}

export async function POST() {
  return NextResponse.json(notImplementedPayload(), { status: 501 });
}
