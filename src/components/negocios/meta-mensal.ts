import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";

/*
 * A meta mensal de vendas da organização (`organizations.meta_mensal`), lida e
 * escrita pelo funil. Arquivo só de hooks: componente e função no mesmo
 * arquivo quebram o fast refresh do Vite.
 */

export const metaMensalKey = (orgId: string) => ["organizations", orgId, "meta_mensal"] as const;

/**
 * `coluna: false` = o banco não tem a coluna (migração 20261021120000 ainda
 * não aplicada): a tela não oferece editar o que não existe. `valor: null` =
 * sem meta. Objeto, e não `undefined` para "sem coluna": o react-query recusa
 * `undefined` como resultado de consulta.
 *
 * O erro 42703 (coluna inexistente) vira "ausente" em vez de falha: sem isso o
 * funil inteiro acusaria erro por causa de um campo opcional.
 */
export function useMetaMensal() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: metaMensalKey(orgId ?? ""),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ coluna: boolean; valor: number | null }> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("meta_mensal")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) {
        if (error.code === "42703") return { coluna: false, valor: null };
        throw error;
      }
      const v = (data as { meta_mensal?: number | string | null } | null)?.meta_mensal;
      if (v === undefined) return { coluna: false, valor: null };
      const n = Number(v);
      return { coluna: true, valor: v === null || !Number.isFinite(n) || n <= 0 ? null : n };
    },
  });
}

/**
 * Grava a meta. `null` apaga.
 *
 * O `.select("id")` não é enfeite: a política de UPDATE de `organizations` é
 * só do OWNER, e o RLS do PostgREST recusa EM SILÊNCIO -- zero linhas, sem
 * erro. Sem conferir a linha devolvida, um admin "salvaria" a meta e ela
 * continuaria a antiga, com toast de sucesso.
 */
export function useSalvarMetaMensal() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: number | null) => {
      if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
        throw { message: "A meta precisa ser um valor maior que zero." };
      }
      const { data, error } = await supabase
        .from("organizations")
        .update({ meta_mensal: valor })
        .eq("id", orgId!)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw { message: "Só o dono da organização pode alterar a meta." };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: metaMensalKey(orgId ?? "") }),
  });
}
