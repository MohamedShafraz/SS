import "server-only";

import { existsSync, mkdirSync, readFileSync, unlinkSync, copyFileSync, renameSync } from "fs";
import { dirname, join } from "path";
import { DatabaseSync } from "node:sqlite";
import type {
  ProductRow,
  ProductVariantRow,
  ReplacementItemRow,
  ReturnItemRow,
  ReturnRow,
  ShopAccountRow,
  ShopPaymentRow,
  TransactionItemRow,
  TransactionRow,
} from "@/types";

type TableName =
  | "products"
  | "product_variants"
  | "transactions"
  | "transaction_items"
  | "returns"
  | "return_items"
  | "replacement_items"
  | "suppliers"
  | "shop_accounts"
  | "shop_payments"
  | "supplier_payments"
  | "expenses"
  | "companies"
  | "users"
  | "settings"
  | "licenses";

type LocalDb = Record<TableName, any[]>;

export type LocalFilter = {
  column: string;
  op: "eq" | "is" | "orStatusCompleted";
  value?: unknown;
};

export type LocalOrder = {
  column: string;
  ascending: boolean;
};

export type LocalQuery = {
  filters?: LocalFilter[];
  order?: LocalOrder | null;
  single?: boolean;
  maybeSingle?: boolean;
  select?: string;
};

const TABLES: TableName[] = [
  "products",
  "product_variants",
  "transactions",
  "transaction_items",
  "returns",
  "return_items",
  "replacement_items",
  "suppliers",
  "shop_accounts",
  "shop_payments",
  "supplier_payments",
  "expenses",
  "companies",
  "users",
  "settings",
  "licenses",
];

const TABLE_COLUMNS: Record<TableName, string[]> = {
  products: [
    "id",
    "name",
    "category",
    "price",
    "cost",
    "least_price",
    "least_price_code",
    "company_id",
    "quantity",
    "image_url",
    "barcode",
    "sku",
    "created_at",
    "updated_at",
  ],
  product_variants: [
    "id",
    "product_id",
    "variant_type",
    "variant_value",
    "variant_type_2",
    "variant_value_2",
    "sku",
    "barcode",
    "quantity",
    "price_adjustment",
    "least_price",
    "least_price_code",
    "image_url",
    "created_at",
    "updated_at",
  ],
  transactions: [
    "id",
    "transaction_date",
    "total_amount",
    "discount_amount",
    "tax_amount",
    "amount_paid",
    "balance_amount",
    "payment_method",
    "status",
    "stripe_session_id",
    "user_id",
    "created_at",
    "is_replacement_transaction",
    "original_return_id",
    "shop_id",
    "customer_name",
    "sale_type",
    "payment_status",
    "due_amount",
  ],
  transaction_items: [
    "id",
    "transaction_id",
    "product_id",
    "variant_id",
    "quantity",
    "unit_price",
    "discount",
    "subtotal",
    "created_at",
  ],
  returns: [
    "id",
    "original_transaction_id",
    "return_date",
    "reason",
    "notes",
    "status",
    "created_at",
    "updated_at",
  ],
  return_items: [
    "id",
    "return_id",
    "product_id",
    "variant_id",
    "quantity",
    "refund_amount",
    "status",
    "created_at",
  ],
  replacement_items: [
    "id",
    "return_id",
    "product_id",
    "variant_id",
    "quantity",
    "replacement_price",
    "status",
    "created_at",
  ],
  suppliers: [
    "id",
    "name",
    "phone",
    "email",
    "address",
    "products",
    "total_amount",
    "paid_amount",
    "due_amount",
    "payment_status",
    "created_at",
    "updated_at",
  ],
  supplier_payments: [
    "id",
    "supplier_id",
    "payment_date",
    "amount",
    "notes",
    "created_at",
  ],
  shop_accounts: [
    "id",
    "name",
    "phone",
    "address",
    "notes",
    "total_billed",
    "total_paid",
    "due_amount",
    "payment_status",
    "created_at",
    "updated_at",
  ],
  shop_payments: [
    "id",
    "shop_id",
    "transaction_id",
    "payment_date",
    "amount",
    "payment_method",
    "notes",
    "created_at",
  ],
  expenses: [
    "id",
    "expense_date",
    "category",
    "description",
    "amount",
    "created_at",
    "updated_at",
  ],
  companies: [
    "id",
    "name",
    "notes",
    "created_at",
    "updated_at",
  ],
  users: [
    "id",
    "email",
    "name",
    "password_hash",
    "role",
    "active",
    "last_login",
    "created_at",
    "updated_at",
    "password_reset_token_hash",
    "password_reset_expires_at",
  ],
  settings: ["id", "key", "value", "created_at", "updated_at"],
  licenses: [
    "id",
    "license_key",
    "client_name",
    "machine_id",
    "status",
    "activated_at",
    "expires_at",
    "signed_payload",
    "created_at",
    "updated_at",
  ],
};

type SqliteDb = InstanceType<typeof DatabaseSync>;

let connection: SqliteDb | null = null;

function dbPath() {
  return process.env.POS_LOCAL_DB_PATH || join(process.cwd(), "data", "pos-local-db.sqlite");
}

function legacyJsonPath() {
  return join(process.cwd(), "data", "pos-local-db.json");
}

function now() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function emptyDb(): LocalDb {
  return TABLES.reduce((db, table) => {
    db[table] = [];
    return db;
  }, {} as LocalDb);
}

function normalizeDb(value: unknown): LocalDb {
  const db = emptyDb();
  if (!value || typeof value !== "object") return db;

  for (const table of TABLES) {
    const rows = (value as Record<string, unknown>)[table];
    db[table] = Array.isArray(rows) ? rows : [];
  }
  return db;
}

function serializeValue(value: unknown) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }
  return value ?? null;
}

function normalizeRow(table: TableName, row: Record<string, unknown>) {
  if (table === "users") {
    return { ...row, active: Boolean(row.active) };
  }

  if (table === "transactions") {
    return {
      ...row,
      is_replacement_transaction: Boolean(row.is_replacement_transaction),
    };
  }

  if (table === "settings" && typeof row.value === "string") {
    try {
      return { ...row, value: JSON.parse(row.value) };
    } catch {
      return row;
    }
  }

  return row;
}

function getDb() {
  if (connection) {
    migrate(connection);
    return connection;
  }

  const file = dbPath();
  mkdirSync(dirname(file), { recursive: true });
  connection = new DatabaseSync(file);
  connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA foreign_keys = ON");
  migrate(connection);
  importLegacyJsonIfNeeded(connection);
  return connection;
}

function closeDb() {
  if (!connection) return;
  connection.close();
  connection = null;
}

function migrate(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      least_price REAL DEFAULT 0,
      least_price_code TEXT DEFAULT '',
      company_id TEXT,
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
      variant_type_2 TEXT,
      variant_value_2 TEXT,
      sku TEXT UNIQUE,
      barcode TEXT UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0,
      price_adjustment REAL NOT NULL DEFAULT 0,
      least_price REAL DEFAULT 0,
      least_price_code TEXT DEFAULT '',
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transaction_date TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance_amount REAL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      stripe_session_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      is_replacement_transaction INTEGER NOT NULL DEFAULT 0,
      original_return_id TEXT,
      shop_id TEXT,
      customer_name TEXT,
      sale_type TEXT DEFAULT 'walk_in',
      payment_status TEXT DEFAULT 'paid',
      due_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      original_transaction_id TEXT NOT NULL,
      return_date TEXT NOT NULL,
      reason TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (original_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      refund_amount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (variant_id) REFERENCES product_variants(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      products TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      due_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shop_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      total_billed REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      due_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_payments (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (shop_id) REFERENCES shop_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replacement_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      replacement_price REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (variant_id) REFERENCES product_variants(id)
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

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
  `);

  ensureColumn(db, "transaction_items", "variant_id", "TEXT");
  ensureColumn(db, "products", "least_price", "REAL DEFAULT 0");
  ensureColumn(db, "products", "least_price_code", "TEXT DEFAULT ''");
  ensureColumn(db, "products", "company_id", "TEXT");
  ensureColumn(db, "product_variants", "variant_type_2", "TEXT");
  ensureColumn(db, "product_variants", "variant_value_2", "TEXT");
  ensureColumn(db, "product_variants", "least_price", "REAL DEFAULT 0");
  ensureColumn(db, "product_variants", "least_price_code", "TEXT DEFAULT ''");
  ensureColumn(db, "transactions", "amount_paid", "REAL DEFAULT 0");
  ensureColumn(db, "transactions", "balance_amount", "REAL DEFAULT 0");
  ensureColumn(db, "transactions", "shop_id", "TEXT");
  ensureColumn(db, "transactions", "customer_name", "TEXT");
  ensureColumn(db, "transactions", "sale_type", "TEXT DEFAULT 'walk_in'");
  ensureColumn(db, "transactions", "payment_status", "TEXT DEFAULT 'paid'");
  ensureColumn(db, "transactions", "due_amount", "REAL DEFAULT 0");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
    CREATE INDEX IF NOT EXISTS idx_shop_payments_shop ON shop_payments(shop_id);
    CREATE INDEX IF NOT EXISTS idx_shop_payments_transaction ON shop_payments(transaction_id);
  `);
}

function ensureColumn(db: SqliteDb, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((item) => item.name === column)) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function importLegacyJsonIfNeeded(db: SqliteDb) {
  const existingRows = TABLES.reduce((sum, table) => {
    const result = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return sum + result.count;
  }, 0);

  if (existingRows > 0 || !existsSync(legacyJsonPath())) return;

  try {
    const legacy = normalizeDb(JSON.parse(readFileSync(legacyJsonPath(), "utf8")));
    const legacyRows = TABLES.reduce((sum, table) => sum + legacy[table].length, 0);
    if (legacyRows === 0) return;

    writeDb(legacy);
  } catch {
    // Ignore invalid legacy JSON; SQLite will start with empty tables.
  }
}

function withDefaults(table: TableName, row: any) {
  const timestamp = now();
  const base = {
    id: row.id || makeId(),
    created_at: row.created_at || timestamp,
  };

  if (table === "products") {
    return {
      ...base,
      name: row.name,
      category: row.category,
      price: Number(row.price || 0),
      cost: Number(row.cost || 0),
      least_price: row.least_price == null ? 0 : Number(row.least_price || 0),
      least_price_code: row.least_price_code || "",
      company_id: row.company_id || null,
      quantity: Number(row.quantity || 0),
      image_url: row.image_url || "",
      barcode: row.barcode || `BCD-${Date.now()}`,
      sku: row.sku || `SKU-${Date.now()}`,
      updated_at: row.updated_at || timestamp,
    } satisfies ProductRow;
  }

  if (table === "product_variants") {
    return {
      ...base,
      product_id: row.product_id,
      variant_type: row.variant_type,
      variant_value: row.variant_value,
      variant_type_2: row.variant_type_2 || null,
      variant_value_2: row.variant_value_2 || null,
      sku: row.sku || `SKU-${Date.now()}`,
      barcode: row.barcode || `BCD-${Date.now()}`,
      quantity: Number(row.quantity || 0),
      price_adjustment: Number(row.price_adjustment || 0),
      least_price: row.least_price == null ? 0 : Number(row.least_price || 0),
      least_price_code: row.least_price_code || "",
      image_url: row.image_url || null,
      updated_at: row.updated_at || timestamp,
    } satisfies ProductVariantRow;
  }

  if (table === "transactions") {
    return {
      ...base,
      transaction_date: row.transaction_date || timestamp,
      total_amount: Number(row.total_amount || 0),
      discount_amount: Number(row.discount_amount || 0),
      tax_amount: Number(row.tax_amount || 0),
      amount_paid: row.amount_paid == null ? 0 : Number(row.amount_paid || 0),
      balance_amount: row.balance_amount == null ? 0 : Number(row.balance_amount || 0),
      payment_method: row.payment_method || "cash",
      status: row.status || "completed",
      stripe_session_id: null,
      user_id: row.user_id || null,
      is_replacement_transaction: Boolean(row.is_replacement_transaction),
      original_return_id: row.original_return_id || null,
      shop_id: row.shop_id || null,
      customer_name: row.customer_name || null,
      sale_type: row.sale_type || (row.shop_id ? "shop" : "walk_in"),
      payment_status: row.payment_status || (Number(row.due_amount || 0) > 0 ? "partial" : "paid"),
      due_amount: row.due_amount == null ? 0 : Number(row.due_amount || 0),
    } satisfies TransactionRow;
  }

  if (table === "transaction_items") {
    return {
      ...base,
      transaction_id: row.transaction_id,
      product_id: row.product_id,
      variant_id: row.variant_id || null,
      quantity: Number(row.quantity || 0),
      unit_price: Number(row.unit_price || 0),
      discount: Number(row.discount || 0),
      subtotal: Number(row.subtotal || 0),
    } satisfies TransactionItemRow & { created_at: string };
  }

  if (table === "returns") {
    return {
      ...base,
      original_transaction_id: row.original_transaction_id,
      return_date: row.return_date || timestamp,
      reason: row.reason || null,
      notes: row.notes || null,
      status: row.status || "pending",
      updated_at: row.updated_at || timestamp,
    } satisfies ReturnRow;
  }

  if (table === "return_items") {
    return {
      ...base,
      return_id: row.return_id,
      product_id: row.product_id,
      variant_id: row.variant_id || null,
      quantity: Number(row.quantity || 0),
      refund_amount: Number(row.refund_amount || 0),
      status: row.status || "pending",
    } satisfies ReturnItemRow;
  }

  if (table === "replacement_items") {
    return {
      ...base,
      return_id: row.return_id,
      product_id: row.product_id,
      variant_id: row.variant_id || null,
      quantity: Number(row.quantity || 0),
      replacement_price: Number(row.replacement_price || 0),
      status: row.status || "pending",
    } satisfies ReplacementItemRow;
  }

  if (table === "suppliers") {
    const total = Number(row.total_amount || 0);
    const paid = Number(row.paid_amount || 0);
    const due = Math.max(0, Number(row.due_amount ?? total - paid));
    return {
      ...base,
      name: row.name,
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
      products: row.products || "",
      total_amount: total,
      paid_amount: paid,
      due_amount: due,
      payment_status: row.payment_status || (due <= 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid"),
      updated_at: row.updated_at || timestamp,
    };
  }

  if (table === "supplier_payments") {
    return {
      ...base,
      supplier_id: row.supplier_id,
      payment_date: row.payment_date || timestamp,
      amount: Number(row.amount || 0),
      notes: row.notes || "",
    };
  }

  if (table === "shop_accounts") {
    const total = Number(row.total_billed || 0);
    const paid = Number(row.total_paid || 0);
    const due = Math.max(0, Number(row.due_amount ?? total - paid));
    return {
      ...base,
      name: row.name,
      phone: row.phone || "",
      address: row.address || "",
      notes: row.notes || "",
      total_billed: total,
      total_paid: paid,
      due_amount: due,
      payment_status: row.payment_status || (due <= 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid"),
      updated_at: row.updated_at || timestamp,
    } satisfies ShopAccountRow;
  }

  if (table === "shop_payments") {
    return {
      ...base,
      shop_id: row.shop_id,
      transaction_id: row.transaction_id,
      payment_date: row.payment_date || timestamp,
      amount: Number(row.amount || 0),
      payment_method: row.payment_method || "cash",
      notes: row.notes || "",
    } satisfies ShopPaymentRow;
  }

  if (table === "expenses") {
    return {
      ...base,
      expense_date: row.expense_date || timestamp,
      category: row.category || "other",
      description: row.description || "",
      amount: Number(row.amount || 0),
      updated_at: row.updated_at || timestamp,
    };
  }

  if (table === "companies") {
    return {
      ...base,
      name: row.name,
      notes: row.notes || "",
      updated_at: row.updated_at || timestamp,
    };
  }

  return {
    ...base,
    ...row,
    updated_at: row.updated_at || timestamp,
  };
}

function whereClause(table: TableName, filters: LocalFilter[] = []) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  filters.forEach((filter, index) => {
    if (filter.op === "orStatusCompleted") {
      if (table !== "transactions") throw new Error("Unsupported filter");
      clauses.push("(status IS NULL OR status = 'completed')");
      return;
    }

    if (!TABLE_COLUMNS[table].includes(filter.column)) throw new Error("Unsupported filter column");
    if (filter.op !== "eq" && filter.op !== "is") throw new Error("Unsupported filter operation");

    const key = `filter_${index}`;
    if (filter.op === "is" && filter.value === null) {
      clauses.push(`${filter.column} IS NULL`);
      return;
    }

    clauses.push(`${filter.column} = @${key}`);
    params[key] = serializeValue(filter.value);
  });

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function selectAll(table: TableName) {
  return getDb()
    .prepare(`SELECT * FROM ${table}`)
    .all()
    .map((row) => normalizeRow(table, row as Record<string, unknown>));
}

function insertOne(table: TableName, row: Record<string, unknown>) {
  const db = getDb();
  const columns = TABLE_COLUMNS[table].filter((column) => column in row);
  const placeholders = columns.map((column) => `@${column}`).join(", ");
  const params = columns.reduce((acc, column) => {
    acc[column] = serializeValue(row[column]);
    return acc;
  }, {} as Record<string, unknown>);

  db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
  ).run(params);
}

function withJoins(table: TableName, rows: any[], select?: string) {
  if (table !== "transaction_items" || !select?.includes("products")) {
    return rows;
  }

  const db = getDb();
  const findProduct = db.prepare("SELECT * FROM products WHERE id = ?");
  return rows.map((row) => ({
    ...row,
    products: findProduct.get(row.product_id) || null,
  }));
}

export function readDb(): LocalDb {
  const db = emptyDb();
  for (const table of TABLES) {
    db[table] = selectAll(table);
  }
  return db;
}

export function getSessionIdentity(id: string) {
  if (!id) return null;
  const row = getDb().prepare("SELECT id, email, role, active FROM users WHERE id = @id").get({ id }) as
    | { id: string; email: string; role: string; active: number | boolean }
    | undefined;
  if (!row || !Boolean(row.active)) return null;
  return { id: row.id, email: row.email, role: row.role };
}

export function createFirstAdminAndSettings(
  admin: { name: string; email: string; passwordHash: string },
  business: { businessName: string; address: string; phone: string; email: string; currency: string }
) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const count = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    if (count.count > 0) throw new Error("First admin already exists");

    const timestamp = now();
    const user = {
      id: makeId(),
      email: admin.email,
      name: admin.name,
      password_hash: admin.passwordHash,
      role: "admin",
      active: 1,
      last_login: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, active, last_login, created_at, updated_at)
      VALUES (@id, @email, @name, @password_hash, @role, @active, @last_login, @created_at, @updated_at)
    `).run(user);

    const existing = db.prepare("SELECT id, value FROM settings WHERE key = 'posSettings'").get() as
      | { id: string; value?: string | null }
      | undefined;
    let currentSettings: Record<string, unknown> = {};
    if (existing?.value) {
      try {
        currentSettings = JSON.parse(existing.value) as Record<string, unknown>;
      } catch {
        currentSettings = {};
      }
    }
    const value = JSON.stringify({ ...currentSettings, ...business });
    if (existing) {
      db.prepare("UPDATE settings SET value = @value, updated_at = @updated_at WHERE id = @id").run({
        id: existing.id,
        value,
        updated_at: timestamp,
      });
    } else {
      db.prepare(`
        INSERT INTO settings (id, key, value, created_at, updated_at)
        VALUES (@id, 'posSettings', @value, @created_at, @updated_at)
      `).run({ id: makeId(), value, created_at: timestamp, updated_at: timestamp });
    }
    db.exec("COMMIT");
    return { id: user.id, email: user.email, name: user.name, role: "admin" as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function writeDb(db: LocalDb) {
  const normalized = normalizeDb(db);
  const sqlite = getDb();
  sqlite.exec("BEGIN");
  try {
    for (const table of [...TABLES].reverse()) {
      sqlite.prepare(`DELETE FROM ${table}`).run();
    }

    for (const table of TABLES) {
      for (const row of normalized[table]) {
        insertOne(table, withDefaults(table, row));
      }
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export function selectRows(table: TableName, query: LocalQuery = {}) {
  const db = getDb();
  const where = whereClause(table, query.filters);
  if (query.order && !TABLE_COLUMNS[table].includes(query.order.column)) {
    throw new Error("Unsupported order column");
  }
  const order = query.order
    ? ` ORDER BY ${query.order.column} ${query.order.ascending ? "ASC" : "DESC"}`
    : "";
  const rows = withJoins(
    table,
    db
      .prepare(`SELECT * FROM ${table}${where.sql}${order}`)
      .all(where.params)
      .map((row) => normalizeRow(table, row as Record<string, unknown>)),
    query.select
  );

  if (query.single || query.maybeSingle) {
    const row = rows[0] || null;
    return {
      data: row,
      error: query.single && !row ? { message: "Row not found", code: "PGRST116" } : null,
    };
  }

  return { data: rows, error: null };
}

export function insertRows(table: TableName, rows: any[]) {
  const inserted = rows.map((row) => withDefaults(table, row));
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const row of inserted) {
      insertOne(table, row);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { data: inserted, error: null };
}

export function createCheckout(
  transactionInput: Record<string, unknown>,
  itemInputs: Array<Record<string, unknown>>,
  userId: string
) {
  if (!itemInputs.length || itemInputs.length > 250) throw new Error("Checkout item count is invalid");
  const db = getDb();
  const allowedTransactionKeys = new Set([
    "transaction_date", "total_amount", "discount_amount", "tax_amount", "amount_paid", "balance_amount",
    "payment_method", "status", "is_replacement_transaction", "original_return_id", "shop_id", "customer_name",
    "sale_type", "payment_status", "due_amount",
  ]);
  const allowedItemKeys = new Set(["product_id", "variant_id", "quantity", "unit_price", "discount", "subtotal"]);
  if (Object.keys(transactionInput).some((key) => !allowedTransactionKeys.has(key))) {
    throw new Error("Checkout contains unsupported transaction fields");
  }
  if (itemInputs.some((input) => !input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !allowedItemKeys.has(key)))) {
    throw new Error("Checkout contains unsupported item fields");
  }

  const total = Number(transactionInput.total_amount);
  if (!Number.isFinite(total) || total < 0) throw new Error("Transaction total is invalid");
  const paymentMethod = String(transactionInput.payment_method || "").trim();
  if (paymentMethod !== "cash" && paymentMethod !== "card" && paymentMethod !== "check") throw new Error("Payment method is invalid");
  const saleType = transactionInput.sale_type === "shop" ? "shop" : transactionInput.sale_type === "walk_in" ? "walk_in" : null;
  if (!saleType) throw new Error("Sale type is invalid");
  const customerNameInput = transactionInput.customer_name == null ? "" : String(transactionInput.customer_name).trim();
  if (customerNameInput.length > 200) throw new Error("Customer name is too long");
  const shopId = typeof transactionInput.shop_id === "string" && transactionInput.shop_id.trim()
    ? transactionInput.shop_id.trim()
    : null;
  if ((saleType === "shop") !== Boolean(shopId)) throw new Error("Shop sales require a valid shop account");
  const amountPaidInput = Number(transactionInput.amount_paid);
  if (!Number.isFinite(amountPaidInput) || amountPaidInput < 0) throw new Error("Paid amount is invalid");

  const items = itemInputs.map((input) => {
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Item quantity is invalid");
    const unitPrice = Number(input.unit_price);
    const discount = Number(input.discount || 0);
    const subtotal = Number(input.subtotal);
    if (![unitPrice, discount, subtotal].every(Number.isFinite) || unitPrice < 0 || discount < 0 || subtotal < 0) {
      throw new Error("Item pricing is invalid");
    }
    if (discount > unitPrice * quantity || Math.abs(subtotal - (unitPrice * quantity - discount)) > 0.02) {
      throw new Error("Item totals do not match");
    }
    const productId = typeof input.product_id === "string" ? input.product_id.trim() : "";
    const variantId = input.variant_id == null ? null : typeof input.variant_id === "string" ? input.variant_id.trim() : "";
    if (!productId || variantId === "") throw new Error("Item product details are invalid");
    return { productId, variantId, quantity, unitPrice, discount, subtotal };
  });

  const itemSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const saleDiscount = Number(transactionInput.discount_amount || 0);
  const tax = Number(transactionInput.tax_amount || 0);
  if (![saleDiscount, tax].every(Number.isFinite) || saleDiscount < 0 || tax < 0 || saleDiscount > itemSubtotal) {
    throw new Error("Transaction totals are invalid");
  }
  if (Math.abs(total - (itemSubtotal - saleDiscount + tax)) > 0.02) {
    throw new Error("Transaction total does not match its items");
  }

  let amountPaid: number;
  let balanceAmount: number;
  let dueAmount: number;
  let paymentStatus: "paid" | "partial" | "unpaid";
  if (saleType === "shop") {
    if (amountPaidInput - total > 0.001) throw new Error("Shop payment cannot exceed the bill total");
    amountPaid = money(amountPaidInput);
    balanceAmount = 0;
    dueAmount = money(Math.max(0, total - amountPaid));
    paymentStatus = paymentStatusFor(amountPaid, total);
  } else if (paymentMethod === "cash") {
    if (amountPaidInput + 0.001 < total) throw new Error("Customer money is less than the total");
    amountPaid = money(amountPaidInput);
    balanceAmount = money(Math.max(0, amountPaid - total));
    dueAmount = 0;
    paymentStatus = "paid";
  } else {
    if (Math.abs(amountPaidInput - total) > 0.02) throw new Error("Card payment must equal the sale total");
    amountPaid = money(total);
    balanceAmount = 0;
    dueAmount = 0;
    paymentStatus = "paid";
  }
  const submittedBalance = Number(transactionInput.balance_amount);
  const submittedDue = Number(transactionInput.due_amount);
  if (!Number.isFinite(submittedBalance) || Math.abs(submittedBalance - balanceAmount) > 0.02) {
    throw new Error("Transaction balance is invalid");
  }
  if (!Number.isFinite(submittedDue) || Math.abs(submittedDue - dueAmount) > 0.02) {
    throw new Error("Transaction due amount is invalid");
  }
  if (transactionInput.payment_status !== paymentStatus) throw new Error("Payment status is invalid");
  if (transactionInput.status !== "completed" || transactionInput.is_replacement_transaction !== false || transactionInput.original_return_id != null) {
    throw new Error("Checkout transaction flags are invalid");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    let customerName = customerNameInput || null;
    if (shopId) {
      const shop = db.prepare("SELECT name FROM shop_accounts WHERE id = @id").get({ id: shopId }) as { name?: string } | undefined;
      if (!shop) throw new Error("Shop account was not found");
      customerName = String(shop.name || customerNameInput || "Shop").slice(0, 200);
    }
    const transaction = withDefaults("transactions", {
      transaction_date: now(),
      total_amount: money(total),
      discount_amount: money(saleDiscount),
      tax_amount: money(tax),
      amount_paid: amountPaid,
      balance_amount: balanceAmount,
      payment_method: paymentMethod,
      status: "completed",
      user_id: userId,
      is_replacement_transaction: false,
      original_return_id: null,
      shop_id: shopId,
      customer_name: customerName,
      sale_type: saleType,
      payment_status: paymentStatus,
      due_amount: dueAmount,
    });
    insertOne("transactions", transaction);
    const timestamp = now();
    for (const item of items) {
      const product = db.prepare("SELECT least_price FROM products WHERE id = @id").get({ id: item.productId }) as
        | { least_price?: number | null }
        | undefined;
      const variant = item.variantId
        ? db.prepare("SELECT least_price FROM product_variants WHERE id = @id AND product_id = @product_id").get({
            id: item.variantId,
            product_id: item.productId,
          }) as { least_price?: number | null } | undefined
        : null;
      if (!product || (item.variantId && !variant)) throw new Error("Product was not found");
      const minimumPrice = Number(variant?.least_price || product.least_price || 0);
      if (item.unitPrice + 0.001 < minimumPrice) throw new Error("An item is below its minimum price");

      const stockResult = item.variantId
        ? db.prepare(`UPDATE product_variants SET quantity = quantity - @quantity, updated_at = @updated_at
            WHERE id = @id AND product_id = @product_id AND quantity >= @quantity`).run({
            id: item.variantId, product_id: item.productId, quantity: item.quantity, updated_at: timestamp,
          })
        : db.prepare(`UPDATE products SET quantity = quantity - @quantity, updated_at = @updated_at
            WHERE id = @id AND quantity >= @quantity`).run({
            id: item.productId, quantity: item.quantity, updated_at: timestamp,
          });
      if (stockResult.changes !== 1) throw new Error("Insufficient stock or product was changed");
      insertOne("transaction_items", withDefaults("transaction_items", {
        transaction_id: transaction.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      }));
    }

    if (transaction.shop_id && Number(transaction.amount_paid || 0) > 0) {
      insertOne("shop_payments", withDefaults("shop_payments", {
        shop_id: transaction.shop_id,
        transaction_id: transaction.id,
        payment_date: timestamp,
        amount: transaction.amount_paid,
        payment_method: transaction.payment_method,
        notes: "Initial payment",
      }));
      refreshShopAccount(transaction.shop_id);
    }

    const savedItems = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = @transaction_id")
      .all({ transaction_id: transaction.id });
    db.exec("COMMIT");
    return { transaction: normalizeRow("transactions", transaction), items: savedItems.map((item) => normalizeRow("transaction_items", item)) };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export type ProcessReturnInput = {
  originalTransactionId: string;
  reason: string;
  notes?: string;
  returnedItems: Array<{
    transactionItemId: string;
    quantity: number;
  }>;
  replacementItems?: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number;
    discount?: number;
    subtotal: number;
  }>;
  replacementPaymentMethod?: string;
  replacementTaxAmount?: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function stockKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId || ""}`;
}

export function getReturnableTransaction(transactionIdInput: string) {
  const transactionId = String(transactionIdInput || "").trim();
  if (!transactionId || transactionId.length > 100) throw new Error("A valid transaction ID is required");
  const db = getDb();
  const transaction = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: transactionId }) as
    | Record<string, unknown>
    | undefined;
  if (!transaction) return { ok: false as const, reason: "not_found" as const };
  if (
    transaction.status === "cancelled" ||
    Boolean(transaction.is_replacement_transaction) ||
    Boolean(transaction.original_return_id) ||
    Number(transaction.total_amount || 0) < 0
  ) {
    return { ok: false as const, reason: "non_returnable" as const };
  }

  const items = db.prepare(`
    SELECT ti.*, p.name AS product_name, p.image_url AS product_image_url
    FROM transaction_items ti
    LEFT JOIN products p ON p.id = ti.product_id
    WHERE ti.transaction_id = @transaction_id AND ti.quantity > 0 AND ti.subtotal > 0
    ORDER BY ti.created_at ASC, ti.id ASC
  `).all({ transaction_id: transactionId }) as Array<Record<string, unknown>>;
  const previous = db.prepare(`
    SELECT ri.product_id, ri.variant_id, COALESCE(SUM(ri.quantity), 0) AS quantity
    FROM return_items ri
    INNER JOIN returns r ON r.id = ri.return_id
    WHERE r.original_transaction_id = @transaction_id
      AND (r.status IS NULL OR r.status <> 'cancelled')
    GROUP BY ri.product_id, ri.variant_id
  `).all({ transaction_id: transactionId }) as Array<{
    product_id: string;
    variant_id?: string | null;
    quantity: number;
  }>;
  const outstandingReturned = new Map(
    previous.map((item) => [stockKey(item.product_id, item.variant_id), Number(item.quantity || 0)])
  );
  const returnableItems = items.flatMap((item) => {
    const quantity = Number(item.quantity || 0);
    const key = stockKey(String(item.product_id || ""), item.variant_id ? String(item.variant_id) : null);
    const alreadyReturned = outstandingReturned.get(key) || 0;
    const consumed = Math.min(quantity, alreadyReturned);
    outstandingReturned.set(key, Math.max(0, alreadyReturned - consumed));
    const remaining = quantity - consumed;
    if (remaining <= 0) return [];
    const ratio = quantity > 0 ? remaining / quantity : 0;
    const normalized = normalizeRow("transaction_items", item);
    return [{
      ...normalized,
      quantity: remaining,
      subtotal: Number(item.subtotal || 0) * ratio,
      products: item.product_name
        ? { name: String(item.product_name), image_url: item.product_image_url ? String(item.product_image_url) : null }
        : null,
    }];
  });
  if (!returnableItems.length) return { ok: false as const, reason: "no_returnable_items" as const };
  return {
    ok: true as const,
    transaction: normalizeRow("transactions", transaction),
    items: returnableItems,
  };
}

/**
 * Completes a return, its refund transaction, and any replacement sale as one
 * SQLite transaction. This intentionally uses the existing schema so databases
 * created by earlier releases remain readable without a destructive migration.
 */
export function processReturn(input: ProcessReturnInput, userId: string) {
  const originalTransactionId = String(input.originalTransactionId || "").trim();
  const reason = String(input.reason || "").trim();
  const notes = String(input.notes || "").trim();
  if (!originalTransactionId) throw new Error("Original transaction is required");
  if (!reason || reason.length > 500) throw new Error("A valid return reason is required");
  if (notes.length > 2_000) throw new Error("Return notes are too long");
  if (!Array.isArray(input.returnedItems) || input.returnedItems.length === 0 || input.returnedItems.length > 200) {
    throw new Error("Select at least one valid item to return");
  }

  const requestedReturns = input.returnedItems.map((item) => ({
    transactionItemId: String(item?.transactionItemId || "").trim(),
    quantity: Number(item?.quantity),
  }));
  if (requestedReturns.some((item) => !item.transactionItemId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error("A returned item quantity is invalid");
  }
  if (new Set(requestedReturns.map((item) => item.transactionItemId)).size !== requestedReturns.length) {
    throw new Error("A returned item was submitted more than once");
  }

  const requestedReplacements = Array.isArray(input.replacementItems) ? input.replacementItems : [];
  if (requestedReplacements.length > 200) throw new Error("Too many replacement items");
  const replacements = requestedReplacements.map((item) => {
    const productId = String(item?.productId || "").trim();
    const variantId = item?.variantId ? String(item.variantId).trim() : null;
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    const discount = Number(item?.discount || 0);
    const subtotal = Number(item?.subtotal);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) throw new Error("A replacement item quantity is invalid");
    if (![unitPrice, discount, subtotal].every(Number.isFinite) || unitPrice < 0 || discount < 0 || subtotal < 0) {
      throw new Error("Replacement item pricing is invalid");
    }
    if (discount > unitPrice * quantity || Math.abs(subtotal - (unitPrice * quantity - discount)) > 0.02) {
      throw new Error("Replacement item totals do not match");
    }
    return { productId, variantId, quantity, unitPrice, discount, subtotal: money(subtotal) };
  });
  const replacementTaxAmount = Number(input.replacementTaxAmount || 0);
  if (!Number.isFinite(replacementTaxAmount) || replacementTaxAmount < 0) throw new Error("Replacement tax is invalid");
  const replacementPaymentMethod = String(input.replacementPaymentMethod || "cash").trim();
  if (replacements.length && (!replacementPaymentMethod || replacementPaymentMethod.length > 100)) {
    throw new Error("Replacement payment method is invalid");
  }

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const original = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: originalTransactionId }) as
      | Record<string, unknown>
      | undefined;
    if (!original) throw new Error("Original transaction was not found");
    if (
      original.status === "cancelled" ||
      Boolean(original.is_replacement_transaction) ||
      Boolean(original.original_return_id) ||
      Number(original.total_amount || 0) < 0
    ) {
      throw new Error("This transaction cannot be returned");
    }
    const originalShopId = original.shop_id ? String(original.shop_id) : null;

    const originalItems = db.prepare(`
      SELECT id, product_id, variant_id, quantity, unit_price, discount, subtotal
      FROM transaction_items
      WHERE transaction_id = @transaction_id AND quantity > 0 AND subtotal > 0
    `).all({ transaction_id: originalTransactionId }) as Array<{
      id: string;
      product_id: string;
      variant_id?: string | null;
      quantity: number;
      unit_price: number;
      discount: number;
      subtotal: number;
    }>;
    const itemById = new Map(originalItems.map((item) => [item.id, item]));
    const originalItemSubtotal = originalItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    if (originalItemSubtotal <= 0) throw new Error("The original transaction has no refundable value");
    const originalTransactionTotal = money(Math.max(0, Number(original.total_amount || 0)));
    // Allocate both the sale-level discount and tax proportionally across the
    // sold lines. A complete return therefore refunds exactly the charged total.
    const refundScale = originalTransactionTotal / originalItemSubtotal;

    const originalQuantityByStock = new Map<string, number>();
    const originalRefundByStock = new Map<string, number>();
    for (const item of originalItems) {
      const key = stockKey(item.product_id, item.variant_id);
      originalQuantityByStock.set(key, (originalQuantityByStock.get(key) || 0) + Number(item.quantity || 0));
      originalRefundByStock.set(
        key,
        (originalRefundByStock.get(key) || 0) + Number(item.subtotal || 0) * refundScale
      );
    }
    const previouslyReturned = db.prepare(`
      SELECT ri.product_id, ri.variant_id,
        COALESCE(SUM(ri.quantity), 0) AS quantity,
        COALESCE(SUM(ri.refund_amount), 0) AS refund_amount
      FROM return_items ri
      INNER JOIN returns r ON r.id = ri.return_id
      WHERE r.original_transaction_id = @transaction_id
        AND (r.status IS NULL OR r.status <> 'cancelled')
      GROUP BY ri.product_id, ri.variant_id
    `).all({ transaction_id: originalTransactionId }) as Array<{
      product_id: string;
      variant_id?: string | null;
      quantity: number;
      refund_amount: number;
    }>;
    const returnedQuantityByStock = new Map(
      previouslyReturned.map((item) => [stockKey(item.product_id, item.variant_id), Number(item.quantity || 0)])
    );
    const returnedRefundByStock = new Map(
      previouslyReturned.map((item) => [stockKey(item.product_id, item.variant_id), Number(item.refund_amount || 0)])
    );

    const requestedQuantityByStock = new Map<string, number>();
    const returnLines = requestedReturns.map((request) => {
      const item = itemById.get(request.transactionItemId);
      if (!item || request.quantity > Number(item.quantity || 0)) throw new Error("A returned item is not part of the original sale");
      const key = stockKey(item.product_id, item.variant_id);
      requestedQuantityByStock.set(key, (requestedQuantityByStock.get(key) || 0) + request.quantity);
      const refundPerUnit = (Number(item.subtotal || 0) * refundScale) / Number(item.quantity || 1);
      const refundAmount = money(refundPerUnit * request.quantity);
      return {
        originalItem: item,
        productId: item.product_id,
        variantId: item.variant_id || null,
        quantity: request.quantity,
        refundAmount,
      };
    });
    for (const [key, quantity] of requestedQuantityByStock) {
      const available = (originalQuantityByStock.get(key) || 0) - (returnedQuantityByStock.get(key) || 0);
      if (quantity > available) throw new Error("An item has already been returned or exceeds the sold quantity");
    }

    const priorRefundTotal = money(previouslyReturned.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0));
    const remainingRefundTotal = money(Math.max(0, originalTransactionTotal - priorRefundTotal));
    const requestedQuantityTotal = [...requestedQuantityByStock.values()].reduce((sum, quantity) => sum + quantity, 0);
    const remainingQuantityTotal = [...originalQuantityByStock].reduce(
      (sum, [key, quantity]) => sum + Math.max(0, quantity - (returnedQuantityByStock.get(key) || 0)),
      0
    );
    let requestedRefundTotal = money(returnLines.reduce((sum, line) => sum + line.refundAmount, 0));
    if (requestedRefundTotal - remainingRefundTotal > 0.02) {
      throw new Error("The requested refund exceeds the remaining transaction value");
    }
    if (returnLines.length && (requestedQuantityTotal === remainingQuantityTotal || requestedRefundTotal > remainingRefundTotal)) {
      const adjustment = money(remainingRefundTotal - requestedRefundTotal);
      returnLines[returnLines.length - 1].refundAmount = money(
        returnLines[returnLines.length - 1].refundAmount + adjustment
      );
      requestedRefundTotal = money(requestedRefundTotal + adjustment);
    }

    const requestedRefundByStock = new Map<string, number>();
    for (const line of returnLines) {
      const key = stockKey(line.productId, line.variantId);
      requestedRefundByStock.set(key, money((requestedRefundByStock.get(key) || 0) + line.refundAmount));
    }
    for (const [key] of requestedQuantityByStock) {
      const availableRefund = (originalRefundByStock.get(key) || 0) - (returnedRefundByStock.get(key) || 0);
      if ((requestedRefundByStock.get(key) || 0) - availableRefund > 0.02) {
        throw new Error("The requested refund exceeds the remaining value of the original item");
      }
    }

    const timestamp = now();
    const returnRecord = withDefaults("returns", {
      original_transaction_id: originalTransactionId,
      return_date: timestamp,
      reason,
      notes,
      status: "completed",
      updated_at: timestamp,
    });
    insertOne("returns", returnRecord);

    const updateVariantUp = db.prepare(`
      UPDATE product_variants SET quantity = quantity + @quantity, updated_at = @updated_at
      WHERE id = @id AND product_id = @product_id
    `);
    const updateProductUp = db.prepare(`
      UPDATE products SET quantity = quantity + @quantity, updated_at = @updated_at WHERE id = @id
    `);
    for (const line of returnLines) {
      insertOne("return_items", withDefaults("return_items", {
        return_id: returnRecord.id,
        product_id: line.productId,
        variant_id: line.variantId,
        quantity: line.quantity,
        refund_amount: line.refundAmount,
        status: "completed",
      }));
      const stockResult = line.variantId
        ? updateVariantUp.run({ id: line.variantId, product_id: line.productId, quantity: line.quantity, updated_at: timestamp })
        : updateProductUp.run({ id: line.productId, quantity: line.quantity, updated_at: timestamp });
      if (stockResult.changes !== 1) throw new Error("A returned product no longer exists");
    }

    const refundTotal = requestedRefundTotal;
    const refundTransaction = withDefaults("transactions", {
      transaction_date: timestamp,
      total_amount: -refundTotal,
      discount_amount: 0,
      tax_amount: 0,
      amount_paid: originalShopId ? 0 : -refundTotal,
      balance_amount: 0,
      payment_method: String(original.payment_method || "cash"),
      status: "completed",
      user_id: userId,
      is_replacement_transaction: false,
      original_return_id: returnRecord.id,
      shop_id: originalShopId,
      customer_name: original.customer_name || null,
      sale_type: originalShopId ? "shop" : (original.sale_type || "walk_in"),
      payment_status: "paid",
      due_amount: 0,
    });
    insertOne("transactions", refundTransaction);
    for (const line of returnLines) {
      insertOne("transaction_items", withDefaults("transaction_items", {
        transaction_id: refundTransaction.id,
        product_id: line.productId,
        variant_id: line.variantId,
        quantity: -line.quantity,
        unit_price: Number(line.originalItem.unit_price || 0),
        discount: 0,
        subtotal: -line.refundAmount,
      }));
    }

    let replacementTransaction: Record<string, unknown> | null = null;
    if (replacements.length) {
      const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'posSettings'").get() as
        | { value?: string | null }
        | undefined;
      let protectStock = true;
      if (settingsRow?.value) {
        try {
          const settings = JSON.parse(settingsRow.value) as { replacementStockProtectionEnabled?: boolean };
          protectStock = settings.replacementStockProtectionEnabled !== false;
        } catch {
          protectStock = true;
        }
      }

      const replacementSubtotal = money(replacements.reduce((sum, item) => sum + item.subtotal, 0));
      const replacementTotal = money(replacementSubtotal + replacementTaxAmount);
      const replacementRecord = withDefaults("transactions", {
        transaction_date: timestamp,
        total_amount: replacementTotal,
        discount_amount: 0,
        tax_amount: money(replacementTaxAmount),
        amount_paid: originalShopId ? 0 : replacementTotal,
        balance_amount: 0,
        payment_method: replacementPaymentMethod,
        status: "completed",
        user_id: userId,
        is_replacement_transaction: true,
        original_return_id: returnRecord.id,
        shop_id: originalShopId,
        customer_name: original.customer_name || null,
        sale_type: originalShopId ? "shop" : (original.sale_type || "walk_in"),
        payment_status: "paid",
        due_amount: 0,
      });
      replacementTransaction = replacementRecord;
      insertOne("transactions", replacementRecord);

      for (const item of replacements) {
        const product = db.prepare("SELECT least_price FROM products WHERE id = @id").get({ id: item.productId }) as
          | { least_price?: number | null }
          | undefined;
        const variant = item.variantId
          ? db.prepare("SELECT least_price FROM product_variants WHERE id = @id AND product_id = @product_id").get({
              id: item.variantId,
              product_id: item.productId,
            }) as { least_price?: number | null } | undefined
          : null;
        if (!product || (item.variantId && !variant)) throw new Error("A replacement product was not found");
        const minimumPrice = Number(variant?.least_price || product.least_price || 0);
        if (item.unitPrice + 0.001 < minimumPrice) throw new Error("A replacement item is below its minimum price");

        insertOne("replacement_items", withDefaults("replacement_items", {
          return_id: returnRecord.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          replacement_price: money(item.unitPrice * item.quantity),
          status: "completed",
        }));
        insertOne("transaction_items", withDefaults("transaction_items", {
          transaction_id: replacementRecord.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
          subtotal: item.subtotal,
        }));

        const stockResult = item.variantId
          ? db.prepare(`UPDATE product_variants SET quantity = quantity - @quantity, updated_at = @updated_at
              WHERE id = @id AND product_id = @product_id${protectStock ? " AND quantity >= @quantity" : ""}`).run({
              id: item.variantId, product_id: item.productId, quantity: item.quantity, updated_at: timestamp,
            })
          : db.prepare(`UPDATE products SET quantity = quantity - @quantity, updated_at = @updated_at
              WHERE id = @id${protectStock ? " AND quantity >= @quantity" : ""}`).run({
              id: item.productId, quantity: item.quantity, updated_at: timestamp,
            });
        if (stockResult.changes !== 1) throw new Error("Insufficient replacement stock or product was changed");
      }
    }

    if (originalShopId) refreshShopAccount(originalShopId);

    db.exec("COMMIT");
    return {
      return: normalizeRow("returns", returnRecord),
      refundTransaction: normalizeRow("transactions", refundTransaction),
      replacementTransaction: replacementTransaction ? normalizeRow("transactions", replacementTransaction) : null,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function recordShopPayment(input: {
  transactionId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}) {
  const transactionId = String(input.transactionId || "").trim();
  const amount = Number(input.amount);
  const paymentMethod = String(input.paymentMethod || "").trim();
  const notes = String(input.notes || "").trim();
  if (!transactionId) throw new Error("Transaction is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");
  if (!paymentMethod || paymentMethod.length > 50 || notes.length > 1000) throw new Error("Payment details are invalid");

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const transaction = db.prepare(`
      SELECT id, shop_id, total_amount, status
      FROM transactions WHERE id = @id
    `).get({ id: transactionId }) as
      | { id: string; shop_id?: string | null; total_amount?: number; status?: string | null }
      | undefined;
    if (!transaction || !transaction.shop_id || transaction.status === "cancelled") {
      throw new Error("Shop transaction was not found");
    }
    const paidRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS paid FROM shop_payments WHERE transaction_id = @transaction_id
    `).get({ transaction_id: transactionId }) as { paid?: number };
    refreshShopAccount(transaction.shop_id);
    const shop = db.prepare("SELECT due_amount FROM shop_accounts WHERE id = @id").get({ id: transaction.shop_id }) as
      | { due_amount?: number }
      | undefined;
    const billDue = Math.max(0, Number(transaction.total_amount || 0) - Number(paidRow.paid || 0));
    const aggregateDue = Math.max(0, Number(shop?.due_amount || 0));
    if (amount - Math.min(billDue, aggregateDue) > 0.001) throw new Error("Payment cannot exceed the shop or bill due amount");

    const payment = withDefaults("shop_payments", {
      shop_id: transaction.shop_id,
      transaction_id: transactionId,
      payment_date: now(),
      amount,
      payment_method: paymentMethod,
      notes,
    });
    insertOne("shop_payments", payment);
    refreshShopAccount(transaction.shop_id);
    const updatedTransaction = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: transactionId });
    const updatedShop = db.prepare("SELECT * FROM shop_accounts WHERE id = @id").get({ id: transaction.shop_id });
    db.exec("COMMIT");
    return {
      payment: normalizeRow("shop_payments", payment),
      transaction: updatedTransaction ? normalizeRow("transactions", updatedTransaction) : null,
      shop: updatedShop ? normalizeRow("shop_accounts", updatedShop) : null,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateShopPayment(input: { id: string; amount: number; notes?: string }) {
  const id = String(input.id || "").trim();
  const amount = Number(input.amount);
  const notes = String(input.notes || "").trim();
  if (!id) throw new Error("Payment is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");
  if (notes.length > 1000) throw new Error("Payment notes are too long");

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const payment = db.prepare(`
      SELECT id, shop_id, transaction_id, amount FROM shop_payments WHERE id = @id
    `).get({ id }) as { id: string; shop_id: string; transaction_id: string; amount: number } | undefined;
    if (!payment) throw new Error("Shop payment was not found");

    const transaction = db.prepare(`
      SELECT id, total_amount, status FROM transactions WHERE id = @id AND shop_id = @shop_id
    `).get({ id: payment.transaction_id, shop_id: payment.shop_id }) as
      | { id: string; total_amount?: number; status?: string | null }
      | undefined;
    if (!transaction || transaction.status === "cancelled") throw new Error("Shop transaction was not found");

    const otherPayments = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS paid
      FROM shop_payments WHERE transaction_id = @transaction_id AND id <> @id
    `).get({ transaction_id: payment.transaction_id, id }) as { paid?: number };
    refreshShopAccount(payment.shop_id);
    const shop = db.prepare("SELECT due_amount FROM shop_accounts WHERE id = @id").get({ id: payment.shop_id }) as
      | { due_amount?: number }
      | undefined;
    const billMaximum = Math.max(0, Number(transaction.total_amount || 0) - Number(otherPayments.paid || 0));
    const aggregateMaximum = Math.max(0, Number(shop?.due_amount || 0) + Number(payment.amount || 0));
    if (amount - Math.min(billMaximum, aggregateMaximum) > 0.001) {
      throw new Error("Payment cannot exceed the shop or bill due amount");
    }

    db.prepare("UPDATE shop_payments SET amount = @amount, notes = @notes WHERE id = @id")
      .run({ id, amount, notes });
    refreshShopAccount(payment.shop_id);
    const updatedPayment = db.prepare("SELECT * FROM shop_payments WHERE id = @id").get({ id });
    const updatedTransaction = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: payment.transaction_id });
    const updatedShop = db.prepare("SELECT * FROM shop_accounts WHERE id = @id").get({ id: payment.shop_id });
    db.exec("COMMIT");
    return {
      payment: updatedPayment ? normalizeRow("shop_payments", updatedPayment) : null,
      transaction: updatedTransaction ? normalizeRow("transactions", updatedTransaction) : null,
      shop: updatedShop ? normalizeRow("shop_accounts", updatedShop) : null,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteShopPayment(idInput: string) {
  const id = String(idInput || "").trim();
  if (!id) throw new Error("Payment is required");

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const payment = db.prepare(`
      SELECT id, shop_id, transaction_id FROM shop_payments WHERE id = @id
    `).get({ id }) as { id: string; shop_id: string; transaction_id: string } | undefined;
    if (!payment) throw new Error("Shop payment was not found");
    const deleted = db.prepare("DELETE FROM shop_payments WHERE id = @id").run({ id });
    if (deleted.changes !== 1) throw new Error("Shop payment was not found");
    refreshShopAccount(payment.shop_id);
    const updatedTransaction = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: payment.transaction_id });
    const updatedShop = db.prepare("SELECT * FROM shop_accounts WHERE id = @id").get({ id: payment.shop_id });
    db.exec("COMMIT");
    return {
      deleted: true,
      transaction: updatedTransaction ? normalizeRow("transactions", updatedTransaction) : null,
      shop: updatedShop ? normalizeRow("shop_accounts", updatedShop) : null,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateRows(table: TableName, values: Record<string, unknown>, filters: LocalFilter[] = []) {
  const timestamp = now();
  const writableValues: Record<string, unknown> = {
    ...values,
    ...(TABLE_COLUMNS[table].includes("updated_at") ? { updated_at: values.updated_at || timestamp } : {}),
  };
  const columns = Object.keys(writableValues).filter((column) =>
    TABLE_COLUMNS[table].includes(column)
  );

  if (!columns.length) return { data: [], error: null };

  const where = whereClause(table, filters);
  const setSql = columns.map((column) => `${column} = @set_${column}`).join(", ");
  const params = {
    ...where.params,
    ...columns.reduce((acc, column) => {
      acc[`set_${column}`] = serializeValue(writableValues[column]);
      return acc;
    }, {} as Record<string, unknown>),
  };
  const db = getDb();

  db.prepare(`UPDATE ${table} SET ${setSql}${where.sql}`).run(params);
  return selectRows(table, { filters });
}

export function deleteRows(table: TableName, filters: LocalFilter[] = []) {
  const where = whereClause(table, filters);
  const result = getDb().prepare(`DELETE FROM ${table}${where.sql}`).run(where.params);
  return { data: { deleted: result.changes }, error: null };
}

function refreshSupplierBalance(supplierId: string) {
  const db = getDb();
  const supplier = db.prepare("SELECT total_amount FROM suppliers WHERE id = @id").get({ id: supplierId }) as
    | { total_amount?: number }
    | undefined;
  if (!supplier) return;
  const payments = db.prepare("SELECT COALESCE(SUM(amount), 0) AS paid FROM supplier_payments WHERE supplier_id = @supplier_id")
    .get({ supplier_id: supplierId }) as { paid?: number };
  const total = Number(supplier.total_amount || 0);
  const paid = Number(payments.paid || 0);
  const due = Math.max(0, total - paid);
  const status = due <= 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  db.prepare("UPDATE suppliers SET paid_amount = @paid, due_amount = @due, payment_status = @status, updated_at = @updated_at WHERE id = @id")
    .run({ id: supplierId, paid, due, status, updated_at: now() });
}

function refreshShopAccount(shopId: string) {
  const db = getDb();
  const shop = db.prepare("SELECT id FROM shop_accounts WHERE id = @id").get({ id: shopId });
  if (!shop) return;
  const billed = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS total FROM transactions WHERE shop_id = @shop_id AND status IS NOT 'cancelled'")
    .get({ shop_id: shopId }) as { total?: number };
  const paid = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM shop_payments WHERE shop_id = @shop_id")
    .get({ shop_id: shopId }) as { total?: number };
  const totalBilled = Number(billed.total || 0);
  const totalPaid = Number(paid.total || 0);
  const due = Math.max(0, totalBilled - totalPaid);
  const transactions = db.prepare(`
    SELECT t.id, t.total_amount, r.original_transaction_id AS credited_transaction_id
    FROM transactions t
    LEFT JOIN returns r ON r.id = t.original_return_id
    WHERE t.shop_id = @shop_id AND t.status IS NOT 'cancelled'
  `).all({ shop_id: shopId }) as Array<{
    id: string;
    total_amount?: number;
    credited_transaction_id?: string | null;
  }>;
  const hasActivity = transactions.length > 0 || totalPaid > 0;
  const status = due <= 0 && hasActivity ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
  db.prepare("UPDATE shop_accounts SET total_billed = @totalBilled, total_paid = @totalPaid, due_amount = @due, payment_status = @status, updated_at = @updated_at WHERE id = @id")
    .run({ id: shopId, totalBilled, totalPaid, due, status, updated_at: now() });
  const paymentTotals = db.prepare("SELECT transaction_id, COALESCE(SUM(amount), 0) AS paid FROM shop_payments WHERE shop_id = @shop_id GROUP BY transaction_id").all({ shop_id: shopId }) as Array<{ transaction_id: string; paid?: number }>;
  const paymentsByTransaction = new Map(paymentTotals.map((payment) => [payment.transaction_id, Number(payment.paid || 0)]));
  const refundCreditsByTransaction = new Map<string, number>();
  for (const transaction of transactions) {
    const total = Number(transaction.total_amount || 0);
    if (total < 0 && transaction.credited_transaction_id) {
      refundCreditsByTransaction.set(
        transaction.credited_transaction_id,
        (refundCreditsByTransaction.get(transaction.credited_transaction_id) || 0) + Math.abs(total)
      );
    }
  }
  const updateTransaction = db.prepare("UPDATE transactions SET amount_paid = @paid, due_amount = @due, payment_status = @status WHERE id = @id");
  for (const transaction of transactions) {
    const transactionTotal = Number(transaction.total_amount || 0);
    const directPayment = paymentsByTransaction.get(transaction.id) || 0;
    const refundCredit = refundCreditsByTransaction.get(transaction.id) || 0;
    const settledAmount = transactionTotal <= 0
      ? 0
      : Math.min(transactionTotal, directPayment + refundCredit);
    const transactionDue = Math.max(0, transactionTotal - settledAmount);
    updateTransaction.run({
      id: transaction.id,
      paid: settledAmount,
      due: transactionDue,
      status: paymentStatusFor(settledAmount, transactionTotal),
    });
  }
}

function paymentStatusFor(paid: number, total: number) {
  if (total <= 0) return "paid";
  const due = Math.max(0, total - paid);
  return due <= 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
}

export function maintenanceUpdate(table: TableName, id: string, values: Record<string, unknown>) {
  const existing = getDb().prepare(`SELECT * FROM ${table} WHERE id = @id`).get({ id }) as Record<string, unknown> | undefined;
  const result = updateRows(table, values, [{ column: "id", op: "eq", value: id }]);
  if (table === "supplier_payments") refreshSupplierBalance(String(values.supplier_id || existing?.supplier_id || ""));
  if (table === "shop_payments") refreshShopAccount(String(values.shop_id || existing?.shop_id || ""));
  return result;
}

export function maintenanceDelete(table: TableName, id: string) {
  const db = getDb();
  if (table === "companies") {
    const linked = db.prepare("SELECT COUNT(*) AS count FROM products WHERE company_id = @company_id").get({ company_id: id }) as { count?: number };
    if (Number(linked.count || 0) > 0) throw new Error("Cannot delete a company linked to products");
  }
  if (table === "shop_accounts") {
    const linked = db.prepare("SELECT COUNT(*) AS count FROM transactions WHERE shop_id = @shop_id").get({ shop_id: id }) as { count?: number };
    if (Number(linked.count || 0) > 0) throw new Error("Cannot delete a shop account linked to transactions");
  }
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = @id`).get({ id }) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Record not found");
  const result = deleteRows(table, [{ column: "id", op: "eq", value: id }]);
  if (table === "supplier_payments") refreshSupplierBalance(String(row.supplier_id || ""));
  if (table === "shop_payments") refreshShopAccount(String(row.shop_id || ""));
  return result;
}

export function deleteTransactionAndRestoreStock(transactionId: string) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const transaction = db.prepare("SELECT * FROM transactions WHERE id = @id").get({ id: transactionId }) as
      | { id: string; total_amount?: number; original_return_id?: string | null; is_replacement_transaction?: number | boolean; shop_id?: string | null }
      | undefined;
    if (!transaction) {
      db.exec("ROLLBACK");
      return { data: null, error: { message: "Transaction not found", code: "PGRST116" } };
    }
    const linkedReturn = db.prepare("SELECT id FROM returns WHERE original_transaction_id = @id LIMIT 1")
      .get({ id: transactionId });
    if (transaction.original_return_id || Boolean(transaction.is_replacement_transaction) || Number(transaction.total_amount || 0) < 0 || linkedReturn) {
      db.exec("ROLLBACK");
      return {
        data: null,
        error: { message: "Return-linked, refund, or replacement transactions cannot be deleted", code: "CONFLICT" },
      };
    }

    const items = db
      .prepare("SELECT * FROM transaction_items WHERE transaction_id = @transaction_id")
      .all({ transaction_id: transactionId }) as Array<{
        product_id: string;
        variant_id?: string | null;
        quantity: number;
      }>;
    if (items.some((item) => Number(item.quantity || 0) <= 0)) {
      db.exec("ROLLBACK");
      return { data: null, error: { message: "Refund transactions cannot be deleted", code: "CONFLICT" } };
    }

    const updateVariantStock = db.prepare(
      "UPDATE product_variants SET quantity = quantity + @quantity, updated_at = @updated_at WHERE id = @id"
    );
    const updateProductStock = db.prepare(
      "UPDATE products SET quantity = quantity + @quantity, updated_at = @updated_at WHERE id = @id"
    );
    const timestamp = now();

    for (const item of items) {
      const quantity = Math.max(0, Number(item.quantity || 0));
      if (quantity <= 0) continue;

      const result = item.variant_id
        ? updateVariantStock.run({ id: item.variant_id, quantity, updated_at: timestamp })
        : updateProductStock.run({ id: item.product_id, quantity, updated_at: timestamp });

      if (result.changes === 0) {
        throw new Error("Could not restore stock for one or more transaction items");
      }
    }

    const deleteResult = db.prepare("DELETE FROM transactions WHERE id = @id").run({ id: transactionId });
    if (transaction.shop_id) refreshShopAccount(transaction.shop_id);
    db.exec("COMMIT");
    return { data: { deleted: deleteResult.changes, restoredItems: items.length }, error: null };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function backupDb(targetPath: string) {
  const file = dbPath();
  getDb().exec("PRAGMA wal_checkpoint(FULL)");
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(file, targetPath);
}

export function getLocalDbPath() {
  return dbPath();
}

export function replaceSqliteDbFromBackup(sourcePath: string) {
  const candidate = new DatabaseSync(sourcePath);
  try {
    candidate.exec("PRAGMA query_only = ON");
    const quickCheck = candidate.prepare("PRAGMA quick_check").get() as Record<string, unknown>;
    if (!Object.values(quickCheck).includes("ok")) throw new Error("Backup database failed its integrity check");
    const existingTables = new Set(
      (candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name)
    );
    for (const required of ["products", "transactions", "transaction_items", "users", "settings"]) {
      if (!existingTables.has(required)) throw new Error(`Backup is missing the ${required} table`);
    }
  } finally {
    candidate.close();
  }

  const target = dbPath();
  mkdirSync(dirname(target), { recursive: true });
  const recovery = `${target}.pre-restore`;
  const staging = `${target}.restore-new`;

  if (connection) connection.exec("PRAGMA wal_checkpoint(FULL)");
  if (existsSync(target)) copyFileSync(target, recovery);
  copyFileSync(sourcePath, staging);
  closeDb();

  try {
    for (const file of [`${target}-wal`, `${target}-shm`]) if (existsSync(file)) unlinkSync(file);
    if (existsSync(target)) unlinkSync(target);
    renameSync(staging, target);
    getDb();
    if (existsSync(recovery)) unlinkSync(recovery);
  } catch (error) {
    closeDb();
    if (existsSync(target)) unlinkSync(target);
    if (existsSync(recovery)) renameSync(recovery, target);
    getDb();
    throw error;
  } finally {
    if (existsSync(staging)) unlinkSync(staging);
  }
}
