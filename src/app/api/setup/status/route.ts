import { NextResponse } from "next/server";
import { readDb } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();

  return NextResponse.json({
    usersCount: db.users.length,
  });
}
