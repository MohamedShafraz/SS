"use client";

import { MainLayout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { Trash2, Printer, Check, X, Barcode, Eye, ArrowLeft, ShoppingCart, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { supabase, fetchProductsWithVariants, findVariantByBarcode } from "@/lib/supabase";
import { ProductVariant } from "@/types";
import { fetchTransactionWithItems, createReturn, addReturnItems, addReplacementItems, createReplacementTransaction, completeReturn } from "@/lib/returns";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  discount: number;
  discountType: "lkr" | "percentage"; // LKR or percentage
  variant_id?: string;                  // NEW: variant support
  variant_type?: string;                // NEW: e.g., 'size'
  variant_value?: string;               // NEW: e.g., 'M'
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
  variants?: ProductVariant[];          // NEW: product variants
}

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  products?: {
    name: string;
    image_url: string;
  };
}

interface TransactionData {
  id: string;
  transaction_date: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
}

export default function POSPage() {
  const [mode, setMode] = useState<"sale" | "returns">("sale");  // NEW: mode toggle
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"lkr" | "percentage">("lkr");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  
  // NEW: Returns mode state
  const [transactionId, setTransactionId] = useState("");
  const [originalTransaction, setOriginalTransaction] = useState<TransactionData | null>(null);
  const [originalItems, setOriginalItems] = useState<TransactionItem[]>([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<string>>(new Set());
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [replacementCart, setReplacementCart] = useState<CartItem[]>([]);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch products with variants from Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsData = await fetchProductsWithVariants();
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading products");
    } finally {
      setLoading(false);
    }
  };

  // NEW: Lookup original transaction for returns
  const handleLookupTransaction = async () => {
    if (!transactionId.trim()) {
      toast.error("Please enter transaction ID");
      return;
    }

    try {
      const result = await fetchTransactionWithItems(transactionId);
      if (!result) {
        toast.error("Transaction not found");
        setOriginalTransaction(null);
        setOriginalItems([]);
        return;
      }

      setOriginalTransaction(result.transaction);
      setOriginalItems(result.items);
      toast.success("Transaction loaded! Select items to return.");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading transaction");
    }
  };

  // NEW: Toggle return item selection
  const toggleReturnItem = (itemId: string) => {
    const newSelected = new Set(selectedReturnItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedReturnItems(newSelected);
  };

  // NEW: Process return and replacement
  const handleProcessReturn = async () => {
    if (selectedReturnItems.size === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (!returnReason.trim()) {
      toast.error("Please enter return reason");
      return;
    }

    try {
      // Step 1: Create return record
      const returnRecord = await createReturn(
        originalTransaction!.id,
        returnReason,
        returnNotes
      );

      if (!returnRecord) {
        toast.error("Failed to create return record");
        return;
      }

      // Step 2: Add returned items
      const returnItems = originalItems
        .filter((item) => selectedReturnItems.has(item.id))
        .map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          refund_amount: item.subtotal,
        }));

      const itemsAdded = await addReturnItems(returnRecord.id, returnItems);
      if (!itemsAdded) {
        toast.error("Failed to add return items");
        return;
      }

      // Step 3: If there are replacements, add them
      if (replacementCart.length > 0) {
        const replacementItems = replacementCart.map((item) => ({
          product_id: item.variant_id ? item.id.split("-")[0] : item.id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          replacement_price: item.price * item.quantity,
        }));

        const replacementsAdded = await addReplacementItems(
          returnRecord.id,
          replacementItems
        );

        if (!replacementsAdded) {
          toast.error("Failed to add replacement items");
          return;
        }

        // Create replacement transaction
        const { globalDiscount, total } = calculateReplacementTotals();
        const txn = await createReplacementTransaction(
          returnRecord.id,
          total,
          globalDiscount,
          paymentMethod
        );

        if (!txn) {
          toast.error("Failed to create replacement transaction");
          return;
        }

        // Update stocks
        await updateReplacementStocks();
      }

      // Mark return as completed
      await completeReturn(returnRecord.id);

      toast.success(
        replacementCart.length > 0
          ? "Return and replacement processed!"
          : "Return processed successfully!"
      );

      // Reset returns mode
      resetReturnsMode();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error processing return");
    }
  };

  // NEW: Calculate replacement totals
  const calculateReplacementTotals = () => {
    let subtotal = 0;
    replacementCart.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      let itemDiscount = 0;

      if (item.discountType === "percentage") {
        itemDiscount = (itemTotal * item.discount) / 100;
      } else {
        itemDiscount = Math.min(itemTotal, item.discount);
      }

      subtotal += Math.max(0, itemTotal - itemDiscount);
    });

    return { subtotal, globalDiscount: 0, total: Math.max(0, subtotal) };
  };

  // NEW: Update stocks for replacement items
  const updateReplacementStocks = async () => {
    for (const item of replacementCart) {
      if (item.variant_id) {
        const variant = products
          .flatMap((p) => p.variants || [])
          .find((v) => v.id === item.variant_id);

        if (variant) {
          await supabase
            .from("product_variants")
            .update({ quantity: variant.quantity - item.quantity })
            .eq("id", item.variant_id);
        }
      } else {
        const product = products.find((p) => p.id === item.id);
        if (product) {
          await supabase
            .from("products")
            .update({ quantity: product.quantity - item.quantity })
            .eq("id", item.id);
        }
      }
    }
  };

  // NEW: Reset returns mode
  const resetReturnsMode = () => {
    setTransactionId("");
    setOriginalTransaction(null);
    setOriginalItems([]);
    setSelectedReturnItems(new Set());
    setReturnReason("");
    setReturnNotes("");
    setReplacementCart([]);
    setMode("sale");
  };

  // Filter products based on search input
  const handleSearchFilter = (searchText: string) => {
    setBarcodeInput(searchText);

    if (!searchText.trim()) {
      setFilteredProducts(products);
      return;
    }

    const searchLower = searchText.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.barcode.toLowerCase().includes(searchLower) ||
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower)
    );

    setFilteredProducts(filtered);
  };

  useEffect(() => {
    // Focus barcode input on mount
    barcodeInputRef.current?.focus();
  }, []);

  const handleBarcodeInput = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const searchLower = barcodeInput.toLowerCase();
      
      // Try variant barcode first
      const variant = await findVariantByBarcode(searchLower);
      if (variant) {
        const product = products.find((p) => p.id === variant.product_id);
        if (product) {
          addToCartWithVariant(product, variant);
          toast.success(`Added ${product.name} - ${variant.variant_value}`);
          setBarcodeInput("");
          setFilteredProducts(products);
          return;
        }
      }
      
      // Try product barcode match
      let product = products.find((p) => p.barcode.toLowerCase() === searchLower);
      
      // If not found by barcode, try by name
      if (!product) {
        product = products.find((p) => p.name.toLowerCase().includes(searchLower));
      }

      if (product) {
        if (product.variants && product.variants.length > 0) {
          // Show variant selector
          setPendingProduct(product);
          setShowVariantSelector(true);
        } else {
          // No variants, add directly
          addToCart(product);
          toast.success(`Added ${product.name}`);
        }
        setBarcodeInput("");
        setFilteredProducts(products);
      } else {
        toast.error("Product not found");
      }
    }
  };

  const addToCartWithVariant = (product: Product, variant: ProductVariant) => {
    const cartItemId = `${product.id}-${variant.id}`;
    const existingInCart = cart.find((c) => c.id === cartItemId);
    const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

    // Check variant stock
    if (variant.quantity - currentQtyInCart <= 0) {
      toast.error("Variant out of stock");
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === cartItemId);
      if (existingItem) {
        const newQty = Math.min(variant.quantity, existingItem.quantity + 1);
        if (existingItem.quantity >= variant.quantity) {
          toast.error("Reached available variant stock");
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === cartItemId ? { ...item, quantity: newQty } : item
        );
      }

      const variantPrice = product.price + variant.price_adjustment;
      return [
        ...prevCart,
        {
          id: cartItemId,
          name: product.name,
          price: variantPrice,
          quantity: 1,
          image_url: product.image_url,
          discount: 0,
          discountType: "lkr",
          variant_id: variant.id,
          variant_type: variant.variant_type,
          variant_value: variant.variant_value,
        },
      ];
    });
  };

  const addToCart = (product: Product) => {
    // Prevent adding more than available stock
    const existingInCart = cart.find((c) => c.id === product.id);
    const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;
    if (product.quantity - currentQtyInCart <= 0) {
      toast.error("Product out of stock");
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        const newQty = Math.min(product.quantity, existingItem.quantity + 1);
        if (existingItem.quantity >= product.quantity) {
          toast.error("Reached available stock");
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty } : item
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
          discountType: "lkr",
        },
      ];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    // Check max based on product or variant stock
    let maxQty = Infinity;
    const cartItem = cart.find((item) => item.id === id);
    
    if (cartItem?.variant_id) {
      // Find variant stock
      const variant = products
        .flatMap((p) => p.variants || [])
        .find((v) => v.id === cartItem.variant_id);
      maxQty = variant?.quantity || 0;
    } else {
      // Find product stock
      const product = products.find((p) => p.id === id);
      maxQty = product?.quantity || 0;
    }

    let validQty = quantity;
    if (quantity > maxQty) {
      toast.error(`Only ${maxQty} available`);
      validQty = maxQty;
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, quantity: validQty } : item
      )
    );
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id) return item;

        const itemTotal = item.price * item.quantity;
        let validDiscount = Math.max(0, discount);

        // Validate based on discount type
        if (item.discountType === "percentage") {
          // Percentage discount can't be >= 100
          validDiscount = Math.min(99.99, validDiscount);
        } else {
          // LKR discount can't exceed item total
          validDiscount = Math.min(itemTotal, validDiscount);
        }

        return { ...item, discount: validDiscount };
      })
    );
  };

  const updateDiscountType = (id: string, type: "lkr" | "percentage") => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id) return item;

        const itemTotal = item.price * item.quantity;
        let validDiscount = item.discount;

        // Validate discount for the new type
        if (type === "percentage") {
          // If switching to percentage, ensure it's < 100
          validDiscount = Math.min(99.99, validDiscount);
        } else {
          // If switching to LKR, ensure it doesn't exceed item total
          validDiscount = Math.min(itemTotal, validDiscount);
        }

        return { ...item, discountType: type, discount: validDiscount };
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const calculateTotals = () => {
    let subtotal = 0;

    // Calculate subtotal with individual item discounts (robust to bad input)
    cart.forEach((item) => {
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
      const rawDiscount = Number(item.discount ?? 0);
      let itemDiscount = 0;

      if (item.discountType === "percentage") {
        const pct = isFinite(rawDiscount) ? rawDiscount : 0;
        itemDiscount = (itemTotal * pct) / 100;
      } else {
        const lkr = isFinite(rawDiscount) ? rawDiscount : 0;
        itemDiscount = Math.min(itemTotal, lkr);
      }

      subtotal += Math.max(0, itemTotal - itemDiscount);
    });

    // Apply global discount safely
    const rawGlobal = Number(discount ?? 0);
    let globalDiscount = 0;
    if (discountType === "percentage") {
      const pct = isFinite(rawGlobal) ? rawGlobal : 0;
      globalDiscount = Math.min(subtotal, (subtotal * pct) / 100);
    } else {
      const lkr = isFinite(rawGlobal) ? rawGlobal : 0;
      globalDiscount = Math.min(subtotal, lkr);
    }

    const total = Math.max(0, subtotal - globalDiscount);
    return { subtotal, globalDiscount, total };
  };

  const { subtotal, globalDiscount, total } = calculateTotals();

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
            discount_amount: globalDiscount,
            tax_amount: 0,
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
        const items = cart.map((item) => {
          const itemTotal = item.price * item.quantity;
          let itemDiscount = 0;
          
          if (item.discountType === "percentage") {
            itemDiscount = (itemTotal * item.discount) / 100;
          } else {
            itemDiscount = item.discount;
          }
          
          return {
            transaction_id: transactionId,
            product_id: item.variant_id ? item.id.split("-")[0] : item.id, // Extract product ID if variant
            quantity: item.quantity,
            unit_price: item.price,
            discount: itemDiscount,
            subtotal: itemTotal - itemDiscount,
          };
        });

        const { error: itemsError } = await supabase
          .from("transaction_items")
          .insert(items);

        if (itemsError) {
          console.error("Error saving transaction items:", itemsError);
          toast.error("Failed to save transaction items");
          return;
        }

        // Update product/variant quantities
        for (const cartItem of cart) {
          if (cartItem.variant_id) {
            // Update variant stock
            const variant = products
              .flatMap((p) => p.variants || [])
              .find((v) => v.id === cartItem.variant_id);
            
            if (variant) {
              const newQuantity = variant.quantity - cartItem.quantity;
              const { error: updateError } = await supabase
                .from("product_variants")
                .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq("id", cartItem.variant_id);

              if (updateError) {
                console.error("Error updating variant quantity:", updateError);
              }
            }
          } else {
            // Update product stock
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
      }

      // Refresh products after checkout
      await fetchProducts();

      toast.success(`Order completed! Total: ${total}/=`);
      setCart([]);
      setDiscount(0);
      setDiscountType("lkr");
      barcodeInputRef.current?.focus();

      // Trigger print after successful checkout
      handlePrint();
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
      {/* Mode Switcher Tabs */}
      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setMode("sale")}
          className={`px-4 py-2 font-semibold transition-colors ${
            mode === "sale"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <ShoppingCart className="w-4 h-4 inline mr-2" />
          Sale
        </button>
        <button
          onClick={() => setMode("returns")}
          className={`px-4 py-2 font-semibold transition-colors ${
            mode === "returns"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <RotateCcw className="w-4 h-4 inline mr-2" />
          Returns & Replacements
        </button>
      </div>

      {/* Sale Mode */}
      {mode === "sale" && (
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
                onChange={(e) => handleSearchFilter(e.target.value)}
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
            ) : products.length === 0? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">No products available</p>
                  <p className="text-sm text-gray-500">Add products from the Products page</p>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">No products found</p>
                  <p className="text-sm text-gray-500">Try a different search term</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
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
                      onClick={() => {
                        if (product.variants && product.variants.length > 0) {
                          setPendingProduct(product);
                          setShowVariantSelector(true);
                        } else {
                          addToCart(product);
                          toast.success(`Added ${product.name}`);
                        }
                      }}
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
                        <div className="flex-1">
                          <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                            {item.name}
                          </h3>
                          {item.variant_type && item.variant_value && (
                            <p className="text-xs text-gray-600">
                              {item.variant_type}: {item.variant_value}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 ml-2"
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
                      <div className="flex gap-2 mb-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.discount ?? 0}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                            const itemTotal = item.price * item.quantity;
                            let validDiscount = Math.max(0, val);

                            // Validate based on discount type
                            if (item.discountType === "percentage") {
                              // Percentage discount can't be >= 100
                              validDiscount = Math.min(99.99, validDiscount);
                            } else {
                              // LKR discount can't exceed item total
                              validDiscount = Math.min(itemTotal, validDiscount);
                            }

                            updateDiscount(item.id, validDiscount);
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <select
                          value={item.discountType}
                          onChange={(e) =>
                            updateDiscountType(item.id, e.target.value as "lkr" | "percentage")
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white min-w-fit"
                        >
                          <option value="lkr">/=</option>
                          <option value="percentage">%</option>
                        </select>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        Subtotal: {(() => {
                          const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
                          const rawDiscount = Number(item.discount ?? 0);
                          let itemDiscount = 0;
                          if (item.discountType === "percentage") {
                            const pct = isFinite(rawDiscount) ? rawDiscount : 0;
                            itemDiscount = (itemTotal * pct) / 100;
                          } else {
                            const lkr = isFinite(rawDiscount) ? rawDiscount : 0;
                            itemDiscount = Math.min(itemTotal, lkr);
                          }
                          return Math.max(0, itemTotal - itemDiscount);
                        })()}/=
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
                <span className="font-medium">{Math.round(subtotal)}/=</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Discount:</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount ?? 0}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                      let validDiscount = Math.max(0, val);

                      // Validate based on discount type
                      if (discountType === "percentage") {
                        // Percentage discount can't be >= 100
                        validDiscount = Math.min(99.99, validDiscount);
                      } else {
                        // LKR discount can't exceed subtotal
                        validDiscount = Math.min(subtotal, validDiscount);
                      }

                      setDiscount(validDiscount);
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => {
                      const newType = e.target.value as "lkr" | "percentage";
                      let validDiscount = discount;

                      // Validate discount for the new type
                      if (newType === "percentage") {
                        // If switching to percentage, ensure it's < 100
                        validDiscount = Math.min(99.99, validDiscount);
                      } else {
                        // If switching to LKR, ensure it doesn't exceed subtotal
                        validDiscount = Math.min(subtotal, validDiscount);
                      }

                      setDiscountType(newType);
                      setDiscount(validDiscount);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white min-w-fit"
                  >
                    <option value="lkr">/=</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>
              <div className="border-t-2 pt-2 flex justify-between">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-blue-600">{Math.round(total)}/=</span>
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
                  setDiscountType("lkr");
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
      )}

      {/* Returns Mode */}
      {mode === "returns" && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full overflow-hidden">
        {/* Transaction Lookup Section */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Returns & Replacements
            </h2>

            {!originalTransaction ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter transaction ID..."
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="input-base flex-1"
                  />
                  <button
                    onClick={handleLookupTransaction}
                    className="btn-primary"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Transaction Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(originalTransaction.transaction_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">Total Amount</p>
                  <p className="font-bold text-blue-600 text-lg">
                    {originalTransaction.total_amount}/=
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setOriginalTransaction(null)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Original Items List */}
          {originalTransaction && (
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Select Items to Return</h3>
              <div className="space-y-2">
                {originalItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReturnItems.has(item.id)}
                      onChange={() => toggleReturnItem(item.id)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.products?.name || "Product"}
                      </p>
                      <p className="text-xs text-gray-600">
                        Qty: {item.quantity} × {item.unit_price}/= = {item.subtotal}/=
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedReturnItems.size > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Return Reason *</p>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select reason...</option>
                    <option value="Wrong size">Wrong size</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Changed mind">Changed mind</option>
                    <option value="Defective">Defective</option>
                    <option value="Other">Other</option>
                  </select>

                  <label className="block text-sm text-gray-600 mt-2">Notes (optional)</label>
                  <textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Replacement Products Section */}
        <div className="lg:col-span-1 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Available Products
            </h2>
            <input
              type="text"
              placeholder="Search replacements..."
              value={barcodeInput}
              onChange={(e) => handleSearchFilter(e.target.value)}
              className="input-base text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-1 gap-2">
              {filteredProducts.slice(0, 20).map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    if (product.variants && product.variants.length > 0) {
                      setPendingProduct(product);
                      setShowVariantSelector(true);
                    } else {
                      const item: CartItem = {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: 1,
                        image_url: product.image_url,
                        discount: 0,
                        discountType: "lkr",
                      };
                      setReplacementCart([...replacementCart, item]);
                    }
                  }}
                  className="p-2 text-left rounded bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900 line-clamp-1">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-600">{product.price}/=</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Replacement Cart Section */}
        <div className="lg:col-span-1 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden h-fit">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Replacement Cart
            </h2>
            {replacementCart.length > 0 && (
              <p className="text-xs text-gray-600">
                Total: {replacementCart.reduce((sum, item) => sum + item.price * item.quantity, 0)}/=
              </p>
            )}
          </div>

          {/* Replacement Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {replacementCart.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Add replacement items
              </p>
            ) : (
              <div className="space-y-2">
                {replacementCart.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-gray-900 line-clamp-1">
                        {item.name}
                      </p>
                      <button
                        onClick={() =>
                          setReplacementCart(
                            replacementCart.filter((i) => i.id !== item.id)
                          )
                        }
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1;
                        setReplacementCart(
                          replacementCart.map((i) =>
                            i.id === item.id ? { ...i, quantity: newQty } : i
                          )
                        );
                      }}
                      className="w-full px-1 py-1 border border-gray-300 rounded text-xs mb-1"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{item.price * item.quantity}/=</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t p-4 space-y-2">
            <button
              onClick={handleProcessReturn}
              disabled={selectedReturnItems.size === 0 || !returnReason.trim()}
              className="w-full px-4 py-3 bg-green-600 text-white font-semibold text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 inline mr-1" />
              Process Return
            </button>
            <button
              onClick={resetReturnsMode}
              className="w-full px-4 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
            >
              <X className="w-4 h-4 inline mr-1" />
              Cancel
            </button>
          </div>
        </div>
      </div>
      )}

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

      {/* Variant Selector Modal */}
      {showVariantSelector && pendingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                Select Variant: {pendingProduct.name}
              </h2>
              <button
                onClick={() => {
                  setShowVariantSelector(false);
                  setPendingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Variants Grid */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingProduct.variants && pendingProduct.variants.length > 0 ? (
                pendingProduct.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => {
                      addToCartWithVariant(pendingProduct, variant);
                      setShowVariantSelector(false);
                      setPendingProduct(null);
                    }}
                    disabled={variant.quantity <= 0}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                      variant.quantity <= 0
                        ? "border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed"
                        : "border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {variant.variant_type}: {variant.variant_value}
                        </p>
                        <p className="text-xs text-gray-600">
                          Stock: {variant.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {pendingProduct.price + variant.price_adjustment}/=
                        </p>
                        {variant.price_adjustment !== 0 && (
                          <p className="text-xs text-gray-500">
                            {variant.price_adjustment > 0 ? "+" : ""}{variant.price_adjustment}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-gray-600 text-center py-4">No variants available</p>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => {
                setShowVariantSelector(false);
                setPendingProduct(null);
              }}
              className="w-full px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
