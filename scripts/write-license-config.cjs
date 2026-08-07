const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ||= value;
  }
}

loadDotEnv();

const activationServerUrl = (process.env.ACTIVATION_SERVER_URL || "").trim();
const publicKeyPem = (process.env.LICENSE_PUBLIC_KEY_PEM || "").trim();
const microsoftStoreProductId = (process.env.MICROSOFT_STORE_PRODUCT_ID || "").trim();

if (!activationServerUrl || !publicKeyPem) {
  throw new Error("ACTIVATION_SERVER_URL and LICENSE_PUBLIC_KEY_PEM are required.");
}

const outFile = path.join(process.cwd(), "client-build", "license-config.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      activationServerUrl,
      licensePublicKeyPem: publicKeyPem,
      // Optional for Microsoft Store builds. Use the durable add-on Store ID
      // from Partner Center, for example "9NBLGGH4TNMP".
      ...(microsoftStoreProductId ? { microsoftStoreProductId } : {}),
    },
    null,
    2
  )
);

console.log(`Wrote ${outFile}`);
