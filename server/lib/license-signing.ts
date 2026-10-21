import "server-only";

import crypto from "node:crypto";
import { canonicalLicensePayload, type SignedLicensePayload } from "@/lib/offline-license";

function normalizePem(value: string | undefined) {
  return value?.trim().replace(/\\n/g, "\n") || "";
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function signLicensePayload(payload: SignedLicensePayload) {
  const privateKeyPem = normalizePem(process.env.LICENSE_PRIVATE_KEY_PEM);

  if (!privateKeyPem) {
    throw new Error("LICENSE_PRIVATE_KEY_PEM is required on the activation server.");
  }

  return {
    payload,
    signature: base64Url(
      crypto.sign(null, Buffer.from(canonicalLicensePayload(payload)), privateKeyPem)
    ),
    keyId: process.env.LICENSE_KEY_ID || "offline-license-2026-01",
    algorithm: "ed25519" as const,
  };
}
