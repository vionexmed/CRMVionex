import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Plus, Trophy, XCircle, MoreHorizontal, Pencil, Eye, Mail, Calendar, Flame, Sun, Snowflake } from "lucide-react";
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
import { formatarMoedaInteira, formatarNumero, pluralizar } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Iniciais } from "@/components/layout/ListaV1";
import { getContactOrigin } from "@/lib/contact-options";
import {
  corDaEtapa, diasSemAvancar, etapasEmOrdem, proximaAtividade, rotuloDaProxima,
  ROTULO_DA_TEMPERATURA, temperaturaDe, type Temperatura,
} from "@/components/negocios/sinais";
import { AvatarDaPessoa } from "@/components/negocios/AvatarDaPessoa";


type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

/** A partir de quantos dias sem movimento o card mostra os dias parado. */
const DIAS_PARADO_ALERTA = 7;
/** A partir daqui, sem nada agendado, o card diz "Parado" -- o mesmo 14 da faixa. */
const DIAS_PARADO_CRITICO = 14;

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
 * O card do quadro, no desenho do Visual 01: iniciais da empresa, título,
 * pessoa · origem, valor grande com a TEMPERATURA à direita, divisória e a
 * linha da PRÓXIMA ATIVIDADE com os dias parado e o responsável.
 *
 * A linha de baixo lê `atividades` (que `dealsApi.list` já embute): "Ligação
 * seg, 09:00", "Reunião atrasada 2 dias" em vermelho, ou "Sem atividade". Os
 * dias aparecem a partir de 7 sem avançar de etapa (`diasSemAvancar`, o mesmo
 * critério do chip "Parados há 7+ dias"): em vermelho quando nada está agendado, porque aí
 * ninguém vai mexer; neutros quando há algo marcado.
 *
 * Seleção em lote e o menu `…` (abrir, editar, e-mail, agendar) aparecem no
 * canto ao passar o mouse ou ao focar: a referência não tem fileira de ações
 * no card, e tirá-las de vez levaria embora a única porta para EDITAR o
 * negócio a partir do quadro. Marcado, a caixa fica à vista.
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
  // gatilho de entrada se chamam pelo nome da pessoa.
  const nomeContato = nome && nome !== deal.title ? nome : null;
  const origem = deal.contact
    ? getContactOrigin(deal.contact.metadata as Record<string, unknown> | null).label
    : null;

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
      className={cn("vx-deal-card group relative shadow-sm", selecionado && "vx-deal-card--marcado", aberto && "border-primary shadow-md ring-1 ring-primary")}
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
        <Iniciais nome={deal.company?.name || nome || deal.title} forma={deal.company ? "empresa" : "pessoa"} className="h-9 w-9" />
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
                    className="hover:text-foreground hover:underline"
                  >
                    {tratamento ? `${tratamento} ${nomeContato}` : nomeContato}
                  </button>
                ) : (tratamento ? `${tratamento} ${nomeContato}` : nomeContato)
              ) : deal.company?.name}
              {(nomeContato || deal.company) && origem && " · "}
              {origem}
            </p>
          )}
        </div>
      </div>

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

      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-lg font-bold tabular-nums tracking-tight text-foreground">
          {formatarMoedaInteira(Number(deal.value) || 0, deal.currency || "BRL")}
        </span>
        {visualTemp && temperatura && (
          <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold", visualTemp.cor)}>
            <visualTemp.Icone aria-hidden="true" className="h-3.5 w-3.5" />
            {ROTULO_DA_TEMPERATURA[temperatura]}
          </span>
        )}
      </div>

      {/*
        PRÓXIMA ATIVIDADE, DIAS e RESPONSÁVEL, abaixo da divisória. A divisória
        não sangra: na referência ela para no padding do card.
      */}
      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2.5">
        <span aria-hidden="true" className={cn(
          "h-2 w-2 shrink-0 rounded-full",
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
            "shrink-0 text-xs font-semibold tabular-nums",
            proxima ? "text-foreground" : "text-destructive",
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

/**
 * A ponta de seta do cabeçalho é `clip-path`, nunca transform/rotate: um
 * ancestral do card com transform vira bloco de contenção do DragOverlay
 * (CLAUDE.md). A primeira faixa tem a esquerda reta; as outras, o entalhe que
 * encaixa na ponta da anterior.
 */
const SETA_INICIAL = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)";
const SETA_SEGUINTE = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";

function StageColumn({
  stage,
  indice,
  totalEtapas,
  deals,
  selecionados,
  abertoId,
  agora,
  tons,
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
  const cor = corDaEtapa(indice, totalEtapas);

  return (
    <div
      ref={setNodeRef}
      // Realce de soltura por COR, nunca por escala/filtro: transform num
      // ancestral do card faz o DragOverlay fugir do cursor (CLAUDE.md).
      className={cn(
        "flex h-full w-[268px] min-h-0 shrink-0 flex-col rounded-lg transition-colors",
        isOver ? "bg-accent" : "bg-transparent",
      )}
    >
      {/*
        A FAIXA DO CABEÇALHO em seta: fundo no tom da etapa, ponto, nome,
        contagem e o total com a chance da etapa.

        A cor vem da POSIÇÃO (escala --stage-1…6, da marca ao verde), não de
        `pipeline_stages.color`: a escala acompanha a cor de destaque e o tema
        escuro, e a cor gravada no banco é um hex fixo. O fundo é a mesma cor
        misturada ao cartão por `color-mix` -- as variáveis da escala já são
        `color-mix`, e o modificador de opacidade do Tailwind não as atravessa.
      */}
      <div
        className="shrink-0 py-2.5 pl-3.5 pr-5"
        style={{
          clipPath: indice === 0 ? SETA_INICIAL : SETA_SEGUINTE,
          paddingLeft: indice === 0 ? undefined : 28,
          background: `color-mix(in oklab, var(--${cor.replace("bg-", "")}) 14%, hsl(var(--card)))`,
        }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", cor)} />
          <h3 className="vx-titulo-secao min-w-0 truncate text-foreground">{stage.name}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-label font-semibold tabular-nums text-foreground">
            {formatarNumero(deals.length)}
          </span>
        </div>
        <p className="mt-1 truncate text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{formatarMoedaInteira(total)}</span>
          {prob > 0 && <> · prob. {prob}%</>}
        </p>
      </div>

      {/*
        A ROLAGEM DA COLUNA. A altura vem do PAI -- `min-h-0` é o que permite um
        filho de flex encolher abaixo do conteúdo, sem o qual `flex-1` cresce em
        vez de rolar.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2 pt-4">
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

        {/* "+ Adicionar negócio" no FIM da coluna, como na referência. Fica
            dentro da área que rola, logo depois do último card, e a zona vazia
            abaixo dele continua sendo alvo de soltar do arraste. */}
        <button
          type="button"
          onClick={() => onAddDeal(stage.id)}
          className="flex h-[46px] shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed border-border font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-card hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />Adicionar negócio
        </button>
        <div className="min-h-[40px] flex-1" />
      </div>
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
}

export function DealsKanban({
  deals, tons, stages, onDragEnd, onDealClick, onContactClick, onAddDeal, onEditDeal, onMarkWon, onMarkLost,
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
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-2">
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
              <div className="w-[268px] opacity-90">
                <div className="rounded-lg border border-primary bg-card p-3 shadow-lg">
                  <p className="truncate text-sm font-semibold">{activeDeal.title}</p>
                  <p className="mt-1 text-base font-bold tabular-nums text-foreground">
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
