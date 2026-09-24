"use client";

import { MainLayout } from "@/components/layout";
import { useCallback, useEffect, useState } from "react";
import { Eye, Download, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import type { BusinessProfile } from "@/types";

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
    image_url?: string;
  } | null;
  product?: {
    name: string;
  };
}

interface Transaction {
  id: string;
  transaction_date: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  amount_paid?: number | null;
  balance_amount?: number | null;
  payment_method: string;
  is_replacement_transaction?: boolean | null;
  original_return_id?: string | null;
  items?: TransactionItem[];
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [receiptSettings, setReceiptSettings] = useState<Partial<BusinessProfile>>({});

  const fetchTransactions = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      if (isActive()) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or("status.is.null,status.eq.completed")
        .order("transaction_date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Failed to load transactions");
        return;
      }

      if (isActive()) {
        setTransactions(
          (data || []).map((transaction: Transaction) => ({
            id: transaction.id,
            transaction_date: transaction.transaction_date,
            total_amount: transaction.total_amount,
            discount_amount: transaction.discount_amount ?? 0,
            tax_amount: transaction.tax_amount ?? 0,
            amount_paid: transaction.amount_paid ?? 0,
            balance_amount: transaction.balance_amount ?? 0,
            payment_method: transaction.payment_method,
            is_replacement_transaction: transaction.is_replacement_transaction ?? false,
            original_return_id: transaction.original_return_id ?? null,
          }))
        );
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading transactions");
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch transactions from Supabase
  useEffect(() => {
    let active = true;

    fetchTransactions(() => active);

    return () => {
      active = false;
    };
  }, [fetchTransactions]);

  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (active && settings) {
          setReceiptSettings(settings);
          if (settings.currency) setCurrency(settings.currency);
        }
      })
      .catch(() => {
        const stored = localStorage.getItem("posSettings");
        if (!stored) return;
        try {
          const settings = JSON.parse(stored) as Partial<BusinessProfile>;
          setReceiptSettings(settings);
          if (settings.currency) setCurrency(settings.currency);
        } catch {
          // Keep default currency if stored settings cannot be parsed.
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTransactions = transactions;
  const isManagerDayScope = user?.role === "manager";

  const receiptFooterText = () => {
    if (receiptSettings.showReceiptFooter === false) return "";
    const days = Math.max(1, Number(receiptSettings.receiptFooterDays || 7));
    if (receiptSettings.receiptFooterMode === "valid_days") {
      return `This bill is valid for ${days} day${days === 1 ? "" : "s"}.`;
    }
    if (receiptSettings.receiptFooterMode === "custom") {
      return receiptSettings.receiptFooterText || "";
    }
    return `Return allowed within ${days} day${days === 1 ? "" : "s"}.`;
  };

  const loadTransactionDetails = async (transaction: Transaction) => {
    if (transaction.items?.length) return transaction;

    const { data, error } = await supabase
      .from("transaction_items")
      .select("*,products")
      .eq("transaction_id", transaction.id);

    if (error) {
      toast.error("Failed to load receipt items");
      return transaction;
    }

    return {
      ...transaction,
      items: (data || []) as TransactionItem[],
    };
  };

  const buildReceiptHtml = (transaction: Transaction) => {
    const items = transaction.items || [];
    const subtotal = transaction.total_amount - transaction.tax_amount + transaction.discount_amount;
    const footer = receiptFooterText();
    const showBusinessInfo = receiptSettings.showReceiptBusinessInfo !== false;
    const width = receiptSettings.receiptPaperWidth === "58mm" ? "58mm" : "80mm";
    const rows = items.map((item) => {
      const name = item.products?.name || item.product?.name || item.product_id;
      return `
        <div class="line item">
          <div>
            <strong>${name}</strong>
            <div class="muted">${item.quantity} x ${formatCurrency(item.unit_price, currency)}</div>
          </div>
          <div>${formatCurrency(item.subtotal, currency)}</div>
        </div>
      `;
    }).join("");

    return `<!doctype html><html><head><meta charset="utf-8" /><title>Receipt ${transaction.id}</title><style>
      @page { size: ${width} auto; margin: 4mm; }
      body { width: ${width}; margin: 0 auto; font-family: Arial, sans-serif; color: #111827; font-size: 12px; }
      .receipt { padding: 8px; }
      .center { text-align: center; }
      .logo { max-width: 44mm; max-height: 18mm; object-fit: contain; margin-bottom: 4px; }
      .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
      .muted { color: #4b5563; font-size: 11px; }
      .divider { border-top: 1px dashed #9ca3af; margin: 8px 0; }
      .line { display: flex; justify-content: space-between; gap: 8px; }
      .item { margin: 8px 0; }
      .total { font-size: 16px; font-weight: 700; }
    </style></head><body><div class="receipt">
      ${showBusinessInfo ? `<div class="center">
        ${receiptSettings.logoImage ? `<img class="logo" src="${receiptSettings.logoImage}" alt="Logo" />` : ""}
        <div class="title">${receiptSettings.businessName || "MSHPOS"}</div>
        <div class="muted">${receiptSettings.address || ""}</div>
        <div class="muted">${receiptSettings.phone || ""}</div>
      </div><div class="divider"></div>` : ""}
      <div class="line"><span>Transaction</span><span>${transaction.id}</span></div>
      <div class="line"><span>Date</span><span>${new Date(transaction.transaction_date).toLocaleString()}</span></div>
      <div class="line"><span>Payment</span><span>${transaction.payment_method}</span></div>
      ${transaction.amount_paid ? `<div class="line"><span>Received</span><span>${formatCurrency(transaction.amount_paid, currency)}</span></div>` : ""}
      ${transaction.balance_amount ? `<div class="line"><span>Balance</span><span>${formatCurrency(transaction.balance_amount, currency)}</span></div>` : ""}
      <div class="divider"></div>
      ${rows || `<div class="center muted">No item rows found</div>`}
      <div class="divider"></div>
      <div class="line"><span>Subtotal</span><span>${formatCurrency(subtotal, currency)}</span></div>
      <div class="line"><span>Discount</span><span>${formatCurrency(transaction.discount_amount, currency)}</span></div>
      <div class="line"><span>Tax</span><span>${formatCurrency(transaction.tax_amount, currency)}</span></div>
      <div class="line total"><span>Total</span><span>${formatCurrency(transaction.total_amount, currency)}</span></div>
      <div class="divider"></div>
      ${footer ? `<div class="center muted">${footer}</div>` : ""}
      <div class="center muted">Thank you</div>
    </div></body></html>`;
  };

  const handleSelectTransaction = async (transaction: Transaction) => {
    const detailed = await loadTransactionDetails(transaction);
    setSelectedTransaction(detailed);
  };

  const handlePrintReceipt = async (transaction: Transaction) => {
    const detailed = await loadTransactionDetails(transaction);
    const printWindow = window.open("", "MSHPOSReceiptPrint", "width=420,height=680");
    if (!printWindow) {
      toast.error("Print popup was blocked");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(detailed));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadReceipt = async (transaction: Transaction) => {
    const detailed = await loadTransactionDetails(transaction);
    const blob = new Blob([buildReceiptHtml(detailed)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${transaction.id}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  const totalSales = filteredTransactions.reduce((sum, txn) => sum + txn.total_amount, 0);
  const totalTransactions = filteredTransactions.length;
  const transactionType = (transaction: Transaction) => {
    if (transaction.original_return_id && transaction.total_amount < 0) return "Return";
    if (transaction.is_replacement_transaction) return "Replacement";
    return "Sale";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">
            {isManagerDayScope
              ? "View today sales transactions"
              : "View and manage all sales transactions"}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-gray-600 text-sm font-medium mb-2">
              Total Transactions
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalTransactions}
            </p>
          </div>
          <div className="card">
            <h3 className="text-gray-600 text-sm font-medium mb-2">
              Total Sales
            </h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totalSales, currency)}</p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Date & Time
                  </th>
                  {/* <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Items
                  </th> */}
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-600">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <p className="text-gray-600 mb-2">No transactions found</p>
                      <p className="text-sm text-gray-500">Start by adding products and making sales</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {transaction.id}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{transaction.transaction_date}</p>
                      </td>
                      {/* <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.items?.length || 0} item
                        {(transaction.items?.length || 0) > 1 ? "s" : ""}
                      </td> */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(transaction.total_amount, currency)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            transactionType(transaction) === "Return"
                              ? "bg-red-100 text-red-700"
                              : transactionType(transaction) === "Replacement"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {transactionType(transaction)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            transaction.payment_method === "cash"
                              ? "bg-green-100 text-green-700"
                              : transaction.payment_method === "card"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {transaction.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSelectTransaction(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(transaction)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                            title="Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadReceipt(transaction)}
                            className="p-2 text-orange-600 hover:bg-orange-100 rounded transition-colors"
                            title="Download Receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Receipt {selectedTransaction.id}
                  </h2>
                  <p className="text-gray-600">
                    {new Date(selectedTransaction.transaction_date).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Receipt Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Items
                </h3>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-300">
                    <tr>
                      <th className="text-left py-2">Product</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Discount</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-2">{item.products?.name || item.product?.name || item.product_id || "Product"}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price, currency)}</td>
                        <td className="text-right py-2">
                          {item.discount > 0 ? formatCurrency(item.discount, currency) : "-"}
                        </td>
                        <td className="text-right py-2 font-semibold">
                          {formatCurrency(item.subtotal, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedTransaction.total_amount - selectedTransaction.tax_amount + selectedTransaction.discount_amount, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold">
                    {selectedTransaction.discount_amount > 0
                      ? formatCurrency(selectedTransaction.discount_amount, currency)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (5%):</span>
                  <span className="font-semibold">{formatCurrency(selectedTransaction.tax_amount, currency)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(selectedTransaction.total_amount, currency)}
                  </span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Payment Method:{" "}
                  <span className="font-semibold text-gray-900">
                    {selectedTransaction.payment_method}
                  </span>
                </p>
                {selectedTransaction.amount_paid ? (
                  <p className="text-sm text-gray-600 mt-2">
                    Amount Paid:{" "}
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(selectedTransaction.amount_paid, currency)}
                    </span>
                  </p>
                ) : null}
                {selectedTransaction.balance_amount ? (
                  <p className="text-sm text-gray-600 mt-2">
                    Balance:{" "}
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(selectedTransaction.balance_amount, currency)}
                    </span>
                  </p>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() =>
                    handlePrintReceipt(selectedTransaction)
                  }
                  className="btn-primary flex-1"
                >
                  Print
                </button>
                <button
                  onClick={() =>
                    handleDownloadReceipt(selectedTransaction)
                  }
                  className="btn-secondary flex-1"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
