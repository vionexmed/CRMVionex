import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Plus, Trophy, XCircle, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Eye, Mail, Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import type { DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { formatarDataCurta, formatarMoeda, formatarMoedaInteira, formatarNumero, pluralizar } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Iniciais } from "@/components/layout/ListaV1";
import { getContactOrigin } from "@/lib/contact-options";
import {
  corDaEtapa, diasParado, etapasEmOrdem, proximaAtividade, rotuloDaProxima,
} from "@/components/negocios/sinais";


type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

/** A partir de quantos dias sem movimento o card pinta o "parado" de vermelho. */
const DIAS_PARADO_ALERTA = 7;

/* ── Deal Card ───────────────────────────────────────────── */

/**
 * O card do quadro, no desenho do Visual 01: iniciais da empresa, título,
 * pessoa · origem, valor grande, divisória e a linha da PRÓXIMA ATIVIDADE com
 * o responsável à direita.
 *
 * A linha de baixo voltou a ler `atividades` (que `dealsApi.list` já embute):
 * "Ligação seg, 09:00", "Reunião atrasada 2 dias" em vermelho, ou "Sem
 * atividade" com os dias parado. É a pergunta que o vendedor faz a cada card --
 * "o que eu tenho que fazer aqui?" -- e o valor sozinho não responde.
 *
 * Os quatro botões redondos (abrir, editar, e-mail, agenda) viraram um menu
 * `…`: a referência não tem fileira de ações no card, e tirar as ações de vez
 * levaria embora a única porta para EDITAR o negócio a partir do quadro.
 *
 * Sem marcador de temperatura ("Quente/Morno/Frio"): não existe coluna para
 * isso, e inventar a partir de outra coisa seria um número sem fonte.
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

  // Empresa e pessoa: o nome da pessoa é clicável e abre o painel dela.
  const nome = deal.contact
    ? `${deal.contact.first_name} ${deal.contact.last_name || ""}`.trim()
    : null;

  // O nome sai do subtítulo quando o título JÁ É ele.
  //
  // Os negócios criados pelo gatilho de entrada se chamam pelo nome da pessoa
  // (antes era "Lead: <nome>", prefixo removido em 20260827120000). Sem esta
  // linha, o card mostra o mesmo nome duas vezes seguidas.
  const nomeContato = nome && nome !== deal.title ? nome : null;
  const origem = deal.contact
    ? getContactOrigin(deal.contact.metadata as Record<string, unknown> | null).label
    : null;

  const proxima = proximaAtividade(deal.atividades, agora);
  const parado = diasParado(deal, agora);

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
      className={cn("vx-deal-card", selecionado && "vx-deal-card--marcado", aberto && "border-primary ring-1 ring-primary")}
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
      <div className="flex items-start gap-2.5">
        <Iniciais nome={deal.company?.name || nome || deal.title} forma={deal.company ? "empresa" : "pessoa"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug text-foreground">{deal.title}</p>
          {(deal.company || nomeContato || origem) && (
            <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
              {nomeContato ? (
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
                    className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    {nomeContato}
                  </button>
                ) : nomeContato
              ) : deal.company?.name}
              {(nomeContato || deal.company) && origem && " · "}
              {origem}
            </p>
          )}
        </div>
        {/*
          CAIXA DE SELEÇÃO e MENU no canto, juntos.

          A caixa alimenta a MESMA seleção da visão de lista -- marcar aqui e
          trocar para lista mantém a marcação, e a barra de ações em lote
          aparece igual.
        */}
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {onAlternarSelecao && (
            <span {...isolar} className="flex h-8 w-6 items-center justify-center">
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
              {/* Abre o compositor do CRM, e não o `mailto:`: o envio passa pela
                  conta conectada e vira histórico do negócio. */}
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
      </div>

      <div className="mt-2.5 flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate text-lg font-bold tabular-nums tracking-tight text-foreground">
          {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
        </span>
        {deal.close_date && (
          <span className="shrink-0 text-xs text-muted-foreground" title="Previsão de fechamento">
            {formatarDataCurta(deal.close_date)}
          </span>
        )}
      </div>

      {/*
        PRÓXIMA ATIVIDADE e RESPONSÁVEL, abaixo da divisória.

        A divisória sangra até a borda com margem negativa: `-mx-3.5` cancela os
        14px de padding de `.vx-deal-card` -- os dois precisam ser o mesmo número.
      */}
      <div className="-mx-3.5 -mb-3.5 mt-3 flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <span aria-hidden="true" className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          proxima?.atrasada ? "bg-destructive" : proxima ? "bg-primary" : "bg-muted-foreground/50",
        )} />
        <span className={cn(
          "min-w-0 flex-1 truncate text-xs",
          proxima?.atrasada ? "font-medium text-destructive" : proxima ? "text-foreground" : "text-muted-foreground",
        )}>
          {proxima ? rotuloDaProxima(proxima, agora) : "Sem atividade"}
        </span>
        {!proxima && parado > 0 && (
          <span title="Dias sem nenhum movimento registrado" className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            parado >= DIAS_PARADO_ALERTA ? "text-destructive" : "text-muted-foreground",
          )}>
            {parado} {pluralizar(parado, "dia")}
          </span>
        )}
        {deal.owner?.name && (
          <span title={`Responsável: ${deal.owner.name}`} className="shrink-0">
            <Iniciais nome={deal.owner.name} tamanho="sm" destaque />
          </span>
        )}
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
    <div
      ref={setNodeRef}
      // Realce de soltura por COR, nunca por escala/filtro: transform num
      // ancestral do card faz o DragOverlay fugir do cursor (CLAUDE.md).
      className={cn(
        "flex h-full w-[272px] min-h-0 shrink-0 flex-col overflow-hidden rounded-lg transition-colors sm:w-[292px]",
        isOver ? "bg-accent ring-1 ring-primary/40" : "bg-muted/60",
      )}
    >
      {/*
        A FAIXA DO CABEÇALHO: ponto na cor da etapa, nome, contagem e o total
        com a chance da etapa.

        A cor vem da POSIÇÃO (escala bg-stage-1…6, da marca ao verde), não de
        `pipeline_stages.color`: a escala acompanha a cor de destaque e o tema
        escuro, e a cor gravada no banco é um hex fixo.
      */}
      <div className="border-b border-border/60 bg-muted px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", corDaEtapa(indice, totalEtapas))} />
          <h3 className="vx-titulo-secao min-w-0 truncate text-foreground">{stage.name}</h3>
          <span className="rounded-full bg-card px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {formatarNumero(deals.length)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{formatarMoedaInteira(total)}</span>
          {prob > 0 && <> · prob. {prob}%</>}
        </p>
      </div>

      {/*
        A ROLAGEM DA COLUNA. A altura vem do PAI -- `min-h-0` é o que permite um
        filho de flex encolher abaixo do conteúdo, sem o qual `flex-1` cresce em
        vez de rolar.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            selecionado={selecionados.has(deal.id)}
            aberto={deal.id === abertoId}
            agora={agora}
            onDealClick={onDealClick}
            onContactClick={onContactClick}
            onEditDeal={onEditDeal}
            onComposeEmail={onComposeEmail}
            onAbrirPagina={onAbrirPagina}
            onAlternarSelecao={onAlternarSelecao}
          />
        ))}

        {/* "+ Adicionar negócio" no FIM da coluna, como na referência. Fica
            dentro da área que rola, logo depois do último card, e a zona vazia
            abaixo dele continua sendo alvo de soltar do arraste. */}
        <button
          type="button"
          onClick={() => onAddDeal(stage.id)}
          className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-card hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />Adicionar negócio
        </button>
        <div className="min-h-[40px] flex-1" />
      </div>
    </div>
  );
}

/* ── Collapsible Won/Lost ────────────────────────────────── */

function CollapsibleStatusColumn({
  title,
  icon: Icon,
  deals,
  color,
  onDealClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  deals: DealWithRelations[];
  color: string;
  onDealClick: (d: DealWithRelations) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const total = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);

  if (deals.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="flex min-h-10 w-full items-center justify-between px-3 py-2 transition-colors hover:bg-surface-2"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-semibold">{title}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-label font-medium text-muted-foreground">
            {deals.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-foreground">{formatarMoedaInteira(total)}</span>
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {deals.map((deal) => (
            <button
              type="button"
              key={deal.id}
              className="rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-primary/40"
              onClick={() => onDealClick(deal)}
            >
              <p className="truncate text-sm font-medium">{deal.title}</p>
              {deal.company && (
                <p className="truncate text-label text-muted-foreground">{deal.company.name}</p>
              )}
              <p className={`mt-0.5 text-xs font-semibold tabular-nums ${color}`}>
                {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Won/Lost Drop Zones ─────────────────────────────────── */

function WonLostDropZone({
  id,
  label,
  icon: Icon,
  color,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      // Só cor no realce. Havia um `scale-105` aqui -- e escala é transform,
      // que num ancestral vira bloco de contenção do DragOverlay (CLAUDE.md).
      className={cn(
        "flex w-16 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        isOver ? "border-primary bg-accent" : "border-border bg-card/50",
      )}
    >
      <Icon className={`h-5 w-5 ${color}`} />
      <span className={`mt-1 text-label font-medium ${color}`}>{label}</span>
    </div>
  );
}

/* ── Main Kanban ─────────────────────────────────────────── */

interface DealsKanbanProps {
  deals: DealWithRelations[];
  wonDeals: DealWithRelations[];
  lostDeals: DealWithRelations[];
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
}

export function DealsKanban({
  deals, wonDeals, lostDeals, stages, onDragEnd, onDealClick, onContactClick, onAddDeal, onEditDeal, onMarkWon, onMarkLost,
  onComposeEmail, onOpenPage, openDealId = null, selectedDeals, onSelectionChange,
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
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-20">
        <div className="text-center">
          <p className="text-muted-foreground">Este funil não tem etapas</p>
          <p className="text-sm text-muted-foreground">Vá em Configurações → Funis e etapas para adicionar</p>
        </div>
      </div>
    );
  }

  return (
    // `min-h-0` em cada nível até a coluna: sem ele a altura para de descer no
    // primeiro flex e a coluna volta a crescer em vez de rolar.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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
              onDealClick={onDealClick}
              onContactClick={onContactClick}
              onAddDeal={onAddDeal}
              onEditDeal={onEditDeal}
              onComposeEmail={onComposeEmail}
              onAbrirPagina={onOpenPage}
              onAlternarSelecao={onSelectionChange ? alternarSelecao : undefined}
            />
          ))}

          {/* Won/Lost drop zones */}
          <WonLostDropZone id="won-drop" label="Ganho" icon={Trophy} color="text-success" />
          <WonLostDropZone id="lost-drop" label="Perdido" icon={XCircle} color="text-destructive" />
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
              <div className="w-[272px] opacity-90 sm:w-[292px]">
                <div className="rounded-lg border border-primary bg-card p-3 shadow-lg">
                  <p className="truncate text-sm font-semibold">{activeDeal.title}</p>
                  <p className="mt-1 text-base font-bold tabular-nums text-foreground">
                    {formatarMoeda(Number(activeDeal.value) || 0, activeDeal.currency || "BRL")}
                  </p>
                </div>
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

      {(wonDeals.length > 0 || lostDeals.length > 0) && (
        <div className="space-y-2">
          <CollapsibleStatusColumn title="Ganhos" icon={Trophy} deals={wonDeals} color="text-success" onDealClick={onDealClick} />
          <CollapsibleStatusColumn title="Perdidos" icon={XCircle} deals={lostDeals} color="text-destructive" onDealClick={onDealClick} />
        </div>
      )}
    </div>
  );
}
