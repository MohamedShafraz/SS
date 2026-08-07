import { NextRequest, NextResponse } from "next/server";
import { getActivationRecord, saveActivationRecord } from "@/lib/activation-records";
import { signLicensePayload } from "@/lib/license-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const licenseKey = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  const machineFingerprintHash =
    typeof body.machineFingerprintHash === "string" ? body.machineFingerprintHash.trim() : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";

  if (!licenseKey || !machineFingerprintHash) {
    return NextResponse.json(
      { message: "License key and machine fingerprint are required" },
      { status: 400 }
    );
  }

  try {
    const record = await getActivationRecord(licenseKey);

    if (!record || record.status === "disabled") {
      return NextResponse.json({ message: "Invalid license key" }, { status: 403 });
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json({ message: "This license has expired" }, { status: 403 });
    }

    if (
      record.machineFingerprintHash &&
      record.machineFingerprintHash !== machineFingerprintHash
    ) {
      return NextResponse.json(
        { message: "This license is already activated on another device" },
        { status: 409 }
      );
    }

    const timestamp = new Date().toISOString();
    const activatedRecord = {
      ...record,
      status: "active",
      clientName: record.clientName || clientName || "Offline Client",
      machineFingerprintHash,
      activatedAt: record.activatedAt || timestamp,
      updatedAt: timestamp,
    } as const;

    const signedLicense = signLicensePayload({
      schemaVersion: 1,
      licenseId: activatedRecord.licenseId,
      licenseKeySuffix: licenseKey.slice(-6),
      clientName: activatedRecord.clientName,
      machineFingerprintHash,
      activatedAt: activatedRecord.activatedAt || timestamp,
      expiresAt: activatedRecord.expiresAt,
    });

    await saveActivationRecord(activatedRecord);

    return NextResponse.json({ signedLicense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isSigningKeyError =
      message.includes("LICENSE_PRIVATE_KEY_PEM") ||
      message.includes("DECODER routines") ||
      message.includes("unsupported");

    return NextResponse.json(
      {
        message: isSigningKeyError
          ? "Activation server signing key is misconfigured. Check LICENSE_PRIVATE_KEY_PEM."
          : message || "Activation failed",
      },
      { status: 500 }
    );
  }
}
