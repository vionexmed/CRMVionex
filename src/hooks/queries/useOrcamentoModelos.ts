import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orcamentoModelosApi, type DadosDoModelo, type OrcamentoModelo } from "@/lib/api/orcamento-modelos";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";

const chave = (orgId: string) => ["orcamento-modelos", orgId] as const;

export function useOrcamentoModelos() {
  const { orgId } = useOrg();
  return useQuery<OrcamentoModelo[]>({
    queryKey: chave(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => orcamentoModelosApi.list(orgId!),
  });
}

export function useSalvarModelo() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: DadosDoModelo }) =>
      id ? orcamentoModelosApi.atualizar(id, dados) : orcamentoModelosApi.criar(orgId!, user?.id ?? null, dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento-modelos"] }),
  });
}

export function useExcluirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orcamentoModelosApi.excluir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento-modelos"] }),
  });
}
