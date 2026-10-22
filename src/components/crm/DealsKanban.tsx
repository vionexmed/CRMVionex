import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Plus, Trophy, XCircle, MoreHorizontal, Pencil, Eye, Mail, Calendar, Flame, Sun, Snowflake, Settings2, Check, X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import type { DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { formatarMoeda, formatarMoedaInteira, pluralizar } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { ColunaKanban, NovaColuna, type CorDaEtapa } from "@/components/padrao";
import {
  diasSemAvancar, etapasEmOrdem, proximaAtividade, rotuloDaProxima,
  ROTULO_DA_TEMPERATURA, temperaturaDe, type Temperatura,
} from "@/components/negocios/sinais";
import { AvatarDaPessoa } from "@/components/negocios/AvatarDaPessoa";


type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

/** A partir de quantos dias sem movimento o card mostra os dias parado. */
const DIAS_PARADO_ALERTA = 7;
/** A partir daqui, sem nada agendado, o card diz "Parado" -- o mesmo 14 da faixa. */
const DIAS_PARADO_CRITICO = 14;

/**
 * Cor da faixa da coluna pela POSIÇÃO no funil, como no padrão da plataforma:
 * a entrada é cinza (ainda não andou), as do meio são a cor de destaque (em
 * andamento) e a última é verde (perto de fechar). Por token, nunca pelo hex de
 * `pipeline_stages.color` -- a cor de destaque é trocável em tempo de execução
 * e o hex gravado não tem versão para o tema escuro.
 */
function corDaColuna(indice: number, total: number): CorDaEtapa {
  if (indice === 0) return "cinza";
  if (indice === total - 1) return "verde";
  return "azul";
}

/* ── Deal Card ───────────────────────────────────────────── */

/** Ícone e cor de cada temperatura. Ícone lucide, nunca emoji: emoji muda de desenho por sistema. */
const VISUAL_DA_TEMPERATURA: Record<Temperatura, { Icone: typeof Flame; cor: string }> = {
  quente: { Icone: Flame, cor: "text-warning" },
  morno: { Icone: Sun, cor: "text-foreground" },
  frio: { Icone: Snowflake, cor: "text-muted-foreground" },
};

/** "Dra. Paula Ramos": só tratamento conhecido entra -- `title` também guarda cargo. */
const TRATAMENTO = /^(dra?|sra?|prof|profa)\.?$/i;

/**
 * O card do quadro, no padrão da plataforma: branco, sombra suave, sem borda.
 * Título em negrito, pessoa · empresa, valor com a TEMPERATURA em ícone à
 * direita, e a linha da PRÓXIMA ATIVIDADE com os dias parado e as iniciais do
 * responsável.
 *
 * Os dias aparecem a partir de 7 sem avançar de etapa (`diasSemAvancar`, o
 * mesmo critério do filtro "Parados há 7+ dias"): em vermelho quando nada está
 * agendado, porque aí ninguém vai mexer; neutros quando há algo marcado.
 *
 * Seleção em lote e o menu `…` (abrir, editar, e-mail, agendar) aparecem no
 * canto ao passar o mouse ou ao focar. Marcado, a caixa fica à vista.
 *
 * `memo` porque o quadro renderiza CONTINUAMENTE durante o arraste -- o dnd-kit
 * atualiza a posição a cada movimento do ponteiro. Sem isso, mover um card
 * renderiza os duzentos. Só funciona com props estáveis, e é por isso que o
 * clique recebe `onDealClick` + `deal` em vez de uma arrow inline.
 */
const DealCard = memo(function DealCard({
  deal,
  selecionado,
  aberto,
  agora,
  tom,
  onDealClick,
  onContactClick,
  onEditDeal,
  onComposeEmail,
  onAbrirPagina,
  onAlternarSelecao,
}: {
  deal: DealWithRelations;
  /** Marcado na seleção em lote. A mesma que a lista usa. */
  selecionado: boolean;
  /** É o negócio aberto no painel lateral. */
  aberto: boolean;
  /** Relógio do quadro, para todos os cards medirem atraso pelo mesmo instante. */
  agora: number;
  /** Tom das iniciais do responsável (`tonsDaEquipe`). */
  tom?: string;
  onDealClick: (d: DealWithRelations) => void;
  /** Abre o painel da PESSOA, sem sair do quadro. */
  onContactClick?: (contact: Contact) => void;
  /** Abre o formulário de edição. Ausente: o item some do menu. */
  onEditDeal?: (d: DealWithRelations) => void;
  /** Abre o compositor do CRM já endereçado. Ausente: o item fica apagado. */
  onComposeEmail?: (d: DealWithRelations) => void;
  /** Vai direto à página do negócio (agenda, linha do tempo). */
  onAbrirPagina?: (d: DealWithRelations) => void;
  /** Ausente: a caixa de seleção não aparece -- não há barra que a receba. */
  onAlternarSelecao?: (id: string) => void;
}) {
  // O clone visual do drag é o DragOverlay — o card original só fica translúcido
  // (aplicar transform aqui fazia DOIS cards se moverem ao mesmo tempo)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  const style = isDragging ? { opacity: 0.4 } : undefined;

  const nome = deal.contact
    ? `${deal.contact.first_name} ${deal.contact.last_name || ""}`.trim()
    : null;
  const tratamento = deal.contact?.title?.trim() && TRATAMENTO.test(deal.contact.title.trim())
    ? deal.contact.title.trim()
    : null;

  // O nome sai do subtítulo quando o título JÁ É ele: os negócios criados pelo
  // gatilho de entrada se chamam pelo nome da pessoa. Idem a empresa.
  const nomeContato = nome && nome !== deal.title ? nome : null;
  const empresa = deal.company?.name && deal.company.name !== deal.title ? deal.company.name : null;

  const proxima = proximaAtividade(deal.atividades, agora);
  const parado = diasSemAvancar(deal, agora);
  const temperatura = temperaturaDe(deal);
  const visualTemp = temperatura ? VISUAL_DA_TEMPERATURA[temperatura] : null;

  // Um arraste abortado não pode engolir o clique seguinte, e soltar um card não
  // pode abrir painel. Mesmo padrão de ContactsKanbanByOwner.
  const arrastou = useRef(false);
  useEffect(() => {
    if (isDragging) arrastou.current = true;
  }, [isDragging]);

  const email = deal.contact?.email?.trim() || null;

  // Nos DOIS eventos de ponteiro, e no teclado: sem o `onPointerDown`, o
  // dnd-kit começa a arrastar o card a partir do controle e o clique nunca
  // acontece; sem o `onKeyDown`, Enter no controle iniciaria o arraste por
  // teclado do card inteiro.
  const isolar = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("vx-deal-card group relative p-3", selecionado && "vx-deal-card--marcado", aberto && "border-primary ring-1 ring-primary")}
      aria-current={aberto ? "true" : undefined}
      onPointerDown={(e) => {
        arrastou.current = false;
        listeners?.onPointerDown?.(e);
      }}
      onClick={() => {
        if (arrastou.current) {
          arrastou.current = false;
          return;
        }
        onDealClick(deal);
      }}
    >
      <p className="truncate pr-6 text-sm font-semibold leading-snug text-foreground">{deal.title}</p>
      {(nomeContato || empresa) && (
        <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
          {nomeContato && (
            onContactClick && deal.contact ? (
              <button
                type="button"
                {...isolar}
                // stopPropagation senão o clique sobe para o card e abre o
                // negócio -- os dois painéis abririam no mesmo clique.
                onClick={(e) => {
                  e.stopPropagation();
                  if (arrastou.current) return;
                  onContactClick(deal.contact!);
                }}
                className="hover:text-foreground hover:underline"
              >
                {tratamento ? `${tratamento} ${nomeContato}` : nomeContato}
              </button>
            ) : (tratamento ? `${tratamento} ${nomeContato}` : nomeContato)
          )}
          {nomeContato && empresa && " · "}
          {empresa}
        </p>
      )}

      {/*
        CAIXA DE SELEÇÃO e MENU no canto, por cima do card, à vista no hover e
        no foco. `opacity` e não `hidden`: escondido por display, o Tab não
        chegaria neles.
      */}
      <div className={cn(
        "absolute right-1.5 top-1.5 flex items-center rounded-md bg-card opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
        selecionado && "opacity-100",
      )}>
        {onAlternarSelecao && (
          <span {...isolar} className="flex h-8 w-7 items-center justify-center">
            <Checkbox
              checked={selecionado}
              onCheckedChange={() => onAlternarSelecao(deal.id)}
              aria-label={`Selecionar ${deal.title}`}
            />
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" {...isolar} aria-label={`Ações de ${deal.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          {/* O menu é portal, mas evento sintético do React sobe pela árvore
              de COMPONENTES: sem isolar aqui, escolher um item também
              "clicaria" o card e abriria o negócio. */}
          <DropdownMenuContent align="end" {...isolar}>
            <DropdownMenuItem onSelect={() => (onAbrirPagina ?? onDealClick)(deal)}>
              <Eye className="mr-2 h-3.5 w-3.5" />Abrir negócio
            </DropdownMenuItem>
            {onEditDeal && (
              <DropdownMenuItem onSelect={() => onEditDeal(deal)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />Editar
              </DropdownMenuItem>
            )}
            {/* Abre o compositor do CRM, e não o envio pelo cliente de e-mail:
                o envio passa pela conta conectada e vira histórico do negócio. */}
            <DropdownMenuItem disabled={!email || !onComposeEmail} onSelect={() => onComposeEmail?.(deal)}>
              <Mail className="mr-2 h-3.5 w-3.5" />
              {!email ? "Sem e-mail no contato" : "Escrever e-mail"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => (onAbrirPagina ?? onDealClick)(deal)}>
              <Calendar className="mr-2 h-3.5 w-3.5" />Agendar atividade
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-bold tabular-nums text-foreground">
          {formatarMoedaInteira(Number(deal.value) || 0, deal.currency || "BRL")}
        </span>
        {visualTemp && temperatura && (
          <span title={ROTULO_DA_TEMPERATURA[temperatura]} className={cn("inline-flex shrink-0 items-center", visualTemp.cor)}>
            <visualTemp.Icone aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">{ROTULO_DA_TEMPERATURA[temperatura]}</span>
          </span>
        )}
      </div>

      {/* PRÓXIMA ATIVIDADE, DIAS e RESPONSÁVEL. */}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span aria-hidden="true" className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          proxima?.atrasada ? "bg-destructive" : proxima ? "bg-primary" : "bg-muted-foreground/50",
        )} />
        <span className={cn(
          "min-w-0 flex-1 truncate",
          proxima?.atrasada ? "font-medium text-destructive" : proxima ? "text-foreground" : "text-muted-foreground",
        )}>
          {proxima ? rotuloDaProxima(proxima, agora) : "Sem atividade"}
        </span>
        {parado >= DIAS_PARADO_ALERTA && (
          <span title="Dias sem avançar de etapa" className={cn(
            "shrink-0 font-semibold tabular-nums",
            proxima ? "text-muted-foreground" : "text-destructive",
          )}>
            {!proxima && parado >= DIAS_PARADO_CRITICO && "Parado "}{parado} {pluralizar(parado, "dia")}
          </span>
        )}
        {deal.owner?.name ? (
          <span title={`Responsável: ${deal.owner.name}`} className="shrink-0">
            <AvatarDaPessoa nome={deal.owner.name} tom={tom} />
          </span>
        ) : <span aria-hidden="true" className="h-6 w-0" />}
      </div>
    </div>
  );
});

/* ── Stage Column ────────────────────────────────────────── */

function StageColumn({
  stage,
  indice,
  totalEtapas,
  deals,
  selecionados,
  abertoId,
  agora,
  tons,
  linkConfigurarEtapas,
  onDealClick,
  onContactClick,
  onAddDeal,
  onEditDeal,
  onComposeEmail,
  onAbrirPagina,
  onAlternarSelecao,
}: {
  stage: Stage;
  indice: number;
  totalEtapas: number;
  deals: DealWithRelations[];
  selecionados: Set<string>;
  abertoId: string | null;
  agora: number;
  tons?: Map<string, string>;
  linkConfigurarEtapas?: string;
  onDealClick: (d: DealWithRelations) => void;
  onContactClick?: (contact: Contact) => void;
  onAddDeal: (stageId: string) => void;
  onEditDeal?: (d: DealWithRelations) => void;
  onComposeEmail?: (d: DealWithRelations) => void;
  onAbrirPagina?: (d: DealWithRelations) => void;
  onAlternarSelecao?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const prob = Number(stage.win_probability) || 0;

  return (
    <ColunaKanban
      cor={corDaColuna(indice, totalEtapas)}
      titulo={stage.name}
      valor={<span title={prob > 0 ? `Chance de ganho da etapa: ${prob}%` : undefined}>{formatarMoeda(total)}</span>}
      quantidade={deals.length}
      className="h-full w-[312px] shrink-0"
      corpoRef={setNodeRef}
      // Realce de soltura por COR, nunca por escala/filtro: transform num
      // ancestral do card faz o DragOverlay fugir do cursor (CLAUDE.md).
      corpoClassName={cn("flex flex-col gap-3 pt-1 transition-colors", isOver && "bg-accent")}
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Opções da etapa ${stage.name}`}
              className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {prob > 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chance de ganho: {prob}%</DropdownMenuLabel>}
            <DropdownMenuItem onSelect={() => onAddDeal(stage.id)}>
              <Plus className="mr-2 h-3.5 w-3.5" />Novo negócio nesta etapa
            </DropdownMenuItem>
            {linkConfigurarEtapas && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={linkConfigurarEtapas}><Settings2 className="mr-2 h-3.5 w-3.5" />Configurar etapas</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      rodape={
        <button
          type="button"
          onClick={() => onAddDeal(stage.id)}
          className="flex h-9 w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />Novo negócio
        </button>
      }
    >
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          selecionado={selecionados.has(deal.id)}
          aberto={deal.id === abertoId}
          agora={agora}
          tom={deal.owner_id ? tons?.get(deal.owner_id) : undefined}
          onDealClick={onDealClick}
          onContactClick={onContactClick}
          onEditDeal={onEditDeal}
          onComposeEmail={onComposeEmail}
          onAbrirPagina={onAbrirPagina}
          onAlternarSelecao={onAlternarSelecao}
        />
      ))}
    </ColunaKanban>
  );
}

/* ── Nova coluna (admin) ─────────────────────────────────── */

/** "+ Nova coluna": vira um campo de nome no lugar, e Enter cria a etapa no fim do funil. */
function CriarEtapa({ onCriar }: { onCriar: (nome: string) => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!editando) return <NovaColuna className="h-9" onClick={() => setEditando(true)} />;

  const confirmar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    try {
      await onCriar(limpo);
      setNome("");
      setEditando(false);
    } catch {
      // A página já avisou do erro; o campo fica aberto para tentar de novo.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      className="flex items-center gap-1 rounded-lg bg-card p-1 shadow-card"
      onSubmit={(e) => { e.preventDefault(); void confirmar(); }}
    >
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setEditando(false); }}
        placeholder="Nome da etapa"
        aria-label="Nome da nova etapa"
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button type="submit" disabled={!nome.trim() || salvando} aria-label="Criar etapa"
        className="flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-accent disabled:opacity-40">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

/* ── Won/Lost Drop Zones ─────────────────────────────────── */

function WonLostDropZone({
  id,
  label,
  icon: Icon,
  color,
  visivel,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  /** Só à vista durante o arraste; montada sempre, para o dnd-kit medi-la. */
  visivel: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      aria-hidden={!visivel}
      // Só cor no realce. Havia um `scale-105` aqui -- e escala é transform,
      // que num ancestral vira bloco de contenção do DragOverlay (CLAUDE.md).
      // `invisible` (visibility) e não `hidden`: a zona mantém a caixa medida.
      className={cn(
        "flex h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
        isOver ? "border-primary bg-accent" : "border-border bg-card",
        !visivel && "invisible",
      )}
    >
      <Icon className={`h-5 w-5 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

/* ── Main Kanban ─────────────────────────────────────────── */

interface DealsKanbanProps {
  deals: DealWithRelations[];
  /** Tom das iniciais de cada responsável (`tonsDaEquipe`). */
  tons?: Map<string, string>;
  stages: Stage[];
  onDragEnd: (dealId: string, newStageId: string) => void;
  onDealClick: (deal: DealWithRelations) => void;
  /** Clique no nome da pessoa: abre o painel dela sem sair do quadro. */
  onContactClick?: (contact: Contact) => void;
  onAddDeal: (stageId?: string) => void;
  /** Abre o formulário de edição a partir do card. Ausente: o item some do menu. */
  onEditDeal?: (deal: DealWithRelations) => void;
  /** Abre o compositor de e-mail do CRM a partir do card. */
  onComposeEmail?: (deal: DealWithRelations) => void;
  /** "Abrir negócio" do menu do card: sempre a página, mesmo com painel. */
  onOpenPage?: (deal: DealWithRelations) => void;
  /** O negócio aberto no painel lateral, para o card ganhar o realce. */
  openDealId?: string | null;
  /**
   * A MESMA seleção da visão de lista, e é o que faz a caixa do card valer algo.
   * Sem estas duas props a caixa não aparece -- não há barra para receber o clique.
   */
  selectedDeals?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  onMarkWon: (dealId: string) => void;
  onMarkLost: (dealId: string) => void;
  /** Cria uma etapa no fim do funil. Ausente (não admin): sem "+ Nova coluna". */
  onNovaEtapa?: (nome: string) => Promise<void>;
  /** Para onde leva "Configurar etapas" no "…" da coluna. Ausente: o item some. */
  linkConfigurarEtapas?: string;
}

export function DealsKanban({
  deals, tons, stages, onDragEnd, onDealClick, onContactClick, onAddDeal, onEditDeal, onMarkWon, onMarkLost,
  onComposeEmail, onOpenPage, openDealId = null, selectedDeals, onSelectionChange, onNovaEtapa, linkConfigurarEtapas,
}: DealsKanbanProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);

  // Um relógio só para o quadro, e não `Date.now()` em cada card: dois cards
  // renderizados com milissegundos de diferença não podem discordar sobre
  // "atrasada hoje". Anda de minuto em minuto -- e não a cada render, o que
  // daria prop nova a todo card em cada movimento do arraste e quebraria o
  // `memo`. O minuto também faz a reunião das 15h virar "atrasada" sozinha.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Estável para o `memo` do card: uma arrow inline aqui teria identidade nova a
  // cada render do quadro e faria os duzentos cards renderizarem de novo.
  const alternarSelecao = useCallback((id: string) => {
    if (!onSelectionChange || !selectedDeals) return;
    const proxima = new Set(selectedDeals);
    if (proxima.has(id)) proxima.delete(id);
    else proxima.add(id);
    onSelectionChange(proxima);
  }, [selectedDeals, onSelectionChange]);

  const semSelecao = useMemo(() => new Set<string>(), []);
  const ordenadas = useMemo(() => etapasEmOrdem(stages), [stages]);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = active.id as string;
    const overId = over.id as string;

    if (overId === "won-drop") {
      onMarkWon(dealId);
    } else if (overId === "lost-drop") {
      onMarkLost(dealId);
    } else if (dealId !== overId) {
      onDragEnd(dealId, overId);
    }
  };

  // Chegar aqui significa uma coisa só: o funil existe e está SEM ETAPAS. Os
  // casos de "carregando", "falhou" e "nenhum funil" são resolvidos em Deals.tsx.
  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-card py-20 shadow-card">
        <div className="text-center">
          <p className="text-muted-foreground">Este funil não tem etapas</p>
          <p className="text-sm text-muted-foreground">Vá em Configurações → Funis e etapas para adicionar</p>
        </div>
      </div>
    );
  }

  const arrastando = activeDeal !== null;

  return (
    // `min-h-0` em cada nível até a coluna: sem ele a altura para de descer no
    // primeiro flex e a coluna volta a crescer em vez de rolar.
    <div className="flex min-h-0 flex-1 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDeal(null)}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {ordenadas.map((stage, i) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              indice={i}
              totalEtapas={ordenadas.length}
              deals={deals.filter((d) => d.stage_id === stage.id)}
              selecionados={selectedDeals ?? semSelecao}
              abertoId={openDealId}
              agora={agora}
              tons={tons}
              linkConfigurarEtapas={linkConfigurarEtapas}
              onDealClick={onDealClick}
              onContactClick={onContactClick}
              onAddDeal={onAddDeal}
              onEditDeal={onEditDeal}
              onComposeEmail={onComposeEmail}
              onAbrirPagina={onOpenPage}
              onAlternarSelecao={onSelectionChange ? alternarSelecao : undefined}
            />
          ))}

          {/* "+ Nova coluna" (admin) e, durante o arraste, as zonas Ganho/Perdido. */}
          <div className="flex w-64 shrink-0 flex-col gap-3">
            {onNovaEtapa && <CriarEtapa onCriar={onNovaEtapa} />}
            <WonLostDropZone id="won-drop" label="Ganho" icon={Trophy} color="text-success" visivel={arrastando} />
            <WonLostDropZone id="lost-drop" label="Perdido" icon={XCircle} color="text-destructive" visivel={arrastando} />
          </div>
        </div>

        {/*
          PORTAL PARA O <body>, e é a proteção que importa.

          `.vx-page` anima `transform`, e um ancestral com transform vira bloco
          de contenção para `position: fixed` -- o overlay passava a se
          posicionar em relação ao <main> e fugia do cursor pela largura da
          lateral. No <body> não há ancestral nenhum para conter. Mesmo padrão de
          ContactsKanbanByOwner.
        */}
        {createPortal(
          <DragOverlay>
            {activeDeal && (
              // A largura da coluna com o mesmo respiro lateral do corpo
              // (`px-3`): o clone sai do tamanho exato do card.
              <div className="w-[312px] px-3">
                <div className="rounded-lg bg-card p-3 shadow-pop ring-1 ring-primary">
                  <p className="truncate text-sm font-semibold">{activeDeal.title}</p>
                  <p className="mt-2 text-sm font-bold tabular-nums text-foreground">
                    {formatarMoedaInteira(Number(activeDeal.value) || 0, activeDeal.currency || "BRL")}
                  </p>
                </div>
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

    </div>
  );
}
