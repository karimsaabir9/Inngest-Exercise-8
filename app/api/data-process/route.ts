import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent, isDevMode, waitForRunOutput } from "@/app/inngest/devApi";

export async function POST() {
  const { ids } = await inngest.send({
    name: "data/process",
    data: {},
  });

  const run = await findRunForEvent(ids[0]);
  if (!run) {
    return NextResponse.json({ success: false, error: "Run was not found" });
  }

  // Inngest Cloud's free/shared infra pool can take much longer than the
  // local dev server to pick up and finish a run, especially on cold starts.
  const { status, result } = await waitForRunOutput(
    { eventId: ids[0], runId: run.run_id },
    { timeoutMs: isDevMode ? 20000 : 90000 },
  );

  return NextResponse.json({ success: true, status, result });
}
