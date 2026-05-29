"use client";

import { MainLayout } from "@/components/layout";
import { useState, useEffect } from "react";
import { Eye, Download, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
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
  payment_method: string;
  items?: TransactionItem[];
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  // Fetch transactions from Supabase
  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Failed to load transactions");
        return;
      }

      setTransactions(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading transactions");
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions;

  const handlePrintReceipt = (transaction: Transaction) => {
    toast.success(`Receipt for ${transaction.id} printed!`);
  };

  const handleDownloadReceipt = (transaction: Transaction) => {
    toast.success(`Receipt for ${transaction.id} downloaded!`);
  };

  const totalSales = filteredTransactions.reduce((sum, txn) => sum + txn.total_amount, 0);
  const totalTransactions = filteredTransactions.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">View and manage all sales transactions</p>
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
            <p className="text-3xl font-bold text-green-600">{totalSales}/=</p>
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
                          {transaction.total_amount}/=
                        </p>
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
                            onClick={() => setSelectedTransaction(transaction)}
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
                        <td className="py-2">{item.product_id || "Product"}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">{item.unit_price}/=</td>
                        <td className="text-right py-2">
                          {item.discount > 0 ? `${item.discount}/=` : "-"}
                        </td>
                        <td className="text-right py-2 font-semibold">
                          {item.subtotal}/=
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
                    {(selectedTransaction.total_amount - selectedTransaction.tax_amount + selectedTransaction.discount_amount)?.toFixed(2)}/=
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold">
                    {selectedTransaction.discount_amount > 0
                      ? `${selectedTransaction.discount_amount}/=`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (5%):</span>
                  <span className="font-semibold">{selectedTransaction.tax_amount?.toFixed(2)}/=</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-blue-600">
                    {selectedTransaction.total_amount?.toFixed(2)}/=
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
