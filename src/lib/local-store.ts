import "server-only";

import { existsSync, mkdirSync, readFileSync, unlinkSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import type {
  AuthRole,
  ProductRow,
  ProductVariantRow,
  ReplacementItemRow,
  ReturnItemRow,
  ReturnRow,
  TransactionItemRow,
  TransactionRow,
  UserRow,
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
  if (connection) return connection;

  const file = dbPath();
  mkdirSync(dirname(file), { recursive: true });
  connection = new DatabaseSync(file);
  connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA foreign_keys = ON");
  migrate(connection);
  importLegacyJsonIfNeeded(connection);
  return connection;
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
      original_return_id TEXT
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

function whereClause(filters: LocalFilter[] = []) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  filters.forEach((filter, index) => {
    if (filter.op === "orStatusCompleted") {
      clauses.push("(status IS NULL OR status = 'completed')");
      return;
    }

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
  const where = whereClause(query.filters);
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

  const where = whereClause(filters);
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
  const where = whereClause(filters);
  const result = getDb().prepare(`DELETE FROM ${table}${where.sql}`).run(where.params);
  return { data: { deleted: result.changes }, error: null };
}

export async function ensureSeedAdmin() {
  const db = readDb();
  if (db.users.length > 0) return;

  insertRows("users", [
    {
      id: makeId(),
      email: "admin@pos.local",
      name: "Local Admin",
      password_hash: await bcrypt.hash("admin12345", 10),
      role: "admin" satisfies AuthRole,
      active: true,
      last_login: null,
      created_at: now(),
      updated_at: now(),
    } satisfies UserRow,
  ]);
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
  if (connection) {
    connection.close();
    connection = null;
  }

  const target = dbPath();
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) unlinkSync(target);
  copyFileSync(sourcePath, target);
  getDb();
}
