"use client";

import { MainLayout } from "@/components/layout";
import { useState, useEffect, useContext } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  CreditCard,
  ReceiptText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "@/lib/auth-context";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import type { BusinessProfile, ProductVariant } from "@/types";

// Demo data (no longer used - all data is fetched from database)

export default function Dashboard() {
  const authContext = useContext(AuthContext);
  const [dateFilter, setDateFilter] = useState("today");
  const [productFilter, setProductFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shopPayments, setShopPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [shopDashboardSettings, setShopDashboardSettings] = useState({
    shopBillingEnabled: false,
    shopDashboardReceivablesEnabled: true,
    shopDashboardPartialBillsEnabled: true,
    shopDashboardUnpaidBillsEnabled: true,
    shopDashboardFollowupPaymentsEnabled: true,
    shopDashboardFollowupTableEnabled: true,
  });

  const isManagerDayScope = authContext?.user?.role === "manager";

  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (active && settings?.currency) setCurrency(settings.currency);
        if (active) {
          setShopDashboardSettings({
            shopBillingEnabled: settings?.shopBillingEnabled === true,
            shopDashboardReceivablesEnabled: settings?.shopDashboardReceivablesEnabled !== false,
            shopDashboardPartialBillsEnabled: settings?.shopDashboardPartialBillsEnabled !== false,
            shopDashboardUnpaidBillsEnabled: settings?.shopDashboardUnpaidBillsEnabled !== false,
            shopDashboardFollowupPaymentsEnabled: settings?.shopDashboardFollowupPaymentsEnabled !== false,
            shopDashboardFollowupTableEnabled: settings?.shopDashboardFollowupTableEnabled !== false,
          });
        }
      })
      .catch(() => {
        const stored = localStorage.getItem("posSettings");
        if (!stored) return;
        try {
          const settings = JSON.parse(stored) as Partial<BusinessProfile>;
          if (settings.currency) setCurrency(settings.currency);
          setShopDashboardSettings({
            shopBillingEnabled: settings.shopBillingEnabled === true,
            shopDashboardReceivablesEnabled: settings.shopDashboardReceivablesEnabled !== false,
            shopDashboardPartialBillsEnabled: settings.shopDashboardPartialBillsEnabled !== false,
            shopDashboardUnpaidBillsEnabled: settings.shopDashboardUnpaidBillsEnabled !== false,
            shopDashboardFollowupPaymentsEnabled: settings.shopDashboardFollowupPaymentsEnabled !== false,
            shopDashboardFollowupTableEnabled: settings.shopDashboardFollowupTableEnabled !== false,
          });
        } catch {
          // Keep default currency if stored settings cannot be parsed.
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isManagerDayScope && dateFilter !== "today") {
      setDateFilter("today");
    }
  }, [dateFilter, isManagerDayScope]);

  // Fetch base data on mount and when auth scope changes.
  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        if (active) {
          setLoading(true);
        }

        // If not authenticated, fetch real data filtered for user_id = NULL
        if (!authContext?.isAuthenticated) {
          // Fetch all products
          const { data: productsData, error: productsError } = await supabase
            .from("products")
            .select("*")
            .is("user_id", null);

          if (!productsError) {
            if (active) {
              setProducts(productsData || []);
            }
          }

          const { data: companiesData, error: companiesError } = await supabase
            .from("companies")
            .select("*")
            .is("user_id", null)
            .order("name", { ascending: true });

          if (!companiesError && active) {
            setCompanies(companiesData || []);
          }

          const { data: variantsData, error: variantsError } = await supabase
            .from("product_variants")
            .select("*");

          if (!variantsError && active) {
            setVariants((variantsData || []) as ProductVariant[]);
          }

          // Fetch transactions where user_id is NULL
          const { data: transactionsData, error: transactionsError } = await supabase
            .from("transactions")
            .select("*")
            .or("status.is.null,status.eq.completed")
            .is("user_id", null)
            .order("transaction_date", { ascending: false });

          if (!transactionsError) {
            if (active) {
              setTransactions(transactionsData || []);
            }
          }

          // Fetch transaction items
          const { data: itemsData, error: itemsError } = await supabase
            .from("transaction_items")
            .select("*")
            .is("user_id", null);

          if (!itemsError) {
            if (active) {
              setTransactionItems(itemsData || []);
            }
          }

          const { data: expensesData, error: expensesError } = await supabase
            .from("expenses")
            .select("*");

          if (!expensesError && active) {
            setExpenses(expensesData || []);
          }
          const { data: shopPaymentsData, error: shopPaymentsError } = await supabase
            .from("shop_payments")
            .select("*");

          if (!shopPaymentsError && active) {
            setShopPayments(shopPaymentsData || []);
          }
          return;
        }

        // Fetch all products
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*");

        if (!productsError) {
          if (active) {
            setProducts(productsData || []);
          }
        }

        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("*")
          .order("name", { ascending: true });

        if (!companiesError && active) {
          setCompanies(companiesData || []);
        }

        const { data: variantsData, error: variantsError } = await supabase
          .from("product_variants")
          .select("*");

        if (!variantsError && active) {
          setVariants((variantsData || []) as ProductVariant[]);
        }

        // Fetch all transactions (for authenticated users)
        const { data: transactionsData, error: transactionsError } = await supabase
          .from("transactions")
          .select("*")
          .or("status.is.null,status.eq.completed")
          .order("transaction_date", { ascending: false });

        if (!transactionsError) {
          if (active) {
            setTransactions(transactionsData || []);
          }
        }

        // Fetch transaction items to get category data
        const { data: itemsData, error: itemsError } = await supabase
          .from("transaction_items")
          .select("*");

        if (!itemsError) {
          if (active) {
            setTransactionItems(itemsData || []);
          }
        }

        const { data: expensesData, error: expensesError } = await supabase
          .from("expenses")
          .select("*");

        if (!expensesError && active) {
          setExpenses(expensesData || []);
        }

        const { data: shopPaymentsData, error: shopPaymentsError } = await supabase
          .from("shop_payments")
          .select("*");

        if (!shopPaymentsError && active) {
          setShopPayments(shopPaymentsData || []);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, [authContext?.isAuthenticated]);

  const dateMatchesFilter = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();

    switch (dateFilter) {
      case "today":
        return date.toDateString() === now.toDateString();
      case "week": {
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(now.getDate() - now.getDay());
        return date >= weekStart && date <= now;
      }
      case "month":
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "year":
        return date.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const dashboardDateKey = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  };

  const getItemProduct = (item: any) => {
    const directProduct = products.find((product) => product.id === item.product_id);
    if (directProduct) return directProduct;

    const variant = variants.find((entry) => entry.id === item.variant_id);
    return variant ? products.find((product) => product.id === variant.product_id) : null;
  };

  const scopedTransactions = () =>
    transactions.filter((transaction) => dateMatchesFilter(transaction.transaction_date));

  const isToday = (value: string) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
  };

  const shopTransactions = transactions.filter(
    (transaction) => transaction.sale_type === "shop" || transaction.shop_id
  );
  const activeShopBills = shopTransactions
    .filter((transaction) => Number(transaction.due_amount || 0) > 0)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  const shopReceivables = activeShopBills.reduce(
    (sum, transaction) => sum + Number(transaction.due_amount || 0),
    0
  );
  const partialBillCount = activeShopBills.filter((transaction) => transaction.payment_status === "partial").length;
  const unpaidBillCount = activeShopBills.filter((transaction) => transaction.payment_status === "unpaid").length;
  const followUpPaymentsToday = shopPayments
    .filter((payment) => isToday(payment.payment_date) && payment.notes !== "Initial payment")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  // Get filtered transaction items by date, product, and company.
  const getFilteredItems = () => {
    const scopedTransactionIds = new Set(scopedTransactions().map((transaction) => transaction.id));
    const scopedItems = transactionItems.filter((item) => scopedTransactionIds.has(item.transaction_id));

    return scopedItems.filter((item) => {
      const product = getItemProduct(item);
      const productMatches = productFilter === "all" || product?.id === productFilter;
      if (!productMatches) return false;

      const companyMatches = companyFilter === "all" || (product && (product.company_id || "") === companyFilter);
      if (!companyMatches) return false;

      return true;
    });
  };

  // Calculate metrics
  const calculateMetrics = () => {
    const filteredItems = getFilteredItems();
    
    // Calculate total sales from filtered items
    const totalSales = filteredItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const costOfGoodsSold = filteredItems.reduce((sum, item) => {
      const product = getItemProduct(item);
      return sum + Number(product?.cost || 0) * Number(item.quantity || 0);
    }, 0);
    const totalExpenses = expenses
      .filter((expense) => dateMatchesFilter(expense.expense_date))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const netProfit = totalSales - costOfGoodsSold - totalExpenses;
    
    // Calculate inventory value
    const inventoryValue = 
      companyFilter !== "all"
        ? products
            .filter((p) => (p.company_id || "") === companyFilter)
            .reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0)
        : productFilter === "all"
        ? products.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0)
        : products
            .filter((p) => p.id === productFilter)
            .reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0);
    
    const totalLoss = netProfit < 0 ? Math.abs(netProfit) : 0;

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalProfit: Math.round(netProfit * 100) / 100,
      totalLoss: Math.round(totalLoss * 100) / 100,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
    };
  };

  // Generate sales chart data based on date filter and category filter
  const generateSalesData = () => {
    const filteredItems = getFilteredItems();
    
    // Map items to transactions and apply date filter
    const filteredTransactions = scopedTransactions();

    // Group by date and filter by category
    const groupedByDate = filteredTransactions.reduce((acc: any, t) => {
      // Check if this transaction has items from the selected category
      const hasFilteredItems = filteredItems.some((item) => {
        const transaction = transactions.find((tx) => tx.id === item.transaction_id);
        return transaction && transaction.id === t.id;
      });
      
      if (!hasFilteredItems) return acc;
      
      const date = dashboardDateKey(t.transaction_date);
      if (!acc[date]) {
        acc[date] = { sales: 0, profit: 0, transactions: 0 };
      }
      const transactionItemsForDate = filteredItems.filter((item) => item.transaction_id === t.id);
      const sales = transactionItemsForDate.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const cost = transactionItemsForDate.reduce((sum, item) => {
        const product = getItemProduct(item);
        return sum + Number(product?.cost || 0) * Number(item.quantity || 0);
      }, 0);
      acc[date].sales += sales;
      acc[date].profit += sales - cost;
      acc[date].transactions += 1;
      return acc;
    }, {});

    // Convert to array and sort
    return Object.entries(groupedByDate)
      .map(([date, data]: [string, any]) => ({
        date,
        sales: Math.round(data.sales * 100) / 100,
        profit: Math.round(
          (data.profit -
            expenses
              .filter((expense) => dashboardDateKey(expense.expense_date) === date)
              .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)) *
            100
        ) / 100,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getVariantLabel = (variantId: string | null | undefined, productName = "Product") => {
    if (!variantId) return productName;
    const variant = variants.find((entry) => entry.id === variantId);
    if (!variant) return productName;

    const parts = [
      variant.variant_type && variant.variant_value
        ? `${variant.variant_type}: ${variant.variant_value}`
        : "",
      variant.variant_type_2 && variant.variant_value_2
        ? `${variant.variant_type_2}: ${variant.variant_value_2}`
        : "",
    ].filter(Boolean);

    return parts.length > 0 ? `${productName} - ${parts.join(" / ")}` : productName;
  };

  // Generate sales distribution by variant when variants exist, otherwise by product/category.
  const generateDistributionData = () => {
    const salesMap = new Map<string, number>();
    let totalSales = 0;
    const filteredItems = getFilteredItems();
    const hasVariantSales = filteredItems.some((item) => item.variant_id);
    

    filteredItems.forEach((item) => {
      const product = getItemProduct(item);
      const productName = product?.name || "Product";
      const label = hasVariantSales
        ? getVariantLabel(item.variant_id, productName)
        : productName || product?.category || "Product";
      const sales = salesMap.get(label) || 0;
      salesMap.set(label, sales + (item.subtotal || 0));
      totalSales += item.subtotal || 0;
    });

    return Array.from(salesMap.entries())
      .map(([name, sales]) => ({
        name,
        value: totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0,
        sales: Math.round(sales * 100) / 100,
      }))
      .filter((item) => item.sales > 0)
      .sort((a, b) => b.sales - a.sales);
  };

  // Sample data - will be replaced with real data from Supabase
  const salesData = generateSalesData();

  const distributionData = generateDistributionData();
  const distributionTitle = distributionData.some((entry) => entry.name.includes(" - "))
    ? "Sales by Variant"
    : "Sales by Product / Service";
  const productOptions = products.filter(
    (product) => companyFilter === "all" || (product.company_id || "") === companyFilter
  );

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  const { totalSales, totalProfit, totalLoss, inventoryValue } = calculateMetrics();

  const metrics = [
    {
      title: "Total Sales",
      value: formatCurrency(totalSales, currency),
      change: "0%",
      icon: ShoppingCart,
      color: "bg-blue-100",
      textColor: "text-blue-600",
    },
    {
      title: "Total Profit",
      value: formatCurrency(totalProfit, currency),
      change: "0%",
      icon: TrendingUp,
      color: "bg-green-100",
      textColor: "text-green-600",
    },
    {
      title: "Total Loss",
      value: formatCurrency(totalLoss, currency),
      change: "0%",
      icon: TrendingDown,
      color: "bg-red-100",
      textColor: "text-red-600",
    },
    {
      title: "Inventory Value",
      value: formatCurrency(inventoryValue, currency),
      change: "0%",
      icon: Package,
      color: "bg-purple-100",
      textColor: "text-purple-600",
    },
  ];

  const shopMetrics = [
    {
      id: "shopDashboardReceivablesEnabled",
      title: "Shop Receivables",
      value: formatCurrency(shopReceivables, currency),
      icon: ReceiptText,
      color: "bg-red-100",
      textColor: "text-red-600",
    },
    {
      id: "shopDashboardPartialBillsEnabled",
      title: "Partial Bills",
      value: String(partialBillCount),
      icon: CreditCard,
      color: "bg-yellow-100",
      textColor: "text-yellow-600",
    },
    {
      id: "shopDashboardUnpaidBillsEnabled",
      title: "Unpaid Bills",
      value: String(unpaidBillCount),
      icon: ReceiptText,
      color: "bg-orange-100",
      textColor: "text-orange-600",
    },
    {
      id: "shopDashboardFollowupPaymentsEnabled",
      title: "Follow-up Payments Today",
      value: formatCurrency(followUpPaymentsToday, currency),
      icon: TrendingUp,
      color: "bg-green-100",
      textColor: "text-green-600",
    },
  ];
  const visibleShopMetrics = shopMetrics.filter((metric) =>
    Boolean(shopDashboardSettings[metric.id as keyof typeof shopDashboardSettings])
  );

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              {isManagerDayScope
                ? "Today sales, profit, and inventory overview"
                : "Sales, profit, and inventory overview"}
            </p>
          </div>

          {/* Filters - Only show for authenticated users */}
          {authContext?.isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {!isManagerDayScope && (
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="input-base"
                >
                  <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                </select>
              )}

              <select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setProductFilter("all");
                }}
                className="input-base"
              >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="input-base"
              >
                <option value="all">All Products / Services</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="card h-32 bg-gray-100 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div key={index} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-lg ${metric.color}`}>
                      <Icon className={`w-6 h-6 ${metric.textColor}`} />
                    </div>
                    {/* <span className="text-green-600 text-sm font-semibold">
                      {metric.change}
                    </span> */}
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-1">
                    {metric.title}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {shopDashboardSettings.shopBillingEnabled && !loading && (
          <>
            {visibleShopMetrics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {visibleShopMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.title} className="card">
                    <div className={`mb-4 inline-flex p-3 rounded-lg ${metric.color}`}>
                      <Icon className={`w-6 h-6 ${metric.textColor}`} />
                    </div>
                    <h3 className="text-gray-600 text-sm font-medium mb-1">{metric.title}</h3>
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  </div>
                );
              })}
            </div>
            )}

            {shopDashboardSettings.shopDashboardFollowupTableEnabled && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="border-b p-5">
                <h2 className="text-lg font-semibold text-gray-900">Shop Bills To Follow Up</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {["Shop", "Bill", "Date", "Total", "Paid", "Due", "Status"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeShopBills.slice(0, 8).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-600">
                          No unpaid or partial shop bills.
                        </td>
                      </tr>
                    ) : (
                      activeShopBills.slice(0, 8).map((bill) => (
                        <tr key={bill.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{bill.customer_name || "Shop"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{bill.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{bill.transaction_date}</td>
                          <td className="px-4 py-3">{formatCurrency(bill.total_amount, currency)}</td>
                          <td className="px-4 py-3">{formatCurrency(bill.amount_paid || 0, currency)}</td>
                          <td className="px-4 py-3 font-semibold text-red-600">{formatCurrency(bill.due_amount || 0, currency)}</td>
                          <td className="px-4 py-3 capitalize">{bill.payment_status || "unpaid"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales vs Profit Chart */}
          <div className="card lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Sales & Profit Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sales Distribution */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {distributionTitle}
            </h2>
            
            {/* Distribution Legend */}
            <div className="mb-4 space-y-2">
              {distributionData.map((entry, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-sm text-gray-700 flex-1">{entry.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{entry.value}%</span>
                </div>
              ))}
            </div>

            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Sales Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Daily Sales
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#3b82f6" />
              <Bar dataKey="profit" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </MainLayout>
  );
}
