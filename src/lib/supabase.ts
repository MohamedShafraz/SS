import { createClient } from "@supabase/supabase-js";
import { Product, ProductVariant } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY || "";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// PRODUCT VARIANTS HELPER FUNCTIONS (Phase 2)
// ============================================================

/**
 * Fetch products with their variants
 */
export const fetchProductsWithVariants = async (): Promise<
  (Product & { variants?: ProductVariant[] })[]
> => {
  try {
    // Fetch all products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (productsError) throw productsError;

    // Fetch all variants
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("*");

    if (variantsError) throw variantsError;

    // Map variants to products
    const productsWithVariants = (products || []).map((product) => ({
      ...product,
      variants: (variants || []).filter((v) => v.product_id === product.id),
    }));

    return productsWithVariants;
  } catch (error) {
    console.error("Error fetching products with variants:", error);
    return [];
  }
};

/**
 * Get variants for a specific product
 */
export const getProductVariants = async (
  productId: string
): Promise<ProductVariant[]> => {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching variants:", error);
    return [];
  }
};

/**
 * Add a new variant to a product
 */
export const addProductVariant = async (
  productId: string,
  variant_type: string,
  variant_value: string,
  sku: string,
  barcode: string,
  quantity: number,
  price_adjustment: number = 0
): Promise<ProductVariant | null> => {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .insert([
        {
          product_id: productId,
          variant_type,
          variant_value,
          sku,
          barcode,
          quantity,
          price_adjustment,
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error("Error adding variant:", error);
    return null;
  }
};

/**
 * Update variant stock
 */
export const updateVariantStock = async (
  variantId: string,
  newQuantity: number
): Promise<boolean> => {
  try {
    const { error } = await supabase
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

/**
 * Find variant by barcode (for quick scanning)
 */
export const findVariantByBarcode = async (
  barcode: string
): Promise<ProductVariant | null> => {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("barcode", barcode)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data || null;
  } catch (error) {
    console.error("Error finding variant by barcode:", error);
    return null;
  }
};
