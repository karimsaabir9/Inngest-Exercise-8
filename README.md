This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Exercise 8: Inngest step functions

The homepage (`app/page.tsx`) demos three Inngest patterns, triggered from the frontend with axios:

1. **Multi-Step (`step.run()`)** — `data/process` event, three sequential steps.
2. **Delay Step (`step.sleep()`)** — `reminder/schedule` event, sleeps then sends a reminder.
3. **Wait for Event (`step.waitForEvent()`)** — `workflow/start` + `workflow/approval` events.

Each API route sends the event, then polls the **local Inngest Dev Server** (`http://localhost:8288`) to fetch the function's real output and return it to the frontend.

> **Note on the deployed (Vercel) link:** the "fetch the real output" polling in `app/inngest/devApi.ts` talks to the Inngest Dev Server's local dev-only API (`http://localhost:8288`), which only exists when running `npx inngest-cli dev` alongside `npm run dev` on your own machine. That dev server does not exist in the Vercel deployment, so the buttons on the live link will error. All three flows were verified working end-to-end locally (see commit history / screenshots) — run the project locally per the steps below to see it working live.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
