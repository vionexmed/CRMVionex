import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { itensDoModelo, type ItemDeModelo } from "@/lib/orcamento-modelos";

export type OrcamentoModeloRow = Database["public"]["Tables"]["orcamento_modelos"]["Row"];

/** O modelo com os itens já lidos com segurança. */
export type OrcamentoModelo = Omit<OrcamentoModeloRow, "itens"> & { itens: ItemDeModelo[] };

export type DadosDoModelo = {
  nome: string;
  titulo: string | null;
  itens: ItemDeModelo[];
  validade_dias: number | null;
  desconto: number;
  condicoes: string | null;
  observacoes: string | null;
};

/** Tabela ainda não criada (migração 20261021150000 não aplicada): lista vazia, não erro. */
function tabelaAusente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return e.code === "42P01" || e.code === "PGRST205" || /orcamento_modelos/.test(e.message ?? "") && /does not exist|schema cache/.test(e.message ?? "");
}

const paraLinha = (r: OrcamentoModeloRow): OrcamentoModelo => ({ ...r, itens: itensDoModelo(r.itens) });

export const orcamentoModelosApi = {
  list: async (orgId: string): Promise<OrcamentoModelo[]> => {
    const { data, error } = await supabase
      .from("orcamento_modelos")
      .select("*")
      .eq("org_id", orgId)
      .order("nome", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw error;
    }
    return ((data ?? []) as OrcamentoModeloRow[]).map(paraLinha);
  },

  criar: async (orgId: string, userId: string | null, d: DadosDoModelo): Promise<OrcamentoModelo> => {
    const { data, error } = await supabase
      .from("orcamento_modelos")
      .insert({ ...d, itens: d.itens as unknown as Json, org_id: orgId, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return paraLinha(data as OrcamentoModeloRow);
  },

  atualizar: async (id: string, d: DadosDoModelo): Promise<OrcamentoModelo> => {
    const { data, error } = await supabase
      .from("orcamento_modelos")
      .update({ ...d, itens: d.itens as unknown as Json, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return paraLinha(data as OrcamentoModeloRow);
  },

  excluir: async (id: string): Promise<void> => {
    const { error } = await supabase.from("orcamento_modelos").delete().eq("id", id);
    if (error) throw error;
  },
};
