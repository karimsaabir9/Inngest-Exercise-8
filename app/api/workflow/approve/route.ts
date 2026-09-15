import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import { waitForRunOutput } from "@/app/inngest/devApi";
import { getWorkflowRun } from "@/app/inngest/workflowRuns";

export async function POST(req: Request) {
  const { requestId, approved, reason } = await req.json();

  await inngest.send({
    name: "workflow/approval",
    data: { requestId, approved, reason },
  });

  const runId = getWorkflowRun(requestId);
  if (!runId) {
    return NextResponse.json({ success: false, error: "No workflow run found for requestId" });
  }

  const { status, result } = await waitForRunOutput(runId, { timeoutMs: 20000 });

  return NextResponse.json({ success: true, status, result });
}
