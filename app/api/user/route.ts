import { NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";

export async function POST(req: Request) {
  const { email, name } = await req.json();

  // Create user (your business logic)
  const user = { id: "user-123", email, name };

  // Send event to trigger multiple functions
  await inngest.send({
    name: "user/create",
    data: {
      userId: user.id,
      email: user.email,
      name: user.name,
    },
  });

  return NextResponse.json({ success: true, user });
}
