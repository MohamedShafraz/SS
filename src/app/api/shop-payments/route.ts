import { NextRequest, NextResponse } from "next/server";
import { deleteShopPayment, recordShopPayment, updateShopPayment } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin", "manager"]);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Request body is too large" }, { status: 413 });
    }
    const body = await request.json() as {
      transactionId?: unknown;
      amount?: unknown;
      paymentMethod?: unknown;
      notes?: unknown;
    };
    const result = recordShopPayment({
      transactionId: typeof body.transactionId === "string" ? body.transactionId : "",
      amount: Number(body.amount),
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "",
      notes: typeof body.notes === "string" ? body.notes : "",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to record shop payment" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin", "manager"]);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Request body is too large" }, { status: 413 });
    }
    const body = await request.json() as { id?: unknown; amount?: unknown; notes?: unknown };
    const result = updateShopPayment({
      id: typeof body.id === "string" ? body.id : "",
      amount: Number(body.amount),
      notes: typeof body.notes === "string" ? body.notes : "",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update shop payment" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin", "manager"]);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Request body is too large" }, { status: 413 });
    }
    const body = await request.json() as { id?: unknown };
    const result = deleteShopPayment(typeof body.id === "string" ? body.id : "");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete shop payment" },
      { status: 400 }
    );
  }
}
