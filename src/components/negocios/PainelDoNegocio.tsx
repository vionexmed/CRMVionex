import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AtividadeDoNegocio, DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { Iniciais } from "@/components/layout/ListaV1";
import { SeloDeNegocio } from "@/components/crm/SeloDeNegocio";
import {
  AcoesRapidas, AlertaDeAtraso, FatosDoNegocio, TrilhaDeEtapas,
} from "@/components/negocios/ResumoDoNegocio";
import { montarAcoesRapidas, type TipoParaRegistrar } from "@/components/negocios/acoes-rapidas";
import { ReagendarAtividade } from "@/components/negocios/ReagendarAtividade";
import {
  diasParado, etapasEmOrdem, identidadeDoNegocio, proximaAtividade, rotuloDaProxima,
} from "@/components/negocios/sinais";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

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
  deal, etapas, onFechar, onGanho, onPerdido, onMudarEtapa, onEditar, onEscreverEmail, onRegistrar,
}: {
  deal: DealWithRelations;
  /** Etapas do funil ativo, em qualquer ordem. */
  etapas: Stage[];
  onFechar: () => void;
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
  const parado = diasParado(deal, agora);
  const aberto = (deal.status ?? "open") === "open";

  const subtitulo = [deal.company?.name, id.nomeContato].filter(Boolean).join(" · ");
  // Probabilidade do NEGÓCIO quando alguém a definiu; senão a da etapa, dita
  // como tal -- "40%" sem dizer de onde viria parecer uma estimativa sobre
  // este cliente.
  const prob = Number(deal.probability) || 0;
  const probEtapa = Number(etapa?.win_probability) || 0;
  const probabilidade = prob > 0 ? `${prob}%` : probEtapa > 0 ? `${probEtapa}% (da etapa)` : "—";

  return (
    <aside aria-label={`Negócio ${deal.title}`}
      className="flex min-h-0 w-full flex-col overflow-y-auto rounded-lg border border-border bg-card">
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Iniciais nome={id.nomeIniciais} forma={id.forma} tamanho="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="vx-titulo-painel truncate">{deal.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {subtitulo || "Sem empresa ou contato"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar painel" className="-mr-1 -mt-1 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
          </span>
          {!aberto && <SeloDeNegocio status={deal.status} />}
        </div>

        {aberto && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onGanho(deal.id)} className="bg-success text-success-foreground hover:bg-success/90">
              Marcar ganho
            </Button>
            <Button variant="outline" onClick={() => onPerdido(deal.id)}
              className="border-destructive/40 text-destructive hover:bg-destructive-soft">
              Perdido
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-border p-4">
        {ordenadas.length > 0 && (
          <TrilhaDeEtapas etapas={ordenadas} atualId={deal.stage_id} status={deal.status}
            onEscolher={(stageId) => onMudarEtapa(deal.id, stageId)} />
        )}
        <p className="text-xs text-muted-foreground">
          {proxima && !proxima.atrasada
            ? <>Próxima: <span className="font-medium text-foreground">{rotuloDaProxima(proxima, agora)}</span></>
            : <>Último movimento há <span className="font-semibold text-foreground">{parado}</span> {parado === 1 ? "dia" : "dias"}</>}
        </p>
        <FatosDoNegocio fatos={[
          { rotulo: "Responsável", valor: deal.owner?.name || "Sem responsável" },
          { rotulo: "Previsão de fechamento", valor: deal.close_date ? formatarData(deal.close_date) : "—" },
          { rotulo: "Origem", valor: id.origem ?? "—" },
          { rotulo: "Probabilidade", valor: probabilidade },
        ]} />
      </div>

      <div className="space-y-3 border-t border-border p-4">
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
