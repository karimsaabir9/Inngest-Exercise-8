import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent, getStepOutput } from "@/app/inngest/devApi";

export async function POST(req: Request) {
  const { requestId, action } = await req.json();

  const { ids } = await inngest.send({
    name: "workflow/start",
    data: { requestId, action },
  });

  const run = await findRunForEvent(ids[0]);
  if (!run) {
    return NextResponse.json({ success: false, error: "Run was not found" });
  }

  // The function pauses on step.waitForEvent(), so we only wait for the
  // "process-request" step's output, not the whole run. In production this
  // step-level lookup isn't available (Inngest Cloud's public API doesn't
  // expose per-step output), so fall back to the known shape of that step.
  const processed =
    (await getStepOutput(run.run_id, "process-request")) ?? { requestId, action, status: "pending_approval" };

  // runId/eventId are handed back so the frontend can pass them to the
  // approve step later. Serverless functions don't share memory between
  // invocations, so this can't be cached server-side between the two calls.
  return NextResponse.json({ success: true, result: processed, runId: run.run_id, eventId: ids[0] });
}
