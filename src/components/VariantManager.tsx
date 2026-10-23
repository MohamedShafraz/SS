"use client";

import { useState } from "react";
import { Barcode, Edit, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ProductVariant } from "@/types";
import { OfflineProductImage } from "@/components/OfflineProductImage";
import {
  addProductVariant,
  deleteProductVariant,
  updateProductVariant,
  updateVariantStock,
} from "@/lib/local-db-client";

interface VariantManagerProps {
  productId: string;
  variants: ProductVariant[];
  parentCost?: number;
  parentPrice?: number;
  onVariantsUpdated: () => void;
  onPrintBarcode?: (variant: ProductVariant) => void;
  createVariantSku?: (
    variantType: string,
    variantValue: string,
    variantType2?: string,
    variantValue2?: string
  ) => string;
  createVariantBarcode?: () => string;
}

const VARIANT_TYPES = ["size", "color", "material"];

function labelVariant(variant: ProductVariant) {
  return [
    `${variant.variant_type}: ${variant.variant_value}`,
    variant.variant_type_2 && variant.variant_value_2
      ? `${variant.variant_type_2}: ${variant.variant_value_2}`
      : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

export const VariantManager = ({
  productId,
  variants,
  parentCost,
  parentPrice,
  onVariantsUpdated,
  onPrintBarcode,
  createVariantSku,
  createVariantBarcode,
}: VariantManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [variantType, setVariantType] = useState("size");
  const [variantValue, setVariantValue] = useState("");
  const [variantType2, setVariantType2] = useState("");
  const [variantValue2, setVariantValue2] = useState("");
  const [sku, setSku] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceAdjustment, setPriceAdjustment] = useState("");
  const [leastPrice, setLeastPrice] = useState("");
  const [leastPriceCode, setLeastPriceCode] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setVariantType("size");
    setVariantValue("");
    setVariantType2("");
    setVariantValue2("");
    setSku("");
    setBarcodeValue("");
    setQuantity("");
    setPriceAdjustment("");
    setLeastPrice("");
    setLeastPriceCode("");
    setImagePreview(null);
    setImageBase64(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageBase64(base64);
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleEditVariant = (variant: ProductVariant) => {
    setEditingId(variant.id);
    setVariantType(variant.variant_type || "size");
    setVariantValue(variant.variant_value || "");
    setVariantType2(variant.variant_type_2 || "");
    setVariantValue2(variant.variant_value_2 || "");
    setSku(variant.sku || "");
    setBarcodeValue(variant.barcode || "");
    setQuantity(variant.quantity ? String(variant.quantity) : "");
    setPriceAdjustment(variant.price_adjustment ? String(variant.price_adjustment) : "");
    setLeastPrice(variant.least_price ? String(variant.least_price) : "");
    setLeastPriceCode(variant.least_price_code || "");
    setImagePreview(variant.image_url || null);
    setImageBase64(null);
    setShowForm(true);
  };

  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (!confirm(`Delete variant ${labelVariant(variant)}?`)) return;

    const success = await deleteProductVariant(variant.id);
    if (success) {
      toast.success("Variant deleted");
      onVariantsUpdated();
    } else {
      toast.error("Failed to delete variant");
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantValue.trim()) {
      toast.error("Please fill in the variant value");
      return;
    }

    try {
      setLoading(true);
      const quantityValue = Math.max(0, Number(quantity || 0));
      const priceAdjustmentValue = Number(priceAdjustment || 0);
      const leastPriceValue = Math.max(0, Number(leastPrice || 0));
      const parentCostValue = Number(parentCost || 0);
      const variantSellingPrice = Number(parentPrice || 0) + priceAdjustmentValue;
      if (
        leastPriceValue > 0 &&
        Number.isFinite(parentCostValue) &&
        Number.isFinite(variantSellingPrice) &&
        (leastPriceValue < parentCostValue || leastPriceValue > variantSellingPrice)
      ) {
        toast.error("Variant least price must be between cost and selling price");
        return;
      }
      const secondType = variantType2 || null;
      const secondValue = secondType && variantValue2.trim() ? variantValue2.trim() : null;
      const finalSku =
        sku.trim() ||
        createVariantSku?.(variantType, variantValue, secondType || undefined, secondValue || undefined) ||
        `${variantType.toUpperCase().slice(0, 2)}-${variantValue.replace(/\s+/g, "").slice(0, 5)}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;
      const finalBarcode =
        barcodeValue.trim() ||
        createVariantBarcode?.() ||
        `${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;

      const success = editingId
        ? await updateProductVariant(editingId, {
            variant_type: variantType,
            variant_value: variantValue,
            variant_type_2: secondType,
            variant_value_2: secondValue,
            sku: finalSku,
            barcode: finalBarcode,
            quantity: quantityValue,
            price_adjustment: priceAdjustmentValue,
            least_price: leastPriceValue,
            least_price_code: leastPriceCode || "",
            ...(imageBase64 ? { image_url: imageBase64 } : {}),
          })
        : Boolean(
            await addProductVariant(
              productId,
              variantType,
              variantValue,
              finalSku,
              finalBarcode,
              quantityValue,
              priceAdjustmentValue,
              leastPriceValue,
              leastPriceCode || undefined,
              secondType || undefined,
              secondValue || undefined,
              imageBase64 || undefined
            )
          );

      if (success) {
        toast.success(editingId ? "Variant updated" : "Variant added");
        resetForm();
        setShowForm(false);
        onVariantsUpdated();
      } else {
        toast.error(editingId ? "Failed to update variant" : "Failed to add variant");
      }
    } catch (error) {
      console.error("Error saving variant:", error);
      toast.error("Error saving variant");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (variantId: string, newQuantity: number) => {
    try {
      const success = await updateVariantStock(variantId, newQuantity);
      if (success) {
        toast.success("Stock updated!");
        onVariantsUpdated();
      } else {
        toast.error("Failed to update stock");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      toast.error("Error updating stock");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Added Variants</h4>
        {variants.length === 0 ? (
          <div className="px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 italic">
            No variants yet
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-300"
              >
                {variant.image_url && (
                  <div className="w-6 h-6 rounded overflow-hidden bg-white flex-shrink-0">
                    <OfflineProductImage
                      src={variant.image_url}
                      alt={variant.variant_value}
                      className="w-full h-full"
                    />
                  </div>
                )}
                <span>{labelVariant(variant)}</span>
                <div className="flex items-center gap-1 text-xs bg-blue-200 px-2 py-0.5 rounded">
                  <span>Qty:</span>
                  <input
                    type="number"
                    value={variant.quantity || ""}
                    onChange={(e) => handleUpdateStock(variant.id, Math.max(0, Number(e.target.value) || 0))}
                    min="0"
                    className="w-12 px-1 py-0 border border-blue-400 rounded text-xs text-center bg-white"
                    title="Edit stock"
                  />
                </div>
                {variant.price_adjustment !== 0 && (
                  <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded">
                    {variant.price_adjustment > 0 ? "+" : ""}{variant.price_adjustment}
                  </span>
                )}
                {variant.least_price_code && (
                  <span className="text-xs bg-white px-2 py-0.5 rounded border border-blue-300">
                    {variant.least_price_code}
                  </span>
                )}
                {onPrintBarcode && (
                  <button
                    type="button"
                    onClick={() => onPrintBarcode(variant)}
                    className="p-1 text-blue-700 hover:bg-blue-200 rounded"
                    title="Barcode preview"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEditVariant(variant)}
                  className="p-1 text-green-700 hover:bg-blue-200 rounded"
                  title="Edit variant"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVariant(variant)}
                  className="p-1 text-red-700 hover:bg-red-100 rounded"
                  title="Delete variant"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        {!showForm ? (
          <button
            onClick={() => {
              resetForm();
              setSku(createVariantSku?.("size", "") || "");
              setBarcodeValue(createVariantBarcode?.() || "");
              setShowForm(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Variant
          </button>
        ) : (
          <form onSubmit={handleSaveVariant} className="space-y-3 p-3 bg-gray-50 rounded border border-blue-200">
            <h4 className="font-semibold text-gray-900 text-sm">{editingId ? "Edit Variant" : "New Variant"}</h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={variantType}
                  onChange={(e) => {
                    setVariantType(e.target.value);
                    if (variantType2 === e.target.value) {
                      setVariantType2("");
                      setVariantValue2("");
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  {VARIANT_TYPES.map((type) => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Value *</label>
                <input
                  type="text"
                  value={variantValue}
                  onChange={(e) => setVariantValue(e.target.value)}
                  placeholder="M, Red, Leather"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Second Type</label>
                <select
                  value={variantType2}
                  onChange={(e) => {
                    setVariantType2(e.target.value);
                    if (!e.target.value) setVariantValue2("");
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">None</option>
                  {VARIANT_TYPES.filter((type) => type !== variantType).map((type) => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Second Value</label>
                <input
                  type="text"
                  value={variantValue2}
                  onChange={(e) => setVariantValue2(e.target.value)}
                  disabled={!variantType2}
                  placeholder="Red"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded border border-blue-200 bg-blue-50 p-2">
              <label className="block text-xs font-medium text-gray-700">
                Variant SKU
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Variant SKU"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSku(
                        createVariantSku?.(
                          variantType,
                          variantValue,
                          variantType2 || undefined,
                          variantValue2 || undefined
                        ) || ""
                      )
                    }
                    className="px-2 py-1.5 rounded bg-white border border-blue-300 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Generate
                  </button>
                </div>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Variant Barcode
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Scan, type, or generate barcode"
                  />
                  <button
                    type="button"
                    onClick={() => setBarcodeValue(createVariantBarcode?.() || "")}
                    className="px-2 py-1.5 rounded bg-white border border-blue-300 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Generate
                  </button>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-gray-700">
                Stock Qty
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Price Adj (+/-)
                <input
                  type="number"
                  value={priceAdjustment}
                  onChange={(e) => setPriceAdjustment(e.target.value)}
                  step="0.01"
                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-gray-700">
                Least Price
                <input
                  type="number"
                  value={leastPrice}
                  onChange={(e) => setLeastPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Least Price Code
                <input
                  type="text"
                  value={leastPriceCode}
                  onChange={(e) => setLeastPriceCode(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="Code"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Variant Image (optional)</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-xs" />
              {imagePreview && (
                <div className="mt-2 p-2 bg-white rounded border border-gray-300">
                  <OfflineProductImage src={imagePreview} alt="Preview" className="w-full h-32 rounded" />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : editingId ? "Update Variant" : "Add Variant"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="flex-1 px-3 py-1.5 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
