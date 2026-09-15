import { serve } from "inngest/next";
import { inngest } from "../../inngest/client";
import {
  apiFetcher,
  approvalWorkflow,
  batchProcessor,
  creatUser,
  dailyReport,
  dataProcessor,
  emailSender,
  reminder,
  simpleGreeter,
  validationFunction,
} from "../../inngest/fuctions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    simpleGreeter,
    dataProcessor,
    emailSender,
    approvalWorkflow,
    apiFetcher,
    validationFunction,
    reminder,
    batchProcessor,
    creatUser,
  ],
});
