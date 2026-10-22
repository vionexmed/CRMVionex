import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelinesApi } from "@/lib/api/pipelines";
import { useOrg } from "@/hooks/useOrg";
import type { EditingStage } from "@/lib/api/pipelines";

export const pipelinesKeys = {
  pipelines: (orgId: string) => ["pipelines", orgId] as const,
  stages: (orgId: string) => ["pipeline_stages", orgId] as const,
};

export function usePipelines() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: pipelinesKeys.pipelines(orgId ?? ""),
    queryFn: () => pipelinesApi.list(orgId!),
    enabled: !!orgId,
  });
}

export function usePipelineStages() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: pipelinesKeys.stages(orgId ?? ""),
    queryFn: () => pipelinesApi.stages(orgId!),
    enabled: !!orgId,
  });
}

export function useSavePipelineStages() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({
      pipelineId,
      currentStageIds,
      editingStages,
    }: {
      pipelineId: string;
      currentStageIds: string[];
      editingStages: EditingStage[];
    }) => pipelinesApi.saveStages(orgId!, pipelineId, currentStageIds, editingStages),
    onSuccess: () => qc.invalidateQueries({ queryKey: pipelinesKeys.stages(orgId ?? "") }),
  });
}

/** "+ Nova coluna" do quadro: cria a etapa depois da última do funil. */
export function useCriarEtapa() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ pipelineId, nome, ordem, cor }: { pipelineId: string; nome: string; ordem: number; cor: string }) =>
      pipelinesApi.criarEtapa(orgId!, pipelineId, nome, ordem, cor),
    onSuccess: () => qc.invalidateQueries({ queryKey: pipelinesKeys.stages(orgId ?? "") }),
  });
}
