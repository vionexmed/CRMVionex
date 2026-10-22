/**
 * Painel (rota /dashboard).
 *
 * Responde pela operação: quanto lead entrou, quantas abordagens saíram, quanto
 * respondeu e quanto virou oportunidade e venda, mais o atendimento e as
 * atividades. Três visões, como no padrão da plataforma: Comercial, Atendimento
 * e Atividades. As métricas medem o funil INDEPENDENTE de quem executa (hoje uma
 * pessoa do comercial, adiante o SDR de IA).
 *
 * Cinco métricas não têm fonte de dado no banco hoje e aparecem marcadas como
 * "sem fonte", nunca com número aproximado (ver SEM_FONTE em useSdrMetrics.ts).
 *
 * Período, comparação, visão e métrica do gráfico moram na URL: o link mandado
 * a um colega abre o mesmo recorte, e F5 não devolve o painel ao padrão.
 */
import { useState } from "react";
import { TriangleAlert, FileDown } from "lucide-react";
import { Pagina, AbasSegmentadas } from "@/components/padrao";
import { Button } from "@/components/ui/button";
import { useAbaNaUrl } from "@/hooks/useAbaNaUrl";
import { useSdrMetrics, SDR_PERIOD_LABELS, type SdrPeriod, type SdrComparacao, type MetricKey } from "@/hooks/useSdrMetrics";
import { useSdrCharts } from "@/hooks/useSdrCharts";
import { useSdrMetricLeads, type MetricDrilldownKey } from "@/hooks/useSdrMetricLeads";
import { MetricLeadsSheet } from "@/components/dashboard/MetricLeadsSheet";
import { useSerieAnterior } from "@/components/dashboard/useSerieAnterior";
import { rotulosDoPeriodo, comparacoesDoPeriodo } from "@/components/dashboard/periodo-do-painel";
import { formatValue, variation } from "@/components/dashboard/formato-da-metrica";
import { GROUPS } from "@/components/dashboard/indicadores";
import { SeletorDoPeriodoDoPainel } from "@/components/dashboard/SeletorDoPeriodoDoPainel";
import { VisaoComercial, INDICADORES_COMERCIAIS } from "@/components/dashboard/VisaoComercial";
import { VisaoAtendimento, VisaoAtividades } from "@/components/dashboard/VisoesDeAtendimentoEAtividades";
import type { DadosDoPainel } from "@/components/dashboard/dados-do-painel";
import { formatarMoedaCurta } from "@/lib/formato";
import { exportarCSV } from "@/lib/csv";
import { mensagemErro } from "@/lib/erro-supabase";

const PERIODS: SdrPeriod[] = ["today", "this_week", "this_month", "last_month", "this_quarter", "this_year", "all"];
const COMPARACOES: SdrComparacao[] = ["anterior", "ano_anterior", "nenhuma"];

type Visao = "comercial" | "atendimento" | "atividades";
const VISOES: Visao[] = ["comercial", "atendimento", "atividades"];
const ABAS = [
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "atendimento", rotulo: "Atendimento" },
  { valor: "atividades", rotulo: "Atividades" },
];

/** Teto da lista de oportunidades somada no "R$ 184 mil". */
const TETO_OPORTUNIDADES = 1000;

/** "AAAA-MM-DD" de hoje no fuso de quem olha, para cortar os dias que não vieram. */
function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [period, setPeriodNaUrl] = useAbaNaUrl<SdrPeriod>("periodo", "this_month", PERIODS);
  const [comparacaoNaUrl, setComparacao] = useAbaNaUrl<SdrComparacao>("comparacao", "anterior", COMPARACOES);
  const [visao, setVisao] = useAbaNaUrl<Visao>("visao", "comercial", VISOES);
  // Comparação que não cabe no período (ex.: "ano anterior" em "Este ano") cai
  // na primeira válida, sem reescrever a URL.
  const opcoesDeComparacao = comparacoesDoPeriodo(period);
  const comparacao = opcoesDeComparacao.includes(comparacaoNaUrl) ? comparacaoNaUrl : opcoesDeComparacao[0];
  const [metricaGrafico, setMetricaGrafico] = useAbaNaUrl<MetricKey>("metrica", "leadsRecebidos", INDICADORES_COMERCIAIS);
  /** Métrica com o painel lateral aberto. Um painel serve todas as listas. */
  const [painelDe, setPainelDe] = useState<MetricDrilldownKey | null>(null);

  const { data, isLoading, error } = useSdrMetrics(period, comparacao);
  const { data: charts, isLoading: loadingCharts } = useSdrCharts(period);
  const { data: serieAnterior } = useSerieAnterior(period, comparacao);
  // O valor das oportunidades sai da MESMA lista que o drill-down mostra --
  // a função sdr_metric_leads usa o critério do card (saiu da etapa de entrada).
  const { data: listaOportunidades } = useSdrMetricLeads("oportunidades", period, TETO_OPORTUNIDADES, true);
  const metrics = data?.metrics;

  const rotulos = rotulosDoPeriodo(period, new Date(), comparacao);
  const hoje = hojeLocal();

  const valorOportunidades = listaOportunidades
    ? listaOportunidades.reduce((s, l) => s + (Number(l.valor) || 0), 0)
    : null;
  // Lista no teto = soma parcial; dizer "R$ X" seria afirmar um total que a
  // tela não tem.
  const textoOportunidades = valorOportunidades && valorOportunidades > 0
    ? `${formatarMoedaCurta(valorOportunidades)}${listaOportunidades!.length >= TETO_OPORTUNIDADES ? "+" : ""}`
    : null;

  /** O CSV é o que a tela mostra: todas as métricas do período, com a comparação. */
  const exportar = () => {
    const intervalo = rotulos.intervalo ? `${SDR_PERIOD_LABELS[period]} (${rotulos.intervalo})` : SDR_PERIOD_LABELS[period];
    exportarCSV(
      GROUPS.flatMap((g) => g.tiles.map((t) => {
        const m = metrics?.[t.key];
        const v = t.noSource ? null : variation(m?.value ?? null, m?.previous, t.format ?? "number");
        return {
          Grupo: g.title,
          "Métrica": t.label,
          "Período": intervalo,
          Valor: t.noSource ? "sem fonte de dado" : m?.value == null ? "" : formatValue(m.value, t.format ?? "number"),
          "Comparação": rotulos.comparacao && !t.noComparison ? rotulos.comparacao : "",
          "Valor na comparação": t.noSource || t.noComparison || m?.previous == null ? "" : formatValue(m.previous, t.format ?? "number"),
          "Variação": v ? `${v.valor > 0 ? "+" : ""}${v.valor}${v.unidade === "%" ? "%" : " p.p."}` : "",
        };
      })),
      `painel-${period}-${hoje}.csv`,
    );
  };

  const dados: DadosDoPainel = {
    period, comparacao, metrics, carregando: isLoading, pessoasAbordadas: data?.pessoasAbordadas ?? null, charts, carregandoCharts: loadingCharts,
    serieAnterior, rotulos, hoje, abrirLista: setPainelDe,
  };

  return (
    <Pagina
      titulo="Painel"
      subtitulo="Visão geral do seu desempenho e atividades"
      acao={<>
        <SeletorDoPeriodoDoPainel
          periodo={period}
          periodos={PERIODS}
          onPeriodo={setPeriodNaUrl}
          comparacao={comparacao}
          comparacoes={opcoesDeComparacao}
          onComparacao={setComparacao}
          rotuloDaComparacao={(c) => (c === "nenhuma" ? "Sem comparação" : `vs. ${rotulosDoPeriodo(period, new Date(), c).comparacao ?? ""}`)}
          intervalo={rotulos.intervalo}
        />
        <Button
          variant="outline"
          className="h-9 border-primary text-primary hover:bg-primary/10 hover:text-primary"
          onClick={exportar}
          disabled={isLoading || !metrics}
          title="Baixar as métricas do período (CSV)"
        >
          <FileDown aria-hidden />Exportar painel
        </Button>
        <AbasSegmentadas abas={ABAS} valor={visao} onChange={(v) => setVisao(v as Visao)} rotulo="Visão do painel" />
      </>}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Não foi possível carregar as métricas: {mensagemErro(error)}</span>
        </div>
      )}

      {visao === "comercial" && (
        <VisaoComercial d={dados} metrica={metricaGrafico} onMetrica={setMetricaGrafico} textoOportunidades={textoOportunidades} />
      )}
      {visao === "atendimento" && <VisaoAtendimento d={dados} />}
      {visao === "atividades" && <VisaoAtividades d={dados} />}

      <MetricLeadsSheet
        metric={painelDe}
        period={period}
        total={painelDe ? (metrics?.[painelDe]?.value ?? null) : null}
        onClose={() => setPainelDe(null)}
      />
    </Pagina>
  );
}
