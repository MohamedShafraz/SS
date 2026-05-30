"use client";

import { useState } from "react";
import { Plus} from "lucide-react";
import toast from "react-hot-toast";
import { ProductVariant } from "@/types";
import { addProductVariant, updateVariantStock } from "@/lib/supabase";

interface VariantManagerProps {
  productId: string;
  variants: ProductVariant[];
  onVariantsUpdated: () => void;
}

export const VariantManager = ({
  productId,
  variants,
  onVariantsUpdated,
}: VariantManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [variantType, setVariantType] = useState("size");
  const [variantValue, setVariantValue] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [priceAdjustment, setPriceAdjustment] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantValue.trim() || !sku.trim() || !barcode.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const result = await addProductVariant(
        productId,
        variantType,
        variantValue,
        sku,
        barcode,
        quantity,
        priceAdjustment
      );

      if (result) {
        toast.success(`Variant added: ${variantType} - ${variantValue}`);
        setVariantValue("");
        setSku("");
        setBarcode("");
        setQuantity(0);
        setPriceAdjustment(0);
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU-M"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Barcode *
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
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
                  setSku("");
                  setBarcode("");
                  setQuantity(0);
                  setPriceAdjustment(0);
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
