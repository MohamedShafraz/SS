import { NextRequest, NextResponse } from "next/server";
import { getReturnableTransaction } from "@/lib/local-store";
import { authErrorResponse, requireSession } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    requireSession(request, ["admin", "manager", "cashier"]);
    const result = getReturnableTransaction(request.nextUrl.searchParams.get("transactionId") || "");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden"].includes(error.message)) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Transaction lookup failed" },
      { status: 400 }
    );
  }
}
