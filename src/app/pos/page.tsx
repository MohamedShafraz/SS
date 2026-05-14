"use client";

import { MainLayout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { Trash2, Printer, Check, X, Barcode, Eye, ArrowLeft, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  discount: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  category: string;
  quantity: number;
  image_url: string;
  barcode: string;
  sku: string;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch products from Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Focus barcode input on mount
    barcodeInputRef.current?.focus();
  }, []);

  const handleBarcodeInput = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const product = products.find((p) => p.barcode === barcodeInput);
      if (product) {
        addToCart(product);
        toast.success(`Added ${product.name}`);
      } else {
        toast.error("Product not found");
      }
      setBarcodeInput("");
    }
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image_url: product.image_url,
          discount: 0,
        },
      ];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, discount } : item
      )
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity - item.discount,
      0
    );
    const tax = Math.round(subtotal * 0.05); // 5% tax
    const total = subtotal + tax - discount;
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calculateTotals();

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    try {
      // Save transaction to Supabase
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            transaction_date: new Date().toISOString().split('T')[0],
            total_amount: total,
            discount_amount: discount,
            tax_amount: tax,
            payment_method: paymentMethod,
          },
        ])
        .select();

      if (transactionError) {
        console.error("Error saving transaction:", transactionError);
        toast.error("Failed to save transaction");
        return;
      }

      // Save transaction items
      if (transactionData && transactionData.length > 0) {
        const transactionId = transactionData[0].id;
        const items = cart.map((item) => ({
          transaction_id: transactionId,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          discount: item.discount,
          subtotal: item.price * item.quantity - item.discount,
        }));

        const { error: itemsError } = await supabase
          .from("transaction_items")
          .insert(items);

        if (itemsError) {
          console.error("Error saving transaction items:", itemsError);
          toast.error("Failed to save transaction items");
          return;
        }

        // Update product quantities
        for (const cartItem of cart) {
          const product = products.find((p) => p.id === cartItem.id);
          if (product) {
            const newQuantity = product.quantity - cartItem.quantity;
            const { error: updateError } = await supabase
              .from("products")
              .update({ quantity: newQuantity })
              .eq("id", cartItem.id);

            if (updateError) {
              console.error("Error updating product quantity:", updateError);
            }
          }
        }
      }

      // Refresh products after checkout
      await fetchProducts();

      toast.success(`Order completed! Total: ${total}/=`);
      setCart([]);
      setDiscount(0);
      barcodeInputRef.current?.focus();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error processing checkout");
    }
  };

  const handlePrint = () => {
    toast.success("Receipt printed!");
  };

  return (
    <MainLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
        {/* Products Section */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Products
            </h2>
            <div className="flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or search..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={handleBarcodeInput}
                className="input-base flex-1"
              />
              <button className="btn-primary">
                <Barcode className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">No products available</p>
                  <p className="text-sm text-gray-500">Add products from the Products page</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="card-hover p-3 text-left relative group rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="w-full h-32 bg-gray-200 rounded mb-3 overflow-hidden relative">
                      <img
                        src={product.image_url && product.image_url.startsWith('data:') 
                          ? product.image_url 
                          : (product.image_url || "https://via.placeholder.com/150?text=No+Image")}
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/150?text=No+Image";
                        }}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-40 transition-all rounded"
                        title="View Details"
                      >
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">{product.category}</p>
                    <p className="text-lg font-bold text-blue-600">{product.price}/=</p>
                    <button
                      onClick={() => addToCart(product)}
                      className="mt-3 w-full px-3 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 transition-colors"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="lg:col-span-1 h-fit flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto border-b">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cart</h2>
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                          {item.name}
                        </h3>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                          {item.price}/=
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.id, parseInt(e.target.value))
                          }
                          className="w-12 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Discount"
                        value={item.discount}
                        onChange={(e) =>
                          updateDiscount(item.id, parseInt(e.target.value))
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                      />
                      <p className="text-sm font-semibold text-gray-900">
                        Subtotal: {item.price * item.quantity - item.discount}/=
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Totals Section */}
          <div className="p-4 bg-gray-50 border-t">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{subtotal}/=</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (5%):</span>
                <span className="font-medium">{tax}/=</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Discount:</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="border-t-2 pt-2 flex justify-between">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-blue-600">{total}/=</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-base text-sm"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="check">Check</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCheckout}
                className="btn-success flex-1 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Checkout
              </button>
              <button
                onClick={handlePrint}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
              <button
                onClick={() => {
                  setCart([]);
                  setDiscount(0);
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Product Image */}
            <div className="mb-6">
              <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={selectedProduct.image_url && selectedProduct.image_url.startsWith('data:') 
                    ? selectedProduct.image_url 
                    : (selectedProduct.image_url || "https://via.placeholder.com/150?text=No+Image")}
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/150?text=No+Image";
                  }}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              {/* Name and Category */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {selectedProduct.name}
                </h2>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                  {selectedProduct.category}
                </span>
              </div>

              {/* Price and Cost */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm font-medium mb-1">Selling Price</p>
                  <p className="text-2xl font-bold text-green-600">{selectedProduct.price}/=</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm font-medium mb-1">Cost</p>
                  <p className="text-2xl font-bold text-orange-600">{selectedProduct.cost}/=</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm font-medium mb-1">Margin</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(((selectedProduct.price - selectedProduct.cost) / selectedProduct.price) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Stock Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Stock Quantity</p>
                    <p className="text-3xl font-bold text-gray-900">{selectedProduct.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Stock Status</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        selectedProduct.quantity > 20
                          ? "bg-green-100 text-green-700"
                          : selectedProduct.quantity > 5
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {selectedProduct.quantity > 20
                        ? "In Stock"
                        : selectedProduct.quantity > 5
                        ? "Low Stock"
                        : "Critical"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SKU and Barcode */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">SKU</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.sku}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Barcode</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.barcode}</p>
                </div>
              </div>

              {/* Profit Calculation */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-gray-600 text-sm font-medium mb-2">Profit per Unit</p>
                <p className="text-3xl font-bold text-blue-600">
                  {selectedProduct.price - selectedProduct.cost}/=
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                  toast.success(`Added ${selectedProduct.name} to cart`);
                }}
                className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
