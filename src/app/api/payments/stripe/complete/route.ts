import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" })
  : null;

async function parseJsonBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json(
        { message: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const sessionId = getString(body.sessionId);

    if (!sessionId) {
      return NextResponse.json({ message: "sessionId is required" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Payment is not completed yet" },
        { status: 400 }
      );
    }

    const transactionId = session.client_reference_id || session.metadata?.transaction_id;
    if (!transactionId) {
      return NextResponse.json(
        { message: "Transaction reference missing" },
        { status: 400 }
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        payment_method: "stripe",
      })
      .eq("id", transactionId)
      .eq("stripe_session_id", session.id)
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error("Failed to finalize transaction:", transactionError);
      return NextResponse.json(
        { message: "Failed to finalize transaction" },
        { status: 500 }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select("*")
      .eq("transaction_id", transactionId);

    if (itemsError) {
      console.error("Failed to load transaction items:", itemsError);
      return NextResponse.json(
        { message: "Failed to load transaction items" },
        { status: 500 }
      );
    }

    for (const item of items || []) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("quantity")
        .eq("id", item.product_id)
        .single();

      if (productError) {
        console.error("Failed to load product for inventory update:", productError);
        return NextResponse.json({ message: "Failed to update inventory" }, { status: 500 });
      }

      if (!product) continue;

      const { error: updateError } = await supabase
        .from("products")
        .update({ quantity: Math.max(0, Number(product.quantity || 0) - Number(item.quantity || 0)) })
        .eq("id", item.product_id);

      if (updateError) {
        console.error("Failed to update product inventory:", updateError);
        return NextResponse.json({ message: "Failed to update inventory" }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: "Stripe payment finalized",
      transactionId: transaction.id,
    });
  } catch (error: any) {
    console.error("Stripe complete error:", error);
    return NextResponse.json(
      { message: "Failed to complete Stripe payment" },
      { status: 500 }
    );
  }
}
