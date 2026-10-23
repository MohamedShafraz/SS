"use client";

import { MainLayout } from "@/components/layout";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { localDb } from "@/lib/local-db-client";
import type { BusinessProfile, ShopAccountRow, ShopPaymentRow, TransactionRow } from "@/types";
import { CreditCard, Edit3, ReceiptText, Store, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

type ShopBill = TransactionRow & {
  shopName: string;
};

export default function ShopsPage() {
  const { user } = useAuth();
  const canMaintain = user?.role === "admin" || user?.role === "manager";
  const [shops, setShops] = useState<ShopAccountRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [payments, setPayments] = useState<ShopPaymentRow[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [selectedShopId, setSelectedShopId] = useState("all");
  const [paymentTarget, setPaymentTarget] = useState<ShopBill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const money = useCallback((amount: number | string | null | undefined) => formatCurrency(amount, currency), [currency]);

  const fetchData = useCallback(async () => {
    const [shopsResult, transactionsResult, paymentsResult] = await Promise.all([
      localDb.from("shop_accounts").select("*").order("name", { ascending: true }),
      localDb
        .from("transactions")
        .select("*")
        .or("status.is.null,status.eq.completed")
        .order("transaction_date", { ascending: false }),
      localDb.from("shop_payments").select("*").order("payment_date", { ascending: false }),
    ]);

    if (shopsResult.error) toast.error("Failed to load shop accounts");
    if (!shopsResult.error) setShops((shopsResult.data || []) as ShopAccountRow[]);
    if (!transactionsResult.error) setTransactions((transactionsResult.data || []) as TransactionRow[]);
    if (!paymentsResult.error) setPayments((paymentsResult.data || []) as ShopPaymentRow[]);
  }, []);

  useEffect(() => {
    fetchData();
    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (settings?.currency) setCurrency(settings.currency);
      })
      .catch(() => {});
  }, [fetchData]);

  const shopMap = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);
  const shopBills = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.sale_type === "shop" || transaction.shop_id)
        .map((transaction) => ({
          ...transaction,
          shopName: shopMap.get(transaction.shop_id || "")?.name || transaction.customer_name || "Shop",
        }))
        .filter((bill) => selectedShopId === "all" || bill.shop_id === selectedShopId),
    [selectedShopId, shopMap, transactions]
  );
  const activeBills = shopBills
    .filter((bill) => Number(bill.due_amount || 0) > 0)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  const totals = shops.reduce(
    (acc, shop) => {
      acc.billed += Number(shop.total_billed || 0);
      acc.paid += Number(shop.total_paid || 0);
      acc.due += Number(shop.due_amount || 0);
      return acc;
    },
    { billed: 0, paid: 0, due: 0 }
  );

  const savePayment = async () => {
    if (!paymentTarget) return;
    const amount = Number(paymentAmount || 0);
    const due = Number(paymentTarget.due_amount || 0);
    if (amount <= 0) {
      toast.error("Payment amount is required");
      return;
    }
    if (amount > due) {
      toast.error("Payment cannot exceed bill due amount");
      return;
    }
    if (!paymentTarget.shop_id) {
      toast.error("Bill is missing a shop account");
      return;
    }

    try {
      setSavingPayment(true);
      const response = await fetch("/api/shop-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: paymentTarget.id,
          amount,
          paymentMethod,
          notes: paymentNotes,
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Failed to record payment");

      toast.success("Payment recorded");
      setPaymentTarget(null);
      setPaymentAmount(0);
      setPaymentNotes("");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const editShop = async (shop: ShopAccountRow) => {
    const name = window.prompt("Shop name", shop.name)?.trim();
    if (!name) return;
    const phone = window.prompt("Phone", shop.phone || "") ?? (shop.phone || "");
    const address = window.prompt("Address", shop.address || "") ?? (shop.address || "");
    const notes = window.prompt("Notes", shop.notes || "") ?? (shop.notes || "");
    const { error } = await localDb.from("shop_accounts").maintenance().update({ name, phone, address, notes }).eq("id", shop.id);
    if (error) toast.error(error.message || "Failed to update shop");
    else { toast.success("Shop updated"); fetchData(); }
  };

  const deleteShop = async (shop: ShopAccountRow) => {
    if (!window.confirm("Delete this shop account? Accounts with bills cannot be deleted.")) return;
    const { error } = await localDb.from("shop_accounts").maintenance().delete().eq("id", shop.id);
    if (error) toast.error(error.message || "Failed to delete shop");
    else { toast.success("Shop deleted"); fetchData(); }
  };

  const editPayment = async (payment: ShopPaymentRow) => {
    const amountText = window.prompt("Payment amount", String(payment.amount));
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid payment amount"); return; }
    const notes = window.prompt("Notes", payment.notes || "") ?? (payment.notes || "");
    const response = await fetch("/api/shop-payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: payment.id, amount, notes }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) toast.error(result.message || "Failed to update payment");
    else { toast.success("Payment updated"); fetchData(); }
  };

  const deletePayment = async (payment: ShopPaymentRow) => {
    if (!window.confirm("Delete this payment and recalculate the bill?")) return;
    const response = await fetch("/api/shop-payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: payment.id }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) toast.error(result.message || "Failed to delete payment");
    else { toast.success("Payment deleted"); fetchData(); }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop Accounts</h1>
          <p className="text-gray-600">Track neighbour shop bills, dues, and follow-up payments.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card"><p className="text-sm text-gray-600">Total Billed</p><p className="text-2xl font-bold">{money(totals.billed)}</p></div>
          <div className="card"><p className="text-sm text-gray-600">Total Paid</p><p className="text-2xl font-bold text-green-600">{money(totals.paid)}</p></div>
          <div className="card"><p className="text-sm text-gray-600">Outstanding Due</p><p className="text-2xl font-bold text-red-600">{money(totals.due)}</p></div>
        </div>

        <div className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
            </div>
            <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)} className="input-base sm:max-w-xs">
              <option value="all">All shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {shops.map((shop) => (
              <div key={shop.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{shop.name}</p>
                    <p className="text-sm text-gray-600">{shop.phone || "No phone"}</p>
                  </div>
                  <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    shop.payment_status === "paid" ? "bg-green-100 text-green-700" :
                    shop.payment_status === "partial" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>{shop.payment_status}</span>{canMaintain && <><button type="button" onClick={() => editShop(shop)} className="text-blue-600"><Edit3 className="w-4 h-4" /></button><button type="button" onClick={() => deleteShop(shop)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></>}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-gray-500">Billed</p><p className="font-semibold">{money(shop.total_billed)}</p></div>
                  <div><p className="text-gray-500">Paid</p><p className="font-semibold">{money(shop.total_paid)}</p></div>
                  <div><p className="text-gray-500">Due</p><p className="font-semibold">{money(shop.due_amount)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b p-5">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Bills Needing Follow-up</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  {["Shop", "Bill", "Date", "Total", "Paid", "Due", "Status", "Action"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-sm font-semibold text-gray-900">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeBills.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No unpaid shop bills.</td></tr>
                ) : (
                  activeBills.map((bill) => (
                    <tr key={bill.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{bill.shopName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{bill.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{bill.transaction_date}</td>
                      <td className="px-4 py-3">{money(bill.total_amount)}</td>
                      <td className="px-4 py-3">{money(bill.amount_paid || 0)}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{money(bill.due_amount || 0)}</td>
                      <td className="px-4 py-3 capitalize">{bill.payment_status}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentTarget(bill);
                            setPaymentAmount(Number(bill.due_amount || 0));
                          }}
                          className="btn-primary flex items-center gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          Pay
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold text-gray-900">Recent Follow-up Payments</h2>
          </div>
          <div className="divide-y">
            {payments.slice(0, 10).map((payment) => (
              <div key={payment.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{shopMap.get(payment.shop_id)?.name || "Shop"}</p>
                  <p className="text-sm text-gray-600">{payment.payment_date} - Bill {payment.transaction_id}</p>
                </div>
                <div className="flex items-center gap-3"><p className="font-semibold text-green-600">{money(payment.amount)}</p>{canMaintain && <><button type="button" onClick={() => editPayment(payment)} className="text-blue-600"><Edit3 className="w-4 h-4" /></button><button type="button" onClick={() => deletePayment(payment)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></>}</div>
              </div>
            ))}
            {payments.length === 0 && <p className="p-5 text-sm text-gray-600">No follow-up payments recorded.</p>}
          </div>
        </div>

        {paymentTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
              <p className="mt-1 text-sm text-gray-600">{paymentTarget.shopName} - Due {money(paymentTarget.due_amount || 0)}</p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <input
                  type="number"
                  min={0}
                  max={Number(paymentTarget.due_amount || 0)}
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(Math.min(Number(paymentTarget.due_amount || 0), Math.max(0, Number(e.target.value) || 0)))}
                  className="input-base"
                  placeholder="Payment amount"
                />
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-base">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                </select>
                <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="input-base" placeholder="Notes optional" />
              </div>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPaymentTarget(null)} disabled={savingPayment} className="btn-secondary">Cancel</button>
                <button type="button" onClick={savePayment} disabled={savingPayment} className="btn-success">
                  {savingPayment ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
