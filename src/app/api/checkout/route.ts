import { NextRequest, NextResponse } from "next/server";
import { createCheckout } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CHECKOUT_ITEMS = 250;

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const session = requireSession(request, ["admin", "manager", "cashier"]);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Checkout request is too large" }, { status: 413 });
    }
    const body = await request.json() as { transaction?: unknown; items?: unknown };
    if (!body.transaction || typeof body.transaction !== "object" || Array.isArray(body.transaction) || !Array.isArray(body.items)) {
      return NextResponse.json({ message: "Transaction and items are required" }, { status: 400 });
    }
    if (body.items.length < 1 || body.items.length > MAX_CHECKOUT_ITEMS) {
      return NextResponse.json({ message: `Checkout requires between 1 and ${MAX_CHECKOUT_ITEMS} items` }, { status: 400 });
    }
    const result = createCheckout(body.transaction as Record<string, unknown>, body.items as Array<Record<string, unknown>>, session.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Checkout failed" }, { status: 409 });
  }
}
