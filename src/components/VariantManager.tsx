"use client";

import { useState } from "react";
import { Barcode, Plus} from "lucide-react";
import toast from "react-hot-toast";
import { ProductVariant } from "@/types";
import { addProductVariant, updateVariantStock } from "@/lib/supabase";

interface VariantManagerProps {
  productId: string;
  variants: ProductVariant[];
  onVariantsUpdated: () => void;
  onPrintBarcode?: (variant: ProductVariant) => void;
}

export const VariantManager = ({
  productId,
  variants,
  onVariantsUpdated,
  onPrintBarcode,
}: VariantManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [variantType, setVariantType] = useState("size");
  const [variantValue, setVariantValue] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [priceAdjustment, setPriceAdjustment] = useState(0);
  const [leastPrice, setLeastPrice] = useState(0);
  const [leastPriceCode, setLeastPriceCode] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ ,setEditingId] = useState<string | null>(null);

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

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantValue.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      
      // Auto-generate SKU and Barcode
      const sku = `${variantType.toUpperCase().slice(0, 2)}-${variantValue.replace(/\s+/g, '').slice(0, 5)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const barcode = `${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 2).toUpperCase()}`;
      
      const result = await addProductVariant(
        productId,
        variantType,
        variantValue,
        sku,
        barcode,
        quantity,
        priceAdjustment,
        leastPrice,
        leastPriceCode || undefined,
        imageBase64 || undefined
      );

      if (result) {
        toast.success(`Variant added: ${variantType} - ${variantValue}`);
        setVariantValue("");
        setQuantity(0);
        setPriceAdjustment(0);
        setLeastPrice(0);
        setLeastPriceCode("");
        setImagePreview(null);
        setImageBase64(null);
        setShowForm(false);
        setEditingId(null);
        onVariantsUpdated();
      } else {
        toast.error("Failed to add variant");
      }
    } catch (error) {
      console.error("Error adding variant:", error);
      toast.error("Error adding variant");
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
      {/* Variants Display as Badges */}
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
                    <img
                      src={variant.image_url}
                      alt={variant.variant_value}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <span>
                  <strong>{variant.variant_type}:</strong> {variant.variant_value}
                </span>
                <div className="flex items-center gap-1 text-xs bg-blue-200 px-2 py-0.5 rounded">
                  <span>Qty:</span>
                  <input
                    type="number"
                    value={variant.quantity}
                    onChange={(e) =>
                      handleUpdateStock(variant.id, Number(e.target.value))
                    }
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Variant Form */}
      <div className="border-t pt-4">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Variant
          </button>
        ) : (
          <form onSubmit={handleAddVariant} className="space-y-3 p-3 bg-gray-50 rounded border border-blue-200">
            <h4 className="font-semibold text-gray-900 text-sm">New Variant</h4>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                value={variantType}
                onChange={(e) => setVariantType(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="size">Size</option>
                <option value="color">Color</option>
                <option value="material">Material</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value * <span className="text-gray-500">(e.g., M, Red, Leather)</span>
              </label>
              <input
                type="text"
                value={variantValue}
                onChange={(e) => setVariantValue(e.target.value)}
                placeholder="Enter variant value"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                autoFocus
              />
            </div>

            <div className="p-2 bg-blue-50 rounded text-xs text-gray-600 border border-blue-200">
              SKU and Barcode will be auto-generated
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Stock Qty
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min="0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Price Adj (+/-)
                </label>
                <input
                  type="number"
                  value={priceAdjustment}
                  onChange={(e) => setPriceAdjustment(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Least Price
                </label>
                <input
                  type="number"
                  value={leastPrice}
                  onChange={(e) => setLeastPrice(Math.max(0, Number(e.target.value) || 0))}
                  min="0"
                  step="0.01"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Least Price Code
                </label>
                <input
                  type="text"
                  value={leastPriceCode}
                  onChange={(e) => setLeastPriceCode(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="Code"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variant Image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-xs"
              />
              {imagePreview && (
                <div className="mt-2 p-2 bg-white rounded border border-gray-300">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Add Variant"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setVariantValue("");
                  setQuantity(0);
                  setPriceAdjustment(0);
                  setLeastPrice(0);
                  setLeastPriceCode("");
                  setImagePreview(null);
                  setImageBase64(null);
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
