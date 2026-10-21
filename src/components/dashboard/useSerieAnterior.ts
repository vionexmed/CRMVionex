/**
 * A série diária do PERÍODO ANTERIOR, para a linha tracejada do gráfico.
 *
 * Vem da MESMA função do gráfico principal (`sdr_series`), só com o intervalo
 * de comparação que `getSdrRanges` já calcula para os cards. Montar a
 * comparação por outra consulta faria a linha tracejada contar coisa diferente
 * da linha cheia -- e a diferença entre as duas é justamente o que se lê.
 *
 * A chave mora sob o prefixo `sdr-charts` de propósito: é o que `invalidarPainel`
 * e o botão de atualizar invalidam, então a comparação não fica velha enquanto
 * a série atual se atualiza.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { rangeDeComparacao, type SdrComparacao, type SdrPeriod } from "@/hooks/useSdrMetrics";
import type { PontoSerie } from "@/hooks/useSdrCharts";

export function useSerieAnterior(period: SdrPeriod, comparacao: SdrComparacao = "anterior") {
  const { orgId } = useOrg();
  const previous = rangeDeComparacao(period, comparacao);

  return useQuery<PontoSerie[]>({
    queryKey: ["sdr-charts", orgId ?? "", period, "anterior", comparacao],
    // "Todo o período" não tem anterior: não há o que buscar.
    enabled: !!orgId && !!previous,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sdr_series", {
        _org_id: orgId!,
        _from: previous!.start ? previous!.start.toISOString() : undefined,
        _to: previous!.end ? previous!.end.toISOString() : undefined,
      });
      if (error) throw error;
      return (data ?? []) as PontoSerie[];
    },
  });
}
