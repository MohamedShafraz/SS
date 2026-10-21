import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    activationBypassed: true,
    message: "Activation is temporarily disabled for this offline POS build.",
  });
}
