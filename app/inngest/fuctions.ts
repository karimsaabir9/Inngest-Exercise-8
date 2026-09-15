import { NonRetriableError } from "inngest";
import { inngest } from "./client";

export const simpleGreeter = inngest.createFunction(
  {
    id: "simple-greeter",
    triggers: { event: "greet/user" },
  },
  async ({ event, step }) => {
    // step 1
    const result = await step.run("say-hello", async () => {
      return `Hello, ${event.data.name}!`;
    });
    return result;
  },
);

export const dataProcessor = inngest.createFunction(
  {
    id: "data-processor",
    triggers: { event: "data/process" },
  },
  async ({ event, step }) => {
    // step 1 fetch data
    const rowData = await step.run("fetch-data", async () => {
      console.log("Fetching data...");
      // simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { users: ["Ali", "Baba", "Alex"] };
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

export const emailSender = inngest.createFunction(
  {
    id: "email-sender",
    triggers: { event: "email/send" },
  },

  async ({ event, step }) => {
    // step 1 send email
    const { emails } = event.data;
    const results = [];

    for (const email of emails) {
      // send email
      const result = await step.run("send-email", async () => {
        console.log(`Sending email to ${email}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { email, status: "send", timeStamp: new Date().toISOString() };
      });
      results.push(result);

      if (email !== emails[emails.length - 1]) {
        await step.sleep("wait-for-next-email", "2s");
      }
    }
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
    const processed = await step.run("process-request", async () => {
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

export const apiFetcher = inngest.createFunction(
  {
    id: "api-fetcher",
    retries: 1,
    triggers: { event: "api/fetch" },
  },

  async ({ event, step }) => {
    const { url } = event.data;

    // This will automatically retry if it fails
    const data = await step.run("fetch-api", async () => {
      console.log(`Fetching from ${url}...`);

      // Simulate random failures (for demo)
      if (Math.random() > 0.3) {
        throw new Error("API temporarily unavailable");
      }

      return { url, data: "Success!" };
    });

    return data;
  },
);

export const validationFunction = inngest.createFunction(
  {
    id: "validation",
    triggers: { event: "data/validate" },
  },
  async ({ event, step }) => {
    const { email } = event.data;

    const isValid = await step.run("validate-email", async () => {
      if (!email.includes("@")) {
        // Don't retry validation errors - they'll always fail
        throw new NonRetriableError("Invalid email format");
      }
      return { email, valid: true };
    });

    return isValid;
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

export const dailyReport = inngest.createFunction(
  {
    id: "daily-report",
    // Run every minute (for testing - change to "0 9 * * *" for 9 AM daily)
    triggers: { cron: "*/1 * * * *" }, // Every minute
  },
  async ({ step }) => {
    const report = await step.run("generate-report", async () => {
      const timestamp = new Date().toISOString();
      console.log(`📊 Generating daily report at ${timestamp}`);

      // Simulate report generation
      return {
        date: new Date().toDateString(),
        metrics: {
          users: Math.floor(Math.random() * 1000),
          revenue: Math.floor(Math.random() * 10000),
        },
        generatedAt: timestamp,
      };
    });

    return report;
  },
);

export const batchProcessor = inngest.createFunction(
  {
    id: "batch-processor",
    concurrency: 2,
    triggers: { event: "batch/process" },
  },
  async ({ event, step }) => {
    const { items } = event.data;
    console.log(`Processing ${items.length} items...`);

    // Process each item (queued automatically)
    const results = await Promise.all(
      items.map((item: string, index: number) =>
        step.run(`process-item-${index}`, async () => {
          console.log(`Processing item: ${item}`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return { item, processed: true, timestamp: new Date().toISOString() };
        }),
      ),
    );

    return { processed: results.length, results };
  },
);

export const creatUser = inngest.createFunction(
  {
    id: "create-user",
    triggers: { event: "user/create" },
  },
  async ({ event, step }) => {
    const { email, name } = event.data;
    console.log(`Creating user: ${email}, ${name}`);

    await step.run("send-welcome-email", async () => {
      console.log(`Sending welcome email to ${email}...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return { email, name };
    });

    return { email, name };
  },
);
