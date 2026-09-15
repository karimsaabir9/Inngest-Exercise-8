import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { isDevMode, waitForRunOutput } from "@/app/inngest/devApi";
import { getWorkflowRun } from "@/app/inngest/workflowRuns";

export async function POST(req: Request) {
  const { requestId, approved, reason } = await req.json();

  await inngest.send({
    name: "workflow/approval",
    data: { requestId, approved, reason },
  });

  const run = getWorkflowRun(requestId);
  if (!run) {
    return NextResponse.json({ success: false, error: "No workflow run found for requestId" });
  }

  const { status, result } = await waitForRunOutput(run, { timeoutMs: isDevMode ? 20000 : 90000 });

  return NextResponse.json({ success: true, status, result });
}
