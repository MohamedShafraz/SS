import "server-only";

import crypto from "node:crypto";

export type SignedLicensePayload = {
  schemaVersion: 1;
  licenseId: string;
  licenseKeySuffix: string;
  clientName: string;
  machineFingerprintHash: string;
  activatedAt: string;
  expiresAt: string | null;
};

export type SignedLicenseEnvelope = {
  payload: SignedLicensePayload;
  signature: string;
  keyId: string;
  algorithm: "ed25519";
};

export type LicenseVerification =
  | { ok: true; payload: SignedLicensePayload }
  | { ok: false; reason: string };

const FINGERPRINT_SALT = "mshpos-offline-machine-binding-v1";

function normalizePem(value: string | undefined) {
  return value?.trim().replace(/\\n/g, "\n") || "";
}

function base64UrlToBuffer(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function licensePublicKeyPem() {
  return normalizePem(process.env.LICENSE_PUBLIC_KEY_PEM);
}

export function canonicalLicensePayload(payload: SignedLicensePayload) {
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    licenseId: payload.licenseId,
    licenseKeySuffix: payload.licenseKeySuffix,
    clientName: payload.clientName,
    machineFingerprintHash: payload.machineFingerprintHash,
    activatedAt: payload.activatedAt,
    expiresAt: payload.expiresAt,
  });
}

export function machineFingerprintHash() {
  const rawFingerprint = [
    process.env.COMPUTERNAME,
    process.env.USERDOMAIN,
    process.env.PROCESSOR_IDENTIFIER,
    process.env.PROCESSOR_ARCHITECTURE,
    process.env.OS,
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();

  return `sha256:${crypto
    .createHash("sha256")
    .update(`${FINGERPRINT_SALT}|${rawFingerprint}`)
    .digest("hex")}`;
}

export function parseSignedLicense(value: unknown): SignedLicenseEnvelope | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    if (!parsed || typeof parsed !== "object") return null;

    const envelope = parsed as Partial<SignedLicenseEnvelope>;
    const payload = envelope.payload as Partial<SignedLicensePayload> | undefined;

    if (
      envelope.algorithm !== "ed25519" ||
      typeof envelope.keyId !== "string" ||
      typeof envelope.signature !== "string" ||
      !payload ||
      payload.schemaVersion !== 1 ||
      typeof payload.licenseId !== "string" ||
      typeof payload.licenseKeySuffix !== "string" ||
      typeof payload.clientName !== "string" ||
      typeof payload.machineFingerprintHash !== "string" ||
      typeof payload.activatedAt !== "string" ||
      !(typeof payload.expiresAt === "string" || payload.expiresAt === null)
    ) {
      return null;
    }

    return envelope as SignedLicenseEnvelope;
  } catch {
    return null;
  }
}

export function verifySignedLicense(
  signedLicense: unknown,
  expectedMachineFingerprintHash = machineFingerprintHash()
): LicenseVerification {
  const publicKey = licensePublicKeyPem();
  if (!publicKey) {
    return { ok: false, reason: "missing_public_key" };
  }

  const envelope = parseSignedLicense(signedLicense);
  if (!envelope) {
    return { ok: false, reason: "malformed_license" };
  }

  const isSignatureValid = crypto.verify(
    null,
    Buffer.from(canonicalLicensePayload(envelope.payload)),
    publicKey,
    base64UrlToBuffer(envelope.signature)
  );

  if (!isSignatureValid) {
    return { ok: false, reason: "invalid_signature" };
  }

  if (envelope.payload.machineFingerprintHash !== expectedMachineFingerprintHash) {
    return { ok: false, reason: "machine_mismatch" };
  }

  if (envelope.payload.expiresAt && new Date(envelope.payload.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload: envelope.payload };
}
