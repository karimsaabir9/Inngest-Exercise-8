const requestIdToRunId = new Map<string, string>();

export function setWorkflowRun(requestId: string, runId: string) {
  requestIdToRunId.set(requestId, runId);
}

export function getWorkflowRun(requestId: string): string | undefined {
  return requestIdToRunId.get(requestId);
}
