import { NextRequest, NextResponse } from "next/server";
import { processReturn, type ProcessReturnInput } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const session = requireSession(request, ["admin", "manager", "cashier"]);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 256 * 1024) {
      return NextResponse.json({ message: "Return request is too large" }, { status: 413 });
    }
    const body = await request.json() as ProcessReturnInput;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Return details are required" }, { status: 400 });
    }

    const result = processReturn(body, session.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Return processing failed" },
      { status: 409 }
    );
  }
}
