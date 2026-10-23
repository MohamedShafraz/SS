import type { Transaction, TransactionItemWithProductRow } from "@/types";
import { normalizeTransaction, normalizeTransactionItemWithProduct } from "./contracts";

export type ReturnableTransactionItem = ReturnType<typeof normalizeTransactionItemWithProduct>;

export type TransactionLookupResult =
  | { ok: true; transaction: Transaction; items: ReturnableTransactionItem[] }
  | { ok: false; reason: "not_found" | "non_returnable" | "no_returnable_items" };

export interface ProcessReturnRequest {
  originalTransactionId: string;
  reason: string;
  notes?: string;
  returnedItems: Array<{ transactionItemId: string; quantity: number }>;
  replacementItems: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
  replacementPaymentMethod: string;
  replacementTaxAmount: number;
}

export async function fetchReturnableTransactionWithItems(
  transactionId: string
): Promise<TransactionLookupResult> {
  try {
    const response = await fetch(`/api/returns/lookup?transactionId=${encodeURIComponent(transactionId)}`, {
      cache: "no-store",
    });
    const result = await response.json() as {
      ok?: boolean;
      reason?: "not_found" | "non_returnable" | "no_returnable_items";
      transaction?: unknown;
      items?: unknown[];
      message?: string;
    };
    if (!response.ok) throw new Error(result.message || "Transaction lookup failed");
    if (!result.ok || !result.transaction || !Array.isArray(result.items)) {
      return { ok: false, reason: result.reason || "not_found" };
    }
    return {
      ok: true,
      transaction: normalizeTransaction(result.transaction as Parameters<typeof normalizeTransaction>[0]),
      items: (result.items as TransactionItemWithProductRow[]).map(normalizeTransactionItemWithProduct),
    };
  } catch (error) {
    console.error("Error fetching returnable transaction:", error);
    throw error;
  }
}

export async function processReturn(request: ProcessReturnRequest) {
  const response = await fetch("/api/returns/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(result.message || "Return processing failed");
  return result;
}
