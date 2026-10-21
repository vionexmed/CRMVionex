/**
 * Gráficos do painel de SDR — SVG puro, sem biblioteca de gráfico.
 *
 * O recharts custa 407 kB minificado (1,3 MB em desenvolvimento) e o painel
 * usava dele apenas área, barra, rosca, eixo e tooltip. Os quatro são
 * desenhados à mão; a série diária mora em `GraficoEvolucao.tsx`.
 *
 * Todos recebem dado já agregado pelo banco: nenhum agrupa linha no cliente,
 * porque isso quebraria a privacidade entre pessoas montada no Plano 2.
 *
 * VISUAL 01: cada gráfico é um cartão (`Card`: borda, sem sombra, raio 8px)
 * sobre o fundo da página. A versão anterior empilhava seções chapadas
 * separadas por linha, e com o painel virando duas colunas a linha deixava de
 * dizer onde um bloco termina.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeloComPonto } from "@/components/layout/ListaV1";
import { CHART_COLORS } from "@/components/reports/types";
import { Donut } from "./svg/Donut";
import { maiorPerda } from "./funil";
import type { EtapaFunil, FatiaCanal, LinhaPessoa } from "@/hooks/useSdrCharts";
import { formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

const fmt = (v: number) => formatarNumero(v);

/**
 * Escala do funil: da marca ao verde de venda (`--stage-1`…`--stage-6`).
 *
 * Classe estática por posição, porque o Tailwind só gera o que lê no código --
 * `bg-stage-${i}` não existiria no CSS final.
 */
const COR_DA_ETAPA = ["bg-stage-1", "bg-stage-2", "bg-stage-3", "bg-stage-4", "bg-stage-5", "bg-stage-6"];

function Cabecalho({ titulo, descricao, extra }: { titulo: string; descricao?: string; extra?: ReactNode }) {
  return (
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <CardTitle>{titulo}</CardTitle>
          {descricao && <CardDescription className="max-w-2xl leading-relaxed">{descricao}</CardDescription>}
        </div>
        {extra}
      </div>
    </CardHeader>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-20 items-center border-l-2 border-border pl-4 text-xs text-muted-foreground">
      {texto}
    </div>
  );
}

// ── Funil ────────────────────────────────────────────────────────────────────


export function GraficoFunil({ dados, className }: { dados: EtapaFunil[]; className?: string }) {
  const topo = dados[0]?.total ?? 0;
  const perda = maiorPerda(dados);

  return (
    <Card className={cn("min-w-0", className)}>
      {/* "no período" é a parte que faltava. O funil é de COORTE: conta os
          contatos que ENTRARAM na janela, e mostra até onde eles tinham chegado
          no fim dela -- não onde estão hoje. Sem isso, quem lê supõe uma foto
          do momento. */}
      <Cabecalho
        titulo="Funil de conversão"
        descricao="Dos contatos que entraram no período, até onde chegaram — e a perda entre as etapas"
        extra={topo > 0 && perda && (
          <SeloComPonto tom="perigo" variante="suave" className="whitespace-normal">
            Maior perda: {perda.perda}% entre {perda.de} e {perda.para}
          </SeloComPonto>
        )}
      />
      <CardContent>
        {topo === 0 ? (
          <Vazio texto="Nenhum lead no período." />
        ) : (
          <ol className="space-y-3">
            {dados.map((etapa, i) => {
              const largura = Math.max(1, (etapa.total / topo) * 100);
              const anterior = i > 0 ? dados[i - 1].total : null;
              const conversao = anterior && anterior > 0 ? Math.round((etapa.total / anterior) * 100) : null;
              const ehPerda = perda && perda.para === etapa.etapa;

              return (
                <li key={etapa.etapa} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
                  <span className="truncate text-xs font-medium">{etapa.etapa}</span>
                  {/* Trilho em `bg-surface-2`: `bg-muted` sobre cartão branco é
                      quase invisível no tema claro (ver CLAUDE.md). */}
                  <div className="h-6 overflow-hidden rounded bg-surface-2">
                    <div
                      className={cn("h-full rounded", COR_DA_ETAPA[Math.min(i, COR_DA_ETAPA.length - 1)])}
                      style={{ width: `${largura}%` }}
                    />
                  </div>
                  <span className="flex w-24 items-baseline justify-end gap-2 tabular-nums">
                    <span className="text-sm font-semibold">{fmt(etapa.total)}</span>
                    {conversao !== null && (
                      <span
                        className={cn("text-xs", ehPerda ? "font-semibold text-destructive" : "text-muted-foreground")}
                        title={`${conversao}% avançaram de "${dados[i - 1].etapa}"`}
                      >
                        {conversao}%
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ── Canais ───────────────────────────────────────────────────────────────────
export function GraficoCanais({ dados, className }: { dados: FatiaCanal[]; className?: string }) {
  const total = dados.reduce((s, d) => s + d.total, 0);
  // Enquanto o vocabulário de origem não for unificado (Plano 6), a maior parte
  // dos leads cai em "Não informado" — melhor avisar do que deixar interpretar.
  const naoInformado = dados.find((d) => d.canal === "Não informado")?.total ?? 0;
  const maioriaSemOrigem = total > 0 && naoInformado / total > 0.5;

  return (
    <Card className={cn("min-w-0", className)}>
      <Cabecalho
        titulo="Leads por canal"
        descricao="De onde cada lead chegou"
        extra={maioriaSemOrigem && <Badge variant="warning" className="shrink-0">origem incompleta</Badge>}
      />
      <CardContent>
        {total === 0 ? (
          <Vazio texto="Nenhum lead no período." />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Donut
              formatar={fmt}
              tamanho={144}
              espessura={22}
              fatias={dados.map((d, i) => ({
                nome: d.canal,
                valor: d.total,
                cor: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
            <ul className="min-w-[160px] flex-1 space-y-1.5">
              {dados.slice(0, 6).map((d, i) => (
                <li key={d.canal} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="flex-1 truncate">{d.canal}</span>
                  <span className="font-medium tabular-nums">{fmt(d.total)}</span>
                  <span className="w-9 text-right tabular-nums text-muted-foreground">
                    {Math.round((d.total / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {maioriaSemOrigem && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            A maioria dos leads está sem origem gravada. O número só fica confiável depois de
            padronizar a captação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Desempenho por pessoa ────────────────────────────────────────────────────
/**
 * Tabela, não barras: quatro contagens por pessoa se COMPARAM lendo a coluna,
 * e barras agrupadas de quatro cores obrigavam a ir e voltar na legenda.
 *
 * Visível para todos, não só admin: os eventos que compõem o número de cada
 * pessoa já estão à vista da equipe (ver seguranca/crm-da-organizacao.test).
 */
export function GraficoPessoas({
  dados, falhou = false, className,
}: { dados: LinhaPessoa[]; falhou?: boolean; className?: string }) {
  const comMovimento = dados.filter((d) => d.leads || d.abordagens || d.reunioes || d.vendas);

  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <Cabecalho titulo="Desempenho por pessoa" descricao="Leads recebidos, abordagens, reuniões e vendas no período" />
      {falhou ? (
        <CardContent><Vazio texto="Não foi possível carregar o desempenho por pessoa." /></CardContent>
      ) : comMovimento.length === 0 ? (
        <CardContent><Vazio texto="Nenhuma atividade registrada por pessoa neste período." /></CardContent>
      ) : (
        // Sem respiro: a tabela desenha a própria borda e encosta no cartão.
        <CardContent className="p-0">
          <div className="vx-table overflow-x-auto rounded-none border-x-0 border-b-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {["Pessoa", "Leads", "Abordagens", "Reuniões", "Vendas"].map((label, i) => (
                    <th key={label} className={cn("px-4", i > 0 && "text-right")}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comMovimento.map((p) => (
                  <tr key={p.pessoa}>
                    <td className="min-w-40 px-4 font-medium">{p.pessoa}</td>
                    {[p.leads, p.abordagens, p.reunioes, p.vendas].map((value, i) => (
                      <td key={i} className="px-4 text-right tabular-nums">{fmt(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
