import { NextResponse } from "next/server";
import { checkRunOnce } from "@/app/inngest/devApi";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const runId = searchParams.get("runId");

  if (!eventId || !runId) {
    return NextResponse.json({ success: false, error: "Missing eventId/runId" }, { status: 400 });
  }

  const { status, result, done } = await checkRunOnce({ eventId, runId });

  return NextResponse.json({ success: true, status, result, done });
}
