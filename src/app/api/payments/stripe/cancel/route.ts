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

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .eq("status", "pending")
      .single();

    if (transactionError && transactionError.code !== "PGRST116") {
      console.error("Failed to load pending transaction for cancellation:", transactionError);
      return NextResponse.json({ message: "Failed to cancel Stripe payment" }, { status: 500 });
    }

    if (transaction) {
      const { error: itemsError } = await supabase.from("transaction_items").delete().eq("transaction_id", transaction.id);
      if (itemsError) {
        console.error("Failed to delete cancelled transaction items:", itemsError);
        return NextResponse.json({ message: "Failed to cancel Stripe payment" }, { status: 500 });
      }

      const { error: deleteError } = await supabase.from("transactions").delete().eq("id", transaction.id);
      if (deleteError) {
        console.error("Failed to delete cancelled transaction:", deleteError);
        return NextResponse.json({ message: "Failed to cancel Stripe payment" }, { status: 500 });
      }
    }

    return NextResponse.json({ message: "Stripe payment cancelled" });
  } catch (error: any) {
    console.error("Stripe cancel error:", error);
    return NextResponse.json(
      { message: "Failed to cancel Stripe payment" },
      { status: 500 }
    );
  }
}
