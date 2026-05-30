import { supabase } from "./supabase";
import { Return } from "@/types";

/**
 * Fetch a transaction with all its items
 */
export const fetchTransactionWithItems = async (transactionId: string) => {
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

    return { transaction, items };
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
    return data?.[0] || null;
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
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    refund_amount: number;
  }>
): Promise<boolean> => {
  try {
    const returnItems = items.map((item) => ({
      return_id: returnId,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
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
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    replacement_price: number;
  }>
): Promise<boolean> => {
  try {
    const replacementItems = items.map((item) => ({
      return_id: returnId,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
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
) => {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          transaction_date: new Date().toISOString(),
          total_amount: totalAmount,
          discount_amount: discountAmount,
          tax_amount: 0,
          payment_method: paymentMethod,
          is_replacement_transaction: true,
          original_return_id: returnId,
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error("Error creating replacement transaction:", error);
    return null;
  }
};

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
