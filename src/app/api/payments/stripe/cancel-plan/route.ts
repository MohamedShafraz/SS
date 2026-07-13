import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

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
    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const sessionId = getString(body.sessionId);

    if (!sessionId) {
      return NextResponse.json({ message: "sessionId is required" }, { status: 400 });
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from("plan_purchases")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .eq("status", "pending")
      .single();

    if (purchaseError && purchaseError.code !== "PGRST116") {
      console.error("Failed to load pending plan purchase for cancellation:", purchaseError);
      return NextResponse.json({ message: "Failed to cancel plan payment" }, { status: 500 });
    }

    if (purchase) {
      const { error: updateError } = await supabase
        .from("plan_purchases")
        .update({ status: "cancelled" })
        .eq("id", purchase.id);

      if (updateError) {
        console.error("Failed to cancel plan purchase:", updateError);
        return NextResponse.json({ message: "Failed to cancel plan payment" }, { status: 500 });
      }
    }

    return NextResponse.json({ message: "Plan payment cancelled" });
  } catch (error: any) {
    console.error("Cancel plan error:", error);
    return NextResponse.json(
      { message: "Failed to cancel plan payment" },
      { status: 500 }
    );
  }
}
