"use client";

import { MainLayout } from "@/components/layout";
import { supabase } from "@/lib/supabase";
import { Building2, Edit3, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

interface Company {
  id: string;
  name: string;
  notes?: string | null;
  created_at?: string | null;
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const canMaintain = user?.role === "admin" || user?.role === "manager";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Failed to load companies");
    } else {
      setCompanies((data || []) as Company[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const addCompany = async () => {
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    const query = editingId
      ? supabase.from("companies").maintenance().update({ name: name.trim(), notes }).eq("id", editingId)
      : supabase.from("companies").insert([{ name: name.trim(), notes }]);
    const { error } = await query;
    if (error) {
      toast.error("Failed to save company");
      return;
    }
    setName("");
    setNotes("");
    setEditingId(null);
    toast.success(editingId ? "Company updated" : "Company saved");
    fetchCompanies();
  };

  const deleteCompany = async (id: string) => {
    if (!window.confirm("Delete this company? Products linked to it must be reassigned first.")) return;
    const { error } = await supabase.from("companies").maintenance().delete().eq("id", id);
    if (error) toast.error(error.message || "Failed to delete company");
    else { toast.success("Company deleted"); fetchCompanies(); }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600">Categorize products by company or brand.</p>
        </div>

        <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Company / brand name" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base" placeholder="Notes" />
          <button onClick={addCompany} className="btn-success flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            {editingId ? "Update Company" : "Add Company"}
          </button>
          {editingId && <button onClick={() => { setEditingId(null); setName(""); setNotes(""); }} className="btn-secondary">Cancel</button>}
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <p className="p-6 text-gray-600">Loading companies...</p>
          ) : companies.length === 0 ? (
            <p className="p-6 text-gray-600">No companies saved.</p>
          ) : (
            <div className="divide-y">
              {companies.map((company) => (
                <div key={company.id} className="p-4 flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{company.name}</p>
                    {company.notes && <p className="text-sm text-gray-600">{company.notes}</p>}
                  </div>
                  {canMaintain && <div className="flex gap-2"><button type="button" onClick={() => { setEditingId(company.id); setName(company.name); setNotes(company.notes || ""); }} className="text-blue-600"><Edit3 className="w-4 h-4" /></button><button type="button" onClick={() => deleteCompany(company.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
