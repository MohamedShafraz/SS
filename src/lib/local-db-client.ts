import type { Database, Product, ProductVariant, ProductRow, ProductVariantRow } from "@/types";
import { normalizeProduct, normalizeProductVariant } from "./contracts";

type TableName = keyof Database["public"]["Tables"] | "settings" | "licenses";
type Filter = {
  column: string;
  op: "eq" | "is" | "orStatusCompleted";
  value?: unknown;
};
type Order = {
  column: string;
  ascending: boolean;
};
type LocalResponse<T = any> = {
  data: T;
  error: { message: string; code?: string } | null;
};

class LocalQueryBuilder {
  private filters: Filter[] = [];
  private orderBy: Order | null = null;
  private selectValue = "*";
  private writePromise: Promise<LocalResponse> | null = null;
  private maintenanceMode = false;

  constructor(private readonly table: string) {}

  select(value = "*") {
    this.selectValue = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, op: "is", value });
    return this;
  }

  or(value: string) {
    if (value === "status.is.null,status.eq.completed") {
      this.filters.push({ column: "status", op: "orStatusCompleted" });
    }
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  maintenance() {
    this.maintenanceMode = true;
    return this;
  }

  single() {
    return this.executeRead(true, false);
  }

  maybeSingle() {
    return this.executeRead(false, true);
  }

  insert(rows: Record<string, unknown>[]) {
    this.writePromise = fetch(`/api/local-db/${this.table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }).then((response) => response.json());
    return this;
  }

  update(values: Record<string, unknown>) {
    this.writePromise = Promise.resolve().then(() =>
      fetch(`/api/local-db/${this.table}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, filters: this.filters, maintenance: this.maintenanceMode }),
      }).then((response) => response.json())
    );
    return this;
  }

  delete() {
    this.writePromise = Promise.resolve().then(() => {
      const params = new URLSearchParams({
        filters: JSON.stringify(this.filters),
        maintenance: String(this.maintenanceMode),
      });
      return fetch(`/api/local-db/${this.table}?${params}`, {
        method: "DELETE",
      }).then((response) => response.json());
    });
    return this;
  }

  then<TResult1 = LocalResponse<any>, TResult2 = never>(
    onfulfilled?: ((value: LocalResponse<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return (this.writePromise || this.executeRead()).then(onfulfilled, onrejected);
  }

  private executeRead(single = false, maybeSingle = false) {
    const params = new URLSearchParams({
      filters: JSON.stringify(this.filters),
      order: JSON.stringify(this.orderBy),
      select: this.selectValue,
      single: String(single),
      maybeSingle: String(maybeSingle),
    });

    return fetch(`/api/local-db/${this.table}?${params}`).then((response) => response.json());
  }
}

export const localDb = {
  from(table: TableName) {
    return new LocalQueryBuilder(String(table));
  },
};

export const fetchProductsWithVariants = async (): Promise<
  (Product & { variants?: ProductVariant[] })[]
> => {
  try {
    const { data: products, error: productsError } = await localDb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (productsError) throw productsError;

    const { data: variants, error: variantsError } = await localDb
      .from("product_variants")
      .select("*");

    if (variantsError) throw variantsError;

    const normalizedVariants = ((variants as ProductVariantRow[]) ?? []).map(normalizeProductVariant);
    return (((products as ProductRow[]) ?? []).map((product) => ({
      ...normalizeProduct(product),
      variants: normalizedVariants.filter((variant) => variant.product_id === product.id),
    })));
  } catch (error) {
    console.error("Error fetching products with variants:", error);
    return [];
  }
};

export const getProductVariants = async (productId: string): Promise<ProductVariant[]> => {
  try {
    const { data, error } = await localDb
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) throw error;
    return (((data as ProductVariantRow[]) ?? []).map(normalizeProductVariant));
  } catch (error) {
    console.error("Error fetching variants:", error);
    return [];
  }
};

export const addProductVariant = async (
  productId: string,
  variant_type: string,
  variant_value: string,
  sku: string,
  barcode: string,
  quantity: number,
  price_adjustment: number = 0,
  least_price: number = 0,
  least_price_code?: string,
  variant_type_2?: string,
  variant_value_2?: string,
  imageUrl?: string
): Promise<ProductVariant | null> => {
  try {
    const { data, error } = await localDb
      .from("product_variants")
      .insert([
        {
          product_id: productId,
          variant_type,
          variant_value,
          variant_type_2: variant_type_2 || null,
          variant_value_2: variant_value_2 || null,
          sku,
          barcode,
          quantity,
          price_adjustment,
          least_price,
          least_price_code: least_price_code ?? "",
          image_url: imageUrl ?? null,
        },
      ])
      .select();

    if (error) throw error;
    const rows = (data as ProductVariantRow[]) ?? [];
    return rows[0] ? normalizeProductVariant(rows[0]) : null;
  } catch (error) {
    console.error("Error adding variant:", error);
    return null;
  }
};

export const updateProductVariant = async (
  variantId: string,
  values: Partial<Pick<
    ProductVariant,
    | "variant_type"
    | "variant_value"
    | "variant_type_2"
    | "variant_value_2"
    | "sku"
    | "barcode"
    | "quantity"
    | "price_adjustment"
    | "least_price"
    | "least_price_code"
    | "image_url"
  >>
): Promise<boolean> => {
  try {
    const { error } = await localDb
      .from("product_variants")
      .update({
        ...values,
        variant_type_2: values.variant_type_2 || null,
        variant_value_2: values.variant_value_2 || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variantId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating variant:", error);
    return false;
  }
};

export const deleteProductVariant = async (variantId: string): Promise<boolean> => {
  try {
    const { error } = await localDb.from("product_variants").delete().eq("id", variantId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting variant:", error);
    return false;
  }
};

export const updateVariantStock = async (
  variantId: string,
  newQuantity: number
): Promise<boolean> => {
  try {
    const { error } = await localDb
      .from("product_variants")
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq("id", variantId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating variant stock:", error);
    return false;
  }
};

export const findVariantByBarcode = async (
  barcode: string
): Promise<ProductVariant | null> => {
  try {
    const { data, error } = await localDb
      .from("product_variants")
      .select("*")
      .eq("barcode", barcode)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data ? normalizeProductVariant(data as ProductVariantRow) : null;
  } catch (error) {
    console.error("Error finding variant by barcode:", error);
    return null;
  }
};

export type { ProductRow, ProductVariantRow };
