import { NextRequest, NextResponse } from "next/server";
import { deleteTransactionAndRestoreStock, readDb } from "@/lib/local-store";
import type { BusinessProfile } from "@/types";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "posSettings";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function transactionDeleteEnabled() {
  const row = readDb().settings.find((setting) => setting.key === SETTINGS_KEY);
  const settings = row?.value as Partial<BusinessProfile> | null | undefined;
  return Boolean(settings?.allowTransactionDelete);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin"]);

    if (!transactionDeleteEnabled()) {
      return NextResponse.json({ message: "Transaction deletion is disabled in settings" }, { status: 403 });
    }

    const transactionId = (await params).id?.trim();
    if (!transactionId) {
      return NextResponse.json({ message: "Transaction id is required" }, { status: 400 });
    }

    const result = deleteTransactionAndRestoreStock(transactionId);
    if (result.error) {
      return NextResponse.json(
        { message: result.error.message },
        { status: result.error.code === "PGRST116" ? 404 : 409 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
