import { useMemo } from "react";
import { FaixaDeIndicadores, Indicador } from "@/components/layout/ListaV1";
import { CartaoDeRelatorio, VazioDoBloco } from "@/components/reports/CartaoDeRelatorio";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FAIXAS_PREVISAO, calcularPrevisao, totaisDaPrevisao } from "@/lib/previsao";
import { BarrasAgrupadas } from "@/components/dashboard/svg/BarrasAgrupadas";
import {
  Deal, Stage,
  fmt,
} from "@/components/reports/types";

export function ForecastReport({ deals, stages, ownerFilter, pipelineFilter }: {
  deals: Deal[]; stages: Stage[]; ownerFilter: string; pipelineFilter: string;
}) {
  const { toast } = useToast();

  const openDeals = useMemo(() => {
    let list = deals.filter((d) => d.status === "open");
    if (ownerFilter !== "all") list = list.filter((d) => d.owner_id === ownerFilter);
    if (pipelineFilter !== "all") {
      const pipeStages = stages.filter((s) => s.pipeline_id === pipelineFilter).map((s) => s.id);
      list = list.filter((d) => d.stage_id && pipeStages.includes(d.stage_id));
    }
    return list;
  }, [deals, ownerFilter, pipelineFilter, stages]);

  // O cálculo mora em `lib/previsao`. Era duplicado aqui e em
  // `crm/DealsForecast`, com os mesmos limiares e nomes diferentes: a faixa
  // ≥80% se chamava "Pessimista" aqui e "Comprometido" lá, e -- pior -- era
  // pintada de VERMELHO aqui e de VERDE lá. O mesmo número, lido como problema
  // numa tela e como conquista na outra.
  const buckets = useMemo(() => calcularPrevisao(openDeals, { meses: 3 }), [openDeals]);
  const totals = useMemo(() => totaisDaPrevisao(buckets), [buckets]);

  // Inline probability edit
  const updateProbability = async (dealId: string, newProb: number) => {
    const { error } = await supabase.from("deals").update({ probability: newProb }).eq("id", dealId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Probabilidade atualizada" });
    // Update local state
    const idx = deals.findIndex((d) => d.id === dealId);
    if (idx >= 0) deals[idx].probability = newProb;
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Esta aba olha para a FRENTE, então não segue o filtro de período --
          só o de responsável e o de funil. */}
      <FaixaDeIndicadores>
        {FAIXAS_PREVISAO.map((faixa) => (
          <Indicador key={faixa.chave} rotulo={faixa.rotulo} valor={fmt(totals[faixa.chave])} apoio={`probabilidade ≥ ${faixa.minimo}%`} />
        ))}
        <Indicador rotulo="Valor em aberto" valor={fmt(totals.pipeline)} apoio={`${openDeals.length} ${openDeals.length === 1 ? "negócio" : "negócios"}`} />
      </FaixaDeIndicadores>

      <CartaoDeRelatorio titulo="Previsão de receita" descricao="Próximos 3 meses, pela data prevista de fechamento">
        {/* Faixa, cor e rótulo saem de FAIXAS_PREVISAO -- a mesma lista dos
            números acima e do selo por negócio abaixo, para que as três
            leituras da mesma coisa não possam divergir. */}
        <BarrasAgrupadas
          linhas={buckets}
          rotulo={(b) => b.rotulo}
          formatar={fmt}
          vazio="Nenhum negócio aberto nos próximos três meses"
          series={FAIXAS_PREVISAO.map((faixa) => ({
            nome: faixa.rotulo,
            cor: faixa.corCss,
            valor: (b: (typeof buckets)[number]) => b[faixa.chave],
          }))}
        />
      </CartaoDeRelatorio>

      {buckets.map((bucket) => (
        <CartaoDeRelatorio
          key={bucket.chave}
          // Só a primeira letra: `capitalize` fazia "Outubro De 2026".
          titulo={bucket.rotulo.charAt(0).toUpperCase() + bucket.rotulo.slice(1)}
          descricao={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {FAIXAS_PREVISAO.map((faixa) => (
                <span key={faixa.chave} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: faixa.corCss }} />
                  {faixa.rotulo}: <span className="font-medium text-foreground tabular-nums">{fmt(bucket[faixa.chave])}</span>
                </span>
              ))}
            </span>
          }
        >
          {bucket.pipeline > 0 && (
            <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-success" style={{ width: `${(bucket.comprometido / bucket.pipeline) * 100}%` }} />
              <div className="h-full bg-primary" style={{ width: `${((bucket.provavel - bucket.comprometido) / bucket.pipeline) * 100}%` }} />
              <div className="h-full bg-warning" style={{ width: `${((bucket.possivel - bucket.provavel) / bucket.pipeline) * 100}%` }} />
            </div>
          )}
          {bucket.negocios.length === 0 ? (
            <VazioDoBloco>Nenhum negócio com fechamento previsto neste mês.</VazioDoBloco>
          ) : (
            <ul className="divide-y divide-border">
              {/* Cópia antes de ordenar: `.sort()` é in place, e `bucket.negocios`
                  vem de um useMemo -- ordenar aqui muta o resultado memoizado
                  durante o render. */}
              {[...bucket.negocios].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).map((deal) => {
                const prob = Number(deal.probability) || 0;
                const stageName = stages.find((s) => s.id === deal.stage_id)?.name || "—";
                // A faixa do negócio sai da MESMA lista dos números e das
                // barras. Antes era um terceiro encadeamento de ternários com
                // os limiares repetidos e as cores invertidas.
                const faixa = FAIXAS_PREVISAO.find((f) => prob >= f.minimo);
                const scenario = faixa?.rotulo ?? "Fora da previsão";
                const scenarioColor = faixa?.cor ?? "text-muted-foreground";
                return (
                  <li key={deal.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{deal.title}</span>
                      <Badge variant="neutral" className="shrink-0">{stageName}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-medium ${scenarioColor}`}>{scenario}</span>
                      <Select
                        value={String(prob)}
                        onValueChange={(v) => updateProbability(deal.id, Number(v))}
                      >
                        <SelectTrigger aria-label={`Probabilidade de ${deal.title}`} className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                            <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="w-24 text-right font-semibold tabular-nums">{fmt(Number(deal.value) || 0)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CartaoDeRelatorio>
      ))}
    </div>
  );
}
