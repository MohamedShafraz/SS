import { NextResponse } from "next/server";
import { readDb } from "@/lib/local-store";
import { machineFingerprintHash, verifySignedLicense } from "@/lib/offline-license";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();
  const currentMachine = machineFingerprintHash();
  const activeLicense = db.licenses.find((license) => {
    if (license.status !== "active" || license.machine_id !== currentMachine) {
      return false;
    }

    return verifySignedLicense(license.signed_payload, currentMachine).ok;
  });

  return NextResponse.json({
    activated: Boolean(activeLicense),
    machineBound: Boolean(activeLicense),
    usersCount: db.users.length,
    license: activeLicense
      ? {
          clientName: activeLicense.client_name,
          activatedAt: activeLicense.activated_at,
          expiresAt: activeLicense.expires_at,
        }
      : null,
  });
}
