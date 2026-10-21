/**
 * Painel de SDR.
 *
 * Responde pela operação de prospecção: quanto lead entrou, quantas abordagens
 * saíram, quanto respondeu, e quanto disso virou reunião, oportunidade e venda.
 * As métricas medem o funil INDEPENDENTE de quem executa — hoje uma pessoa do
 * comercial, adiante o SDR de IA — para a tela não precisar ser reescrita.
 *
 * Cinco métricas não têm fonte de dado no banco hoje e aparecem marcadas como
 * "sem fonte", nunca com número aproximado. Ver SEM_FONTE em useSdrMetrics.ts.
 *
 * Os KPIs de vendas que ficavam aqui (receita, win rate, ticket, ciclo, meta,
 * negócios em risco) seguem disponíveis em Relatórios.
 *
 * VISUAL 01: um cartão principal com a faixa dos quatro números e, embaixo, a
 * métrica escolhida dia a dia contra a comparação; ao lado, o que espera ação;
 * embaixo, o funil. Período, comparação e métrica moram na URL: o link mandado
 * a um colega abre o mesmo recorte, e F5 não devolve o painel ao padrão.
 *
 * As abas (Visão geral / Indicadores / Assistente) saíram: a referência não
 * tem, e a trilha da barra superior já diz "Visão geral". Os indicadores
 * completos continuam na mesma página, depois do funil; o Assistente era um
 * "em breve" sem função, e botão que promete e não entrega não volta.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { UserPlus, MessageCircle, Instagram, Globe, Linkedin, Send, CheckCheck, Reply, MessagesSquare, CalendarCheck, Briefcase, Trophy, Sparkles, Timer, Hourglass, UserCheck, TriangleAlert, CalendarDays, List, Download } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard, type StatAccent, type StatFormat } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAbaNaUrl } from "@/hooks/useAbaNaUrl";
import {
  useSdrMetrics, SDR_PERIOD_LABELS,
  type SdrPeriod, type SdrComparacao, type MetricKey,
} from "@/hooks/useSdrMetrics";
import { useSdrCharts, type PontoSerie } from "@/hooks/useSdrCharts";
import { useSdrMetricLeads, type MetricDrilldownKey } from "@/hooks/useSdrMetricLeads";
import { MetricDrilldown } from "@/components/dashboard/MetricDrilldown";
import { MetricLeadsSheet } from "@/components/dashboard/MetricLeadsSheet";
// Import ESTÁTICO: os gráficos são SVG puro, sem biblioteca. Não há peso a
// postergar, então carregar sob demanda só adicionava uma espera.
import SdrChartsPanel from "@/components/dashboard/SdrChartsPanel";
import { Pendencias, AtendimentoAgora } from "@/components/dashboard/PainelLateral";
import { useSerieAnterior } from "@/components/dashboard/useSerieAnterior";
import { rotulosDoPeriodo, comparacoesDoPeriodo } from "@/components/dashboard/periodo-do-painel";
import { formatValue, variation } from "@/components/dashboard/formato-da-metrica";
import { formatarMoedaCurta } from "@/lib/formato";
import { exportarCSV } from "@/lib/csv";
import { mensagemErro } from "@/lib/erro-supabase";
import { Secao } from "@/components/layout/Secao";

type TileConfig = {
  key: MetricKey;
  label: string;
  /** Rótulo na faixa de destaque, onde o espaço é de um quarto de cartão. */
  rotuloCurto?: string;
  icon: LucideIcon;
  accent?: StatAccent;
  format?: StatFormat;
  href?: string;
  hint?: string;
  noSource?: boolean;
  noComparison?: boolean;
  /** Métrica com lista por trás do número. Ver useSdrMetricLeads. */
  drilldown?: MetricDrilldownKey;
};

type Group = { title: string; description: string; tiles: TileConfig[] };

const GROUPS: Group[] = [
  {
    title: "Entrada",
    description: "De onde e quanto lead está chegando",
    tiles: [
      {
        key: "leadsRecebidos", label: "Leads recebidos", icon: UserPlus, accent: "primary", href: "/contacts?estagio=lead", drilldown: "leadsRecebidos",
        hint: "Contatos criados no período. Conta por data de criação, não por status — a qualificação sobrescreve lead → prospect e apagaria o histórico.",
      },
      {
        key: "leadsWhatsapp", label: "Leads WhatsApp", icon: MessageCircle, accent: "success", href: "/contacts?estagio=lead",
        hint: "Leads criados no período que nos escreveram por WhatsApp. Derivado das mensagens recebidas — o webhook não grava a origem no contato.",
      },
      {
        key: "leadsInstagram", label: "Leads Instagram", icon: Instagram, noSource: true,
        hint: "Sem fonte: nada no sistema grava Instagram como origem. A classificação atual agrupa Instagram dentro de \"Meta Ads\", e a integração de anúncios não cria contato.",
      },
      {
        key: "leadsGoogle", label: "Leads Google", icon: Globe, noSource: true,
        hint: "Sem fonte: não existe integração com Google Ads, e nenhuma entrada garante utm_source=google.",
      },
      {
        key: "leadsLinkedin", label: "Leads LinkedIn", icon: Linkedin, noSource: true,
        hint: "Sem fonte: o campo de LinkedIn no contato é o perfil dele, não a origem do lead. Não há integração nem valor de origem para LinkedIn.",
      },
    ],
  },
  {
    title: "Abordagem",
    description: "O que saiu para o lead e o que voltou",
    tiles: [
      {
        key: "abordagens", label: "Abordagens realizadas", rotuloCurto: "Abordagens", icon: Send, accent: "primary", href: "/activities", drilldown: "abordagens",
        hint: "Tentativas de contato que de fato saíram: ligação e e-mail registrados como concluídos, e-mail enviado pelo CRM, e WhatsApp aceito pela Meta. REUNIÃO NÃO ENTRA — ela é o resultado de abordar, não a abordagem, e tem card próprio. Agendada e não feita não conta, e tentativa que falhou também não.",
      },
      {
        key: "taxaEntrega", label: "Taxa de entrega", icon: CheckCheck, accent: "success", format: "percent",
        hint: "Mensagens de WhatsApp entregues ou lidas sobre o total enviado, pelos callbacks da Meta. Cobre só WhatsApp: e-mail não tem captura de bounce, e envio que falha é apagado do registro.",
      },
      {
        key: "taxaResposta", label: "Taxa de resposta", icon: Reply, accent: "success", format: "percent", drilldown: "taxaResposta",
        hint: "Leads que responderam depois de serem abordados, sobre os abordados no período — por WhatsApp. Resposta que chega fora da janela do período não é contada.",
      },
      {
        key: "conversasIniciadas", label: "Conversas iniciadas", icon: MessagesSquare, accent: "primary", href: "/atendimento?canal=whatsapp",
        hint: "Contatos distintos com pelo menos uma mensagem de WhatsApp no período. Não existe entidade de conversa no banco — é derivado por contato.",
      },
    ],
  },
  {
    title: "Conversão",
    description: "O que a abordagem produziu",
    tiles: [
      {
        key: "reunioes", label: "Reuniões geradas", icon: CalendarCheck, accent: "primary", href: "/activities",
        hint: "Reuniões concluídas no período, pela data da conclusão. Depende de alguém registrar: nada cria reunião automaticamente e não há integração de agenda.",
      },
      {
        key: "oportunidades", label: "Oportunidades geradas", rotuloCurto: "Oportunidades", icon: Briefcase, accent: "primary", href: "/deals", drilldown: "oportunidades",
        hint: "Negócios que SAÍRAM da etapa de entrada. Como todo contato passa a entrar no funil automaticamente, estar nele é o padrão — o feito é ter avançado. Estar no funil não conta como oportunidade.",
      },
      {
        key: "vendasSdr", label: "Vendas originadas pelo SDR", icon: Trophy, accent: "success", href: "/deals",
        hint: "Negócios ganhos com contato vinculado, pela data de fechamento. É aproximação: o negócio não guarda quem o originou, e ganho sem data de fechamento não entra.",
      },
      {
        key: "qualificadosIA", label: "Leads qualificados pela IA", icon: Sparkles, noSource: true,
        hint: "Sem fonte: a qualificação existe, mas só é disparada por clique humano. As funções de IA do CRM devolvem texto e não gravam nada — falta registrar quem qualificou.",
      },
    ],
  },
  {
    title: "Operação",
    description: "Velocidade e fila de atendimento",
    tiles: [
      {
        key: "tempoRespostaMin", label: "Tempo médio de resposta", icon: Timer, accent: "warning", format: "duration",
        hint: "Do momento em que o lead escreve até a nossa primeira resposta, por WhatsApp. É a única fonte com direção e horário de servidor confiáveis. Cair é bom.",
      },
      {
        key: "aguardandoHumano", label: "Aguardando atendimento", icon: Hourglass, accent: "destructive", href: "/contacts?estagio=lead", noComparison: true,
        hint: "Leads sem nenhuma abordagem registrada: nenhuma atividade, nenhum e-mail, nenhuma mensagem. É a fila do momento, por isso não compara com o período anterior.",
      },
      {
        key: "transferidosHumano", label: "Transferidos para humano", icon: UserCheck, noSource: true,
        hint: "Sem fonte: não existe registro de passagem de bastão. Os campos que serviriam para isso foram removidos do banco numa migração anterior.",
      },
    ],
  },
];

const PERIODS: SdrPeriod[] = ["today", "this_week", "this_month", "last_month", "this_quarter", "this_year", "all"];

/** Métricas em destaque na faixa superior — o que se olha primeiro. */
const DESTAQUE: MetricKey[] = ["leadsRecebidos", "abordagens", "taxaResposta", "oportunidades"];

/**
 * De qual coluna de `sdr_series` cada métrica da faixa tira a série diária.
 *
 * Taxa de resposta e oportunidades ficam de fora de propósito. `respostas` na
 * série conta MENSAGENS recebidas, não leads que responderam sobre os
 * abordados -- desenhá-la embaixo do card de taxa poria um número sob outro. E
 * oportunidade (negócio que saiu da etapa de entrada) não tem série por dia.
 */
const SERIE_DA_METRICA: Partial<Record<MetricKey, { coluna: keyof Omit<PontoSerie, "dia">; titulo: string; singular: string; plural: string }>> = {
  leadsRecebidos: { coluna: "leads", titulo: "Leads por dia", singular: "lead", plural: "leads" },
  abordagens: { coluna: "abordagens", titulo: "Abordagens por dia", singular: "abordagem", plural: "abordagens" },
};

/** Por que a métrica escolhida não tem gráfico diário. Dito, não escondido. */
const SEM_SERIE: Partial<Record<MetricKey, string>> = {
  taxaResposta: "A taxa é calculada sobre o período inteiro: a resposta de hoje pode ser de uma abordagem de outro dia, então ela não se divide por dia.",
  oportunidades: "Oportunidade é o negócio que saiu da etapa de entrada. O banco conta isso por período e ainda não tem a série por dia.",
};

const COMPARACOES: SdrComparacao[] = ["anterior", "ano_anterior", "nenhuma"];

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
  // Comparação que não cabe no período (ex.: "ano anterior" em "Este ano") cai
  // na primeira válida, sem reescrever a URL.
  const opcoesDeComparacao = comparacoesDoPeriodo(period);
  const comparacao = opcoesDeComparacao.includes(comparacaoNaUrl) ? comparacaoNaUrl : opcoesDeComparacao[0];
  const [metricaGrafico, setMetricaGrafico] = useAbaNaUrl<MetricKey>("metrica", "leadsRecebidos", DESTAQUE);
  /** Métrica com o painel lateral aberto. Um painel serve os quatro tiles. */
  const [painelDe, setPainelDe] = useState<MetricDrilldownKey | null>(null);

  const { data, isLoading, error } = useSdrMetrics(period, comparacao);
  const { data: charts, isLoading: loadingCharts } = useSdrCharts(period);
  const { data: serieAnterior } = useSerieAnterior(period, comparacao);
  // O valor das oportunidades sai da MESMA lista que o drill-down mostra --
  // a função sdr_metric_leads usa o critério do card (saiu da etapa de entrada).
  const { data: listaOportunidades } = useSdrMetricLeads("oportunidades", period, TETO_OPORTUNIDADES, true);
  const metrics = data?.metrics;
  const pessoasAbordadas = data?.pessoasAbordadas ?? null;
  const aguardando = metrics?.aguardandoHumano?.value ?? null;

  const rotulos = rotulosDoPeriodo(period, new Date(), comparacao);

  const valorOportunidades = listaOportunidades
    ? listaOportunidades.reduce((s, l) => s + (Number(l.valor) || 0), 0)
    : null;
  // Lista no teto = soma parcial; dizer "R$ X" seria afirmar um total que a
  // tela não tem.
  const textoOportunidades = valorOportunidades && valorOportunidades > 0
    ? `${formatarMoedaCurta(valorOportunidades)}${listaOportunidades!.length >= TETO_OPORTUNIDADES ? "+" : ""}`
    : null;

  const tiles = GROUPS.flatMap((g) => g.tiles);
  const tilesDestaque = DESTAQUE
    .map((k) => tiles.find((t) => t.key === k))
    .filter((t): t is TileConfig => !!t);
  const tileDoGrafico = tilesDestaque.find((t) => t.key === metricaGrafico) ?? tilesDestaque[0];

  // A série do banco vai até o fim do período, com zero nos dias que ainda não
  // vieram. Desenhados, eles leriam como queda no fim do mês.
  const serie = SERIE_DA_METRICA[tileDoGrafico.key];
  const hoje = hojeLocal();
  const pontos = serie
    ? (charts?.serie ?? []).filter((p) => p.dia.slice(0, 10) <= hoje).map((p) => ({ dia: p.dia, valor: p[serie.coluna] }))
    : [];
  const anterior = serie && serieAnterior && comparacao !== "nenhuma" ? serieAnterior.map((p) => p[serie.coluna]) : null;

  const verLista = (tile: TileConfig) =>
    tile.drilldown ? (
      <Button variant="ghost" size="sm" onClick={() => setPainelDe(tile.drilldown!)}>
        <List aria-hidden />Ver lista
      </Button>
    ) : null;

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

  return (
    <PageShell
      title="Painel"
      className="space-y-5"
      actions={<>
          {/* Período e comparação num controle só, como na referência. */}
          <div className="flex h-10 min-w-0 items-stretch rounded-md border border-input bg-card shadow-sm">
            <Select value={period} onValueChange={(v) => setPeriodNaUrl(v as SdrPeriod)}>
              <SelectTrigger aria-label="Período do painel" className="h-full w-auto gap-2 border-0 bg-transparent pl-3 pr-3 font-semibold shadow-none">
                <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                <SelectValue>
                  {SDR_PERIOD_LABELS[period]}
                  {rotulos.intervalo && <span className="ml-2 font-normal text-muted-foreground">{rotulos.intervalo}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>{SDR_PERIOD_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span aria-hidden className="my-2 w-px bg-border" />
            <Select value={comparacao} onValueChange={(v) => setComparacao(v as SdrComparacao)}>
              <SelectTrigger aria-label="Comparar com" className="h-full w-auto gap-2 border-0 bg-transparent pl-3 pr-3 shadow-none">
                <SelectValue>{rotulos.comparacao ? `vs. ${rotulos.comparacao}` : "Sem comparação"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {opcoesDeComparacao.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "nenhuma"
                      ? "Sem comparação"
                      : `vs. ${rotulosDoPeriodo(period, new Date(), c).comparacao ?? ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shadow-sm"
            // 40px, a altura do seletor ao lado (o `size="icon"` usa a do controle).
            style={{ height: 40, width: 40 }}
            onClick={exportar}
            disabled={isLoading || !metrics}
            aria-label="Baixar métricas do período (CSV)"
            title="Baixar métricas do período (CSV)"
          >
            <Download />
          </Button>
        </>}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Não foi possível carregar as métricas: {mensagemErro(error)}</span>
        </div>
      )}
      {/* O respiro do painel é um degrau acima do padrão (20px, como na
          referência) só na densidade normal: compacto e confortável continuam
          mandando. */}
      <div className="space-y-8 [[data-density=normal]_&]:[--respiro:1.25rem]">
          <SdrChartsPanel
            charts={charts}
            carregando={loadingCharts}
            faixa={
              // `-mt-px`: a borda de cima da faixa fica sob a do cartão (que
              // recorta com overflow-hidden). Sem isso o topo teria linha dupla.
              <div className="vx-metrics-strip -mt-px">
              <div className="-ml-px -mt-px grid grid-cols-2 lg:grid-cols-4">
                {tilesDestaque.map((tile) =>
                  isLoading ? (
                    <div key={tile.key} className="border-l border-t border-border vx-respiro">
                      <Skeleton className="h-16 rounded-none" />
                    </div>
                  ) : (
                    <StatCard
                      emFaixa
                      emphasis
                      key={tile.key}
                      ativo={tile.key === tileDoGrafico.key}
                      label={tile.rotuloCurto ?? tile.label}
                      value={metrics?.[tile.key]?.value ?? null}
                      previous={metrics?.[tile.key]?.previous ?? null}
                      format={tile.format}
                      icon={tile.icon}
                      hint={tile.hint}
                      // Toques E pessoas em abordagens: é a única métrica onde a
                      // diferença entre evento e gente confunde. Em
                      // oportunidades, quanto elas valem.
                      secundario={
                        tile.key === "abordagens"
                          ? { valor: pessoasAbordadas, rotulo: "pessoas" }
                          : tile.key === "oportunidades"
                            ? { texto: textoOportunidades }
                            : undefined
                      }
                      // Clicar escolhe a métrica do gráfico -- a faixa é a barra
                      // de abas dele. A lista por trás do número continua a um
                      // passo: prévia no hover do valor.
                      onCardClick={() => setMetricaGrafico(tile.key)}
                      drilldown={
                        tile.drilldown
                          ? (valor) => (
                              <MetricDrilldown
                                metric={tile.drilldown!}
                                period={period}
                                total={metrics?.[tile.key]?.value ?? null}
                                onVerTodos={() => setPainelDe(tile.drilldown!)}
                              >
                                {valor}
                              </MetricDrilldown>
                            )
                          : undefined
                      }
                    />
                  ),
                )}
              </div>
              </div>
            }
            evolucao={serie ? {
              titulo: `${serie.titulo} · ${rotulos.intervaloPorExtenso ?? ""}`,
              unidade: { singular: serie.singular, plural: serie.plural },
              pontos,
              anterior,
              legendaAtual: rotulos.legendaAtual,
              legendaAnterior: rotulos.legendaAnterior,
              rotuloComparacao: rotulos.comparacao,
              projecao: rotulos.emAndamento && rotulos.diasNoPeriodo
                ? { diasNoPeriodo: rotulos.diasNoPeriodo, nomeDoPeriodo: rotulos.nomeDoPeriodo }
                : null,
            } : null}
            semSerie={
              <div className="vx-respiro">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{tileDoGrafico.label}</p>
                  {verLista(tileDoGrafico)}
                </div>
                <p className="mt-4 max-w-xl border-l-2 border-border pl-4 text-xs leading-relaxed text-muted-foreground">
                  {SEM_SERIE[tileDoGrafico.key] ?? "Esta métrica não tem série por dia."}
                </p>
              </div>
            }
            lateral={<>
              <Pendencias aguardando={aguardando} carregandoMetricas={isLoading} />
              <AtendimentoAgora
                tempoResposta={metrics?.tempoRespostaMin}
                aguardando={aguardando}
                carregando={isLoading}
                period={period}
              />
            </>}
          />

          <MetricLeadsSheet
            metric={painelDe}
            period={period}
            total={painelDe ? (metrics?.[painelDe]?.value ?? null) : null}
            onClose={() => setPainelDe(null)}
          />

        {/* Todos os indicadores, abaixo do que se olha primeiro. Eram uma aba;
            sem abas, vêm depois do funil, agrupados como antes. */}
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <Secao key={group.title} titulo={group.title} descricao={group.description}>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="-ml-px -mt-px grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {group.tiles.map((tile) =>
                  isLoading ? (
                    /* O esqueleto leva as MESMAS bordas da célula real, e é
                       quadrado. Sem isso a grade nascia sem divisória nenhuma e
                       saltava para a grade de fio de cabelo ao carregar -- duas
                       telas diferentes para o mesmo conteúdo. */
                    <div key={tile.key} className="border-l border-t border-border vx-respiro">
                      <Skeleton className="h-[72px] rounded-none" />
                    </div>
                  ) : (
                    <StatCard
                      key={tile.key}
                      label={tile.label}
                      value={metrics?.[tile.key]?.value ?? null}
                      previous={metrics?.[tile.key]?.previous ?? null}
                      format={tile.format}
                      icon={tile.icon}
                      accent={tile.accent}
                      href={tile.href}
                      hint={tile.hint}
                      noSource={tile.noSource}
                      noComparison={tile.noComparison}
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
      </div>
    </PageShell>
  );
}
