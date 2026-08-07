import { supabase } from "./supabase";
import type {
  ReplacementItemInsert,
  Return,
  ReturnItemInsert,
  Transaction,
  TransactionInsert,
  TransactionItemWithProductRow,
} from "@/types";
import {
  normalizeReturn,
  normalizeTransaction,
  normalizeTransactionItemWithProduct,
} from "./contracts";

export interface TransactionWithItems {
  transaction: Transaction;
  items: ReturnableTransactionItem[];
}

export type TransactionLookupResult =
  | { ok: true; transaction: Transaction; items: ReturnableTransactionItem[] }
  | { ok: false; reason: "not_found" | "non_returnable" | "no_returnable_items" };

export type ReturnableTransactionItem = ReturnType<typeof normalizeTransactionItemWithProduct>;

function isReturnTransaction(transaction: Transaction) {
  return Boolean(transaction.original_return_id) && transaction.total_amount < 0;
}

export interface ReturnItemInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  refund_amount: number;
}

export interface ReplacementItemInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  replacement_price: number;
}

export interface TransactionLineInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

/**
 * Fetch a transaction with all its items
 */
export const fetchTransactionWithItems = async (
  transactionId: string
): Promise<TransactionWithItems | null> => {
  try {
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError) throw txError;

    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select("*, products(*)")
      .eq("transaction_id", transactionId);

    if (itemsError) throw itemsError;

    return {
      transaction: normalizeTransaction(transaction),
      items: ((items ?? []) as TransactionItemWithProductRow[]).map(
        normalizeTransactionItemWithProduct
      ),
    };
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
};

/**
 * Create a return record
 */
export const createReturn = async (
  originalTransactionId: string,
  reason: string,
  notes: string
): Promise<Return | null> => {
  try {
    const { data, error } = await supabase
      .from("returns")
      .insert([
        {
          original_transaction_id: originalTransactionId,
          return_date: new Date().toISOString(),
          reason,
          notes,
          status: "pending",
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] ? normalizeReturn(data[0]) : null;
  } catch (error) {
    console.error("Error creating return:", error);
    return null;
  }
};

/**
 * Add items to a return
 */
export const addReturnItems = async (
  returnId: string,
  items: ReturnItemInput[]
): Promise<boolean> => {
  try {
    const returnItems: ReturnItemInsert[] = items.map((item) => ({
      return_id: returnId,
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: item.quantity,
      refund_amount: item.refund_amount,
      status: "pending",
    }));

    const { error } = await supabase
      .from("return_items")
      .insert(returnItems);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error adding return items:", error);
    return false;
  }
};

/**
 * Add replacement items to a return
 */
export const addReplacementItems = async (
  returnId: string,
  items: ReplacementItemInput[]
): Promise<boolean> => {
  try {
    const replacementItems: ReplacementItemInsert[] = items.map((item) => ({
      return_id: returnId,
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: item.quantity,
      replacement_price: item.replacement_price,
      status: "pending",
    }));

    const { error } = await supabase
      .from("replacement_items")
      .insert(replacementItems);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error adding replacement items:", error);
    return false;
  }
};

/**
 * Create replacement transaction
 */
export const createReplacementTransaction = async (
  returnId: string,
  totalAmount: number,
  discountAmount: number,
  paymentMethod: string
): Promise<Transaction | null> => {
  try {
    const replacementTransaction: TransactionInsert = {
      transaction_date: new Date().toISOString(),
      total_amount: totalAmount,
      discount_amount: discountAmount,
      tax_amount: 0,
      payment_method: paymentMethod,
      status: "completed",
      stripe_session_id: null,
      user_id: null,
      is_replacement_transaction: true,
      original_return_id: returnId,
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert([replacementTransaction])
      .select();

    if (error) throw error;
    return data?.[0] ? normalizeTransaction(data[0]) : null;
  } catch (error) {
    console.error("Error creating replacement transaction:", error);
    return null;
  }
};

/**
 * Create a negative transaction for a completed return so reports reflect refunds.
 */
export const createReturnTransaction = async (
  returnId: string,
  refundAmount: number,
  paymentMethod: string
): Promise<Transaction | null> => {
  try {
    const returnTransaction: TransactionInsert = {
      transaction_date: new Date().toISOString(),
      total_amount: -Math.abs(refundAmount),
      discount_amount: 0,
      tax_amount: 0,
      payment_method: paymentMethod,
      status: "completed",
      stripe_session_id: null,
      user_id: null,
      is_replacement_transaction: false,
      original_return_id: returnId,
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert([returnTransaction])
      .select();

    if (error) throw error;
    return data?.[0] ? normalizeTransaction(data[0]) : null;
  } catch (error) {
    console.error("Error creating return transaction:", error);
    return null;
  }
};

export const fetchReturnableTransactionWithItems = async (
  transactionId: string
): Promise<TransactionLookupResult> => {
  const result = await fetchTransactionWithItems(transactionId);
  if (!result) {
    return { ok: false, reason: "not_found" };
  }

  if (isReturnTransaction(result.transaction) || result.transaction.is_replacement_transaction) {
    return { ok: false, reason: "non_returnable" };
  }

  const returnableItems = result.items.filter(
    (item) => item.quantity > 0 && item.subtotal > 0
  );

  if (returnableItems.length === 0) {
    return { ok: false, reason: "no_returnable_items" };
  }

  return {
    ok: true,
    transaction: result.transaction,
    items: returnableItems,
  };
};

/**
 * Save transaction item rows for return/replacement transactions.
 */
export const createTransactionItems = async (
  transactionId: string,
  items: TransactionLineInput[]
): Promise<boolean> => {
  try {
    const transactionItems = items.map((item) => ({
      transaction_id: transactionId,
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      subtotal: item.subtotal,
    }));

    const { error } = await supabase
      .from("transaction_items")
      .insert(transactionItems);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error creating transaction items:", error);
    return false;
  }
};

export const createReplacementTransactionItems = createTransactionItems;
export const createReturnTransactionItems = createTransactionItems;

/**
 * Mark return as completed
 */
export const completeReturn = async (returnId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("returns")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", returnId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error completing return:", error);
    return false;
  }
};
