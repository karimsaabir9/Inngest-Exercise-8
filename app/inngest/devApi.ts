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

const DEV_TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"];
const CLOUD_TERMINAL = ["Completed", "Failed", "Cancelled"];

// A single, non-blocking status check — safe to call from a short-lived
// request (e.g. a route the frontend polls) without risking a proxy/function
// timeout on a long-running Inngest Cloud cold start.
export async function checkRunOnce({
  eventId,
  runId,
}: {
  eventId: string;
  runId: string;
}): Promise<{ status: string; result: unknown; done: boolean }> {
  if (isDevMode) {
    const data = await gql<{ runTrace: TraceSpan }>(
      `query($runID: String!) { runTrace(runID: $runID) { status outputID } }`,
      { runID: runId },
    );
    const trace = data.runTrace;
    const status = trace?.status ?? "UNKNOWN";
    // outputID is present as soon as the run starts (it's a pointer, not a
    // completion signal) — only trust it once the status is a terminal one.
    if (DEV_TERMINAL.includes(status)) {
      return { status, result: await resolveOutput(trace?.outputID ?? null), done: true };
    }
    return { status, result: null, done: false };
  }

  const run = await getRunForEvent(eventId);
  const status = run?.status ?? "UNKNOWN";
  if (CLOUD_TERMINAL.includes(status)) {
    return { status, result: parseJsonMaybe(run?.output), done: true };
  }
  return { status, result: null, done: false };
}

// Polls checkRunOnce server-side. Useful for dev (fast, reliable local
// server) but risky in production, where an Inngest Cloud cold start can
// take longer than a single HTTP request should block for — prefer having
// the frontend poll checkRunOnce/its route repeatedly instead.
export async function waitForRunOutput(
  ref: { eventId: string; runId: string },
  { timeoutMs = 20000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ status: string; result: unknown }> {
  const deadline = Date.now() + timeoutMs;
  let last = { status: "UNKNOWN", result: null as unknown, done: false };

  while (Date.now() < deadline) {
    last = await checkRunOnce(ref);
    if (last.done) return { status: last.status, result: last.result };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: last.status, result: null };
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
