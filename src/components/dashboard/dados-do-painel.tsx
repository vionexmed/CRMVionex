/**
 * O que as três visões do painel compartilham: o pacote de dados já carregado
 * pela página e a montagem de um `CartaoDeIndicador` a partir de uma métrica.
 */
import type { ReactNode } from "react";
import { CartaoDeIndicador } from "@/components/padrao";
import type { SdrPeriod, SdrComparacao, SdrMetrics, MetricKey } from "@/hooks/useSdrMetrics";
import type { SdrCharts } from "@/hooks/useSdrCharts";
import type { MetricDrilldownKey } from "@/hooks/useSdrMetricLeads";
import { formatValue, variation } from "./formato-da-metrica";
import type { RotulosDoPeriodo } from "./periodo-do-painel";
import { GROUPS } from "./indicadores";

export type DadosDoPainel = {
  period: SdrPeriod;
  comparacao: SdrComparacao;
  metrics: SdrMetrics["metrics"] | undefined;
  carregando: boolean;
  /** Pessoas distintas abordadas: toques e gente são coisas diferentes. */
  pessoasAbordadas: number | null;
  charts: SdrCharts | undefined;
  carregandoCharts: boolean;
  serieAnterior: SdrCharts["serie"] | undefined;
  rotulos: RotulosDoPeriodo;
  /** "AAAA-MM-DD" de hoje: corta os dias que ainda não vieram. */
  hoje: string;
  abrirLista: (m: MetricDrilldownKey) => void;
};

const TILES = GROUPS.flatMap((g) => g.tiles);

export const tileDe = (k: MetricKey) => TILES.find((t) => t.key === k)!;

/** Indicador de uma métrica do `sdr_metrics`: valor, variação contra a comparação e dica. */
export function IndicadorDeMetrica({
  chave, d, icone, rotulo, extra, selecionado, onClick,
}: {
  chave: MetricKey;
  d: DadosDoPainel;
  icone: ReactNode;
  rotulo?: string;
  /** Acrescenta ao subtexto (ex.: o valor das oportunidades). */
  extra?: string | null;
  selecionado?: boolean;
  onClick?: () => void;
}) {
  const t = tileDe(chave);
  const m = d.metrics?.[chave];
  const formato = t.format ?? "number";
  const v = t.noSource || t.noComparison ? null : variation(m?.value ?? null, m?.previous, formato);
  const base = t.noSource
    ? "sem fonte de dado"
    : v && d.rotulos.comparacao
      ? `${v.valor > 0 ? "+" : ""}${v.valor}${v.unidade === "%" ? "%" : " p.p."} vs. ${d.rotulos.comparacao}`
      : formato === "number"
        ? "no período"
        : "sobre o período";
  return (
    <CartaoDeIndicador
      rotulo={rotulo ?? t.label}
      valor={d.carregando ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-muted align-middle" /> : t.noSource || m?.value == null ? "—" : formatValue(m.value, formato)}
      subtexto={extra ? `${base.replace(/ vs\..*$/, "")} · ${extra}`.replace(/^no período · /, "") : base}
      icone={icone}
      tom={t.accent === "destructive" ? "perigo" : t.accent === "success" ? "sucesso" : t.accent === "warning" ? "alerta" : "destaque"}
      selecionado={selecionado}
      onClick={onClick}
      info={t.hint}
    />
  );
}
