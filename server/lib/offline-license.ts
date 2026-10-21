import "server-only";

export type SignedLicensePayload = {
  schemaVersion: 1;
  licenseId: string;
  licenseKeySuffix: string;
  clientName: string;
  machineFingerprintHash: string;
  activatedAt: string;
  expiresAt: string | null;
};

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
