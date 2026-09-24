"use client";

import { MainLayout } from "@/components/layout";
import { supabase } from "@/lib/supabase";
import { Building2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Company {
  id: string;
  name: string;
  notes?: string | null;
  created_at?: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

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
    const { error } = await supabase.from("companies").insert([{ name: name.trim(), notes }]);
    if (error) {
      toast.error("Failed to save company");
      return;
    }
    setName("");
    setNotes("");
    toast.success("Company saved");
    fetchCompanies();
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
            Add Company
          </button>
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
                  <div>
                    <p className="font-semibold text-gray-900">{company.name}</p>
                    {company.notes && <p className="text-sm text-gray-600">{company.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

