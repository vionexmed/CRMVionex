import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { formatarMoeda, formatarMoedaInteira } from "@/lib/formato";
import { FaixaDeIndicadores, Indicador, Iniciais } from "@/components/layout/ListaV1";
import { indexarPorId } from "@/lib/utils";
import {
  FAIXAS_PREVISAO, calcularPrevisao, totaisDaPrevisao,
} from "@/lib/previsao";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];


interface DealsForecastProps {
  deals: DealWithRelations[];
  stages: Stage[];
}

export function DealsForecast({ deals, stages }: DealsForecastProps) {
  // O cálculo mora em `lib/previsao`. Era duplicado aqui e em
  // `reports/ForecastReport`, com os mesmos limiares e nomes diferentes para a
  // mesma coisa -- "Comprometido" aqui, "Pessimista" lá.
  //
  // Sem `meses`: esta aba mostra todos os meses em que há negócio. O relatório
  // pede uma janela de 3.
  const buckets = useMemo(() => calcularPrevisao(deals), [deals]);
  const totals = useMemo(() => totaisDaPrevisao(buckets), [buckets]);

  const porEtapa = useMemo(() => indexarPorId(stages), [stages]);

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-20">
        <p className="text-muted-foreground">Nenhum negócio aberto para previsão</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Os rótulos e limiares vêm de FAIXAS_PREVISAO, a mesma lista que o
          relatório usa -- é o que impede as duas telas de voltarem a chamar o
          mesmo número por nomes diferentes. Uma faixa de indicadores só, como
          no resto do V1: cinco cartões soltos disputavam com os meses abaixo. */}
      <FaixaDeIndicadores>
        {FAIXAS_PREVISAO.map((faixa) => (
          <Indicador
            key={faixa.chave}
            rotulo={faixa.rotulo}
            valor={<span className={faixa.cor}>{formatarMoedaInteira(totals[faixa.chave])}</span>}
            apoio={`probabilidade ≥ ${faixa.minimo}%`}
          />
        ))}
        <Indicador rotulo="Valor em aberto" valor={formatarMoedaInteira(totals.pipeline)} apoio="soma dos negócios abertos" />
      </FaixaDeIndicadores>

      {/* Monthly breakdown */}
      <div className="space-y-3">
        {buckets.map((bucket) => (
          <Card key={bucket.chave}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="capitalize">{bucket.rotulo}</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">Comprometido</span>
                    <span className="font-semibold tabular-nums text-success">{formatarMoeda(bucket.comprometido)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Provável</span>
                    <span className="font-semibold tabular-nums text-primary">{formatarMoeda(bucket.provavel)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span className="text-muted-foreground">Em aberto</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatarMoeda(bucket.pipeline)}</span>
                  </div>
                </div>
              </div>

              {/* Barra empilhada: comprometido, depois o resto do provável. */}
              <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {bucket.pipeline > 0 && (
                  <>
                    <div className="h-full bg-success" style={{ width: `${(bucket.comprometido / bucket.pipeline) * 100}%` }} />
                    <div className="h-full bg-primary" style={{ width: `${((bucket.provavel - bucket.comprometido) / bucket.pipeline) * 100}%` }} />
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                {bucket.negocios.map((deal) => {
                  const stageName = (deal.stage_id && porEtapa.get(deal.stage_id)?.name) || "—";
                  return (
                    <div key={deal.id} className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Iniciais nome={deal.company?.name || deal.title} forma={deal.company ? "empresa" : "pessoa"} tamanho="sm" />
                        <span className="truncate font-medium">{deal.title}</span>
                        {deal.company && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{deal.company.name}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="neutral">{stageName}</Badge>
                        <Badge variant="info" className="tabular-nums">{deal.probability || 0}%</Badge>
                        <span className="w-28 text-right font-semibold tabular-nums text-foreground">
                          {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
