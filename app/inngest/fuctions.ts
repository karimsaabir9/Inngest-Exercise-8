import { inngest } from "./client";

export const dataProcessor = inngest.createFunction(
  {
    id: "data-processor",
    triggers: { event: "data/process" },
  },
  async ({ step }) => {
    // step 1 fetch data
    const rowData = await step.run("fetch-data", async () => {
      console.log("Fetching data...");
      // simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { users: ["Ali", "Rayan", "Mc"] };
    });
    // step 2 process data
    const transformData = await step.run("transform-data", async () => {
      console.log("Transforming data...");
      return rowData.users.map((user: string) => user.toUpperCase());
    });

    // step 3 save data
    const savedData = await step.run("save-data", async () => {
      console.log("Saving data...");
      return transformData;
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return savedData;
  },
);

export const approvalWorkflow = inngest.createFunction(
  {
    id: "approval-workflow",
    triggers: { event: "workflow/start" },
  },
  async ({ event, step }) => {
    const { requestId, action } = event.data;
    // Step 1: Process the request
    await step.run("process-request", async () => {
      console.log(`Processing request: ${action}`);
      return { requestId, action, status: "pending_approval" };
    });

    // Step 2: Wait for approval (up to 1 hour)
    const approval = await step.waitForEvent("wait-for-approval", {
      event: "workflow/approval",
      timeout: "1m",
      match: "data.requestId", // Match on requestId
    });

    if (!approval) {
      return {
        requestId,
        status: "timeout",
        message: "Approval not received within 1 minute",
      };
    }

    // Step 3: Execute approved action
    const result = await step.run("execute-action", async () => {
      if (approval.data.approved) {
        console.log(`Executing approved action: ${action}`);
        return { requestId, status: "completed", action };
      } else {
        return { requestId, status: "rejected", reason: approval.data.reason };
      }
    });

    return result;
  },
);

export const reminder = inngest.createFunction(
  {
    id: "reminder",
    triggers: { event: "reminder/schedule" },
  },
  async ({ event, step }) => {
    const { message, delayMinutes } = event.data;

    // Wait for the specified delay
    await step.sleep("wait-for-reminder", `${delayMinutes}s`);

    // Send reminder
    const sent = await step.run("send-reminder", async () => {
      console.log(`🔔 Reminder: ${message}`);
      return {
        message,
        sentAt: new Date().toISOString(),
        originalDelay: delayMinutes,
      };
    });

    return sent;
  },
);
