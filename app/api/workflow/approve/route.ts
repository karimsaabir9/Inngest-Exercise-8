import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";

export async function POST(req: Request) {
  const { requestId, approved, reason } = await req.json();

  await inngest.send({
    name: "workflow/approval",
    data: { requestId, approved, reason },
  });

  // Returns immediately — the frontend keeps polling /api/run-status using
  // the runId/eventId from the earlier "start" call for the final result.
  return NextResponse.json({ success: true });
}
