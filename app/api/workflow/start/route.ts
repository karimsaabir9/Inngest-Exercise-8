import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { findRunForEvent, getStepOutput } from "@/app/inngest/devApi";
import { setWorkflowRun } from "@/app/inngest/workflowRuns";

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

  setWorkflowRun(requestId, run.run_id);

  // The function pauses on step.waitForEvent(), so we only wait for the
  // "process-request" step's output, not the whole run.
  const processed = await getStepOutput(run.run_id, "process-request");

  return NextResponse.json({ success: true, result: processed });
}
