/**
 * Visão "Comercial": as métricas de SDR e vendas. Uma linha de cinco
 * indicadores (o selecionado escolhe a série do gráfico), dados diários contra
 * o período anterior, percentual por atendente, produtos e atendentes que mais
 * venderam, e embaixo pendências, funil, canais e desempenho por pessoa.
 */
import { useState } from "react";
import { Plus, TrendingUp, Activity, BarChart3, Trophy, List } from "lucide-react";
import { CartaoDeGrafico, GradeDeIndicadores } from "@/components/padrao";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarNumero } from "@/lib/formato";
import { Secao } from "@/components/layout/Secao";
import { StatCard } from "./StatCard";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { GraficoFunil, GraficoCanais, GraficoPessoas } from "./SdrCharts";
import { Pendencias } from "./PainelLateral";
import { RoscaPorAtendente, RankingEmBarras } from "./RoscaPorAtendente";
import { GROUPS } from "./indicadores";
import { IndicadorDeMetrica, tileDe, type DadosDoPainel } from "./dados-do-painel";
import { useMetricasDeProdutos, useProdutos } from "@/hooks/queries/useProdutos";
import type { MetricKey } from "@/hooks/useSdrMetrics";
import type { PontoSerie, LinhaPessoa } from "@/hooks/useSdrCharts";

/** A linha de indicadores, na ordem da tela. O ícone de cada um segue a leitura dele. */
export const INDICADORES_COMERCIAIS: MetricKey[] = ["leadsRecebidos", "abordagens", "taxaResposta", "oportunidades", "vendasSdr"];

const ICONES: Record<string, React.ReactNode> = {
  leadsRecebidos: <Plus />,
  abordagens: <TrendingUp />,
  taxaResposta: <Activity style={{ color: "hsl(var(--chart-5))" }} />,
  oportunidades: <BarChart3 />,
  vendasSdr: <Trophy />,
};

/**
 * De qual coluna de `sdr_series` cada métrica tira a série diária. Taxa de
 * resposta, oportunidades e vendas ficam de fora de propósito: `respostas`
 * conta MENSAGENS (não leads que responderam) e as outras duas só existem por
 * período -- desenhar uma série ao lado delas poria um número sob outro.
 */
const SERIE: Partial<Record<MetricKey, { coluna: keyof Omit<PontoSerie, "dia">; singular: string; plural: string }>> = {
  leadsRecebidos: { coluna: "leads", singular: "lead", plural: "leads" },
  abordagens: { coluna: "abordagens", singular: "abordagem", plural: "abordagens" },
};

const SEM_SERIE: Partial<Record<MetricKey, string>> = {
  taxaResposta: "A taxa é calculada sobre o período inteiro: a resposta de hoje pode ser de uma abordagem de outro dia, então ela não se divide por dia.",
  oportunidades: "Oportunidade é o negócio que saiu da etapa de entrada. O banco conta isso por período e ainda não tem a série por dia.",
  vendasSdr: "As vendas são contadas por período, pela data de fechamento; o banco ainda não tem a série por dia.",
};

const POR_PESSOA = { leads: "Leads", abordagens: "Abordagens", reunioes: "Reuniões", vendas: "Vendas" } as const;
type PorPessoa = keyof typeof POR_PESSOA;

export function VisaoComercial({
  d, metrica, onMetrica, textoOportunidades,
}: {
  d: DadosDoPainel;
  metrica: MetricKey;
  onMetrica: (k: MetricKey) => void;
  textoOportunidades: string | null;
}) {
  const [porPessoa, setPorPessoa] = useState<PorPessoa>("leads");
  const produtos = useProdutos();
  const metricasDeProdutos = useMetricasDeProdutos();

  const tile = tileDe(metrica);
  const serie = SERIE[metrica];
  const pontos = serie
    ? (d.charts?.serie ?? []).filter((p) => p.dia.slice(0, 10) <= d.hoje).map((p) => ({ dia: p.dia, valor: p[serie.coluna] }))
    : [];
  const anterior = serie && d.serieAnterior && d.comparacao !== "nenhuma" ? d.serieAnterior.map((p) => p[serie.coluna]) : null;
  const r = d.rotulos;

  const pessoas: LinhaPessoa[] | null = d.charts?.pessoas ?? null;
  const fatias = (pessoas ?? []).map((p) => ({ nome: p.pessoa, valor: p[porPessoa] }));
  const nomesDosProdutos = new Map((produtos.data ?? []).map((p) => [p.id, p.nome]));
  const maisVendidos = (metricasDeProdutos.data?.por_produto ?? [])
    .filter((p) => p.vendas_mes > 0)
    .sort((a, b) => b.vendas_mes - a.vendas_mes)
    .slice(0, 5)
    .map((p) => ({ nome: nomesDosProdutos.get(p.produto_id) ?? "Produto", valor: p.vendas_mes }));
  const melhoresAtendentes = (pessoas ?? [])
    .filter((p) => p.vendas > 0)
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, 5)
    .map((p) => ({ nome: p.pessoa, valor: p.vendas }));

  const carregando = d.carregandoCharts;
  const corpo = <Skeleton className="h-48" />;

  return (
    <>
      <GradeDeIndicadores>
        {INDICADORES_COMERCIAIS.map((k) => (
          <IndicadorDeMetrica
            key={k}
            chave={k}
            d={d}
            icone={ICONES[k]}
            rotulo={k === "vendasSdr" ? "Vendas do SDR" : undefined}
            selecionado={k === metrica}
            onClick={() => onMetrica(k)}
            extra={
              k === "oportunidades" ? textoOportunidades
                : k === "abordagens" && d.pessoasAbordadas !== null ? `${formatarNumero(d.pessoasAbordadas)} pessoas`
                : null
            }
          />
        ))}
      </GradeDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CartaoDeGrafico
          titulo="Dados diários"
          subtitulo={`Visualização por quantidade: ${tile.label.toLowerCase()}`}
          acao={
            <div className="flex items-center gap-2">
              {tile.drilldown && (
                <Button variant="ghost" size="sm" onClick={() => d.abrirLista(tile.drilldown!)}>
                  <List aria-hidden />Ver lista
                </Button>
              )}
              <Select value="quantidade">
                <SelectTrigger aria-label="Tipo de valor do gráfico" className="h-8 w-auto gap-2 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="quantidade">Quantidade</SelectItem></SelectContent>
              </Select>
            </div>
          }
        >
          {carregando ? corpo : serie ? (
            <GraficoEvolucao
              embutido
              titulo={`${tile.label} por dia`}
              unidade={{ singular: serie.singular, plural: serie.plural }}
              pontos={pontos}
              anterior={anterior}
              legendaAtual={r.legendaAtual}
              legendaAnterior={r.legendaAnterior}
              rotuloComparacao={r.comparacao}
              projecao={r.emAndamento && r.diasNoPeriodo ? { diasNoPeriodo: r.diasNoPeriodo, nomeDoPeriodo: r.nomeDoPeriodo } : null}
            />
          ) : (
            <p className="mx-auto my-10 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
              {SEM_SERIE[metrica] ?? "Esta métrica não tem série por dia."}
            </p>
          )}
        </CartaoDeGrafico>

        <CartaoDeGrafico
          titulo="Percentual por atendente"
          subtitulo={`Visualização por ${POR_PESSOA[porPessoa].toLowerCase()}`}
          vazio={!carregando && (pessoas === null || fatias.every((f) => f.valor === 0))}
          acao={
            <Select value={porPessoa} onValueChange={(v) => setPorPessoa(v as PorPessoa)}>
              <SelectTrigger aria-label="Medida por atendente" className="h-8 w-auto gap-2 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(POR_PESSOA) as PorPessoa[]).map((k) => <SelectItem key={k} value={k}>{POR_PESSOA[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        >
          {carregando ? corpo : <RoscaPorAtendente fatias={fatias} />}
        </CartaoDeGrafico>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CartaoDeGrafico titulo="Produtos mais vendidos" subtitulo="Orçamentos aprovados neste mês" vazio={!metricasDeProdutos.isLoading && maisVendidos.length === 0}>
          {metricasDeProdutos.isLoading ? corpo : <RankingEmBarras itens={maisVendidos} unidade={["venda", "vendas"]} />}
        </CartaoDeGrafico>
        <CartaoDeGrafico titulo="Atendentes com mais vendas" subtitulo="Negócios ganhos no período" vazio={!carregando && melhoresAtendentes.length === 0}>
          {carregando ? corpo : <RankingEmBarras itens={melhoresAtendentes} unidade={["venda", "vendas"]} />}
        </CartaoDeGrafico>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GraficoFunil dados={d.charts?.funil ?? []} className="lg:col-span-2" />
        <Pendencias aguardando={d.metrics?.aguardandoHumano?.value ?? null} carregandoMetricas={d.carregando} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoCanais dados={d.charts?.canais ?? []} />
        <GraficoPessoas dados={d.charts?.pessoas ?? []} falhou={d.charts?.pessoas === null} />
      </div>

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <Secao key={group.title} titulo={group.title} descricao={group.description}>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="-ml-px -mt-px grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {group.tiles.map((t) =>
                  d.carregando ? (
                    <div key={t.key} className="vx-respiro border-l border-t border-border"><Skeleton className="h-[72px] rounded-none" /></div>
                  ) : (
                    <StatCard
                      key={t.key}
                      label={t.label}
                      value={d.metrics?.[t.key]?.value ?? null}
                      previous={d.metrics?.[t.key]?.previous ?? null}
                      format={t.format}
                      icon={t.icon}
                      accent={t.accent}
                      href={t.href}
                      hint={t.hint}
                      noSource={t.noSource}
                      noComparison={t.noComparison}
                      emFaixa
                    />
                  ),
                )}
              </div>
            </div>
          </Secao>
        ))}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Métricas marcadas como <strong>sem fonte</strong> não têm dado no banco — não são zero,
          são não medidas. Passe o mouse no ícone de informação para ver o que falta gravar.
        </p>
      </div>
    </>
  );
}
