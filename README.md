# Exercise 8: Inngest Step Functions

A Next.js app that demos three core Inngest patterns, triggered from the frontend (`app/page.tsx`) via axios:

1. **Multi-Step (`step.run()`)** — `data/process` event, three sequential steps (fetch → transform → save).
2. **Delay Step (`step.sleep()`)** — `reminder/schedule` event, sleeps then sends a reminder.
3. **Wait for Event (`step.waitForEvent()`)** — `workflow/start` + `workflow/approval` events, with approve/reject handling.

**Live demo:** https://inngest-exercise-8.vercel.app

## How it works

Each API route (`app/api/*`) sends an event to Inngest and returns immediately with an `eventId`/`runId`. The frontend then polls `/api/run-status` every ~1.5s to show live progress (`Scheduled` → `Running` → `Completed`) without holding one long HTTP request open.

`app/inngest/devApi.ts` fetches the real function output and works in two modes:

- **Local dev** — talks to the Inngest Dev Server (`http://localhost:8288`) via its GraphQL trace API.
- **Production (Vercel)** — talks to Inngest Cloud's public REST API (`https://api.inngest.com`), authenticated with `INNGEST_SIGNING_KEY`.

## Getting Started

```bash
npm install
npx inngest-cli dev   # in a separate terminal — starts the local Inngest Dev Server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try the three demo cards.

## Deploying

The production deployment needs an [Inngest Cloud](https://app.inngest.com) app synced to `/api/inngest`, with `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` set as Vercel environment variables.
