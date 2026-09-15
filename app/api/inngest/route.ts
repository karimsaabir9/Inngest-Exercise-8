import { serve } from "inngest/next";
import { inngest } from "../../inngest/client";
import { approvalWorkflow, dataProcessor, reminder } from "../../inngest/fuctions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dataProcessor, approvalWorkflow, reminder],
});
