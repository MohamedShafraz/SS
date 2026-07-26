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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "@/lib/auth-context";
import { getCategoryPresets, getStoredIndustryMode } from "@/lib/industry-presets";
import type { IndustryMode } from "@/types";

// Demo data (no longer used - all data is fetched from database)

export default function Dashboard() {
  const authContext = useContext(AuthContext);
  const [dateFilter, setDateFilter] = useState("today");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [industryMode, setIndustryMode] = useState<IndustryMode>("general");

  const categoryPresets = getCategoryPresets(industryMode);

  useEffect(() => {
    setIndustryMode(getStoredIndustryMode());
  }, []);

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

  // Get filtered transaction items by category
  const getFilteredItems = () => {
    if (categoryFilter === "all") {
      return transactionItems;
    }
    
    // Filter items by category
    return transactionItems.filter((item) => {
      const product = products.find((p) => p.id === item.product_id);
      return product && product.category === categoryFilter;
    });
  };

  // Calculate metrics
  const calculateMetrics = () => {
    const filteredItems = getFilteredItems();
    
    // Calculate total sales from filtered items
    const totalSales = filteredItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    // Calculate inventory value
    const inventoryValue = 
      categoryFilter === "all"
        ? products.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0)
        : products
            .filter((p) => p.category === categoryFilter)
            .reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0);
    
    // Calculate profit from filtered transactions
    let totalProfit = 0;
    filteredItems.forEach((item) => {
      // Calculate tax on item (5%)
      const tax = item.subtotal * 0.05;
      totalProfit += tax;
    });
    
    const totalLoss = 0; // Can be calculated if cost tracking is needed

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalLoss,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
    };
  };

  // Generate sales chart data based on date filter and category filter
  const generateSalesData = () => {
    const now = new Date();
    const filteredItems = getFilteredItems();
    
    // Map items to transactions and apply date filter
    const filteredTransactions = transactions.filter((t) => {
      const txDate = new Date(t.transaction_date);
      
      switch (dateFilter) {
        case "today":
          return txDate.toDateString() === now.toDateString();
        case "week":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          return txDate >= weekStart && txDate <= now;
        case "month":
          return txDate.getMonth() === now.getMonth() && 
                 txDate.getFullYear() === now.getFullYear();
        case "year":
          return txDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });

    // Group by date and filter by category
    const groupedByDate = filteredTransactions.reduce((acc: any, t) => {
      // Check if this transaction has items from the selected category
      const hasFilteredItems = filteredItems.some((item) => {
        const transaction = transactions.find((tx) => tx.id === item.transaction_id);
        return transaction && transaction.id === t.id;
      });
      
      if (!hasFilteredItems && categoryFilter !== "all") return acc;
      
      const date = t.transaction_date;
      if (!acc[date]) {
        acc[date] = { sales: 0, profit: 0, transactions: 0 };
      }
      acc[date].sales += t.total_amount || 0;
      acc[date].profit += t.tax_amount || 0;
      acc[date].transactions += 1;
      return acc;
    }, {});

    // Convert to array and sort
    return Object.entries(groupedByDate)
      .map(([date, data]: [string, any]) => ({
        date,
        sales: Math.round(data.sales * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Generate category data from transactions
  const generateCategoryData = () => {
    const categoryMap = new Map<string, number>();
    let totalSales = 0;
    
    // Initialize all categories
    categoryPresets.forEach((cat) => categoryMap.set(cat, 0));
    
    // Get filtered items
    const filteredItems = categoryFilter === "all" 
      ? transactionItems 
      : transactionItems.filter((item) => {
          const product = products.find((p) => p.id === item.product_id);
          return product && product.category === categoryFilter;
        });
    
    // Calculate sales by category (or just show selected category)
    if (categoryFilter !== "all") {
      // If a specific category is selected, show 100% for that category
      const totalByCategory = filteredItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      return [
        {
          name: categoryFilter,
          value: 100,
          sales: Math.round(totalByCategory * 100) / 100,
        },
      ];
    } else {
      // Show all categories
      transactionItems.forEach((item) => {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const category = product.category;
          const sales = categoryMap.get(category) || 0;
          categoryMap.set(category, sales + (item.subtotal || 0));
          totalSales += item.subtotal || 0;
        }
      });

      // Convert to percentage and return
      return Array.from(categoryMap.entries())
        .map(([name, sales]) => ({
          name,
          value: totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0,
          sales: Math.round(sales * 100) / 100,
        }))
        .filter((item) => item.value > 0); // Only show categories with sales
    }
  };

  // Sample data - will be replaced with real data from Supabase
  const salesData = generateSalesData();

  const categoryData = generateCategoryData();

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
      value: `${totalSales}/=`,
      change: "0%",
      icon: ShoppingCart,
      color: "bg-blue-100",
      textColor: "text-blue-600",
    },
    {
      title: "Total Profit",
      value: `${totalProfit}/=`,
      change: "0%",
      icon: TrendingUp,
      color: "bg-green-100",
      textColor: "text-green-600",
    },
    {
      title: "Total Loss",
      value: `${totalLoss}/=`,
      change: "0%",
      icon: TrendingDown,
      color: "bg-red-100",
      textColor: "text-red-600",
    },
    {
      title: "Inventory Value",
      value: `${inventoryValue}/=`,
      change: "0%",
      icon: Package,
      color: "bg-purple-100",
      textColor: "text-purple-600",
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Operations Overview</p>
              <h1 className="text-2xl font-bold text-slate-950">Dashboard</h1>
              <p className="text-sm text-slate-600">Sales, margin, category mix, and inventory value at a glance.</p>
          </div>

          {/* Filters - Only show for authenticated users */}
          {authContext?.isAuthenticated && (
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
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

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-base"
              >
                <option value="all">All Categories</option>
                {categoryPresets.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}
          </div>
        </div>

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`rounded-md p-2.5 ${metric.color}`}>
                      <Icon className={`w-6 h-6 ${metric.textColor}`} />
                    </div>
                    {/* <span className="text-green-600 text-sm font-semibold">
                      {metric.change}
                    </span> */}
                  </div>
                  <h3 className="mb-1 text-sm font-medium text-slate-500">
                    {metric.title}
                  </h3>
                  <p className="text-2xl font-bold text-slate-950">
                    {metric.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Sales vs Profit Chart */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Sales & Profit Trend
            </h2>
            <div className="h-[280px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
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
          </div>

          {/* Category Distribution */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Sales by Category
            </h2>
            
            {/* Category Legend */}
            <div className="mb-4 space-y-2">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="flex-1 text-sm text-slate-700">{entry.name}</span>
                  <span className="text-sm font-semibold text-slate-950">{entry.value}%</span>
                </div>
              ))}
            </div>

            {/* Pie Chart */}
            <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Daily Sales Chart */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-950">
            Daily Sales
          </h2>
          <div className="h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
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
      </div>
    </MainLayout>
  );
}
