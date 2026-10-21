import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

export type Produto = Database["public"]["Tables"]["produtos"]["Row"];
type ProdutoInsert = Database["public"]["Tables"]["produtos"]["Insert"];
type ProdutoUpdate = Database["public"]["Tables"]["produtos"]["Update"];

/** O que `produtos_metricas` devolve (migração 20261021140100). */
export type MetricasDeProdutos = {
  por_produto: { produto_id: string; clientes: number; vendas_mes: number }[];
  receita_recorrente: number;
  mais_vendido: { produto_id: string; nome: string; clientes: number; vendas_mes: number } | null;
  ticket_medio: number | null;
};

export const produtosApi = {
  /**
   * Números de venda do catálogo, calculados no banco a partir de orçamento
   * aprovado e negócio ganho. Devolve `null` se a função ainda não existe
   * (migração não aplicada): a tela mostra "—" em vez de quebrar.
   */
  metricas: async (orgId: string): Promise<MetricasDeProdutos | null> => {
    const { data, error } = await supabase.rpc("produtos_metricas", { _org_id: orgId });
    if (error) {
      // 42883 = função inexistente; PGRST202 = o PostgREST não a conhece.
      if (error.code === "42883" || error.code === "PGRST202") return null;
      throw error;
    }
    return (data as unknown as MetricasDeProdutos | null) ?? null;
  },

  /**
   * O catálogo, em ordem alfabética.
   *
   * `apenasAtivos` existe para o construtor de orçamento: ninguém deve poder
   * acrescentar produto desativado a um orçamento novo. Na tela de Produtos o
   * padrão é o contrário -- mostrar todos, senão o desativado desaparece e não
   * há como reativá-lo.
   */
  list: async (orgId: string, apenasAtivos = false): Promise<Produto[]> => {
    let q = supabase
      .from(TABLES.PRODUTOS)
      .select("*")
      .eq("org_id", orgId)
      .order("nome");

    if (apenasAtivos) q = q.eq("ativo", true);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  create: async (produto: ProdutoInsert): Promise<Produto> => {
    const { data, error } = await supabase
      .from(TABLES.PRODUTOS).insert(produto).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Insere vários de uma vez (importação). Uma chamada só: o PostgREST insere o
   * lote numa transação, então a planilha entra inteira ou não entra. Colunas
   * novas só vão quando preenchidas, para a importação funcionar mesmo antes da
   * migração de categoria/tipo ser aplicada.
   */
  criarVarios: async (
    orgId: string,
    linhas: { nome: string; descricao: string | null; preco: number; categoria: string | null; unidade: string | null; sku: string | null; tipo_cobranca: string | null }[],
  ): Promise<void> => {
    const registros = linhas.map((l) => ({
      org_id: orgId,
      nome: l.nome,
      descricao: l.descricao,
      preco: l.preco,
      ...(l.unidade ? { unidade: l.unidade } : {}),
      ...(l.sku ? { sku: l.sku } : {}),
      ...(l.categoria ? { categoria: l.categoria } : {}),
      ...(l.tipo_cobranca ? { tipo_cobranca: l.tipo_cobranca } : {}),
    }));
    const { error } = await supabase.from(TABLES.PRODUTOS).insert(registros);
    if (error) throw error;
  },

  update: async (id: string, produto: ProdutoUpdate): Promise<Produto> => {
    const { data, error } = await supabase
      .from(TABLES.PRODUTOS)
      .update({ ...produto, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Quantos orçamentos citam este produto.
   *
   * O mesmo padrão de `contactsApi.contarVinculos`, e pelo mesmo motivo: o
   * PostgREST não expõe transação, então a tela precisa dizer o que vai embora
   * ANTES de apagar. Aqui o item não vai embora -- `produto_id` é
   * `ON DELETE SET NULL` e a linha do orçamento guarda nome e preço próprios --
   * mas o vínculo some, e quem apaga merece saber quantos.
   */
  contarVinculos: async (id: string): Promise<number> => {
    const { count, error } = await supabase
      .from(TABLES.ORCAMENTO_ITENS)
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id);
    if (error) throw error;
    return count ?? 0;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from(TABLES.PRODUTOS).delete().eq("id", id);
    if (error) throw error;
  },
};
