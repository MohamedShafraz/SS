import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Online Stripe payments are disabled in the offline Windows build" },
    { status: 410 }
  );
}
