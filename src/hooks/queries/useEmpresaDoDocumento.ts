import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { CAMPOS_DA_EMPRESA, empresaDeSettings, type DadosDaEmpresa } from "@/lib/empresa-documento";
import type { Json } from "@/integrations/supabase/types";

/* Hooks da empresa emitente (`organizations.settings.empresa`). */

export const empresaKey = (orgId: string) => ["organizations", orgId, "empresa"] as const;

export function useEmpresaDoDocumento() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: empresaKey(orgId ?? ""),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations").select("name, settings").eq("id", orgId!).maybeSingle();
      if (error) throw error;
      return { nome: data?.name ?? "", empresa: empresaDeSettings(data?.settings) };
    },
  });
}

/**
 * Grava `settings.empresa` PRESERVANDO o resto do json (moeda, fuso, indústrias):
 * relê o settings atual antes de mesclar, para não apagar o que outra aba mudou.
 *
 * `.select("id")` confere a linha devolvida: o UPDATE de `organizations` é só do
 * owner e o RLS recusa em silêncio (zero linhas, sem erro).
 */
export function useSalvarEmpresa() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (empresa: DadosDaEmpresa) => {
      const { data: atual, error: erroLeitura } = await supabase
        .from("organizations").select("settings").eq("id", orgId!).maybeSingle();
      if (erroLeitura) throw erroLeitura;
      const base = (atual?.settings && typeof atual.settings === "object" ? atual.settings : {}) as Record<string, Json>;
      const limpa = Object.fromEntries(CAMPOS_DA_EMPRESA.map((k) => [k, empresa[k].trim()]));
      const { data, error } = await supabase
        .from("organizations")
        .update({ settings: { ...base, empresa: limpa } as Json })
        .eq("id", orgId!)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw { message: "Só o dono da organização pode alterar os dados da empresa." };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: empresaKey(orgId ?? "") }),
  });
}
