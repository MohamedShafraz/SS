"use client";

import { MainLayout } from "@/components/layout";
import {
  calculateFinancialPosition,
  calculateProfitLoss,
  getReportRange,
  type AccountingProduct,
  type AccountingSupplier,
  type AccountingSupplierPayment,
  type AccountingShopPayment,
  type AccountingTransaction,
  type AccountingTransactionItem,
  type ReportPeriodType,
} from "@/lib/accounting-reports";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { localDb } from "@/lib/local-db-client";
import type { BusinessProfile } from "@/types";
import { BarChart3, Edit3, Plus, ReceiptText, Scale, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description?: string | null;
  amount: number;
}

type AccountingTab = "expenses" | "profit-loss" | "position";

const expenseCategoryLabels: Record<string, string> = {
  staff_salary: "Staff Salary",
  daily: "Daily Expense",
  other: "Other Expense",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountingPage() {
  const { user } = useAuth();
  const canMaintain = user?.role === "admin" || user?.role === "manager";
  const [activeTab, setActiveTab] = useState<AccountingTab>("expenses");
  const [periodType, setPeriodType] = useState<ReportPeriodType>("month");
  const [periodAnchor, setPeriodAnchor] = useState(todayKey());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [transactionItems, setTransactionItems] = useState<AccountingTransactionItem[]>([]);
  const [products, setProducts] = useState<AccountingProduct[]>([]);
  const [suppliers, setSuppliers] = useState<AccountingSupplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<AccountingSupplierPayment[]>([]);
  const [shopPayments, setShopPayments] = useState<AccountingShopPayment[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loadingReports, setLoadingReports] = useState(true);
  const [form, setForm] = useState({
    expense_date: todayKey(),
    category: "daily",
    description: "",
    amount: 0,
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const fetchAccountingData = useCallback(async () => {
    setLoadingReports(true);
    const [
      expensesResult,
      transactionsResult,
      itemsResult,
      productsResult,
      suppliersResult,
      supplierPaymentsResult,
      shopPaymentsResult,
    ] = await Promise.all([
      localDb.from("expenses").select("*").order("expense_date", { ascending: false }),
      localDb
        .from("transactions")
        .select("*")
        .or("status.is.null,status.eq.completed")
        .order("transaction_date", { ascending: false }),
      localDb.from("transaction_items").select("*"),
      localDb.from("products").select("*"),
      localDb.from("suppliers").select("*"),
      localDb.from("supplier_payments").select("*"),
      localDb.from("shop_payments").select("*"),
    ]);

    if (expensesResult.error) toast.error("Failed to load expenses");
    setExpenses(((expensesResult.data || []) as Expense[]).map((expense) => ({
      ...expense,
      amount: Number(expense.amount || 0),
    })));

    if (!transactionsResult.error) setTransactions((transactionsResult.data || []) as AccountingTransaction[]);
    if (!itemsResult.error) setTransactionItems((itemsResult.data || []) as AccountingTransactionItem[]);
    if (!productsResult.error) setProducts((productsResult.data || []) as AccountingProduct[]);
    if (!suppliersResult.error) setSuppliers((suppliersResult.data || []) as AccountingSupplier[]);
    if (!supplierPaymentsResult.error) {
      setSupplierPayments((supplierPaymentsResult.data || []) as AccountingSupplierPayment[]);
    }
    if (!shopPaymentsResult.error) {
      setShopPayments((shopPaymentsResult.data || []) as AccountingShopPayment[]);
    }
    setLoadingReports(false);
  }, []);

  useEffect(() => {
    fetchAccountingData();
    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (settings?.currency) setCurrency(settings.currency);
      })
      .catch(() => {});
  }, [fetchAccountingData]);

  const reportRange = useMemo(
    () => getReportRange(periodType, periodAnchor),
    [periodAnchor, periodType]
  );

  const profitLoss = useMemo(
    () => calculateProfitLoss(reportRange, transactions, transactionItems, products, expenses),
    [expenses, products, reportRange, transactionItems, transactions]
  );

  const financialPosition = useMemo(
    () =>
      calculateFinancialPosition(
        reportRange,
        transactions,
        products,
        suppliers,
        supplierPayments,
        shopPayments,
        profitLoss.netProfit
      ),
    [products, profitLoss.netProfit, reportRange, shopPayments, supplierPayments, suppliers, transactions]
  );

  const totals = useMemo(() => {
    return expenses.reduce(
      (acc, expense) => {
        acc.total += expense.amount || 0;
        acc[expense.category] = (acc[expense.category] || 0) + (expense.amount || 0);
        return acc;
      },
      { total: 0 } as Record<string, number>
    );
  }, [expenses]);

  const saveExpense = async () => {
    if (!form.amount || form.amount <= 0) {
      toast.error("Expense amount is required");
      return;
    }
    const query = editingExpenseId
      ? localDb.from("expenses").maintenance().update(form).eq("id", editingExpenseId)
      : localDb.from("expenses").insert([form]);
    const { error } = await query;
    if (error) {
      toast.error("Failed to save expense");
      return;
    }
    setForm({ expense_date: todayKey(), category: "daily", description: "", amount: 0 });
    setEditingExpenseId(null);
    toast.success(editingExpenseId ? "Expense updated" : "Expense saved");
    fetchAccountingData();
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    const { error } = await localDb.from("expenses").maintenance().delete().eq("id", id);
    if (error) toast.error(error.message || "Failed to delete expense");
    else { toast.success("Expense deleted"); fetchAccountingData(); }
  };

  const money = useCallback((amount: number) => formatCurrency(amount, currency), [currency]);

  const statementRows = [
    ["Sales revenue", profitLoss.salesRevenue],
    ["Returns / refunds", -profitLoss.returnsRefunds],
    ["Net sales", profitLoss.netSales],
    ["Cost of goods sold", -profitLoss.costOfGoodsSold],
    ["Gross profit", profitLoss.grossProfit],
    ["Staff salary", -(profitLoss.expensesByCategory.staff_salary || 0)],
    ["Daily expenses", -(profitLoss.expensesByCategory.daily || 0)],
    ["Other expenses", -(profitLoss.expensesByCategory.other || 0)],
    ["Total expenses", -profitLoss.totalExpenses],
    ["Net profit / loss", profitLoss.netProfit],
  ] as const;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-600">
            Track expenses and view management financial statements.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {[
            { id: "expenses", label: "Expenses", icon: ReceiptText },
            { id: "profit-loss", label: "Profit & Loss", icon: BarChart3 },
            { id: "position", label: "Financial Position", icon: Scale },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as AccountingTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "expenses" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card"><p className="text-sm text-gray-600">Total Expenses</p><p className="text-2xl font-bold">{money(totals.total)}</p></div>
              <div className="card"><p className="text-sm text-gray-600">Staff Salary</p><p className="text-2xl font-bold">{money(totals.staff_salary || 0)}</p></div>
              <div className="card"><p className="text-sm text-gray-600">Daily</p><p className="text-2xl font-bold">{money(totals.daily || 0)}</p></div>
              <div className="card"><p className="text-sm text-gray-600">Other</p><p className="text-2xl font-bold">{money(totals.other || 0)}</p></div>
            </div>

            <div className="card grid grid-cols-1 md:grid-cols-5 gap-4">
              <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input-base" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-base">
                <option value="staff_salary">Staff Salary</option>
                <option value="daily">Daily Expense</option>
                <option value="other">Other Expense</option>
              </select>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base md:col-span-2" placeholder="Description" />
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} className="input-base" placeholder="Amount" />
              <button onClick={saveExpense} className="btn-success flex items-center justify-center gap-2 md:col-span-5">
                <Plus className="w-4 h-4" />
                {editingExpenseId ? "Update Expense" : "Save Expense"}
              </button>
              {editingExpenseId && <button onClick={() => { setEditingExpenseId(null); setForm({ expense_date: todayKey(), category: "daily", description: "", amount: 0 }); }} className="btn-secondary md:col-span-5">Cancel</button>}
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="divide-y">
                {expenses.length === 0 ? (
                  <p className="p-6 text-sm text-gray-600">No expenses saved.</p>
                ) : (
                  expenses.map((expense) => (
                    <div key={expense.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <ReceiptText className="w-5 h-5 text-blue-600 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900">{expense.description || expenseCategoryLabels[expense.category] || expense.category}</p>
                          <p className="text-sm text-gray-600">
                            {expense.expense_date} - {expenseCategoryLabels[expense.category] || expense.category.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3"><p className="font-bold text-gray-900">{money(expense.amount)}</p>{canMaintain && <><button type="button" onClick={() => { setEditingExpenseId(expense.id); setForm({ expense_date: expense.expense_date, category: expense.category, description: expense.description || "", amount: Number(expense.amount || 0) }); }} className="text-blue-600"><Edit3 className="w-4 h-4" /></button><button type="button" onClick={() => deleteExpense(expense.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></>}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab !== "expenses" && (
          <>
            <div className="card grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="block text-sm font-medium text-gray-900">
                Period
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as ReportPeriodType)}
                  className="input-base mt-2"
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-900">
                Date
                <input
                  type="date"
                  value={periodAnchor}
                  onChange={(e) => setPeriodAnchor(e.target.value || todayKey())}
                  className="input-base mt-2"
                />
              </label>
              <div className="md:col-span-2 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm font-semibold text-blue-900">Selected range</p>
                <p className="text-sm text-blue-800">{reportRange.label}</p>
                <p className="text-xs text-blue-700 mt-1">
                  Management statement, not a formal audited financial statement.
                </p>
              </div>
            </div>

            {loadingReports ? (
              <div className="card h-40 animate-pulse bg-gray-100" />
            ) : activeTab === "profit-loss" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card">
                  <p className="text-sm text-gray-600">Net Sales</p>
                  <p className="text-3xl font-bold text-gray-900">{money(profitLoss.netSales)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600">Gross Profit</p>
                  <p className="text-3xl font-bold text-blue-600">{money(profitLoss.grossProfit)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600">Net Profit / Loss</p>
                  <p className={`text-3xl font-bold ${profitLoss.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {money(profitLoss.netProfit)}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden lg:col-span-3">
                  <div className="p-5 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Profit & Loss Statement</h2>
                    <p className="text-sm text-gray-600">{reportRange.label}</p>
                  </div>
                  <div className="divide-y">
                    {statementRows.map(([label, amount]) => (
                      <div key={label} className={`flex justify-between gap-4 px-5 py-3 ${label.includes("Net") || label.includes("Gross") ? "font-bold bg-gray-50" : ""}`}>
                        <span className="text-gray-700">{label}</span>
                        <span className={amount < 0 ? "text-red-600" : "text-gray-900"}>{money(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card">
                  <p className="text-sm text-gray-600">Total Assets</p>
                  <p className="text-3xl font-bold text-blue-600">{money(financialPosition.totalAssets)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600">Total Liabilities</p>
                  <p className="text-3xl font-bold text-red-600">{money(financialPosition.totalLiabilities)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-600">Net Position</p>
                  <p className={`text-3xl font-bold ${financialPosition.netPosition >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {money(financialPosition.netPosition)}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden lg:col-span-3">
                  <div className="p-5 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Financial Position Statement</h2>
                    <p className="text-sm text-gray-600">{reportRange.label}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    <div className="p-5 border-b md:border-r md:border-b-0">
                      <h3 className="font-semibold text-gray-900 mb-3">Assets</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Inventory value</span><span>{money(financialPosition.inventoryValue)}</span></div>
                        <div className="flex justify-between"><span>Period cash / sales received</span><span>{money(financialPosition.periodCashReceived)}</span></div>
                        <div className="flex justify-between"><span>Shop receivables</span><span>{money(financialPosition.customerReceivables)}</span></div>
                        <div className="flex justify-between border-t pt-2 font-bold"><span>Total assets</span><span>{money(financialPosition.totalAssets)}</span></div>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-gray-900 mb-3">Liabilities And Position</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Supplier dues</span><span>{money(financialPosition.supplierLiabilities)}</span></div>
                        <div className="flex justify-between"><span>Supplier payments in period</span><span>{money(financialPosition.supplierPayments)}</span></div>
                        <div className="flex justify-between"><span>Current period profit</span><span>{money(financialPosition.currentPeriodProfit)}</span></div>
                        <div className="flex justify-between border-t pt-2 font-bold"><span>Net position</span><span>{money(financialPosition.netPosition)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
