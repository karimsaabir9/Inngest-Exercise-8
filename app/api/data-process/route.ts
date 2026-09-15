import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent, waitForRunOutput } from "@/app/inngest/devApi";

export async function POST() {
  const { ids } = await inngest.send({
    name: "data/process",
    data: {},
  });

  const run = await findRunForEvent(ids[0]);
  if (!run) {
    return NextResponse.json({ success: false, error: "Run was not found" });
  }

  const { status, result } = await waitForRunOutput(
    { eventId: ids[0], runId: run.run_id },
    { timeoutMs: 20000 },
  );

  return NextResponse.json({ success: true, status, result });
}
