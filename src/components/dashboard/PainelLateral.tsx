/**
 * A coluna da direita do painel: o que espera ação agora.
 *
 * A coluna da esquerda responde "como está indo o período"; esta responde "o
 * que eu faço a seguir". Por isso cada linha de Pendências termina num botão
 * que leva à tela onde a ação acontece -- um número sem caminho obriga a
 * procurar.
 *
 * Só entra linha com fonte no banco (ver usePendencias.ts). A referência visual
 * tinha também "tempo médio vs. meta" e barras por hora no Atendimento: não há
 * meta de tempo de resposta gravada nem agregação por hora, então ficaram fora
 * em vez de virar número inventado.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { FileText, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Iniciais } from "@/components/layout/ListaV1";
import { ATIVIDADE_ICONE, type ActivityType } from "@/lib/atividade-tipos";
import { formatarMoedaCurta, formatarNumero, pluralizar } from "@/lib/formato";
import { DIAS_DE_AVISO, diasParaVencer } from "@/lib/orcamento-resumo";
import { cn } from "@/lib/utils";
import type { MetricValue } from "@/hooks/useSdrMetrics";
import {
  useAtividadesAtrasadas, useNegociosParados, usePropostasVencendo, TETO_PARADOS,
} from "./usePendencias";
import { formatValue, variation } from "./formato-da-metrica";

/** Plural por tipo: "ligação" não vira "ligaçãos". */
const TIPO_PLURAL: Record<ActivityType, [string, string]> = {
  call: ["ligação", "ligações"],
  email: ["e-mail", "e-mails"],
  meeting: ["reunião", "reuniões"],
  note: ["nota", "notas"],
  task: ["tarefa", "tarefas"],
  orcamento: ["orçamento", "orçamentos"],
};

/** Ícones sobrepostos, no lugar das iniciais quando a pendência não tem pessoa. */
function PilhaDeIcones({ icones, tom }: { icones: LucideIcon[]; tom: "perigo" | "marca" }) {
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {icones.map((Icone, i) => (
        <span
          key={i}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-card",
            tom === "perigo" ? "bg-destructive-soft text-destructive" : "bg-accent text-accent-foreground",
          )}
        >
          <Icone className="h-3.5 w-3.5" />
        </span>
      ))}
    </span>
  );
}

function Linha({ marca, titulo, detalhe, acao, onAcao, principal = false }: {
  marca: ReactNode;
  titulo: string;
  detalhe: string;
  acao: string;
  onAcao: () => void;
  principal?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {/* Largura fixa para os títulos alinharem entre linhas com 1 e 3 marcas. */}
      <span className="flex w-20 shrink-0">{marca}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{titulo}</p>
        <p className="text-xs leading-snug text-muted-foreground">{detalhe}</p>
      </div>
      <Button size="sm" variant={principal ? "default" : "outline"} onClick={onAcao} className="shrink-0">
        {acao}
      </Button>
    </li>
  );
}

function quandoVence(dias: number | null, quantas: number): string {
  const verbo = quantas === 1 ? "vence" : "vencem";
  if (dias === 0) return `${verbo} hoje`;
  if (dias === 1) return `${verbo} amanhã`;
  return `${verbo} em até ${dias ?? DIAS_DE_AVISO} dias`;
}

export function Pendencias({ aguardando, carregandoMetricas }: {
  /** `aguardandoHumano` do sdr_metrics: leads sem nenhuma abordagem. */
  aguardando: number | null;
  carregandoMetricas: boolean;
}) {
  const navigate = useNavigate();
  const atividades = useAtividadesAtrasadas();
  const parados = useNegociosParados();
  const propostas = usePropostasVencendo();

  const carregando = carregandoMetricas || atividades.isLoading || parados.isLoading || propostas.isLoading;
  const falhas = [
    atividades.error && "atividades atrasadas",
    parados.error && "negócios parados",
    propostas.error && "propostas a vencer",
  ].filter(Boolean) as string[];

  const linhas: ReactNode[] = [];

  if (aguardando && aguardando > 0) {
    linhas.push(
      <Linha
        key="aguardando"
        principal
        marca={<PilhaDeIcones icones={[Hourglass]} tom="marca" />}
        titulo={`${formatarNumero(aguardando)} ${pluralizar(aguardando, "lead aguardando", "leads aguardando")}`}
        detalhe="Sem nenhuma abordagem registrada"
        acao="Atender"
        onAcao={() => navigate("/contacts?estagio=lead")}
      />,
    );
  }

  const a = atividades.data;
  if (a && a.total > 0) {
    const tipos = a.porTipo
      ? (Object.entries(a.porTipo) as [ActivityType, number][]).sort((x, y) => y[1] - x[1])
      : [];
    linhas.push(
      <Linha
        key="atividades"
        marca={<PilhaDeIcones tom="perigo" icones={tipos.slice(0, 3).map(([t]) => ATIVIDADE_ICONE[t])} />}
        titulo={`${formatarNumero(a.total)} ${pluralizar(a.total, "atividade atrasada", "atividades atrasadas")}`}
        detalhe={tipos.length > 0
          ? tipos.map(([t, n]) => `${n} ${TIPO_PLURAL[t][n === 1 ? 0 : 1]}`).join(", ")
          : "Prazo vencido e ainda não concluídas"}
        acao="Ver"
        onAcao={() => navigate("/activities")}
      />,
    );
  }

  const p = parados.data;
  if (p && p.length > 0) {
    const soma = p.reduce((s, d) => s + d.valor, 0);
    const quantos = p.length >= TETO_PARADOS ? `${TETO_PARADOS}+` : formatarNumero(p.length);
    linhas.push(
      <Linha
        key="parados"
        marca={
          <span className="flex -space-x-1.5">
            {p.slice(0, 3).map((d, i) => (
              <Iniciais key={i} nome={d.contato} className="ring-2 ring-card" />
            ))}
          </span>
        }
        titulo={`${quantos} ${pluralizar(p.length, "negócio parado", "negócios parados")}`}
        detalhe={`${soma > 0 ? `${formatarMoedaCurta(soma)} ` : ""}sem atividade há 7+ dias`}
        acao="Revisar"
        onAcao={() => navigate("/deals")}
      />,
    );
  }

  const o = propostas.data;
  if (o && o.length > 0) {
    const maisCedo = diasParaVencer(o[0].validoAte);
    const nomes = o.slice(0, 2).map((x) => x.nome).join(" · ") + (o.length > 2 ? ` +${o.length - 2}` : "");
    linhas.push(
      <Linha
        key="propostas"
        marca={<PilhaDeIcones tom="marca" icones={o.slice(0, 2).map(() => FileText)} />}
        titulo={`${formatarNumero(o.length)} ${pluralizar(o.length, "proposta", "propostas")} ${quandoVence(maisCedo, o.length)}`}
        detalhe={nomes}
        acao="Abrir"
        onAcao={() => navigate("/orcamentos")}
      />,
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Pendências</CardTitle>
        {!carregando && linhas.length > 0 && (
          <span className="text-xs font-semibold text-destructive">
            {linhas.length} {pluralizar(linhas.length, "pendência")}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="space-y-3" aria-label="Carregando pendências">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <>
            {linhas.length > 0 ? (
              <ul className="divide-y divide-border">{linhas}</ul>
            ) : (
              falhas.length < 3 && (
                <p className="border-l-2 border-border py-2 pl-4 text-xs text-muted-foreground">
                  Nada esperando ação agora.
                </p>
              )
            )}
            {/* A falha é dita, não escondida: "nada pendente" com uma consulta
                caída seria afirmar o que a tela não sabe. */}
            {falhas.length > 0 && (
              <p className="mt-3 text-xs text-destructive">
                Não foi possível verificar: {falhas.join(", ")}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AtendimentoAgora({ tempoResposta, aguardando, carregando }: {
  tempoResposta: MetricValue | undefined;
  aguardando: number | null;
  carregando: boolean;
}) {
  const tempo = tempoResposta?.value ?? null;
  const delta = variation(tempo, tempoResposta?.previous, "duration");

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Atendimento agora</CardTitle>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-md border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", tempo === null && "text-muted-foreground")}>
                  {tempo === null ? "—" : formatValue(tempo, "duration")}
                </span>
                {/* Cair é bom: menos tempo esperando a primeira resposta. */}
                {delta !== null && delta.valor !== 0 && (
                  <span className={cn("text-xs font-semibold tabular-nums", delta.valor < 0 ? "text-success" : "text-destructive")}>
                    {delta.valor < 0 ? "▼" : "▲"} {Math.abs(delta.valor)}%
                    <span className="sr-only"> em relação ao período anterior</span>
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tempo === null ? "sem resposta medida no período" : "por WhatsApp, no período"}
              </p>
            </div>
            <div className="min-w-0 rounded-md border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Aguardando agora</p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className={cn(
                  "text-2xl font-semibold tabular-nums tracking-tight",
                  aguardando === null ? "text-muted-foreground" : aguardando > 0 ? "text-destructive" : "text-foreground",
                )}>
                  {aguardando === null ? "—" : formatarNumero(aguardando)}
                </span>
                {aguardando !== null && <span className="text-xs text-muted-foreground">{pluralizar(aguardando, "lead")}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">sem nenhuma abordagem</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
