"use client";

import { useState } from "react";
import axios from "axios";

// Polls /api/run-status client-side instead of holding one HTTP request
// open until the run finishes — Inngest Cloud cold starts can take longer
// than is safe to block a single serverless request/proxy connection for.
async function pollRunStatus(
  eventId: string,
  runId: string,
  onTick: (data: unknown) => void,
  { intervalMs = 1500, maxAttempts = 60 }: { intervalMs?: number; maxAttempts?: number } = {},
) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get("/api/run-status", { params: { eventId, runId } });
      onTick(res.data);
      if (res.data?.done) return;
    } catch (err) {
      onTick({ success: false, error: axios.isAxiosError(err) ? err.message : String(err) });
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  onTick({ success: false, error: "Timed out waiting for the run to finish" });
}

function ResultBox({ result }: { result: unknown }) {
  if (result === undefined) return null;
  return (
    <pre className="mt-3 w-full overflow-auto rounded bg-black/[.06] p-3 text-xs dark:bg-white/[.08]">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MultiStepDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>();

  const trigger = async () => {
    setLoading(true);
    setResult({ status: "Sending..." });
    try {
      const res = await axios.post("/api/data-process");
      const { eventId, runId } = res.data;
      if (!eventId || !runId) {
        setResult(res.data);
        return;
      }
      await pollRunStatus(eventId, runId, setResult);
    } catch (err) {
      setResult({ error: axios.isAxiosError(err) ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="1. Multi-Step: step.run() — Three Steps"
      description="Triggers 'data/process' -> fetch-data, transform-data, save-data"
    >
      <button
        onClick={trigger}
        disabled={loading}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Running..." : "Trigger Data Process"}
      </button>
      <ResultBox result={result} />
    </Card>
  );
}

function DelayStepDemo() {
  const [message, setMessage] = useState("Meeting starts soon");
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>();

  const trigger = async () => {
    setLoading(true);
    setResult({ status: "Sending..." });
    try {
      const res = await axios.post("/api/reminder", {
        message,
        delayMinutes: delaySeconds,
      });
      const { eventId, runId } = res.data;
      if (!eventId || !runId) {
        setResult(res.data);
        return;
      }
      await pollRunStatus(eventId, runId, setResult);
    } catch (err) {
      setResult({ error: axios.isAxiosError(err) ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="2. Delay Step: step.sleep()"
      description="Triggers 'reminder/schedule' -> sleeps N seconds, then sends the reminder"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col text-sm">
          Message
          <input
            className="mt-1 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm">
          Delay (seconds)
          <input
            type="number"
            min={1}
            className="mt-1 w-32 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
          />
        </label>
        <button
          onClick={trigger}
          disabled={loading}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Running..." : "Schedule Reminder"}
        </button>
      </div>
      <ResultBox result={result} />
    </Card>
  );
}

function WaitForEventDemo() {
  const [requestId, setRequestId] = useState("req-1");
  const [action, setAction] = useState("Publish article");
  const [approved, setApproved] = useState(true);
  const [reason, setReason] = useState("");
  const [startLoading, setStartLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [startResult, setStartResult] = useState<unknown>();
  const [approveResult, setApproveResult] = useState<unknown>();
  // Held only in memory to hand to the approve step — Vercel serverless
  // functions don't share state between invocations, so the frontend is
  // what carries this across the two requests. Never rendered directly.
  const [runRef, setRunRef] = useState<{ runId: string; eventId: string } | null>(null);

  const start = async () => {
    setStartLoading(true);
    setApproveResult(undefined);
    try {
      const res = await axios.post("/api/workflow/start", {
        requestId,
        action,
      });
      const { runId, eventId, ...display } = res.data;
      setStartResult(display);
      setRunRef(runId && eventId ? { runId, eventId } : null);
    } catch (err) {
      setStartResult({ error: axios.isAxiosError(err) ? err.message : String(err) });
    } finally {
      setStartLoading(false);
    }
  };

  const approve = async () => {
    if (!runRef) {
      setApproveResult({ error: "Start the workflow first" });
      return;
    }
    setApproveLoading(true);
    setApproveResult({ status: "Sending..." });
    try {
      await axios.post("/api/workflow/approve", {
        requestId,
        approved,
        reason,
      });
      await pollRunStatus(runRef.eventId, runRef.runId, setApproveResult);
    } catch (err) {
      setApproveResult({ error: axios.isAxiosError(err) ? err.message : String(err) });
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <Card
      title="3. Wait for Event: step.waitForEvent()"
      description="Triggers 'workflow/start' then waits (up to 1m) for 'workflow/approval' matching requestId"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col text-sm">
            Request ID
            <input
              className="mt-1 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            Action
            <input
              className="mt-1 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </label>
          <button
            onClick={start}
            disabled={startLoading}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {startLoading ? "Starting..." : "1) Start Workflow"}
          </button>
        </div>
        <ResultBox result={startResult} />

        <div className="flex flex-col gap-2 border-t border-black/[.08] pt-3 sm:flex-row sm:items-end dark:border-white/[.145]">
          <label className="flex flex-col text-sm">
            Approved?
            <select
              className="mt-1 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
              value={approved ? "yes" : "no"}
              onChange={(e) => setApproved(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Reason (if rejected)
            <input
              className="mt-1 rounded border border-black/[.08] bg-transparent px-3 py-2 dark:border-white/[.145]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            onClick={approve}
            disabled={approveLoading || !runRef}
            className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium dark:border-white/[.145] disabled:opacity-50"
          >
            {approveLoading ? "Running..." : "2) Send Approval Event"}
          </button>
        </div>
        <ResultBox result={approveResult} />
      </div>
    </Card>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Inngest Step Functions Demo
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Each card sends a request via axios to a Next.js API route, which
            sends an event to Inngest.
          </p>
        </div>
        <MultiStepDemo />
        <DelayStepDemo />
        <WaitForEventDemo />
      </main>
    </div>
  );
}
