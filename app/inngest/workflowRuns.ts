// Maps a workflow requestId to its Inngest run/event ids so the approve
// route can find which run to poll without exposing them to the client.
interface WorkflowRunRef {
  runId: string;
  eventId: string;
}

const requestIdToRun = new Map<string, WorkflowRunRef>();

export function setWorkflowRun(requestId: string, ref: WorkflowRunRef) {
  requestIdToRun.set(requestId, ref);
}

export function getWorkflowRun(requestId: string): WorkflowRunRef | undefined {
  return requestIdToRun.get(requestId);
}
