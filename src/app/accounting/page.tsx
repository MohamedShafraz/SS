"use client";

import { MainLayout } from "@/components/layout";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import type { BusinessProfile } from "@/types";
import { Plus, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description?: string | null;
  amount: number;
}

export default function AccountingPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "daily",
    description: "",
    amount: 0,
  });

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });
    if (error) {
      toast.error("Failed to load expenses");
    } else {
      setExpenses((data || []) as Expense[]);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (settings?.currency) setCurrency(settings.currency);
      })
      .catch(() => {});
  }, [fetchExpenses]);

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
    const { error } = await supabase.from("expenses").insert([form]);
    if (error) {
      toast.error("Failed to save expense");
      return;
    }
    setForm({ expense_date: new Date().toISOString().slice(0, 10), category: "daily", description: "", amount: 0 });
    toast.success("Expense saved");
    fetchExpenses();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-600">Track staff salary, daily expenses, and other expenses.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card"><p className="text-sm text-gray-600">Total Expenses</p><p className="text-2xl font-bold">{formatCurrency(totals.total, currency)}</p></div>
          <div className="card"><p className="text-sm text-gray-600">Staff Salary</p><p className="text-2xl font-bold">{formatCurrency(totals.staff_salary || 0, currency)}</p></div>
          <div className="card"><p className="text-sm text-gray-600">Daily</p><p className="text-2xl font-bold">{formatCurrency(totals.daily || 0, currency)}</p></div>
          <div className="card"><p className="text-sm text-gray-600">Other</p><p className="text-2xl font-bold">{formatCurrency(totals.other || 0, currency)}</p></div>
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
            Save Expense
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="divide-y">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ReceiptText className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">{expense.description || expense.category}</p>
                    <p className="text-sm text-gray-600">{expense.expense_date} · {expense.category.replace("_", " ")}</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900">{formatCurrency(expense.amount, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

