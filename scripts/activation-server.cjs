const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = Number(process.env.PORT || 8787);
const recordsPath = process.env.ACTIVATION_RECORDS_PATH || path.join(process.cwd(), "activation-records.json");
const privateKeyPem = (process.env.LICENSE_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n").trim();
const keyId = process.env.LICENSE_KEY_ID || "offline-license-2026-01";

function arg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readRecords() {
  if (!fs.existsSync(recordsPath)) {
    return { licenses: [] };
  }

  return JSON.parse(fs.readFileSync(recordsPath, "utf8"));
}

function writeRecords(records) {
  fs.mkdirSync(path.dirname(recordsPath), { recursive: true });
  fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2));
}

function publicRecord(record) {
  return {
    licenseId: record.licenseId,
    licenseKey: record.licenseKey,
    clientName: record.clientName,
    status: record.status,
    activated: Boolean(record.machineFingerprintHash),
    activatedAt: record.activatedAt,
    expiresAt: record.expiresAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function canonicalLicensePayload(payload) {
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

function signLicense(payload) {
  if (!privateKeyPem) {
    throw new Error("LICENSE_PRIVATE_KEY_PEM is required on the activation server");
  }

  return {
    payload,
    signature: base64Url(crypto.sign(null, Buffer.from(canonicalLicensePayload(payload)), privateKeyPem)),
    keyId,
    algorithm: "ed25519",
  };
}

function issueLicense() {
  const licenseKey = arg("license");
  const clientName = arg("client", "Client Company");
  const expiresAt = arg("expires-at") || null;

  if (!licenseKey) {
    console.error("Usage: node scripts/activation-server.cjs --issue --license=OFFLINE-CLIENT-001 --client=\"Client Name\"");
    process.exit(1);
  }

  const records = readRecords();
  const existing = records.licenses.find((license) => license.licenseKey === licenseKey);
  const row = existing || {
    licenseId: crypto.randomUUID(),
    licenseKey,
    status: "issued",
    machineFingerprintHash: null,
    activatedAt: null,
    createdAt: new Date().toISOString(),
  };

  row.clientName = clientName;
  row.expiresAt = expiresAt;
  row.updatedAt = new Date().toISOString();

  if (!existing) {
    records.licenses.push(row);
  }

  writeRecords(records);
  console.log(`Issued license: ${licenseKey}`);
  console.log(`Client: ${clientName}`);
  console.log(`Records: ${recordsPath}`);
}

function listLicenses() {
  const status = arg("status", "all");
  const query = arg("q").trim().toLowerCase();
  const records = readRecords();
  const licenses = records.licenses
    .filter((license) => status === "all" || license.status === status)
    .filter((license) => {
      if (!query) return true;

      return [license.clientName, license.licenseKey, license.licenseId]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((first, second) => String(second.updatedAt).localeCompare(String(first.updatedAt)))
    .map(publicRecord);

  console.log(JSON.stringify({ clients: licenses }, null, 2));
}

function readJson(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function handleActivate(request, response) {
  const body = await readJson(request);
  const licenseKey = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  const machineFingerprintHash =
    typeof body.machineFingerprintHash === "string" ? body.machineFingerprintHash.trim() : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";

  if (!licenseKey || !machineFingerprintHash) {
    return send(response, 400, { message: "License key and machine fingerprint are required" });
  }

  const records = readRecords();
  const license = records.licenses.find((row) => row.licenseKey === licenseKey);

  if (!license || license.status === "disabled") {
    return send(response, 403, { message: "Invalid license key" });
  }

  if (license.machineFingerprintHash && license.machineFingerprintHash !== machineFingerprintHash) {
    return send(response, 409, { message: "This license is already activated on another device" });
  }

  if (license.expiresAt && new Date(license.expiresAt).getTime() <= Date.now()) {
    return send(response, 403, { message: "This license has expired" });
  }

  license.status = "active";
  license.clientName = license.clientName || clientName || "Offline Client";
  license.machineFingerprintHash = machineFingerprintHash;
  license.activatedAt = license.activatedAt || new Date().toISOString();
  license.updatedAt = new Date().toISOString();
  writeRecords(records);

  const payload = {
    schemaVersion: 1,
    licenseId: license.licenseId,
    licenseKeySuffix: license.licenseKey.slice(-6),
    clientName: license.clientName,
    machineFingerprintHash,
    activatedAt: license.activatedAt,
    expiresAt: license.expiresAt || null,
  };

  return send(response, 200, { signedLicense: signLicense(payload) });
}

if (process.argv.includes("--issue")) {
  issueLicense();
  process.exit(0);
}

if (process.argv.includes("--list")) {
  listLicenses();
  process.exit(0);
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return send(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url.startsWith("/clients")) {
    const token = process.env.ACTIVATION_ADMIN_TOKEN;
    const isAuthorized = !token || request.headers.authorization === `Bearer ${token}`;

    if (!isAuthorized) {
      return send(response, 401, { message: "Unauthorized" });
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const status = requestUrl.searchParams.get("status") || "all";
    const query = (requestUrl.searchParams.get("q") || "").trim().toLowerCase();
    const records = readRecords();
    const clients = records.licenses
      .filter((license) => status === "all" || license.status === status)
      .filter((license) => {
        if (!query) return true;

        return [license.clientName, license.licenseKey, license.licenseId]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((first, second) => String(second.updatedAt).localeCompare(String(first.updatedAt)))
      .map(publicRecord);

    return send(response, 200, { clients });
  }

  if (request.method === "POST" && request.url === "/activate") {
    handleActivate(request, response).catch((error) => {
      console.error(error);
      send(response, 500, { message: "Activation server error" });
    });
    return;
  }

  send(response, 404, { message: "Not found" });
});

server.listen(port, () => {
  console.log(`Activation server listening on http://localhost:${port}`);
  console.log(`Activation endpoint: http://localhost:${port}/activate`);
  console.log(`Client tracking endpoint: http://localhost:${port}/clients`);
  console.log(`Records: ${recordsPath}`);
});
