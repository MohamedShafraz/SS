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

function getRegistrationValue(
  purchase: Record<string, unknown>,
  key: "customer_name" | "customer_email" | "password_hash" | "user_role"
) {
  const value = purchase[key];
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

    const purchaseId = session.metadata?.purchase_id;

    if (!purchaseId) {
      return NextResponse.json(
        { message: "Purchase reference missing" },
        { status: 400 }
      );
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from("plan_purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("stripe_session_id", session.id)
      .single();

    if (purchaseError || !purchase) {
      console.error("Failed to finalize plan purchase:", purchaseError);
      return NextResponse.json(
        { message: "Failed to finalize plan purchase" },
        { status: 500 }
      );
    }

    const purchaseRecord = purchase as Record<string, unknown>;
    const customerEmail = getRegistrationValue(purchaseRecord, "customer_email").toLowerCase();
    const passwordHash = getRegistrationValue(purchaseRecord, "password_hash");
    const customerName = getRegistrationValue(purchaseRecord, "customer_name");
    const userRole = getRegistrationValue(purchaseRecord, "user_role") || "admin";
    const shouldCreateUser = Boolean(customerEmail && passwordHash);
    let userId: string | null = typeof purchaseRecord.user_id === "string" ? purchaseRecord.user_id : null;

    if (shouldCreateUser) {
      if (userRole !== "admin" && userRole !== "manager" && userRole !== "cashier") {
        return NextResponse.json(
          { message: "Invalid registration role" },
          { status: 400 }
        );
      }

      const { data: createdUser, error: userError } = await supabase
        .from("users")
        .upsert(
          {
            email: customerEmail,
            name: customerName || customerEmail.split("@")[0] || "User",
            password_hash: passwordHash,
            role: userRole,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (userError || !createdUser) {
        console.error("Failed to create paid user:", userError);
        return NextResponse.json(
          { message: "Payment completed, but account creation failed" },
          { status: 500 }
        );
      }

      userId = createdUser.id;
    }

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      updated_at: new Date().toISOString(),
    };

    if (shouldCreateUser) {
      updatePayload.user_id = userId;
    }

    const { data: completedPurchase, error: updateError } = await supabase
      .from("plan_purchases")
      .update(updatePayload)
      .eq("id", purchaseId)
      .eq("stripe_session_id", session.id)
      .select("*")
      .single();

    if (updateError || !completedPurchase) {
      console.error("Failed to mark plan purchase completed:", updateError);
      return NextResponse.json(
        { message: "Failed to finalize plan purchase" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Plan payment finalized",
      purchaseId: completedPurchase.id,
      registration: shouldCreateUser,
      customerEmail: shouldCreateUser ? customerEmail : null,
    });
  } catch (error: any) {
    console.error("Complete plan error:", error);
    return NextResponse.json(
      { message: "Failed to complete plan payment" },
      { status: 500 }
    );
  }
}
