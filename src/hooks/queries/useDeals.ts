import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { dealsApi } from "@/lib/api/deals";
import { useOrg } from "@/hooks/useOrg";
import type { DealInsert, DealUpdate, DealListParams, DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { invalidarPainel } from "@/lib/invalidar-painel";

import { toast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";

type DealStatus = Database["public"]["Enums"]["deal_status"];

// Re-export so pages don't need to import from the api layer directly
export type { DealListParams, DealWithRelations };

export const dealsKeys = {
  all: (orgId: string) => ["deals", orgId] as const,
  list: (orgId: string, params: DealListParams) => ["deals", orgId, params] as const,
  detail: (id: string) => ["deals", "detail", id] as const,
};

/**
 * Lista leve p/ o seletor de negócio em Atividades — sem o teto de 1000 que
 * `useDeals({ pageSize: 1000 })` reproduzia (mesma armadilha do PostgREST
 * documentada para `useAllContacts`).
 */
export function useDealsPicker() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: [...dealsKeys.all(orgId ?? ""), "picker"] as const,
    queryFn: () => dealsApi.listForPicker(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: dealsKeys.detail(id ?? ""),
    queryFn: () => dealsApi.getById(id!),
    enabled: !!id,
  });
}

export function useDeals(params: DealListParams = {}, opcoes: { enabled?: boolean } = {}) {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: dealsKeys.list(orgId ?? "", params),
    queryFn: () => dealsApi.list(orgId!, params),
    // `enabled` deixa a tela desligar a consulta que a visão atual não usa.
    enabled: !!orgId && (opcoes.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (deal: DealInsert) => dealsApi.create(deal),
    onSuccess: () => qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, deal }: { id: string; deal: DealUpdate }) => dealsApi.update(id, deal),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") });
      qc.invalidateQueries({ queryKey: dealsKeys.detail(id) });
    },
  });
}

/**
 * Aplica a troca de etapa a UMA consulta do cache, só se ela tiver o formato de
 * lista de negócios (`{ data: [...], count }`).
 *
 * A atualização otimista percorre TODAS as consultas sob `deals`, e nem todas
 * têm esse formato: o seletor leve de negócios (`picker`) guarda um array puro,
 * e consultas de resumo guardam outra coisa. Assumir `old.data.map` estourava
 * "undefined is not an object (evaluating 'u.data.map')" no meio do arraste, e
 * o negócio voltava à etapa anterior mesmo com o servidor aceitando a troca.
 * O que não for lista de negócios passa intacto.
 */
export function aplicarEtapaNoCache<T>(old: T, id: string, stageId: string): T {
  const lista = old as unknown as { data?: unknown } | null | undefined;
  if (!lista || typeof lista !== "object" || !Array.isArray(lista.data)) return old;
  return {
    ...(lista as object),
    data: (lista.data as { id?: string }[]).map((d) => (d && d.id === id ? { ...d, stage_id: stageId } : d)),
  } as unknown as T;
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      dealsApi.updateStage(id, stageId),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: dealsKeys.all(orgId ?? "") });
      const keys = qc
        .getQueryCache()
        .findAll({ queryKey: dealsKeys.all(orgId ?? "") });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];
      keys.forEach((q) => {
        snapshots.push({ key: q.queryKey, data: q.state.data });
        qc.setQueryData(q.queryKey, (old: unknown) => aplicarEtapaNoCache(old, id, stageId));
      });
      return { snapshots };
    },
    onError: (error, _vars, ctx) => {
      ctx?.snapshots?.forEach(({ key, data }) => qc.setQueryData(key, data));
      toast({
        title: "Não foi possível mudar a etapa",
        description: `O negócio voltou à etapa anterior. ${mensagemErro(error)}`,
        variant: "destructive",
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") }),
  });
}

export function useUpdateDealStatus() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({
      id,
      status,
      lossReasonId,
      lossReasonNote,
    }: {
      id: string;
      status: DealStatus;
      /** Categoria do catálogo `loss_reasons`, quando `status` é "lost". */
      lossReasonId?: string | null;
      /** Texto livre opcional -- NÃO concatenado com a categoria (ver dealsApi.updateStatus). */
      lossReasonNote?: string | null;
    }) => dealsApi.updateStatus(id, status, lossReasonId, lossReasonNote),
    onSuccess: () => qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") }),
  });
}

export function useBatchUpdateDeals() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: "won" | "lost" | "delete" }) => {
      if (action === "delete") return dealsApi.deleteMany(ids);
      return dealsApi.batchUpdateStatus(ids, action);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") }),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, comVinculos }: { id: string; comVinculos?: boolean }) =>
      dealsApi.delete(id, comVinculos),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: dealsKeys.all(orgId ?? "") });
      qc.removeQueries({ queryKey: dealsKeys.detail(id) });
      // A exclusão em cascata apaga atividades: sem invalidar, a tela de
      // Atividades continuaria listando registro de negócio que não existe mais.
      qc.invalidateQueries({ queryKey: ["activities"] });
      // O painel conta contatos, negócios e atividades: qualquer um deles
      // mudando torna os números dele velhos.
      invalidarPainel(qc, orgId);
    },
  });
}

// Re-export types expected by pages/components
export type { DealInsert, DealUpdate };
