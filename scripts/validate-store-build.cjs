const fs = require("fs");
const path = require("path");

const root = process.cwd();
const mode = process.argv[2];

function fail(message) {
  console.error(`Store validation failed: ${message}`);
  process.exitCode = 1;
}

if (mode === "--config") {
  const privacyUrl = String(process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || "").trim();
  try {
    const parsed = new URL(privacyUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".local") ||
      parsed.hostname === "example.com" ||
      parsed.hostname.endsWith(".example")
    ) {
      fail("NEXT_PUBLIC_PRIVACY_POLICY_URL must be a public HTTPS URL.");
    }
  } catch {
    fail("Set NEXT_PUBLIC_PRIVACY_POLICY_URL before building the Store package.");
  }
}

if (mode === "--artifact") {
  const standalone = path.join(root, ".next", "standalone");
  const forbiddenNames = new Set([
    ".env", ".env.local", ".env.production", ".env.production.local",
    "license-config.json", "pos-local-db.json", "pos-local-db.sqlite",
    "pos-local-db.sqlite-shm", "pos-local-db.sqlite-wal",
  ]);
  const forbiddenText = [
    "admin123", "manager123", "worker123", "admin@pos.com",
    "offline-pos-local-session-secret-change-before-client-build",
    "STRIPE_SECRET_KEY=", "SUPABASE_SERVICE_ROLE_KEY=",
    "-----BEGIN PRIVATE KEY-----", "-----BEGIN RSA PRIVATE KEY-----",
    "sk_live_", "service_role",
  ];

  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        inspect(fullPath);
      } else {
        const lowerName = entry.name.toLowerCase();
        if (
          lowerName === ".env" || lowerName.startsWith(".env.") ||
          forbiddenNames.has(lowerName) ||
          lowerName.endsWith(".sqlite3") ||
          lowerName.endsWith(".db") ||
          lowerName.endsWith(".db-wal") ||
          lowerName.endsWith(".db-shm") ||
          lowerName.endsWith(".sqlite") ||
          lowerName.endsWith(".sqlite-wal") ||
          lowerName.endsWith(".sqlite-shm") ||
          lowerName.endsWith(".pem") ||
          lowerName.endsWith(".key") ||
          lowerName.endsWith(".pfx") ||
          lowerName.endsWith(".p12")
        ) {
          fail(`forbidden file is packaged: ${path.relative(root, fullPath)}`);
        }
        if (entry.size <= 10 * 1024 * 1024) {
          const content = fs.readFileSync(fullPath, "utf8");
          for (const marker of forbiddenText) {
            if (content.includes(marker)) fail(`forbidden secret/test marker found in ${path.relative(root, fullPath)}`);
          }
        }
      }
    }
  }

  if (!fs.existsSync(standalone)) fail(".next/standalone is missing; run the production build first.");
  else inspect(standalone);
}

if (!process.exitCode) console.log("Store validation passed");
