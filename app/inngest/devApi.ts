const DEV_SERVER_URL = process.env.INNGEST_DEV_SERVER_URL ?? "http://localhost:8288";

interface RunSummary {
  run_id: string;
  status: string;
  event_id: string;
}

interface TraceSpan {
  name: string;
  status: string;
  outputID: string | null;
  childrenSpans: TraceSpan[];
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${DEV_SERVER_URL}/v0/gql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data as T;
}

async function resolveOutput(outputId: string | null): Promise<unknown> {
  if (!outputId) return null;

  const data = await gql<{
    runTraceSpanOutputByID: { data: string | null; error: { message: string } | null };
  }>(
    `query($id: String!) {
      runTraceSpanOutputByID(outputID: $id) { data error { message } }
    }`,
    { id: outputId },
  );

  const out = data.runTraceSpanOutputByID;
  if (out.error) throw new Error(out.error.message);
  if (!out.data) return null;

  try {
    return JSON.parse(out.data);
  } catch {
    return out.data;
  }
}

// The dev server caches "no runs yet" responses for ~15s keyed by the exact
// URL, so a fixed URL polled repeatedly can get stuck on a stale empty
// result. Appending a cache-busting query param forces a fresh lookup.
function cacheBust(url: string): string {
  return `${url}?_cb=${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function getRunForEvent(eventId: string): Promise<RunSummary | null> {
  const res = await fetch(cacheBust(`${DEV_SERVER_URL}/v1/events/${eventId}/runs`), {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0] ?? null;
}

// Finds the run created for an event. The run can take a moment to become
// visible after the event is sent, so this retries briefly.
export async function findRunForEvent(
  eventId: string,
  { timeoutMs = 8000, intervalMs = 300 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<RunSummary | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await getRunForEvent(eventId);
    if (run) return run;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// The dev server's REST run status can report "Completed" slightly before
// the run's final output is actually available, so completion is
// determined by the trace's outputID showing up (the source of truth used
// by the dev UI), not by the REST status field.
export async function waitForRunOutput(
  runId: string,
  { timeoutMs = 20000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ status: string; result: unknown }> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "UNKNOWN";

  while (Date.now() < deadline) {
    const data = await gql<{ runTrace: TraceSpan }>(
      `query($runID: String!) { runTrace(runID: $runID) { status outputID } }`,
      { runID: runId },
    );
    const trace = data.runTrace;
    lastStatus = trace?.status ?? lastStatus;

    // outputID is present as soon as the run starts (it's a pointer, not a
    // completion signal) — only trust it once the status is COMPLETED.
    if (lastStatus === "COMPLETED" || lastStatus === "FAILED" || lastStatus === "CANCELLED") {
      return { status: lastStatus, result: await resolveOutput(trace?.outputID ?? null) };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: lastStatus, result: null };
}

export async function getStepOutput(
  runId: string,
  stepName: string,
  { timeoutMs = 8000, intervalMs = 300 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await gql<{ runTrace: TraceSpan }>(
      `query($runID: String!) {
        runTrace(runID: $runID) {
          childrenSpans { name status outputID }
        }
      }`,
      { runID: runId },
    );
    const span = data.runTrace?.childrenSpans?.find((s) => s.name === stepName);
    if (span && (span.status === "COMPLETED" || span.status === "FAILED")) {
      return resolveOutput(span.outputID);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
