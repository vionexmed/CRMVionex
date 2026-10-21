import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Flame, Pencil, Snowflake, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AtividadeDoNegocio, DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { formatarMoedaInteira, pluralizar } from "@/lib/formato";
import { Iniciais } from "@/components/layout/ListaV1";
import { SeloDeNegocio } from "@/components/crm/SeloDeNegocio";
import {
  AcoesRapidas, AlertaDeAtraso, FatosDoNegocio, TrilhaDeEtapas,
} from "@/components/negocios/ResumoDoNegocio";
import { montarAcoesRapidas, type TipoParaRegistrar } from "@/components/negocios/acoes-rapidas";
import { ReagendarAtividade } from "@/components/negocios/ReagendarAtividade";
import {
  dataCurta, diasNaEtapa, diasParado, etapasEmOrdem, identidadeDoNegocio, proximaAtividade,
  ROTULO_DA_TEMPERATURA, temColunaTemperatura, TEMPERATURAS, temperaturaDe, type Temperatura,
} from "@/components/negocios/sinais";
import { useOrcamentosDoNegocio } from "@/hooks/queries/useOrcamentos";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

const ICONE_DA_TEMPERATURA: Record<Temperatura, typeof Flame> = { quente: Flame, morno: Sun, frio: Snowflake };
const COR_DA_TEMPERATURA: Record<Temperatura, string> = {
  quente: "text-warning", morno: "text-foreground", frio: "text-muted-foreground",
};

/**
 * O painel do negócio ao lado do quadro -- o lado direito da referência.
 *
 * Abre sem sair do funil: a pessoa olha o negócio, marca ganho ou reagenda e
 * segue para o próximo card, sem a ida e volta pela página inteira (que
 * remontava o quadro e perdia a rolagem das colunas). A página do negócio
 * continua a um clique, para a linha do tempo e a edição completa.
 *
 * Tudo aqui sai do que o quadro já carregou -- o negócio com as atividades
 * embutidas e o dono resolvido por `useMembers()` em Deals.tsx (não há FK de
 * `deals` para `profiles`). Abrir o painel não custa consulta nenhuma.
 *
 * Ganho, perda e mudança de etapa chamam os MESMOS fluxos do card e do arraste
 * (`markAsWon`, `openLossModal`, `updateStage`): perder continua pedindo o
 * motivo.
 */
export function PainelDoNegocio({
  deal, etapas, mediaPorEtapa = null, onFechar, onGanho, onPerdido, onMudarEtapa, onTemperatura, onEditar, onEscreverEmail, onRegistrar,
}: {
  deal: DealWithRelations;
  /** Etapas do funil ativo, em qualquer ordem. */
  etapas: Stage[];
  /** Média de dias por etapa nos ganhos do funil (`resumirFunil`). null: omite. */
  mediaPorEtapa?: number | null;
  onFechar: () => void;
  /** Grava `deals.temperatura`. null = "sem classificação". */
  onTemperatura?: (id: string, t: Temperatura | null) => void;
  onGanho: (id: string) => void;
  onPerdido: (id: string) => void;
  onMudarEtapa: (id: string, stageId: string) => void;
  onEditar?: (d: DealWithRelations) => void;
  onEscreverEmail?: (d: DealWithRelations) => void;
  /** Leva à página do negócio com o formulário no tipo escolhido. */
  onRegistrar: (d: DealWithRelations, tipo: TipoParaRegistrar) => void;
}) {
  const [paraReagendar, setParaReagendar] = useState<AtividadeDoNegocio | null>(null);
  const ordenadas = useMemo(() => etapasEmOrdem(etapas), [etapas]);
  const etapa = ordenadas.find((e) => e.id === deal.stage_id) ?? null;
  const id = identidadeDoNegocio(deal);
  const agora = Date.now();
  const proxima = proximaAtividade(deal.atividades, agora);
  const naEtapa = diasNaEtapa(deal, agora);
  const parado = diasParado(deal, agora);
  const aberto = (deal.status ?? "open") === "open";
  const temperatura = temperaturaDe(deal);
  const editaTemperatura = !!onTemperatura && temColunaTemperatura(deal);

  // O subtítulo é o ESCOPO do negócio: o título do orçamento mais recente
  // ("Implantação · 3 unidades"). Sem orçamento, empresa e pessoa.
  const { data: orcamentos } = useOrcamentosDoNegocio(deal.id);
  const escopo = orcamentos?.[0]?.titulo?.trim();
  const subtitulo = escopo || [deal.company?.name !== deal.title ? deal.company?.name : null, id.nomeContato].filter(Boolean).join(" · ");
  // Probabilidade do NEGÓCIO quando alguém a definiu; senão a da etapa, com a
  // origem no `title` -- o número é o mesmo que a coluna mostra.
  const prob = Number(deal.probability) || 0;
  const probEtapa = Number(etapa?.win_probability) || 0;
  const probabilidade = prob > 0 ? `${prob}%`
    : probEtapa > 0 ? <span title="Chance da etapa">{probEtapa}%</span> : "—";

  return (
    <aside aria-label={`Negócio ${deal.title}`}
      className="flex min-h-0 w-full flex-col overflow-y-auto rounded-lg border border-border bg-card shadow-sm">
      <div className="px-[18px] pb-4 pt-[18px]">
        <div className="flex items-start gap-3">
          <Iniciais nome={id.nomeIniciais} forma="empresa" destaque className="h-11 w-11 rounded-lg border-0 text-sm text-primary" />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="vx-titulo-painel truncate">{deal.title}</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {subtitulo || "Sem empresa ou contato"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar painel"
            className="h-8 w-8 shrink-0 bg-muted text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {formatarMoedaInteira(Number(deal.value) || 0, deal.currency || "BRL")}
          </span>
          {!aberto ? <SeloDeNegocio status={deal.status} /> : editaTemperatura ? (
            // A temperatura é a avaliação do vendedor, e o rótulo É o
            // controle: quem lê "Quente" e discorda muda ali mesmo.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Definir temperatura do negócio" title="Temperatura do negócio"
                  className={cn(
                    "-mr-1.5 inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    temperatura ? COR_DA_TEMPERATURA[temperatura] : "text-muted-foreground",
                  )}>
                  {temperatura ? ROTULO_DA_TEMPERATURA[temperatura] : <>Temperatura<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {TEMPERATURAS.map((t) => {
                  const Icone = ICONE_DA_TEMPERATURA[t];
                  return (
                    <DropdownMenuItem key={t} onSelect={() => onTemperatura!(deal.id, t)}>
                      <Icone aria-hidden="true" className={cn("mr-2 h-3.5 w-3.5", COR_DA_TEMPERATURA[t])} />
                      {ROTULO_DA_TEMPERATURA[t]}
                      {temperatura === t && <Check aria-hidden="true" className="ml-auto h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem onSelect={() => onTemperatura!(deal.id, null)}>
                  <span className="mr-2 w-3.5" />Sem classificação
                  {temperatura === null && <Check aria-hidden="true" className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : temperatura && (
            <span className={cn("text-xs font-semibold", COR_DA_TEMPERATURA[temperatura])}>{ROTULO_DA_TEMPERATURA[temperatura]}</span>
          )}
        </div>

        {aberto && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button onClick={() => onGanho(deal.id)} className="h-[38px] min-h-[38px] bg-success text-sm font-semibold text-success-foreground hover:bg-success/90">
              Marcar ganho
            </Button>
            <Button variant="outline" onClick={() => onPerdido(deal.id)}
              className="h-[38px] min-h-[38px] border-destructive/50 text-sm font-semibold text-destructive hover:bg-destructive-soft hover:text-destructive">
              Perdido
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border px-[18px] pb-3.5 pt-3.5">
        {ordenadas.length > 0 && (
          <TrilhaDeEtapas etapas={ordenadas} atualId={deal.stage_id} status={deal.status}
            onEscolher={(stageId) => onMudarEtapa(deal.id, stageId)} />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {naEtapa !== null ? (
            <>
              Na etapa há <span className="font-semibold text-foreground">{naEtapa} {pluralizar(naEtapa, "dia")}</span>
              {mediaPorEtapa !== null && <> · média do funil: {mediaPorEtapa} {pluralizar(mediaPorEtapa, "dia")}</>}
            </>
          ) : (
            <>Último movimento há <span className="font-semibold text-foreground">{parado} {pluralizar(parado, "dia")}</span></>
          )}
        </p>
        <div className="mt-3.5">
          <FatosDoNegocio fatos={[
            { rotulo: "Responsável", valor: deal.owner?.name || "Sem responsável" },
            { rotulo: "Previsão de fechamento", valor: deal.close_date ? dataCurta(deal.close_date, agora) : "—" },
            { rotulo: "Origem", valor: id.origem ?? "—" },
            { rotulo: "Probabilidade", valor: probabilidade },
          ]} />
        </div>
      </div>

      <div className="space-y-3.5 border-t border-border px-[18px] py-4">
        {proxima?.atrasada && (
          <AlertaDeAtraso proxima={proxima} onReagendar={() => setParaReagendar(proxima.atividade)} />
        )}
        <AcoesRapidas acoes={montarAcoesRapidas({
          deal,
          registrar: (tipo) => onRegistrar(deal, tipo),
          escreverEmail: onEscreverEmail ? () => onEscreverEmail(deal) : undefined,
        })} />
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to={`/deals/${deal.id}`}><ArrowUpRight className="h-3.5 w-3.5" />Abrir negócio</Link>
          </Button>
          {onEditar && (
            <Button variant="outline" size="sm" onClick={() => onEditar(deal)}>
              <Pencil className="h-3.5 w-3.5" />Editar
            </Button>
          )}
        </div>
      </div>

      <ReagendarAtividade atividade={paraReagendar} onFechar={() => setParaReagendar(null)} />
    </aside>
  );
}
