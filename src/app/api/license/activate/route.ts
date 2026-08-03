import { NextRequest, NextResponse } from "next/server";
import { insertRows, readDb, updateRows } from "@/lib/local-store";
import {
  machineFingerprintHash,
  parseSignedLicense,
  verifySignedLicense,
} from "@/lib/offline-license";

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

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const licenseKey = typeof body?.licenseKey === "string" ? body.licenseKey.trim() : "";
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "Offline Client";
  const activationServerUrl = process.env.ACTIVATION_SERVER_URL?.trim();

  if (!licenseKey) {
    return NextResponse.json({ message: "License key is required" }, { status: 400 });
  }

  if (!activationServerUrl) {
    return NextResponse.json(
      { message: "Internet activation is not configured. Set ACTIVATION_SERVER_URL before building the client app." },
      { status: 503 }
    );
  }

  const currentMachine = machineFingerprintHash();
  const db = readDb();
  const matchingActive = db.licenses.find(
    (license) => license.license_key === licenseKey && license.status === "active"
  );

  if (matchingActive && verifySignedLicense(matchingActive.signed_payload, currentMachine).ok) {
    return NextResponse.json({ license: matchingActive });
  }

  let activationResponse: Response;
  try {
    activationResponse = await fetch(activationServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        clientName,
        machineFingerprintHash: currentMachine,
        appId: "com.mshpos.offline",
      }),
    });
  } catch {
    return NextResponse.json(
      { message: "Internet is required for first activation. Please connect and try again." },
      { status: 503 }
    );
  }

  const activationBody = await activationResponse.json().catch(() => ({}));
  if (!activationResponse.ok) {
    return NextResponse.json(
      { message: activationBody.message || "Activation server rejected this license key" },
      { status: activationResponse.status }
    );
  }

  const signedLicense = parseSignedLicense(activationBody.signedLicense);
  const verification = verifySignedLicense(signedLicense, currentMachine);
  if (!verification.ok || !signedLicense) {
    return NextResponse.json(
      { message: "Activation response could not be verified" },
      { status: 403 }
    );
  }

  const licenseRow = {
    license_key: licenseKey,
    client_name: verification.payload.clientName,
    machine_id: currentMachine,
    status: "active",
    activated_at: verification.payload.activatedAt,
    expires_at: verification.payload.expiresAt,
    signed_payload: JSON.stringify(signedLicense),
  };

  const existingLocal = db.licenses.find((license) => license.license_key === licenseKey);
  const { data } = existingLocal
    ? updateRows("licenses", licenseRow, [{ column: "id", op: "eq", value: existingLocal.id }])
    : insertRows("licenses", [licenseRow]);

  return NextResponse.json({ license: data[0] });
}
