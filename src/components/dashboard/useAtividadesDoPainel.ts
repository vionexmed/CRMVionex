/**
 * Números da visão "Atividades" do painel.
 *
 * Seguem a regra de "Métricas do painel": a CONCLUSÃO é o que conta, e a janela
 * do período é pela data da conclusão (`completed_at`), nunca pela criação ou
 * pelo prazo. "Para hoje" é a intenção ainda aberta: prazo hoje e sem conclusão.
 * As atrasadas vêm de `useAtividadesAtrasadas`, o mesmo critério da tela de
 * Atividades.
 *
 * Duas consultas independentes: uma falha apaga só o seu número.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { getSdrRanges, type SdrPeriod } from "@/hooks/useSdrMetrics";
import type { ActivityType } from "@/lib/atividade-tipos";

const TETO = 1000;

export type ConcluidasNoPeriodo = {
  total: number;
  /** null quando a amostra foi cortada em 1000: dividir só uma parte mentiria. */
  porTipo: Partial<Record<ActivityType, number>> | null;
};

export function useAtividadesConcluidas(period: SdrPeriod) {
  const { orgId } = useOrg();
  return useQuery<ConcluidasNoPeriodo>({
    queryKey: ["sdr-metrics", orgId ?? "", "atividades-concluidas", period],
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const { current } = getSdrRanges(period);
      let q = supabase
        .from("activities")
        .select("type", { count: "exact" })
        .eq("org_id", orgId!)
        .not("completed_at", "is", null);
      if (current.start) q = q.gte("completed_at", current.start.toISOString());
      if (current.end) q = q.lt("completed_at", current.end.toISOString());
      const { data, count, error } = await q.limit(TETO);
      if (error) throw error;
      const linhas = (data ?? []) as { type: ActivityType }[];
      const total = count ?? linhas.length;
      if (linhas.length < total) return { total, porTipo: null };
      const porTipo: Partial<Record<ActivityType, number>> = {};
      for (const l of linhas) porTipo[l.type] = (porTipo[l.type] ?? 0) + 1;
      return { total, porTipo };
    },
  });
}

/** Atividades com prazo hoje e ainda sem conclusão. */
export function useAtividadesParaHoje() {
  const { orgId } = useOrg();
  return useQuery<number>({
    queryKey: ["sdr-metrics", orgId ?? "", "atividades-hoje"],
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);
      const { count, error } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .is("completed_at", null)
        .gte("due_date", inicio.toISOString())
        .lt("due_date", fim.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
}
