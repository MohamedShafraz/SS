import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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

const PLANS = [
  { slug: "starter", name: "Starter", amount: 2990 },
  { slug: "growth", name: "Growth", amount: 4990 },
  { slug: "multi-shop", name: "Multi-Shop", amount: 7990 },
];

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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

    const planSlug = getString(body.planSlug);
    const customerName = getString(body.customerName);
    const customerEmail = getString(body.customerEmail).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const isRegistration = Boolean(customerName || customerEmail || password);
    const plan = PLANS.find((item) => item.slug === planSlug);

    if (!plan) {
      return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
    }

    if (isRegistration) {
      if (!customerName || !customerEmail || !password) {
        return NextResponse.json(
          { message: "Name, email, and password are required" },
          { status: 400 }
        );
      }

      if (!isValidEmail(customerEmail)) {
        return NextResponse.json({ message: "Invalid email address" }, { status: 400 });
      }

      if (password.length < 8 || password.length > 128) {
        return NextResponse.json(
          { message: "Password must be between 8 and 128 characters" },
          { status: 400 }
        );
      }
    }

    const passwordHash = isRegistration ? await bcrypt.hash(password, 10) : null;
    const purchasePayload: Record<string, unknown> = {
      plan_name: plan.name,
      amount: plan.amount,
      currency: stripeCurrency,
      status: "pending",
    };

    if (isRegistration) {
      purchasePayload.customer_name = customerName;
      purchasePayload.customer_email = customerEmail;
      purchasePayload.password_hash = passwordHash;
      purchasePayload.user_role = "admin";
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from("plan_purchases")
      .insert([purchasePayload])
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error("Failed to create plan purchase record:", purchaseError);
      return NextResponse.json(
        { message: "Failed to create plan purchase record" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `MSPOS - ${plan.name} Plan`,
            },
            unit_amount: Math.max(1, Math.round(plan.amount * 100)),
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan_slug: plan.slug,
        plan_name: plan.name,
        purchase_id: purchase.id,
        registration: isRegistration ? "true" : "false",
      },
      customer_email: isRegistration ? customerEmail : undefined,
      success_url: `${appUrl}/payment?plan=${plan.slug}&stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment?plan=${plan.slug}&stripe=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    });

    const { error: updateError } = await supabase
      .from("plan_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    if (updateError) {
      console.error("Failed to link plan Stripe session:", updateError);
      return NextResponse.json(
        { message: "Failed to link plan checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error: any) {
    console.error("Stripe plan session error:", error);
    return NextResponse.json(
      { message: "Failed to create plan checkout session" },
      { status: 500 }
    );
  }
}
