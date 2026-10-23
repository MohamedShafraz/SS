"use client";

import { MainLayout } from "@/components/layout";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Printer, Check, X, Barcode, Eye, ArrowLeft, ShoppingCart, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { getOfflineImageSrc, OfflineProductImage } from "@/components/OfflineProductImage";
import { localDb, fetchProductsWithVariants, findVariantByBarcode } from "@/lib/local-db-client";
import { BusinessProfile, ProductVariant } from "@/types";
import { DEFAULT_CURRENCY, discountUnitLabel, formatCurrency } from "@/lib/currency";
import {
  fetchReturnableTransactionWithItems,
  processReturn,
} from "@/lib/returns";

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  originalPrice: number;
  minimumUnitPrice: number;
  leastPrice?: number;
  leastPriceCode?: string;
  quantity: number;
  image_url: string;
  discount: number;
  discountType: "lkr" | "percentage";
  variant_id?: string;                  // NEW: variant support
  variant_type?: string;                // NEW: e.g., 'size'
  variant_value?: string;               // NEW: e.g., 'M'
  variant_type_2?: string | null;
  variant_value_2?: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  least_price?: number;
  least_price_code?: string;
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
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  products?: {
    name: string;
    image_url: string;
  } | null;
}

interface TransactionData {
  id: string;
  transaction_date: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
}

interface ReceiptPreview {
  transactionId: string;
  transactionDate: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  balanceAmount?: number;
  dueAmount?: number;
  customerName?: string | null;
  saleType?: "walk_in" | "shop";
  paymentStatus?: "paid" | "partial" | "unpaid";
  status: "draft" | "completed";
}

interface ShopAccount {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  total_billed: number;
  total_paid: number;
  due_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
}

const defaultReceiptSettings: BusinessProfile = {
  businessName: "Unified Business",
  address: "123 Main Street, City",
  phone: "+94 77 712 3456",
  email: "info@business.com",
  taxRate: 5,
  currency: DEFAULT_CURRENCY,
  businessType: "Retail",
  barcodePrefix: "BCD",
  industryMode: "general",
  receiptLayout: "standard",
  receiptPaperWidth: "80mm",
  showReceiptBusinessInfo: true,
  logoImage: "",
  showReceiptFooter: true,
  receiptFooterMode: "return_days",
  receiptFooterDays: 7,
  receiptFooterText: "",
  allowTransactionDelete: false,
  posSetPriceRule: "least_price",
  billBarcodeEnabled: true,
  returnBarcodeEnabled: true,
  replacementBarcodeEnabled: true,
  replacementStockProtectionEnabled: true,
  partialReturnProtectionEnabled: true,
  taxCalculationEnabled: false,
  shopBillingEnabled: false,
};

type HardwareBridge = {
  listPrinters: () => Promise<Array<{ name: string; isDefault?: boolean }>>;
};

export default function POSPage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="min-h-[60vh] bg-white rounded-lg shadow-lg animate-pulse" />
        </MainLayout>
      }
    >
      <POSContent />
    </Suspense>
  );
}

function POSContent() {
  const [mode, setMode] = useState<"sale" | "returns">("sale");  // NEW: mode toggle
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"lkr" | "percentage">("lkr");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [receiptSettings, setReceiptSettings] =
    useState<BusinessProfile>(defaultReceiptSettings);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(null);
  const [setPriceInputs, setSetPriceInputs] = useState<Record<string, string>>({});
  const [shopAccounts, setShopAccounts] = useState<ShopAccount[]>([]);
  const [saleType, setSaleType] = useState<"walk_in" | "shop">("walk_in");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [newShopPhone, setNewShopPhone] = useState("");
  
  // NEW: Returns mode state
  const [transactionId, setTransactionId] = useState("");
  const [originalTransaction, setOriginalTransaction] = useState<TransactionData | null>(null);
  const [originalItems, setOriginalItems] = useState<TransactionItem[]>([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<string>>(new Set());
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [replacementCart, setReplacementCart] = useState<CartItem[]>([]);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerCheckActiveRef = useRef(false);
  const scannerInputStartedAtRef = useRef<number | null>(null);
  const barcodeValueRef = useRef("");

  const currency = receiptSettings.currency || DEFAULT_CURRENCY;
  const money = useCallback((amount: number | string | null | undefined) => formatCurrency(amount, currency), [currency]);
  const variantLabel = useCallback(
    (item: Pick<CartItem, "variant_type" | "variant_value" | "variant_type_2" | "variant_value_2">) =>
      [
        item.variant_type && item.variant_value ? `${item.variant_type}: ${item.variant_value}` : "",
        item.variant_type_2 && item.variant_value_2 ? `${item.variant_type_2}: ${item.variant_value_2}` : "",
      ].filter(Boolean).join(" / "),
    []
  );
  const discountCurrencyLabel = discountUnitLabel(currency);
  const receiptLayout = receiptSettings.receiptLayout || "standard";
  const receiptPaperWidth = receiptSettings.receiptPaperWidth || "80mm";
  const showReceiptBusinessInfo = receiptSettings.showReceiptBusinessInfo !== false;
  const receiptFooterText = useMemo(() => {
    if (receiptSettings.showReceiptFooter === false) return "";
    const days = Math.max(1, Number(receiptSettings.receiptFooterDays || 7));
    if (receiptSettings.receiptFooterMode === "valid_days") {
      return `This bill is valid for ${days} day${days === 1 ? "" : "s"}.`;
    }
    if (receiptSettings.receiptFooterMode === "custom") {
      return receiptSettings.receiptFooterText || "";
    }
    return `Return allowed within ${days} day${days === 1 ? "" : "s"}.`;
  }, [receiptSettings]);
  const receiptLogoImage = getOfflineImageSrc(receiptSettings.logoImage);
  const posSetPriceRule = receiptSettings.posSetPriceRule || "least_price";
  const billBarcodeEnabled = receiptSettings.billBarcodeEnabled !== false;
  const returnBarcodeEnabled = receiptSettings.returnBarcodeEnabled !== false;
  const replacementBarcodeEnabled = receiptSettings.replacementBarcodeEnabled !== false;
  const replacementStockProtectionEnabled = receiptSettings.replacementStockProtectionEnabled !== false;
  const taxCalculationEnabled = receiptSettings.taxCalculationEnabled === true;
  const shopBillingEnabled = receiptSettings.shopBillingEnabled === true;
  const isShopSale = shopBillingEnabled && saleType === "shop";
  const selectedShop = shopAccounts.find((shop) => shop.id === selectedShopId) || null;
  const activeShopName = (selectedShop?.name || newShopName).trim();
  const minimumUnitPriceForProduct = (product: Product, variant?: ProductVariant | null) => {
    if (posSetPriceRule === "below_cost") {
      return 0;
    }

    const cost = Math.max(0, Number(product.cost || 0));
    if (posSetPriceRule === "cost") {
      return cost;
    }

    return Math.max(0, Number(variant?.least_price || product.least_price || cost));
  };
  const minimumLineTotal = (item: CartItem, quantity = item.quantity) =>
    Math.max(0, Number(item.minimumUnitPrice || 0) * Number(quantity || 0));
  const maxDiscountForLine = (item: CartItem, price = item.price, quantity = item.quantity) =>
    Math.max(0, Number(price || 0) * Number(quantity || 0) - minimumLineTotal(item, quantity));
  const capLineDiscount = (
    item: CartItem,
    rawDiscount = item.discount,
    discountType = item.discountType,
    price = item.price,
    quantity = item.quantity
  ) => {
    const validDiscount = Math.max(0, Number(rawDiscount || 0));
    const itemTotal = Number(price || 0) * Number(quantity || 0);
    const maxDiscount = maxDiscountForLine(item, price, quantity);

    if (discountType === "percentage") {
      const maxPct = itemTotal > 0 ? (maxDiscount / itemTotal) * 100 : 0;
      return Math.min(99.99, maxPct, validDiscount);
    }

    return Math.min(maxDiscount, validDiscount);
  };
  const cartMinimumTotal = (items = cart) =>
    items.reduce((sum, item) => sum + minimumLineTotal(item), 0);

  const fetchProducts = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      if (isActive()) {
        setLoading(true);
      }
      const productsData = await fetchProductsWithVariants();
      if (isActive()) {
        setProducts(productsData);
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

  const fetchShopAccounts = useCallback(async (isActive: () => boolean = () => true) => {
    const { data, error } = await localDb
      .from("shop_accounts")
      .select("*")
      .order("name", { ascending: true });

    if (!error && isActive()) {
      setShopAccounts((data || []) as ShopAccount[]);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    if (!barcodeInput.trim()) {
      return products;
    }

    const searchLower = barcodeInput.toLowerCase();
    return products.filter((product) => {
      const productMatches =
        product.barcode.toLowerCase().includes(searchLower) ||
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower);

      const variantMatches = (product.variants || []).some((variant) =>
        [
          variant.variant_value,
          variant.variant_value_2,
          variant.sku,
          variant.barcode,
          `${variant.variant_type}: ${variant.variant_value}`,
          variant.variant_type_2 && variant.variant_value_2
            ? `${variant.variant_type_2}: ${variant.variant_value_2}`
            : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchLower))
      );

      return productMatches || variantMatches;
    });
  }, [barcodeInput, products]);

  // Fetch products with variants from local offline storage
  useEffect(() => {
    let active = true;

    fetchProducts(() => active);
    fetchShopAccounts(() => active);

    return () => {
      active = false;
    };
  }, [fetchProducts, fetchShopAccounts]);

  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.settings) return;
        setReceiptSettings((prev) => ({ ...prev, ...result.settings }));
      })
      .catch(() => {
        const stored = localStorage.getItem("posSettings");
        if (!stored) return;
        try {
          setReceiptSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
        } catch {
          // Keep defaults if stored settings cannot be parsed.
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // NEW: Lookup original transaction for returns
  const handleLookupTransaction = async () => {
    if (!transactionId.trim()) {
      toast.error("Please enter transaction ID");
      return;
    }

    try {
      const result = await fetchReturnableTransactionWithItems(transactionId);
      if (!result.ok) {
        const message =
          result.reason === "non_returnable"
            ? "Return and replacement transactions cannot be returned again"
            : result.reason === "no_returnable_items"
            ? "This transaction has no returnable sale items"
            : "Transaction not found";
        toast.error(message);
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
    if (!originalTransaction) {
      toast.error("Load a transaction before processing a return");
      return;
    }

    if (selectedReturnItems.size === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (!returnReason.trim()) {
      toast.error("Please enter return reason");
      return;
    }

    try {
      const { taxAmount: replacementTaxAmount } = calculateReplacementTotals();
      await processReturn({
        originalTransactionId: originalTransaction.id,
        reason: returnReason,
        notes: returnNotes,
        returnedItems: originalItems
          .filter((item) => selectedReturnItems.has(item.id))
          .map((item) => ({ transactionItemId: item.id, quantity: item.quantity })),
        replacementItems: replacementCart.map((item) => {
          const itemTotal = item.price * item.quantity;
          const itemDiscount = item.discountType === "percentage"
            ? (itemTotal * item.discount) / 100
            : Math.min(itemTotal, item.discount);
          return {
            productId: item.product_id,
            variantId: item.variant_id ?? null,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: itemDiscount,
            subtotal: Math.max(0, itemTotal - itemDiscount),
          };
        }),
        replacementPaymentMethod: paymentMethod,
        replacementTaxAmount,
      });

      toast.success(
        replacementCart.length > 0
          ? "Return and replacement processed!"
          : "Return processed successfully!"
      );

      await fetchProducts();
      resetReturnsMode();
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Error processing return");
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

    const taxableTotal = Math.max(0, subtotal);
    const taxAmount = taxCalculationEnabled
      ? Math.max(0, taxableTotal * (Number(receiptSettings.taxRate || 0) / 100))
      : 0;
    return { subtotal, globalDiscount: 0, taxAmount, total: taxableTotal + taxAmount };
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
    barcodeValueRef.current = searchText;
    setBarcodeInput(searchText);
  };

  useEffect(() => {
    // Focus barcode input on mount
    barcodeInputRef.current?.focus();

    return () => {
      if (scannerCheckTimerRef.current) clearTimeout(scannerCheckTimerRef.current);
    };
  }, []);

  const getHardwareBridge = () =>
    (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;

  const warnIfPrinterUnavailable = async () => {
    if (typeof window === "undefined" || typeof window.print !== "function") {
      window.alert("Printing is unavailable in this environment.");
      return true;
    }

    const bridge = getHardwareBridge();
    if (!bridge) {
      window.alert("Printer detection is available in the MSHPOS desktop app.");
      return false;
    }

    try {
      const printers = await bridge.listPrinters();
      if (printers.length === 0) {
        window.alert("No printer is connected. Connect a printer and try again.");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Unable to detect printers:", error);
      window.alert("Could not detect a printer. Check the printer connection and try again.");
      return true;
    }
  };

  const checkBarcodeReader = async () => {
    barcodeInputRef.current?.focus();

    if (scannerCheckActiveRef.current) {
      toast("Scanner check is already active. Scan a barcode now.", { duration: 3000 });
      return;
    }

    const browserWithDevices = navigator as Navigator & {
      hid?: { getDevices: () => Promise<Array<unknown>> };
      usb?: { getDevices: () => Promise<Array<unknown>> };
    };

    try {
      const [hidDevices, usbDevices] = await Promise.all([
        browserWithDevices.hid?.getDevices() ?? Promise.resolve([]),
        browserWithDevices.usb?.getDevices() ?? Promise.resolve([]),
      ]);

      if (hidDevices.length > 0 || usbDevices.length > 0) {
        toast.success("Barcode reader connected. Scan a barcode now.", { duration: 4000 });
        return;
      }
    } catch (error) {
      console.warn("Unable to query barcode reader devices:", error);
    }

    scannerCheckActiveRef.current = true;
    scannerInputStartedAtRef.current = null;
    barcodeValueRef.current = "";
    setBarcodeInput("");
    toast("Ready for scanner input. Scan a barcode within 5 seconds.", { duration: 5000 });
    scannerCheckTimerRef.current = setTimeout(() => {
      scannerCheckActiveRef.current = false;
      toast.error("No barcode detected. Check the reader connection and try again.", {
        duration: 5000,
      });
    }, 5000);
  };

  const handleBarcodeChange = (value: string) => {
    if (scannerCheckActiveRef.current && value.length === 1) {
      scannerInputStartedAtRef.current = performance.now();
    }
    barcodeValueRef.current = value;
    setBarcodeInput(value);
  };

  const handleBarcodeInput = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (mode === "sale" && !billBarcodeEnabled) {
        toast.error("Bill barcode scanning is disabled in settings");
        return;
      }
      if (mode === "returns" && !replacementBarcodeEnabled) {
        toast.error("Replacement barcode scanning is disabled in settings");
        return;
      }
      const scannedValue = barcodeValueRef.current.trim();
      const scanStartedAt = scannerInputStartedAtRef.current;
      const isRapidScan =
        scannerCheckActiveRef.current &&
        scannedValue.length >= 4 &&
        scanStartedAt !== null &&
        performance.now() - scanStartedAt <= 1500;

      if (isRapidScan) {
        scannerCheckActiveRef.current = false;
        scannerInputStartedAtRef.current = null;
        if (scannerCheckTimerRef.current) clearTimeout(scannerCheckTimerRef.current);
        toast.success("Barcode reader detected");
      }
      const searchLower = scannedValue.toLowerCase();
      
      // Try variant barcode first
      const variant = await findVariantByBarcode(searchLower);
      if (variant) {
        const product = products.find((p) => p.id === variant.product_id);
        if (product) {
          if (mode === "returns") {
            addVariantToReplacementCart(product, variant);
            toast.success(`Added replacement ${product.name} - ${variant.variant_value}`);
          } else {
            addToCartWithVariant(product, variant);
            toast.success(`Added ${product.name} - ${variant.variant_value}`);
          }
          barcodeValueRef.current = "";
          setBarcodeInput("");
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
          if (mode === "returns") {
            addToReplacementCart(product);
            toast.success(`Added replacement ${product.name}`);
          } else {
            addToCart(product);
            toast.success(`Added ${product.name}`);
          }
        }
        barcodeValueRef.current = "";
        setBarcodeInput("");
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
      const leastPrice = Number(variant.least_price || product.least_price || 0);
      const minimumUnitPrice = minimumUnitPriceForProduct(product, variant);
      return [
        ...prevCart,
        {
          id: cartItemId,
          product_id: product.id,
          name: product.name,
          price: variantPrice,
          originalPrice: variantPrice,
          minimumUnitPrice,
          leastPrice,
          leastPriceCode: variant.least_price_code || product.least_price_code || "",
          quantity: 1,
          image_url: product.image_url,
          discount: 0,
          discountType: "lkr",
          variant_id: variant.id,
          variant_type: variant.variant_type,
          variant_value: variant.variant_value,
          variant_type_2: variant.variant_type_2,
          variant_value_2: variant.variant_value_2,
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
          product_id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.price,
          minimumUnitPrice: minimumUnitPriceForProduct(product),
          leastPrice: Number(product.least_price || 0),
          leastPriceCode: product.least_price_code || "",
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
        item.id === id
          ? { ...item, quantity: validQty, discount: capLineDiscount(item, item.discount, item.discountType, item.price, validQty) }
          : item
      )
    );
  };

  const updateSetPriceInput = (id: string, rawValue: string) => {
    setSetPriceInputs((prev) => ({ ...prev, [id]: rawValue }));
  };

  const commitSetPrice = (id: string, rawValue: string) => {
    setSetPriceInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id) return item;

        const originalPrice = Number(item.originalPrice || item.price || 0);
        const nextPrice = rawValue === "" ? originalPrice : Number(rawValue);

        if (!Number.isFinite(nextPrice) || nextPrice < 0) {
          toast.error("Enter a valid set price");
          return item;
        }

        if (nextPrice < item.minimumUnitPrice) {
          toast.error(`Set price cannot be below ${money(item.minimumUnitPrice)}`);
          return item;
        }

        if (nextPrice > originalPrice) {
          toast.error("Set price cannot be above original price");
          return item;
        }

        const discount = capLineDiscount(item, item.discount, item.discountType, nextPrice);

        return { ...item, price: nextPrice, originalPrice, discount };
      })
    );
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id) return item;

        const validDiscount = capLineDiscount(item, discount);

        return { ...item, discount: validDiscount };
      })
    );
  };

  const updateDiscountType = (id: string, type: "lkr" | "percentage") => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id) return item;

        const validDiscount = capLineDiscount(item, item.discount, type);

        return { ...item, discountType: type, discount: validDiscount };
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    setSetPriceInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addToReplacementCart = (product: Product) => {
    const existingItem = replacementCart.find((item) => item.id === product.id);
    const currentQty = existingItem?.quantity || 0;
    if (replacementStockProtectionEnabled && product.quantity - currentQty <= 0) {
      toast.error("Product out of stock");
      return;
    }

    if (existingItem) {
      setReplacementCart((items) =>
        items.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: replacementStockProtectionEnabled
                  ? Math.min(product.quantity, item.quantity + 1)
                  : item.quantity + 1,
              }
            : item
        )
      );
      return;
    }

    setReplacementCart((items) => [
      ...items,
      {
        id: product.id,
        product_id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.price,
        minimumUnitPrice: minimumUnitPriceForProduct(product),
        leastPrice: Number(product.least_price || 0),
        leastPriceCode: product.least_price_code || "",
        quantity: 1,
        image_url: product.image_url,
        discount: 0,
        discountType: "lkr",
      },
    ]);
  };

  const addVariantToReplacementCart = (product: Product, variant: ProductVariant) => {
    const cartItemId = `${product.id}-${variant.id}`;
    const existingItem = replacementCart.find((item) => item.id === cartItemId);
    const currentQty = existingItem?.quantity || 0;
    if (replacementStockProtectionEnabled && variant.quantity - currentQty <= 0) {
      toast.error("Variant out of stock");
      return;
    }

    if (existingItem) {
      setReplacementCart((items) =>
        items.map((item) =>
          item.id === cartItemId
            ? {
                ...item,
                quantity: replacementStockProtectionEnabled
                  ? Math.min(variant.quantity, item.quantity + 1)
                  : item.quantity + 1,
              }
            : item
        )
      );
      return;
    }

    const variantPrice = product.price + variant.price_adjustment;
    setReplacementCart((items) => [
      ...items,
      {
        id: cartItemId,
        product_id: product.id,
        name: product.name,
        price: variantPrice,
        originalPrice: variantPrice,
        minimumUnitPrice: minimumUnitPriceForProduct(product, variant),
        leastPrice: Number(variant.least_price || product.least_price || 0),
        leastPriceCode: variant.least_price_code || product.least_price_code || "",
        quantity: 1,
        image_url: product.image_url,
        discount: 0,
        discountType: "lkr",
        variant_id: variant.id,
        variant_type: variant.variant_type,
        variant_value: variant.variant_value,
        variant_type_2: variant.variant_type_2,
        variant_value_2: variant.variant_value_2,
      },
    ]);
  };

  const calculateTotals = () => {
    let subtotal = 0;

    // Calculate subtotal with individual item discounts (robust to bad input)
    cart.forEach((item) => {
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
      const rawDiscount = capLineDiscount(item);
      let itemDiscount = 0;

      if (item.discountType === "percentage") {
        const pct = isFinite(rawDiscount) ? rawDiscount : 0;
        itemDiscount = (itemTotal * pct) / 100;
      } else {
        const amountDiscount = isFinite(rawDiscount) ? rawDiscount : 0;
        itemDiscount = Math.min(itemTotal, amountDiscount);
      }

      subtotal += Math.max(0, itemTotal - itemDiscount);
    });

    // Apply global discount safely
    const rawGlobal = Number(discount ?? 0);
    const minimumTotal = cartMinimumTotal();
    const maxGlobalDiscount = Math.max(0, subtotal - minimumTotal);
    let globalDiscount = 0;
    if (discountType === "percentage") {
      const pct = isFinite(rawGlobal) ? rawGlobal : 0;
      globalDiscount = Math.min(maxGlobalDiscount, (subtotal * pct) / 100);
    } else {
      const amountDiscount = isFinite(rawGlobal) ? rawGlobal : 0;
      globalDiscount = Math.min(maxGlobalDiscount, amountDiscount);
    }

    const taxableTotal = Math.max(minimumTotal, subtotal - globalDiscount);
    const taxAmount = taxCalculationEnabled
      ? Math.max(0, taxableTotal * (Number(receiptSettings.taxRate || 0) / 100))
      : 0;
    const total = taxableTotal + taxAmount;
    return { subtotal, globalDiscount, taxableTotal, taxAmount, total };
  };

  const { subtotal, globalDiscount, taxableTotal, taxAmount, total } = calculateTotals();

  const paymentStatusFor = (paid: number, saleTotal: number): "paid" | "partial" | "unpaid" => {
    const due = Math.max(0, saleTotal - paid);
    if (due <= 0) return "paid";
    return paid > 0 ? "partial" : "unpaid";
  };

  const resolveShopAccount = async () => {
    if (!isShopSale) return null;
    if (selectedShop) return selectedShop;

    const name = newShopName.trim();
    if (!name) return null;

    const existing = shopAccounts.find((shop) => shop.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const { data, error } = await localDb
      .from("shop_accounts")
      .insert([
        {
          name,
          phone: newShopPhone.trim(),
          address: "",
          notes: "",
          total_billed: 0,
          total_paid: 0,
          due_amount: 0,
          payment_status: "unpaid",
        },
      ])
      .select();

    if (error) {
      toast.error("Failed to create shop account");
      return null;
    }

    const shop = ((data || [])[0] as ShopAccount | undefined) || null;
    await fetchShopAccounts();
    return shop;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const belowMinimumItem = cart.find((item) => Number(item.price || 0) < Number(item.minimumUnitPrice || 0));
    if (belowMinimumItem) {
      toast.error(`${belowMinimumItem.name} cannot be sold below ${money(belowMinimumItem.minimumUnitPrice)}`);
      return;
    }

    if (taxableTotal < cartMinimumTotal()) {
      toast.error("Discount cannot reduce the sale below the allowed minimum price");
      return;
    }

    const shopAccount = await resolveShopAccount();
    if (isShopSale && !shopAccount) {
      toast.error("Shop name is required");
      return;
    }

    const paid = isShopSale || paymentMethod === "cash" ? Number(amountPaid || 0) : total;
    const dueAmount = isShopSale ? Math.max(0, total - paid) : 0;
    const balance = isShopSale ? 0 : paymentMethod === "cash" ? Math.max(0, paid - total) : 0;
    const paymentStatus = isShopSale ? paymentStatusFor(paid, total) : "paid";
    if (!isShopSale && paymentMethod === "cash" && paid < total) {
      toast.error("Customer money is less than the total");
      return;
    }
    if (isShopSale && paid > total) {
      toast.error("Shop payment cannot exceed the bill total");
      return;
    }

    try {
      const items = cart.map((item) => {
        const itemTotal = item.price * item.quantity;
        const safeDiscount = capLineDiscount(item);
        const itemDiscount = item.discountType === "percentage"
          ? (itemTotal * safeDiscount) / 100
          : safeDiscount;
        return {
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          quantity: item.quantity,
          unit_price: item.price,
          discount: itemDiscount,
          subtotal: Math.max(minimumLineTotal(item), itemTotal - itemDiscount),
        };
      });
      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: {
            transaction_date: new Date().toISOString(),
            total_amount: total,
            discount_amount: globalDiscount,
            tax_amount: taxAmount,
            amount_paid: paid,
            balance_amount: balance,
            payment_method: paymentMethod,
            status: "completed",
            is_replacement_transaction: false,
            original_return_id: null,
            shop_id: shopAccount?.id || null,
            customer_name: shopAccount?.name || null,
            sale_type: isShopSale ? "shop" : "walk_in",
            payment_status: paymentStatus,
            due_amount: dueAmount,
          },
          items,
        }),
      });
      const checkout = await checkoutResponse.json() as {
        transaction?: { id?: string };
        message?: string;
      };
      if (!checkoutResponse.ok || !checkout.transaction?.id) {
        throw new Error(checkout.message || "Failed to save transaction");
      }
      const transactionId = checkout.transaction.id;
      if (isShopSale) await fetchShopAccounts();

      // Refresh products after checkout
      await fetchProducts();

      const completedReceipt: ReceiptPreview = {
        transactionId,
        transactionDate: new Date().toISOString(),
        items: cart.map((item) => ({ ...item })),
        subtotal,
        discount: globalDiscount,
        tax: taxAmount,
        total,
        paymentMethod,
        amountPaid: paid,
        balanceAmount: balance,
        dueAmount,
        customerName: shopAccount?.name || null,
        saleType: isShopSale ? "shop" : "walk_in",
        paymentStatus,
        status: "completed",
      };

      toast.success(`Order completed! Total: ${money(total)}`);
      setCart([]);
      setDiscount(0);
      setDiscountType("lkr");
      setAmountPaid(0);
      setSaleType("walk_in");
      setSelectedShopId("");
      setNewShopName("");
      setNewShopPhone("");
      barcodeInputRef.current?.focus();

      setReceiptPreview(completedReceipt);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error processing checkout");
    }
  };

  const createDraftReceipt = (): ReceiptPreview | null => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return null;
    }

    return {
      transactionId: "Preview",
      transactionDate: new Date().toISOString(),
      items: cart.map((item) => ({ ...item })),
      subtotal,
      discount: globalDiscount,
      tax: taxAmount,
      total,
      paymentMethod,
      amountPaid: isShopSale || paymentMethod === "cash" ? Number(amountPaid || 0) : total,
      balanceAmount: isShopSale ? 0 : paymentMethod === "cash" ? Math.max(0, Number(amountPaid || 0) - total) : 0,
      dueAmount: isShopSale ? Math.max(0, total - Number(amountPaid || 0)) : 0,
      customerName: isShopSale ? activeShopName : null,
      saleType: isShopSale ? "shop" : "walk_in",
      paymentStatus: isShopSale ? paymentStatusFor(Number(amountPaid || 0), total) : "paid",
      status: "draft",
    };
  };

  const handlePrint = () => {
    void (async () => {
      if (await warnIfPrinterUnavailable()) return;

      const draftReceipt = createDraftReceipt();
      if (draftReceipt) setReceiptPreview(draftReceipt);
    })();
  };

  const receiptItemSubtotal = (item: CartItem) => {
    const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
    const rawDiscount = capLineDiscount(item);
    const itemDiscount =
      item.discountType === "percentage"
        ? (itemTotal * rawDiscount) / 100
        : Math.min(itemTotal, rawDiscount);

    return Math.max(minimumLineTotal(item), itemTotal - itemDiscount);
  };

  const escapeReceiptHtml = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const buildReceiptHtml = (receipt: ReceiptPreview) => {
    const width = receiptPaperWidth === "58mm" ? "58mm" : "80mm";
    const isCompact = receiptLayout === "compact";
    const isDetailed = receiptLayout === "detailed";
    const rows = receipt.items
      .map((item) => {
        const label = escapeReceiptHtml(variantLabel(item));
        const variant = label ? `<div class="muted">${label}</div>` : "";
        const discountText = isDetailed && item.discount
          ? `<div class="muted">Discount: ${item.discount}${item.discountType === "percentage" ? "%" : ` ${discountCurrencyLabel}`}</div>`
          : "";

        return `
          <div class="line item">
            <div>
              <strong>${escapeReceiptHtml(item.name)}</strong>
              ${variant}
              ${discountText}
              <div class="muted">${item.quantity} x ${money(Math.round(item.price))}</div>
            </div>
            <div>${money(Math.round(receiptItemSubtotal(item)))}</div>
          </div>
        `;
      })
      .join("");

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt</title>
          <style>
            @page { size: ${width} auto; margin: 4mm; }
            body { width: ${width}; margin: 0 auto; font-family: Arial, sans-serif; color: #111827; font-size: ${isCompact ? "11px" : "12px"}; }
            .receipt { padding: 8px; }
            .center { text-align: center; }
            .title { font-size: ${isCompact ? "15px" : "18px"}; font-weight: 700; margin-bottom: 4px; }
            .logo { max-width: ${isCompact ? "34mm" : "44mm"}; max-height: 18mm; object-fit: contain; margin-bottom: 4px; }
            .muted { color: #4b5563; font-size: ${isCompact ? "10px" : "11px"}; }
            .divider { border-top: 1px dashed #9ca3af; margin: 8px 0; }
            .line { display: flex; justify-content: space-between; gap: 8px; }
            .item { margin: ${isCompact ? "5px" : "8px"} 0; }
            .total { font-size: ${isCompact ? "14px" : "16px"}; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="receipt">
            ${showReceiptBusinessInfo ? `
              <div class="center">
                ${/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(receiptLogoImage || "") ? `<img class="logo" src="${receiptLogoImage}" alt="Logo" />` : ""}
                <div class="title">${escapeReceiptHtml(receiptSettings.businessName)}</div>
                <div class="muted">${escapeReceiptHtml(receiptSettings.address)}</div>
                <div class="muted">${escapeReceiptHtml(receiptSettings.phone)}</div>
                ${isDetailed ? `<div class="muted">${escapeReceiptHtml(receiptSettings.email)}</div>` : ""}
              </div>
              <div class="divider"></div>
            ` : ""}
            <div class="line"><span>Bill</span><span>${escapeReceiptHtml(receipt.transactionId)}</span></div>
            <div class="line"><span>Date</span><span>${new Date(receipt.transactionDate).toLocaleString()}</span></div>
            ${receipt.saleType === "shop" ? `<div class="line"><span>Shop</span><span>${escapeReceiptHtml(receipt.customerName)}</span></div>` : ""}
            <div class="line"><span>Payment</span><span>${escapeReceiptHtml(receipt.paymentMethod)}</span></div>
            ${receipt.saleType === "shop" ? `
              <div class="line"><span>Status</span><span>${escapeReceiptHtml(receipt.paymentStatus || "paid")}</span></div>
              <div class="line"><span>Paid</span><span>${money(Math.round(receipt.amountPaid || 0))}</span></div>
              <div class="line"><span>Due</span><span>${money(Math.round(receipt.dueAmount || 0))}</span></div>
            ` : receipt.paymentMethod === "cash" ? `
              <div class="line"><span>Received</span><span>${money(Math.round(receipt.amountPaid || 0))}</span></div>
              <div class="line"><span>Balance</span><span>${money(Math.round(receipt.balanceAmount || 0))}</span></div>
            ` : ""}
            <div class="divider"></div>
            ${rows}
            <div class="divider"></div>
            <div class="line"><span>Subtotal</span><span>${money(Math.round(receipt.subtotal))}</span></div>
            <div class="line"><span>Discount</span><span>${money(Math.round(receipt.discount))}</span></div>
            ${taxCalculationEnabled ? `<div class="line"><span>Tax</span><span>${money(Math.round(receipt.tax))}</span></div>` : ""}
            <div class="line total"><span>Total</span><span>${money(Math.round(receipt.total))}</span></div>
            <div class="divider"></div>
            ${receiptFooterText ? `<div class="center muted">${escapeReceiptHtml(receiptFooterText)}</div>` : ""}
            <div class="center muted">Thank you</div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>`;
  };

  const printReceiptPreview = async () => {
    if (!receiptPreview || await warnIfPrinterUnavailable()) return;

    const printWindow = window.open("", "MSHPOSReceiptPrint", "width=420,height=680");
    if (!printWindow) {
      toast.error("Print preview popup was blocked. Allow popups and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(receiptPreview));
    printWindow.document.close();
    toast.success("Print preview opened");
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
                placeholder={billBarcodeEnabled ? "Scan barcode or search..." : "Search products..."}
                value={barcodeInput}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                onKeyDown={billBarcodeEnabled ? handleBarcodeInput : undefined}
                className="input-base flex-1"
              />
              {billBarcodeEnabled && (
                <button
                  onClick={checkBarcodeReader}
                  className="btn-primary"
                  title="Check scanner"
                >
                  <Barcode className="w-5 h-5" />
                </button>
              )}
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
                      <OfflineProductImage
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full"
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
                    <p className="text-lg font-bold text-blue-600">{money(product.price)}</p>
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
                          {variantLabel(item) && (
                            <p className="text-xs text-gray-600">
                              {variantLabel(item)}
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
                          {money(item.price)}
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
                      <div className="mb-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Set Price
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={item.originalPrice}
                            step="0.01"
                            placeholder={String(item.originalPrice)}
                            value={
                              setPriceInputs[item.id] ??
                              (item.price === item.originalPrice ? "" : String(item.price))
                            }
                            onChange={(e) => updateSetPriceInput(item.id, e.target.value)}
                            onBlur={(e) => commitSetPrice(item.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          {item.price !== item.originalPrice && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => commitSetPrice(item.id, "")}
                              title="Reset to original price"
                              className="px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {item.leastPrice && item.leastPrice > 0 ? (
                          <p className="mt-1 text-xs text-gray-500">
                            Least: {money(item.leastPrice)}
                            {item.leastPriceCode ? ` (${item.leastPriceCode})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.discount ? String(item.discount) : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value) || 0;
                            const validDiscount = capLineDiscount(item, val);

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
                          <option value="lkr">{discountCurrencyLabel}</option>
                          <option value="percentage">%</option>
                        </select>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        Subtotal: {money((() => {
                          const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
                          const rawDiscount = capLineDiscount(item);
                          let itemDiscount = 0;
                          if (item.discountType === "percentage") {
                            const pct = isFinite(rawDiscount) ? rawDiscount : 0;
                            itemDiscount = (itemTotal * pct) / 100;
                          } else {
                            const amountDiscount = isFinite(rawDiscount) ? rawDiscount : 0;
                            itemDiscount = Math.min(itemTotal, amountDiscount);
                          }
                          return Math.max(minimumLineTotal(item), itemTotal - itemDiscount);
                        })())}
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
                <span className="font-medium">{money(Math.round(subtotal))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Discount:</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount ? String(discount) : ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value) || 0;
                      let validDiscount = Math.max(0, val);
                      const minimumTotal = cartMinimumTotal();
                      const maxGlobalDiscount = Math.max(0, subtotal - minimumTotal);

                      // Validate based on discount type
                      if (discountType === "percentage") {
                        // Percentage discount can't be >= 100
                        const maxPct = subtotal > 0 ? (maxGlobalDiscount / subtotal) * 100 : 0;
                        validDiscount = Math.min(99.99, maxPct, validDiscount);
                      } else {
                        // Amount discount can't exceed subtotal
                        validDiscount = Math.min(maxGlobalDiscount, validDiscount);
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
                      const minimumTotal = cartMinimumTotal();
                      const maxGlobalDiscount = Math.max(0, subtotal - minimumTotal);

                      // Validate discount for the new type
                      if (newType === "percentage") {
                        // If switching to percentage, ensure it's < 100
                        const maxPct = subtotal > 0 ? (maxGlobalDiscount / subtotal) * 100 : 0;
                        validDiscount = Math.min(99.99, maxPct, validDiscount);
                      } else {
                        // If switching to amount, ensure it doesn't exceed subtotal
                        validDiscount = Math.min(maxGlobalDiscount, validDiscount);
                      }

                      setDiscountType(newType);
                      setDiscount(validDiscount);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white min-w-fit"
                  >
                    <option value="lkr">{discountCurrencyLabel}</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>
              <div className="border-t-2 pt-2 flex justify-between">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-blue-600">{money(Math.round(total))}</span>
              </div>
            </div>

            {/* Payment Method */}
            {shopBillingEnabled && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Sale Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["walk_in", "shop"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSaleType(type);
                        setAmountPaid(0);
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        saleType === type
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {type === "shop" ? "Neighbour Shop" : "Walk-in Customer"}
                    </button>
                  ))}
                </div>
                {isShopSale && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <select
                      value={selectedShopId}
                      onChange={(e) => {
                        setSelectedShopId(e.target.value);
                        if (e.target.value) {
                          setNewShopName("");
                          setNewShopPhone("");
                        }
                      }}
                      className="input-base text-sm"
                    >
                      <option value="">New shop / enter name below</option>
                      {shopAccounts.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name} - Due {money(shop.due_amount || 0)}
                        </option>
                      ))}
                    </select>
                    {!selectedShopId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={newShopName}
                          onChange={(e) => setNewShopName(e.target.value)}
                          className="input-base text-sm"
                          placeholder="Shop name"
                        />
                        <input
                          value={newShopPhone}
                          onChange={(e) => setNewShopPhone(e.target.value)}
                          className="input-base text-sm"
                          placeholder="Phone optional"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setAmountPaid(0);
                }}
                className="input-base text-sm"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="check">Check</option>
              </select>
            </div>

            {(paymentMethod === "cash" || isShopSale) && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-900">
                  {isShopSale ? "Paid Now" : "Money Given"}
                  <input
                    type="number"
                    min="0"
                    max={isShopSale ? total : undefined}
                    value={amountPaid ? String(amountPaid) : ""}
                    onChange={(e) => {
                      const next = Math.max(0, Number(e.target.value) || 0);
                      setAmountPaid(isShopSale ? Math.min(next, total) : next);
                    }}
                    className="input-base text-sm mt-2"
                    placeholder="0"
                  />
                </label>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-sm text-gray-600">{isShopSale ? "Due" : "Balance"}</p>
                  <p className={`text-xl font-bold ${isShopSale ? "text-red-600" : "text-green-600"}`}>
                    {isShopSale
                      ? money(Math.max(0, Math.round(total - (amountPaid || 0))))
                      : money(Math.max(0, Math.round((amountPaid || 0) - total)))}
                  </p>
                </div>
              </div>
            )}

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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && returnBarcodeEnabled) {
                        e.preventDefault();
                        handleLookupTransaction();
                      }
                    }}
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
                    {money(originalTransaction.total_amount)}
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
                        Qty: {item.quantity} × {money(item.unit_price)} = {money(item.subtotal)}
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
              onKeyDown={handleBarcodeInput}
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
                      addToReplacementCart(product);
                    }
                  }}
                  className="p-2 text-left rounded bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900 line-clamp-1">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-600">{money(product.price)}</p>
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
                Total: {money(replacementCart.reduce((sum, item) => sum + item.price * item.quantity, 0))}
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
                        let maxQty = Infinity;
                        if (replacementStockProtectionEnabled) {
                          if (item.variant_id) {
                            maxQty =
                              products
                                .flatMap((product) => product.variants || [])
                                .find((variant) => variant.id === item.variant_id)?.quantity || 0;
                          } else {
                            maxQty = products.find((product) => product.id === item.product_id)?.quantity || 0;
                          }
                          if (newQty > maxQty) {
                            toast.error(`Only ${maxQty} available`);
                          }
                        }
                        setReplacementCart(
                          replacementCart.map((i) =>
                            i.id === item.id
                              ? { ...i, quantity: Math.max(1, Math.min(newQty, maxQty)) }
                              : i
                          )
                        );
                      }}
                      className="w-full px-1 py-1 border border-gray-300 rounded text-xs mb-1"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{money(item.price * item.quantity)}</span>
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

      {/* Receipt Preview Modal */}
      {receiptPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bill Preview</h2>
                <p className="text-sm text-gray-600">
                  {receiptPreview.status === "completed"
                    ? "Transaction saved. Review the bill before printing."
                    : "Review the current bill before printing."}
                </p>
              </div>
              <button
                onClick={() => setReceiptPreview(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                X
              </button>
            </div>

            <div className="overflow-y-auto p-4 bg-gray-100">
              <div
                className={`mx-auto bg-white text-gray-950 shadow-sm p-4 ${
                  receiptPaperWidth === "58mm" ? "max-w-[260px]" : "max-w-[340px]"
                }`}
              >
                {showReceiptBusinessInfo && (
                  <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                    {receiptLogoImage && (
                      <img
                        src={receiptLogoImage}
                        alt="Logo"
                        className="mx-auto mb-2 h-14 max-w-[150px] object-contain"
                      />
                    )}
                    <h3 className="font-bold text-lg">{receiptSettings.businessName}</h3>
                    <p className="text-xs text-gray-600">{receiptSettings.address}</p>
                    <p className="text-xs text-gray-600">{receiptSettings.phone}</p>
                    {receiptLayout === "detailed" && (
                      <p className="text-xs text-gray-600">{receiptSettings.email}</p>
                    )}
                  </div>
                )}

                <div className="text-xs space-y-1 border-b border-dashed border-gray-300 pb-3 mb-3">
                  <div className="flex justify-between gap-3">
                    <span>Bill</span>
                    <span>{receiptPreview.transactionId}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Date</span>
                    <span>{new Date(receiptPreview.transactionDate).toLocaleString()}</span>
                  </div>
                  {receiptPreview.saleType === "shop" && (
                    <div className="flex justify-between gap-3">
                      <span>Shop</span>
                      <span>{receiptPreview.customerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span>Payment</span>
                    <span className="capitalize">{receiptPreview.paymentMethod}</span>
                  </div>
                  {receiptPreview.saleType === "shop" ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <span>Status</span>
                        <span className="capitalize">{receiptPreview.paymentStatus}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Paid</span>
                        <span>{money(Math.round(receiptPreview.amountPaid || 0))}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Due</span>
                        <span>{money(Math.round(receiptPreview.dueAmount || 0))}</span>
                      </div>
                    </>
                  ) : receiptPreview.paymentMethod === "cash" && (
                    <>
                      <div className="flex justify-between gap-3">
                        <span>Received</span>
                        <span>{money(Math.round(receiptPreview.amountPaid || 0))}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Balance</span>
                        <span>{money(Math.round(receiptPreview.balanceAmount || 0))}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-3 border-b border-dashed border-gray-300 pb-3 mb-3">
                  {receiptPreview.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {variantLabel(item) && (
                            <p className="text-xs text-gray-600">
                              {variantLabel(item)}
                            </p>
                          )}
                          {receiptLayout === "detailed" && item.discount > 0 && (
                            <p className="text-xs text-gray-600">
                              Discount: {item.discount}
                              {item.discountType === "percentage" ? "%" : ` ${discountCurrencyLabel}`}
                            </p>
                          )}
                          <p className="text-xs text-gray-600">
                            {item.quantity} x {money(Math.round(item.price))}
                          </p>
                        </div>
                        <span>{money(Math.round(receiptItemSubtotal(item)))}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{money(Math.round(receiptPreview.subtotal))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>{money(Math.round(receiptPreview.discount))}</span>
                  </div>
                  {taxCalculationEnabled && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{money(Math.round(receiptPreview.tax))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Total</span>
                    <span>{money(Math.round(receiptPreview.total))}</span>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-gray-600">Thank you</p>
                {receiptFooterText && (
                  <p className="mt-2 text-center text-xs text-gray-600">{receiptFooterText}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t p-4">
              <button
                onClick={printReceiptPreview}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Bill
              </button>
              <button
                onClick={() => setReceiptPreview(null)}
                className="btn-secondary flex-1"
              >
                Close
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
                <OfflineProductImage
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full"
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
                  <p className="text-2xl font-bold text-green-600">{money(selectedProduct.price)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm font-medium mb-1">Cost</p>
                  <p className="text-2xl font-bold text-orange-600">{money(selectedProduct.cost)}</p>
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
                  {money(selectedProduct.price - selectedProduct.cost)}
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
                      if (mode === "returns") {
                        addVariantToReplacementCart(pendingProduct, variant);
                      } else {
                        // Handle for main cart (sale mode)
                        addToCartWithVariant(pendingProduct, variant);
                      }
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
                          {[
                            `${variant.variant_type}: ${variant.variant_value}`,
                            variant.variant_type_2 && variant.variant_value_2
                              ? `${variant.variant_type_2}: ${variant.variant_value_2}`
                              : "",
                          ].filter(Boolean).join(" / ")}
                        </p>
                        <p className="text-xs text-gray-600">
                          Stock: {variant.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {money(pendingProduct.price + variant.price_adjustment)}
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
