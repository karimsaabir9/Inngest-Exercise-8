import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent, waitForRunOutput } from "@/app/inngest/devApi";

export async function POST(req: Request) {
  const { message, delayMinutes } = await req.json();

  const { ids } = await inngest.send({
    name: "reminder/schedule",
    data: { message, delayMinutes },
  });

  const run = await findRunForEvent(ids[0]);
  if (!run) {
    return NextResponse.json({ success: false, error: "Run was not found" });
  }

  const { status, result } = await waitForRunOutput(run.run_id, {
    timeoutMs: Number(delayMinutes) * 1000 + 15000,
  });

  return NextResponse.json({ success: true, status, result });
}
