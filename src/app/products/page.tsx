"use client";

import { MainLayout } from "@/components/layout";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Edit, Trash2, Barcode } from "lucide-react";
import JsBarcode from "jsbarcode";
import toast from "react-hot-toast";
import { supabase, getProductVariants } from "@/lib/supabase";
import { VariantManager } from "@/components/VariantManager";
import { BusinessProfile, IndustryMode, ProductVariant } from "@/types";
import { getCategoryPresets, getStoredIndustryMode } from "@/lib/industry-presets";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";

type HardwarePrinter = { name: string; displayName?: string; isDefault?: boolean };
type HardwareBridge = {
  listPrinters: () => Promise<HardwarePrinter[]>;
  printBarcode: (html: string, printerName?: string) => Promise<{ success: boolean; printerName?: string; error?: string }>;
};

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  image_url: string;
  barcode: string;
  sku: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [industryMode, setIndustryMode] = useState<IndustryMode>("general");
  const [settings, setSettings] = useState<Pick<BusinessProfile, "currency" | "barcodePrefix">>({
    currency: DEFAULT_CURRENCY,
    barcodePrefix: "BCD",
  });
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [printers, setPrinters] = useState<HardwarePrinter[]>([]);
  const [printingBarcode, setPrintingBarcode] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const barcodePreviewRef = useRef<SVGSVGElement>(null);
  const barcodeStickerRef = useRef<SVGSVGElement>(null);

  const categories = getCategoryPresets(industryMode);

  useEffect(() => {
    setIndustryMode(getStoredIndustryMode());
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.settings) return;
        setSettings((prev) => ({ ...prev, ...result.settings }));
      })
      .catch(() => {
        const stored = localStorage.getItem("posSettings");
        if (!stored) return;
        try {
          setSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
        } catch {
          // Keep defaults if stored settings cannot be parsed.
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const createBarcodeValue = useCallback(() => {
    const prefix = settings.barcodePrefix?.trim() || "BCD";
    return `${prefix}-${Date.now()}`;
  }, [settings.barcodePrefix]);

  useEffect(() => {
    if (!showForm || !barcodePreviewRef.current) return;

    const value = formData.barcode?.trim();
    if (!value) {
      barcodePreviewRef.current.innerHTML = "";
      return;
    }

    try {
      JsBarcode(barcodePreviewRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 72,
        displayValue: true,
        margin: 8,
        fontSize: 14,
      });
    } catch {
      barcodePreviewRef.current.innerHTML = "";
    }
  }, [formData.barcode, showForm]);

  useEffect(() => {
    if (!barcodeProduct || !barcodeStickerRef.current) return;

    try {
      JsBarcode(barcodeStickerRef.current, barcodeProduct.barcode, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: true,
        margin: 8,
        fontSize: 14,
      });
    } catch {
      barcodeStickerRef.current.innerHTML = "";
    }
  }, [barcodeProduct]);

  const fetchProducts = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      if (isActive()) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
        return;
      }

      if (isActive()) {
        setProducts(
          (data || []).map((product: Product) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            cost: product.cost,
            quantity: product.quantity ?? 0,
            image_url: product.image_url ?? "",
            barcode: product.barcode ?? "",
            sku: product.sku ?? "",
          }))
        );
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading products");
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch products from Supabase
  useEffect(() => {
    let active = true;

    fetchProducts(() => active);

    return () => {
      active = false;
    };
  }, [fetchProducts]);

  const filteredProducts = products.filter((product) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      product.name.toLowerCase().includes(searchLower) ||
      product.barcode.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower);
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = () => {
    setEditingId(null);
    setVariants([]);
    setFormData({
      barcode: createBarcodeValue(),
      sku: `SKU-${Date.now()}`,
    });
    setShowForm(true);
  };

  const handleEditProduct = async (product: Product) => {
    setEditingId(product.id);
    setFormData(product);
    setVariantsLoading(true);
    const productVariants = await getProductVariants(product.id);
    setVariants(productVariants);
    setVariantsLoading(false);
    setShowForm(true);
  };

  const handleSaveProduct = async () => {
    if (
      !formData.name ||
      !formData.category ||
      !formData.price ||
      !formData.cost
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      // Calculate total quantity from variants if they exist
      const totalQuantity = variants.length > 0 
        ? variants.reduce((sum, v) => sum + (v.quantity || 0), 0)
        : Math.max(0, formData.quantity || 0);

      if (editingId) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update({
            name: formData.name,
            category: formData.category,
            price: formData.price,
            cost: formData.cost,
            quantity: totalQuantity,
            image_url: formData.image_url ?? null,
            barcode: formData.barcode,
            sku: formData.sku,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) {
          console.error("Error updating product:", error);
          toast.error("Failed to update product");
          return;
        }
        toast.success("Product updated!");
      } else {
        // Insert new product
        const { error } = await supabase.from("products").insert([
          {
            name: formData.name,
            category: formData.category,
            price: formData.price,
            cost: formData.cost,
            quantity: Math.max(0, formData.quantity || 0),
            image_url: formData.image_url ?? null,
            barcode: formData.barcode || createBarcodeValue(),
            sku: formData.sku || `SKU-${Date.now()}`,
          },
        ]);

        if (error) {
          console.error("Error adding product:", error);
          toast.error("Failed to add product");
          return;
        }
        toast.success("Product added!");
      }
      setShowForm(false);
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error saving product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) {
        console.error("Error deleting product:", error);
        toast.error("Failed to delete product");
        return;
      }

      toast.success("Product deleted!");
      fetchProducts();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error deleting product");
    }
  };

  const generateBarcodeSticker = (product: Product) => {
    setBarcodeProduct(product);
  };

  useEffect(() => {
    if (!barcodeProduct) {
      setPrinters([]);
      return;
    }

    const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
    bridge?.listPrinters().then(setPrinters).catch((error) => {
      console.error("Unable to detect printers:", error);
      setPrinters([]);
    });
  }, [barcodeProduct]);

  const printBarcode = async () => {
    if (!barcodeProduct || !barcodeStickerRef.current) return;

    setPrintingBarcode(true);
    try {
      const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
      const printer = printers.find((item) => item.isDefault) || printers[0];
      const labelHtml = `<!doctype html><html><head><style>body{font-family:Arial,sans-serif;text-align:center;margin:12mm}svg{max-width:100%}</style></head><body><h3>${barcodeProduct.name}</h3>${barcodeStickerRef.current.outerHTML}<p>${barcodeProduct.sku || ""}</p></body></html>`;

      if (bridge && printer) {
        const result = await bridge.printBarcode(labelHtml, printer.name);
        if (!result.success) throw new Error(result.error || "Unable to print barcode");
        toast.success(`Barcode sent to ${result.printerName || printer.displayName || printer.name}`);
      } else if (typeof window.print === "function") {
        window.print();
      } else {
        toast.error("No printer detected");
      }
    } catch (error) {
      console.error("Unable to print barcode:", error);
      toast.error(error instanceof Error ? error.message : "Unable to print barcode");
    } finally {
      setPrintingBarcode(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600">Manage inventory and product details</p>
          </div>
          <button
            onClick={handleAddProduct}
            className="btn-success flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-base"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-600">
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <p className="text-gray-600 mb-2">No products found</p>
                      <p className="text-sm text-gray-500">Click &quot;Add Product&quot; to create your first product</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const margin = (
                      ((product.price - product.cost) / product.price) *
                      100
                    ).toFixed(1);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={product.image_url && product.image_url.startsWith('data:') 
                                ? product.image_url 
                                : (product.image_url || "https://via.placeholder.com/40?text=No+Image")}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "https://via.placeholder.com/40?text=No+Image";
                              }}
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {formatCurrency(product.price, settings.currency)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatCurrency(product.cost, settings.currency)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              product.quantity > 20
                                ? "bg-green-100 text-green-700"
                                : product.quantity > 5
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {margin}%
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => generateBarcodeSticker(product)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Generate Barcode"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Product Modal - Two Panel Layout */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? "Edit Product" : "Add Product"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Two Panel Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                
                {/* LEFT PANEL - Product Details */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">Product Details</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="input-base"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="input-base"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Categories follow the selected industry profile in Settings.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Price *
                      </label>
                      <input
                        type="number"
                        value={formData.price || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price: parseInt(e.target.value),
                          })
                        }
                        className="input-base"
                        placeholder="Price"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Cost *
                      </label>
                      <input
                        type="number"
                        value={formData.cost || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, cost: parseInt(e.target.value) })
                        }
                        className="input-base"
                        placeholder="Cost"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Quantity
                        {variants.length > 0 && (
                          <span className="text-xs text-gray-600 ml-2">(Variants: {variants.reduce((sum, v) => sum + (v.quantity || 0), 0)})</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={variants.length > 0 ? variants.reduce((sum, v) => sum + (v.quantity || 0), 0) : (formData.quantity || "")}
                        onChange={(e) =>
                          variants.length === 0 && setFormData({
                            ...formData,
                            quantity: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        disabled={variants.length > 0}
                        className={`input-base ${variants.length > 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="Quantity"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        SKU
                      </label>
                      <input
                        type="text"
                        value={formData.sku || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        className="input-base"
                        placeholder="SKU"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="block text-sm font-medium text-gray-900">
                        Barcode
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, barcode: createBarcodeValue() })
                        }
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.barcode || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      className="input-base"
                      placeholder="Scan or enter barcode"
                    />
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 overflow-x-auto">
                      {formData.barcode ? (
                        <svg ref={barcodePreviewRef} className="mx-auto max-w-full" />
                      ) : (
                        <p className="py-8 text-center text-sm text-gray-500">
                          Enter a barcode to preview it
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Product Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setFormData({
                              ...formData,
                              image_url: event.target?.result as string,
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="input-base"
                    />
                    {formData.image_url && (
                      <div className="mt-3">
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="h-32 w-32 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.src = "https://via.placeholder.com/128?text=No+Image";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleSaveProduct}
                      className="btn-success flex-1"
                    >
                      Save Product
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* RIGHT PANEL - Variants (only when editing) */}
                {editingId ? (
                  <div className="space-y-4 border-l pl-6">
                    <h3 className="text-lg font-semibold text-gray-900">Product Variants</h3>
                    
                    {variantsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-gray-500">Loading variants...</p>
                      </div>
                    ) : (
                      <VariantManager
                        productId={editingId}
                        variants={variants}
                        onVariantsUpdated={async () => {
                          if (editingId) {
                            const updated = await getProductVariants(editingId);
                            setVariants(updated);
                          }
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center border-l pl-6">
                    <div className="text-center text-gray-500">
                      <p className="text-sm">Save the product first</p>
                      <p className="text-xs">Then you can add variants</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {barcodeProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Barcode Preview</h2>
                  <p className="text-sm text-gray-600">{barcodeProduct.name}</p>
                </div>
                <button
                  onClick={() => setBarcodeProduct(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  X
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 overflow-x-auto">
                <svg ref={barcodeStickerRef} className="mx-auto max-w-full" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">SKU</p>
                  <p className="font-semibold text-gray-900 break-all">{barcodeProduct.sku || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Barcode</p>
                  <p className="font-semibold text-gray-900 break-all">{barcodeProduct.barcode}</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                {printers.length > 0
                  ? `Printer detected: ${(printers.find((printer) => printer.isDefault) || printers[0]).displayName || (printers.find((printer) => printer.isDefault) || printers[0]).name}`
                  : "No desktop printer detected. Browser printing will be used."}
              </p>

              <button
                onClick={printBarcode}
                disabled={printingBarcode}
                className="btn-primary mt-4 w-full disabled:opacity-50"
              >
                {printingBarcode ? "Printing..." : "Print Barcode"}
              </button>

              <button
                onClick={() => setBarcodeProduct(null)}
                className="btn-secondary mt-6 w-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
