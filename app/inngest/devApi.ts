const DEV_SERVER_URL = process.env.INNGEST_DEV_SERVER_URL ?? "http://localhost:8288";
const CLOUD_API_URL = "https://api.inngest.com";

export const isDevMode = process.env.INNGEST_DEV === "1";

interface RunSummary {
  run_id: string;
  status: string;
  event_id: string;
  output?: string | null;
}

interface TraceSpan {
  name: string;
  status: string;
  outputID: string | null;
  childrenSpans: TraceSpan[];
}

function cloudHeaders(): HeadersInit {
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  return signingKey ? { Authorization: `Bearer ${signingKey}` } : {};
}

// The dev server caches "no runs yet" responses for ~15s keyed by the exact
// URL, so a fixed URL polled repeatedly can get stuck on a stale empty
// result. Appending a cache-busting query param forces a fresh lookup.
function cacheBust(url: string): string {
  return `${url}?_cb=${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

function parseJsonMaybe(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function getRunForEvent(eventId: string): Promise<RunSummary | null> {
  const url = isDevMode
    ? `${DEV_SERVER_URL}/v1/events/${eventId}/runs`
    : `${CLOUD_API_URL}/v1/events/${eventId}/runs`;

  const res = await fetch(cacheBust(url), {
    cache: "no-store",
    headers: isDevMode ? {} : cloudHeaders(),
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

// In dev mode, completion is determined by the dev server's internal trace
// API (its REST "status" field can flip to "Completed" slightly before the
// output is actually available). In production, Inngest Cloud's public REST
// API is used instead (the "output" field on the events/runs endpoint —
// the dev server's GraphQL trace endpoint only exists locally, and Cloud's
// GET /v1/runs/{id} endpoint does not include output, only events/runs does).
export async function waitForRunOutput(
  { eventId, runId }: { eventId: string; runId: string },
  { timeoutMs = 20000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ status: string; result: unknown }> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "UNKNOWN";

  if (isDevMode) {
    while (Date.now() < deadline) {
      const data = await gql<{ runTrace: TraceSpan }>(
        `query($runID: String!) { runTrace(runID: $runID) { status outputID } }`,
        { runID: runId },
      );
      const trace = data.runTrace;
      lastStatus = trace?.status ?? lastStatus;

      // outputID is present as soon as the run starts (it's a pointer, not
      // a completion signal) — only trust it once the status is COMPLETED.
      if (lastStatus === "COMPLETED" || lastStatus === "FAILED" || lastStatus === "CANCELLED") {
        return { status: lastStatus, result: await resolveOutput(trace?.outputID ?? null) };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { status: lastStatus, result: null };
  }

  while (Date.now() < deadline) {
    const run = await getRunForEvent(eventId);
    lastStatus = run?.status ?? lastStatus;

    if (["Completed", "Failed", "Cancelled"].includes(lastStatus)) {
      return { status: lastStatus, result: parseJsonMaybe(run?.output) };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: lastStatus, result: null };
}

// Dev-only: inspects an in-progress run's step-level trace to read a step's
// output before the whole run finishes (used to show the "process-request"
// step's output while the function is paused on step.waitForEvent()).
// Inngest Cloud's public REST API doesn't expose per-step output, so this
// is skipped in production — callers should fall back to a known value.
export async function getStepOutput(
  runId: string,
  stepName: string,
  { timeoutMs = 8000, intervalMs = 300 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<unknown> {
  if (!isDevMode) return null;

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
