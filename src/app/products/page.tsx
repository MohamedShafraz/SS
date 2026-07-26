"use client";

import { MainLayout } from "@/components/layout";
import { useCallback, useEffect, useState } from "react";
import { Plus, Edit, Trash2, Barcode } from "lucide-react";
import toast from "react-hot-toast";
import { supabase, getProductVariants } from "@/lib/supabase";
import { VariantManager } from "@/components/VariantManager";
import { IndustryMode, ProductVariant } from "@/types";
import { getCategoryPresets, getStoredIndustryMode } from "@/lib/industry-presets";

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
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const categories = getCategoryPresets(industryMode);

  useEffect(() => {
    setIndustryMode(getStoredIndustryMode());
  }, []);

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
          (data || []).map((product) => ({
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
  const lowStockCount = products.filter((product) => product.quantity <= 5).length;
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.cost * product.quantity,
    0
  );

  const handleAddProduct = () => {
    setEditingId(null);
    setFormData({});
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
            barcode: formData.barcode || `BCD-${Date.now()}`,
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
    toast.success(`Barcode sticker generated for ${product.name}`);
    // In a real application, this would use jsbarcode to generate and print
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Inventory Control</p>
              <h1 className="text-2xl font-bold text-slate-950">Products</h1>
              <p className="text-sm text-slate-600">Manage stock, pricing, variants, and barcode-ready product records.</p>
          </div>
          <button
            onClick={handleAddProduct}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
              <Plus className="h-4 w-4" />
            Add Product
          </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Visible records</p>
              <p className="text-lg font-bold text-slate-950">{filteredProducts.length}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Low stock</p>
              <p className="text-lg font-bold text-amber-700">{lowStockCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Inventory value</p>
              <p className="text-lg font-bold text-slate-950">{inventoryValue}/=</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <input
              type="text"
              placeholder="Search name, SKU, barcode, or category"
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 p-3 md:hidden">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-600">Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-medium text-slate-700">No products found</p>
                <p className="mt-1 text-sm text-slate-500">Add a product or adjust filters.</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const margin = product.price
                  ? (((product.price - product.cost) / product.price) * 100).toFixed(1)
                  : "0.0";
                return (
                  <div key={product.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex gap-3">
                      <img
                        src={product.image_url && product.image_url.startsWith("data:")
                          ? product.image_url
                          : (product.image_url || "https://via.placeholder.com/48?text=No+Image")}
                        alt={product.name}
                        className="h-14 w-14 rounded-md object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/48?text=No+Image";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{product.name}</p>
                            <p className="truncate text-xs text-slate-500">{product.sku || "No SKU"} · {product.category}</p>
                          </div>
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${
                            product.quantity > 20
                              ? "bg-emerald-50 text-emerald-700"
                              : product.quantity > 5
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}>
                            {product.quantity}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div><p className="text-slate-500">Price</p><p className="font-semibold">{product.price}/=</p></div>
                          <div><p className="text-slate-500">Cost</p><p className="font-semibold">{product.cost}/=</p></div>
                          <div><p className="text-slate-500">Margin</p><p className="font-semibold">{margin}%</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button onClick={() => generateBarcodeSticker(product)} className="rounded-md border border-slate-200 px-2 py-2 text-sm font-medium text-blue-700">Barcode</button>
                      <button onClick={() => handleEditProduct(product)} className="rounded-md border border-slate-200 px-2 py-2 text-sm font-medium text-emerald-700">Edit</button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="rounded-md border border-slate-200 px-2 py-2 text-sm font-medium text-red-700">Delete</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Margin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
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
                          {product.price}/=
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {product.cost}/=
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
      </div>
    </MainLayout>
  );
}
