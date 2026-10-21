/**
 * A coluna da direita do painel: o que espera ação agora.
 *
 * A coluna da esquerda responde "como está indo o período"; esta responde "o
 * que eu faço a seguir". Por isso cada linha de Pendências termina num botão
 * que leva à tela onde a ação acontece -- um número sem caminho obriga a
 * procurar.
 *
 * Só entra linha com fonte no banco (ver usePendencias.ts e useAtendimento.ts).
 * A meta de resposta vem de Configurações > Geral; sem ela, o "meta 15" some
 * em vez de virar um número inventado. As barras por hora são as mensagens
 * recebidas no período, pela hora local.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Iniciais } from "@/components/layout/ListaV1";
import { ATIVIDADE_ICONE, type ActivityType } from "@/lib/atividade-tipos";
import { formatarMoedaInteira, formatarNumero, pluralizar } from "@/lib/formato";
import { DIAS_DE_AVISO, diasParaVencer } from "@/lib/orcamento-resumo";
import { cn } from "@/lib/utils";
import type { MetricValue } from "@/hooks/useSdrMetrics";
import {
  useAtividadesAtrasadas, useNegociosParados, usePropostasVencendo, TETO_PARADOS,
} from "./usePendencias";
import { formatValue } from "./formato-da-metrica";
import {
  NOMES_NA_FILA, tempoDeEspera, useLeadsAguardando, useMensagensPorHora, useMetaResposta,
} from "./useAtendimento";
import type { SdrPeriod } from "@/hooks/useSdrMetrics";


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
    <span className={cn("flex shrink-0", tom === "perigo" ? "-space-x-1" : "-space-x-2")} aria-hidden>
      {icones.map((Icone, i) => (
        <span
          key={i}
          className={cn(
            "flex items-center justify-center ring-2 ring-card",
            // Atrasadas: círculos no tom de perigo. Documentos: o quadrado de
            // arquivo, no tom da marca, com a borda que o separa do vizinho.
            tom === "perigo"
              ? "h-7 w-7 rounded-full bg-destructive-soft text-destructive"
              : "h-8 w-8 rounded-md border border-primary/20 bg-accent text-primary",
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
    <li className="flex items-center gap-3 py-[0.8rem] first:pt-0 last:pb-0">
      {/* Largura fixa para os títulos alinharem entre linhas com 1 e 3 marcas. */}
      <span className="flex w-20 shrink-0">{marca}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalhe}</p>
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
  // A contagem é a do card; esta consulta só traz os rostos e o "espera há".
  const fila = useLeadsAguardando(!!aguardando && aguardando > 0);
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
        marca={
          <span className="flex -space-x-2" aria-hidden>
            {(fila.data ?? []).slice(0, NOMES_NA_FILA).map((l) => (
              <Iniciais key={l.id} nome={l.nome} tamanho="sm" className="ring-2 ring-card" />
            ))}
            {aguardando > Math.min(NOMES_NA_FILA, fila.data?.length ?? 0) && (fila.data?.length ?? 0) > 0 && (
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-label font-semibold text-destructive ring-2 ring-card">
                +{aguardando - Math.min(NOMES_NA_FILA, fila.data!.length)}
              </span>
            )}
          </span>
        }
        titulo={`${formatarNumero(aguardando)} ${pluralizar(aguardando, "lead aguardando", "leads aguardando")}`}
        detalhe={fila.data?.[0]
          ? `O mais antigo espera há ${tempoDeEspera(fila.data[0].desde)}`
          : "Sem nenhuma abordagem registrada"}
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
    // "há 14+ dias": o MENOR tempo parado da lista é o que vale para todos.
    const menorParado = Math.min(...p.map((d) => d.dias));
    const quantos = p.length >= TETO_PARADOS ? `${TETO_PARADOS}+` : formatarNumero(p.length);
    linhas.push(
      <Linha
        key="parados"
        marca={
          <span className="flex -space-x-2">
            {p.slice(0, 3).map((d, i) => (
              <Iniciais key={i} nome={d.titulo} forma="empresa" className="shadow-sm ring-2 ring-card" />
            ))}
          </span>
        }
        titulo={`${quantos} ${pluralizar(p.length, "negócio parado", "negócios parados")}`}
        detalhe={`${soma > 0 ? `${formatarMoedaInteira(soma)} ` : ""}sem atividade há ${Number.isFinite(menorParado) ? menorParado : 7}+ dias`}
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
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-[1.625rem] pt-[calc(var(--respiro)+1px)]">
        <CardTitle className="vx-titulo-painel">Pendências</CardTitle>
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
              <ul>{linhas}</ul>
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

export function AtendimentoAgora({ tempoResposta, aguardando, carregando, period }: {
  tempoResposta: MetricValue | undefined;
  aguardando: number | null;
  carregando: boolean;
  period: SdrPeriod;
}) {
  const tempo = tempoResposta?.value ?? null;
  const meta = useMetaResposta().data ?? null;
  const porHora = useMensagensPorHora(period);

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-4 pt-[calc(var(--respiro)-1px)]">
        <CardTitle className="vx-titulo-painel">Atendimento agora</CardTitle>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-md border border-border bg-surface-2 p-3 pt-3.5">
              <p className="text-xs leading-5 text-muted-foreground">Tempo médio de resposta</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className={cn("text-2xl font-semibold tracking-tight", tempo === null && "text-muted-foreground")}>
                  {tempo === null ? "—" : formatValue(tempo, "duration")}
                </span>
                {/* A meta diz se o número é bom; dentro dela, verde. */}
                {tempo !== null && meta !== null && (
                  <span className={cn("text-xs font-semibold tabular-nums", tempo <= meta ? "text-success" : "text-destructive")}>
                    meta {formatarNumero(meta)}
                  </span>
                )}
              </p>
            </div>
            <div className="min-w-0 rounded-md border border-border bg-surface-2 p-3 pt-3.5">
              <p className="text-xs leading-5 text-muted-foreground">Aguardando agora</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={cn(
                  "text-2xl font-semibold tracking-tight",
                  aguardando === null ? "text-muted-foreground" : aguardando > 0 ? "text-destructive" : "text-foreground",
                )}>
                  {aguardando === null ? "—" : formatarNumero(aguardando)}
                </span>
                {aguardando !== null && <span className="text-xs text-muted-foreground">{pluralizar(aguardando, "lead")}</span>}
              </p>
            </div>
          </div>
        )}
        <BarrasPorHora dados={porHora.data} carregando={porHora.isLoading} falhou={!!porHora.error} />
      </CardContent>
    </Card>
  );
}

/**
 * Mensagens recebidas por hora: quando a fila enche. O pico leva a cor cheia
 * e o rótulo embaixo dele; as outras horas ficam no tom claro da marca.
 */
function BarrasPorHora({ dados, carregando, falhou }: {
  dados: { hora: number; total: number }[] | undefined;
  carregando: boolean;
  falhou: boolean;
}) {
  if (carregando) return <Skeleton className="mt-5 h-16" />;
  if (falhou) return <p className="mt-5 text-xs text-destructive">Não foi possível carregar as mensagens por hora.</p>;
  const lista = dados ?? [];
  const max = Math.max(0, ...lista.map((d) => d.total));
  if (lista.length === 0 || max === 0) {
    return <p className="mt-5 border-l-2 border-border pl-4 text-xs text-muted-foreground">Nenhuma mensagem recebida no período.</p>;
  }
  const iPico = lista.findIndex((d) => d.total === max);
  const fim = lista[lista.length - 1].hora + 1;
  // Posição do rótulo do pico: o centro da barra, em % da largura.
  const centroPico = ((iPico + 0.5) / lista.length) * 100;

  return (
    <figure className="mt-3" aria-label={`Mensagens recebidas por hora; pico às ${lista[iPico].hora}h`}>
      <div className="flex h-[52px] items-end gap-1.5">
        {lista.map((d, i) => (
          <span
            key={d.hora}
            title={`${d.hora}h: ${formatarNumero(d.total)} ${pluralizar(d.total, "mensagem", "mensagens")}`}
            className={cn("flex-1 rounded-t-[2px]", i === iPico ? "bg-primary" : "bg-primary/30")}
            style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="relative mt-3.5 h-4 text-label text-muted-foreground">
        {/* As pontas saem quando o rótulo do pico encostaria nelas. */}
        {iPico > 1 && <span className="absolute left-0">{lista[0].hora}h</span>}
        <span
          className={cn("absolute whitespace-nowrap", iPico === 0 ? "" : iPico === lista.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
          style={{ left: iPico === 0 ? 0 : iPico === lista.length - 1 ? "100%" : `${centroPico}%` }}
        >
          {lista[iPico].hora}h · pico
        </span>
        {iPico < lista.length - 2 && <span className="absolute right-0">{fim}h</span>}
      </figcaption>
    </figure>
  );
}
