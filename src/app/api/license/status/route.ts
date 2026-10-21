import { NextResponse } from "next/server";
import { readDb } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();

  return NextResponse.json({
    activated: true,
    machineBound: false,
    activationBypassed: true,
    usersCount: db.users.length,
    license: null,
  });
}
