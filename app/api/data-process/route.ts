import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent } from "@/app/inngest/devApi";

export async function POST() {
  const { ids } = await inngest.send({
    name: "data/process",
    data: {},
  });

  const run = await findRunForEvent(ids[0]);
  if (!run) {
    return NextResponse.json({ success: false, error: "Run was not found" });
  }

  // Returns immediately — the frontend polls /api/run-status for the
  // result instead of this request blocking until the run finishes
  // (an Inngest Cloud cold start can take longer than a single request
  // should be held open for).
  return NextResponse.json({ success: true, eventId: ids[0], runId: run.run_id });
}
