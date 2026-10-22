import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Pipeline = Database["public"]["Tables"]["pipelines"]["Row"];
type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export type EditingStage = {
  id?: string;
  name: string;
  color: string;
  win_probability: number;
  order: number;
};

export const pipelinesApi = {
  list: async (orgId: string): Promise<Pipeline[]> => {
    const { data, error } = await supabase
      .from(TABLES.PIPELINES)
      .select("*")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  stages: async (orgId: string): Promise<Stage[]> => {
    const { data, error } = await supabase
      .from(TABLES.PIPELINE_STAGES)
      .select("*")
      .eq("org_id", orgId)
      .order("order");
    if (error) throw error;
    return data;
  },

  /**
   * Uma etapa nova no FIM do funil (o "+ Nova coluna" do quadro). Insere uma
   * linha só, sem reescrever a ordem das outras: a etapa de entrada continua
   * sendo a de menor `order`.
   */
  criarEtapa: async (orgId: string, pipelineId: string, nome: string, ordem: number, cor: string): Promise<void> => {
    const { data, error } = await supabase
      .from(TABLES.PIPELINE_STAGES)
      .insert({ org_id: orgId, pipeline_id: pipelineId, name: nome, order: ordem, color: cor, win_probability: 0 })
      .select("id");
    if (error) throw error;
    // O RLS recusa em silêncio: sem linha devolvida, nada foi criado.
    if (!data || data.length === 0) throw new Error("Sem permissão para criar etapas neste funil.");
  },

  saveStages: async (
    orgId: string,
    pipelineId: string,
    currentStageIds: string[],
    editingStages: EditingStage[]
  ): Promise<void> => {
    const keptIds = editingStages.filter((s) => s.id).map((s) => s.id!);
    const toDelete = currentStageIds.filter((id) => !keptIds.includes(id));

    if (toDelete.length > 0) {
      // Não deixa apagar estágio que ainda tem negócios — os deals ficariam órfãos
      const { count, error: countError } = await supabase
        .from(TABLES.DEALS)
        .select("id", { count: "exact", head: true })
        .in("stage_id", toDelete);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Não é possível remover: ${count} negócio(s) ainda estão em estágio(s) que você está excluindo. Mova-os primeiro.`
        );
      }
      const { error } = await supabase.from(TABLES.PIPELINE_STAGES).delete().in("id", toDelete);
      if (error) throw error;
    }

    for (let i = 0; i < editingStages.length; i++) {
      const s = editingStages[i];
      const payload = {
        name: s.name,
        color: s.color,
        win_probability: s.win_probability,
        order: i,
        pipeline_id: pipelineId,
        org_id: orgId,
      };
      if (s.id) {
        const { error } = await supabase.from(TABLES.PIPELINE_STAGES).update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(TABLES.PIPELINE_STAGES).insert(payload);
        if (error) throw error;
      }
    }
  },
};
