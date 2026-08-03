import "server-only";

import crypto from "node:crypto";

export type ActivationRecord = {
  licenseId: string;
  licenseKey: string;
  clientName: string;
  status: "issued" | "active" | "disabled";
  machineFingerprintHash: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const KEY_PREFIX = "mshpos:license:";

function kvUrl() {
  return process.env.KV_REST_API_URL?.replace(/\/+$/, "") || "";
}

function kvToken() {
  return process.env.KV_REST_API_TOKEN || "";
}

function recordKey(licenseKey: string) {
  return `${KEY_PREFIX}${licenseKey}`;
}

function assertKvConfigured() {
  if (!kvUrl() || !kvToken()) {
    throw new Error("Vercel KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
  }
}

async function kvCommand<T>(segments: string[]) {
  assertKvConfigured();

  const url = `${kvUrl()}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${kvToken()}`,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as { result?: T; error?: string } | null;
  if (!response.ok || body?.error) {
    throw new Error(body?.error || "Vercel KV request failed");
  }

  return body?.result ?? null;
}

export async function getActivationRecord(licenseKey: string) {
  const value = await kvCommand<string | null>(["get", recordKey(licenseKey)]);
  if (!value) return null;

  return JSON.parse(value) as ActivationRecord;
}

export async function saveActivationRecord(record: ActivationRecord) {
  await kvCommand(["set", recordKey(record.licenseKey), JSON.stringify(record)]);
  return record;
}

export async function issueActivationRecord(input: {
  licenseKey: string;
  clientName: string;
  expiresAt?: string | null;
  resetMachine?: boolean;
}) {
  const timestamp = new Date().toISOString();
  const existing = await getActivationRecord(input.licenseKey);
  const record: ActivationRecord = existing || {
    licenseId: crypto.randomUUID(),
    licenseKey: input.licenseKey,
    clientName: input.clientName,
    status: "issued",
    machineFingerprintHash: null,
    activatedAt: null,
    expiresAt: input.expiresAt || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  record.clientName = input.clientName || record.clientName;
  record.expiresAt = input.expiresAt ?? record.expiresAt;
  record.updatedAt = timestamp;

  if (input.resetMachine) {
    record.status = "issued";
    record.machineFingerprintHash = null;
    record.activatedAt = null;
  }

  return saveActivationRecord(record);
}

export function publicRecord(record: ActivationRecord) {
  return {
    licenseId: record.licenseId,
    licenseKey: record.licenseKey,
    clientName: record.clientName,
    status: record.status,
    activated: Boolean(record.machineFingerprintHash),
    activatedAt: record.activatedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
