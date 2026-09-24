"use client";

import { MainLayout } from "@/components/layout";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import type { BusinessProfile } from "@/types";
import { Plus, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  products?: string | null;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    products: "",
    total_amount: 0,
    paid_amount: 0,
  });

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load suppliers");
    } else {
      setSuppliers((data || []) as Supplier[]);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        const settings = result.settings as Partial<BusinessProfile> | null;
        if (settings?.currency) setCurrency(settings.currency);
      })
      .catch(() => {});
  }, [fetchSuppliers]);

  const saveSupplier = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    const total = Number(form.total_amount || 0);
    const paid = Number(form.paid_amount || 0);
    const due = Math.max(0, total - paid);
    const status = due <= 0 && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
    const { data, error } = await supabase
      .from("suppliers")
      .insert([{ ...form, due_amount: due, payment_status: status }])
      .select();
    if (error) {
      toast.error("Failed to save supplier");
      return;
    }
    const supplier = (data || [])[0] as Supplier | undefined;
    if (supplier && paid > 0) {
      await supabase.from("supplier_payments").insert([
        { supplier_id: supplier.id, payment_date: new Date().toISOString(), amount: paid, notes: "Initial payment" },
      ]);
    }
    setForm({ name: "", phone: "", products: "", total_amount: 0, paid_amount: 0 });
    toast.success("Supplier saved");
    fetchSuppliers();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600">Track suppliers, products, paid amounts, partial payments, and dues.</p>
        </div>

        <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" placeholder="Supplier name" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-base" placeholder="Phone" />
          <input value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} className="input-base" placeholder="Products supplied" />
          <input type="number" min={0} value={form.total_amount || ""} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) || 0 })} className="input-base" placeholder="Total amount" />
          <input type="number" min={0} value={form.paid_amount || ""} onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) || 0 })} className="input-base" placeholder="Paid amount" />
          <button onClick={saveSupplier} className="btn-success flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Save Supplier
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">{supplier.name}</p>
                    <p className="text-sm text-gray-600">{supplier.phone || "No phone"}</p>
                    <p className="text-sm text-gray-600">{supplier.products || "No products listed"}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  supplier.payment_status === "paid" ? "bg-green-100 text-green-700" :
                  supplier.payment_status === "partial" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {supplier.payment_status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-gray-500">Total</p><p className="font-semibold">{formatCurrency(supplier.total_amount, currency)}</p></div>
                <div><p className="text-gray-500">Paid</p><p className="font-semibold">{formatCurrency(supplier.paid_amount, currency)}</p></div>
                <div><p className="text-gray-500">Due</p><p className="font-semibold">{formatCurrency(supplier.due_amount, currency)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

