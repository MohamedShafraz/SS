import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const stripeCurrency = (process.env.STRIPE_CURRENCY || "lkr").toLowerCase();

const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" })
  : null;

type CartItem = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  discountType: "lkr" | "percentage";
  variant_id?: string;
};

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

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getCartProductId(item: CartItem) {
  return item.product_id || (item.variant_id ? item.id.replace(`-${item.variant_id}`, "") : item.id);
}

function parseCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const productId = typeof item.product_id === "string" ? item.product_id.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const price = toFiniteNumber(item.price);
  const quantity = toFiniteNumber(item.quantity);
  const discount = toFiniteNumber(item.discount ?? 0);
  const discountType = item.discountType === "percentage" ? "percentage" : "lkr";
  const variantId = typeof item.variant_id === "string" ? item.variant_id.trim() : undefined;

  if (!id || !name || price === null || price < 0 || quantity === null || quantity <= 0 || discount === null || discount < 0) {
    return null;
  }

  return {
    id,
    product_id: productId || (variantId ? id.replace(`-${variantId}`, "") : id),
    name,
    price,
    quantity,
    discount,
    discountType,
    ...(variantId ? { variant_id: variantId } : {}),
  };
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

    const rawCart = Array.isArray(body.cart) ? body.cart : [];
    const cart = rawCart.map(parseCartItem).filter((item): item is CartItem => item !== null);
    const total = toFiniteNumber(body.total);
    const discountAmount = toFiniteNumber(body.discountAmount ?? 0);
    const paymentMethod = "stripe";

    if (cart.length === 0) {
      return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
    }

    if (cart.length !== rawCart.length) {
      return NextResponse.json({ message: "Invalid cart item" }, { status: 400 });
    }

    if (total === null || total < 0 || discountAmount === null || discountAmount < 0) {
      return NextResponse.json({ message: "Invalid payment totals" }, { status: 400 });
    }

    const transactionDate = new Date().toISOString();

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .insert([
        {
          transaction_date: transactionDate,
          total_amount: total,
          discount_amount: discountAmount,
          tax_amount: 0,
          payment_method: paymentMethod,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (transactionError || !transactionData) {
      console.error("Failed to create pending transaction:", transactionError);
      return NextResponse.json(
        { message: "Failed to create pending transaction" },
        { status: 500 }
      );
    }

    const transactionId = transactionData.id as string;

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: stripeCurrency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.max(1, Math.round(Number(item.price || 0) * 100)),
      },
      quantity: Math.max(1, Number(item.quantity || 0)),
    }));

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      client_reference_id: transactionId,
      metadata: {
        transaction_id: transactionId,
        payment_method: paymentMethod,
      },
      success_url: `${appUrl}/pos?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pos?stripe=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    });

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ stripe_session_id: stripeSession.id })
      .eq("id", transactionId);

    if (updateError) {
      console.error("Failed to link Stripe session:", updateError);
      return NextResponse.json(
        { message: "Failed to link Stripe session" },
        { status: 500 }
      );
    }

    const itemRows = cart.map((item) => ({
      transaction_id: transactionId,
      product_id: getCartProductId(item),
      quantity: item.quantity,
      unit_price: item.price,
      discount: item.discountType === "percentage" ? (item.price * item.quantity * item.discount) / 100 : item.discount,
      subtotal:
        item.price * item.quantity -
        (item.discountType === "percentage"
          ? (item.price * item.quantity * item.discount) / 100
          : item.discount),
    }));

    const { error: itemsError } = await supabase
      .from("transaction_items")
      .insert(itemRows);

    if (itemsError) {
      console.error("Failed to create transaction items:", itemsError);
      return NextResponse.json(
        { message: "Failed to create transaction items" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: stripeSession.id,
      sessionUrl: stripeSession.url,
      transactionId,
    });
  } catch (error: any) {
    console.error("Stripe session error:", error);
    return NextResponse.json(
      { message: "Failed to create Stripe session" },
      { status: 500 }
    );
  }
}
