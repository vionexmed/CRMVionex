import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

export const companiesApi = {
  getById: async (orgId: string, id: string, signal?: AbortSignal): Promise<Company | null> => {
    if (!orgId || !id) return null;
    const query = supabase.from(TABLES.COMPANIES).select("*").eq("org_id", orgId).eq("id", id);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  list: async (orgId: string): Promise<Company[]> => {
    const { data, error } = await supabase.from(TABLES.COMPANIES).select("*").eq("org_id", orgId);
    if (error) throw error;
    return data;
  },

  create: async (company: CompanyInsert): Promise<Company> => {
    const { data, error } = await supabase.from(TABLES.COMPANIES).insert(company).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, company: CompanyUpdate): Promise<Company> => {
    const { data, error } = await supabase.from(TABLES.COMPANIES).update(company).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from(TABLES.COMPANIES).delete().eq("id", id);
    if (error) throw error;
  },
};
