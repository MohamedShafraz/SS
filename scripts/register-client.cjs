const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");

function arg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function boolArg(name) {
  return process.argv.includes(`--${name}`);
}

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

const outDir = arg("out-dir", path.join(process.cwd(), "client-build", "data"));
const dbPath = arg("db", path.join(outDir, "pos-local-db.sqlite"));
const companyName = arg("company", "Client Company");
const licenseKey = arg("license", `OFFLINE-${companyName.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}-${Date.now()}`);
const adminEmail = arg("admin-email", "admin@pos.local").toLowerCase();
const adminPassword = arg("admin-password", "admin12345");
const managerEmail = arg("manager-email", "manager@pos.local").toLowerCase();
const managerPassword = arg("manager-password", "manager12345");
const workerEmail = arg("worker-email", "worker@pos.local").toLowerCase();
const workerPassword = arg("worker-password", "worker12345");
const productsFile = arg("products");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (boolArg("fresh") && fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    variant_type TEXT NOT NULL,
    variant_value TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    price_adjustment REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transaction_date TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    status TEXT DEFAULT 'completed',
    stripe_session_id TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    is_replacement_transaction INTEGER NOT NULL DEFAULT 0,
    original_return_id TEXT
  );
  CREATE TABLE IF NOT EXISTS transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    original_transaction_id TEXT NOT NULL,
    return_date TEXT NOT NULL,
    reason TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS return_items (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    refund_amount REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS replacement_items (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    replacement_price REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    active INTEGER NOT NULL DEFAULT 1,
    last_login TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    password_reset_token_hash TEXT,
    password_reset_expires_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key TEXT NOT NULL,
    client_name TEXT,
    machine_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at TEXT NOT NULL,
    expires_at TEXT,
    signed_payload TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
`);

const timestamp = now();
const machineId = "UNBOUND-PENDING-CLIENT-ACTIVATION";
const settings = {
  businessName: companyName,
  address: arg("address", ""),
  phone: arg("phone", ""),
  email: arg("email", ""),
  taxRate: Number(arg("tax-rate", "5")),
  currency: arg("currency", "LKR"),
  businessType: arg("business-type", "Retail"),
  barcodePrefix: arg("barcode-prefix", "BCD"),
  industryMode: arg("industry", "general"),
};

db.prepare(`
  INSERT INTO settings (id, key, value, created_at, updated_at)
  VALUES (@id, 'posSettings', @value, @created_at, @updated_at)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`).run({
  id: id(),
  value: JSON.stringify(settings),
  created_at: timestamp,
  updated_at: timestamp,
});

db.prepare(`
  INSERT INTO licenses (id, license_key, client_name, machine_id, status, activated_at, expires_at, signed_payload, created_at, updated_at)
  VALUES (@id, @license_key, @client_name, @machine_id, 'issued', @activated_at, NULL, @signed_payload, @created_at, @updated_at)
`).run({
  id: id(),
  license_key: licenseKey,
  client_name: companyName,
  machine_id: machineId,
  activated_at: timestamp,
  signed_payload: `issued:${licenseKey}:${machineId}`,
  created_at: timestamp,
  updated_at: timestamp,
});

const upsertUser = db.prepare(`
  INSERT INTO users (id, email, name, password_hash, role, active, last_login, created_at, updated_at)
  VALUES (@id, @email, @name, @password_hash, @role, 1, NULL, @created_at, @updated_at)
  ON CONFLICT(email) DO UPDATE SET
    name = excluded.name,
    password_hash = excluded.password_hash,
    role = excluded.role,
    active = 1,
    updated_at = excluded.updated_at
`);

upsertUser.run({
  id: id(),
  email: adminEmail,
  name: "Admin",
  password_hash: bcrypt.hashSync(adminPassword, 10),
  role: "admin",
  created_at: timestamp,
  updated_at: timestamp,
});

upsertUser.run({
  id: id(),
  email: managerEmail,
  name: "Manager",
  password_hash: bcrypt.hashSync(managerPassword, 10),
  role: "manager",
  created_at: timestamp,
  updated_at: timestamp,
});

upsertUser.run({
  id: id(),
  email: workerEmail,
  name: "Worker",
  password_hash: bcrypt.hashSync(workerPassword, 10),
  role: "cashier",
  created_at: timestamp,
  updated_at: timestamp,
});

if (productsFile) {
  const products = JSON.parse(fs.readFileSync(productsFile, "utf8"));
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, cost, quantity, image_url, barcode, sku, created_at, updated_at)
    VALUES (@id, @name, @category, @price, @cost, @quantity, @image_url, @barcode, @sku, @created_at, @updated_at)
  `);

  for (const product of products) {
    insertProduct.run({
      id: product.id || id(),
      name: product.name,
      category: product.category || "Products",
      price: Number(product.price || 0),
      cost: Number(product.cost || 0),
      quantity: Number(product.quantity || 0),
      image_url: product.image_url || "",
      barcode: product.barcode || `BCD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sku: product.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
}

db.exec("PRAGMA wal_checkpoint(FULL)");
db.close();

console.log("Client registered");
console.log(`Company: ${companyName}`);
console.log(`License key: ${licenseKey}`);
console.log(`Database: ${dbPath}`);
console.log(`Admin: ${adminEmail} / ${adminPassword}`);
console.log(`Manager: ${managerEmail} / ${managerPassword}`);
console.log(`Worker: ${workerEmail} / ${workerPassword}`);
