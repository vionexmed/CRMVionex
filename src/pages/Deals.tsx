import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { contactsApi } from "@/lib/api/contacts";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useDeals, useCreateDeal, useUpdateDeal, useUpdateDealStage, useUpdateDealStatus, useBatchUpdateDeals, dealsKeys } from "@/hooks/queries/useDeals";
import { useContactsPicker } from "@/hooks/queries/useContacts";
import { useCompanies } from "@/hooks/queries/useCompanies";
import { useMembers } from "@/hooks/queries/useMembers";
import { usePipelines, usePipelineStages, useSavePipelineStages } from "@/hooks/queries/usePipelines";
import { useLossReasons } from "@/hooks/queries/useLossReasons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Kanban, List, TrendingUp, Plus, Settings2, Loader2, ChevronLeft, ChevronRight, Trophy, XCircle, Trash2 } from "lucide-react";
import { BarraDeSelecao } from "@/components/layout/BarraDeAcoes";
import { ErrorState, LoadingState } from "@/components/layout/EstadoDaLista";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { DealsKanban } from "@/components/crm/DealsKanban";
import { ContactDrawer } from "@/components/crm/ContactDrawer";
import { EmailComposeModal } from "@/components/crm/EmailComposeModal";
import { DealsList } from "@/components/crm/DealsList";
import { DealsForecast } from "@/components/crm/DealsForecast";
import { DealsFilters, type DealFilters } from "@/components/crm/DealsFilters";
import type { Database } from "@/integrations/supabase/types";
import type { EditingStage } from "@/lib/api/pipelines";
import { mensagemErro } from "@/lib/erro-supabase";
import { indexarPorId } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";
import { SegmentedControl } from "@/components/layout/SegmentedControl";
import { LinhaDeEtapa, COR_PADRAO_DE_ETAPA } from "@/components/crm/LinhaDeEtapa";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import type { DealWithRelations } from "@/lib/api/deals";
import { SeletorDeContato } from "@/components/crm/SeletorDeContato";
import { SeletorDeFunil, TimeDoFunil } from "@/components/negocios/CabecalhoDoFunil";
import { FaixaDoFunil } from "@/components/negocios/FaixaDoFunil";
import { ChipsDoFunil } from "@/components/negocios/ChipsDoFunil";
import { PainelDoNegocio } from "@/components/negocios/PainelDoNegocio";
import type { TipoParaRegistrar } from "@/components/negocios/acoes-rapidas";
import { filtrarPorSinal, resumirFunil, type FiltroDeSinal } from "@/components/negocios/sinais";
export type { DealWithRelations } from "@/lib/api/deals";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ViewMode = "kanban" | "list" | "forecast";

const VISOES: ViewMode[] = ["kanban", "list", "forecast"];

/** Nome na URL de cada campo de DealFilters. Lista explícita: ver `filtrosDaUrl`. */
const CHAVE_DO_FILTRO: Record<keyof DealFilters, string> = {
  ownerId: "dono",
  minValue: "min",
  maxValue: "max",
  closeDateFrom: "de",
  closeDateTo: "ate",
};

/**
 * Campo a campo, sem espalhar: renomear uma chave de DealFilters passa a dar erro
 * de tipo aqui, em vez de o filtro parar de filtrar em silêncio.
 * Número inválido na URL vira "sem filtro" em vez de NaN, que descartaria tudo.
 */
function filtrosDaUrl(sp: URLSearchParams): DealFilters {
  const num = (k: string) => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    ownerId: sp.get(CHAVE_DO_FILTRO.ownerId) || undefined,
    minValue: num(CHAVE_DO_FILTRO.minValue),
    maxValue: num(CHAVE_DO_FILTRO.maxValue),
    closeDateFrom: sp.get(CHAVE_DO_FILTRO.closeDateFrom) || undefined,
    closeDateTo: sp.get(CHAVE_DO_FILTRO.closeDateTo) || undefined,
  };
}

/**
 * Os chips de sinal ("Atividade atrasada", "Parados há N+ dias") também moram
 * na URL, pelo mesmo motivo dos filtros: voltar do negócio não pode desligá-los.
 * `parados` guarda o NÚMERO de dias -- o chip liga com 7, o link da faixa de
 * indicadores com 14, e os dois são o mesmo filtro.
 */
function sinaisDaUrl(sp: URLSearchParams): FiltroDeSinal {
  const dias = Number(sp.get("parados"));
  return {
    atrasada: sp.get("atrasada") === "1",
    paradosHa: Number.isInteger(dias) && dias > 0 ? dias : null,
  };
}

/** Painel lateral só onde há largura para ele ao lado do quadro (lg do Tailwind). */
const cabePainel = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1024px)").matches;

export default function Deals() {
  const { orgId } = useOrg();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Visão e filtros moram na URL (replace: não empilha histórico a cada clique).
  //
  // Eram useState: recarregar a página ou voltar do detalhe de um negócio
  // devolvia o quadro ao kanban sem filtro, e não dava para mandar o link de
  // "meus negócios acima de 10 mil" para alguém.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: ViewMode = VISOES.includes(searchParams.get("visao") as ViewMode)
    ? (searchParams.get("visao") as ViewMode)
    : "kanban";
  const setViewMode = useCallback((v: ViewMode) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === "kanban") next.delete("visao");
      else next.set("visao", v);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  // Memoizado: `filters` é lido por efeitos e pelo filtro do quadro, e um objeto
  // novo a cada render faria ambos reavaliar sem que nada tivesse mudado.
  const filters = useMemo(() => filtrosDaUrl(searchParams), [searchParams]);
  const setFilters = useCallback((f: DealFilters) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const k of Object.values(CHAVE_DO_FILTRO)) next.delete(k);
      for (const [campo, chave] of Object.entries(CHAVE_DO_FILTRO) as [keyof DealFilters, string][]) {
        const v = f[campo];
        if (v !== undefined && v !== "") next.set(chave, String(v));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const sinais = useMemo(() => sinaisDaUrl(searchParams), [searchParams]);
  const setSinais = useCallback((f: FiltroDeSinal) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (f.atrasada) next.set("atrasada", "1"); else next.delete("atrasada");
      if (f.paradosHa !== null) next.set("parados", String(f.paradosHa)); else next.delete("parados");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [listPage, setListPage] = useState(0);
  // Filtro novo, página 1: na página 4 de uma lista que encolheu para duas, a
  // tela mostraria "nenhum negócio" com negócios existindo. Pela chave em
  // texto, e não pelo objeto: `filters` é refeito a cada mudança de URL --
  // inclusive as que não são filtro, como abrir o painel de um negócio.
  const chaveDosFiltros = JSON.stringify(filters);
  useEffect(() => { setListPage(0); }, [chaveDosFiltros]);

  // Supporting data
  const { data: allStages = [], isLoading: stagesLoading, isError: stagesError } = usePipelineStages();
  const { data: pipelines = [], isLoading: pipelinesLoading, isError: pipelinesError } = usePipelines();
  // Lista leve, sem o teto de 1000 linhas do PostgREST (inclui leads)
  const { data: contacts = [] } = useContactsPicker();
  const { data: companies = [] } = useCompanies();
  const { data: members = [] } = useMembers();

  // Kanban + Forecast: todos os negócios (sem paginação). Desligada na lista:
  // ela baixava o funil inteiro, com atividades embutidas, só para não usar.
  const precisaDeTodos = viewMode !== "list";
  const {
    data: allDealsResult = { data: [], count: 0 },
    isLoading: todosCarregando,
    isError: todosFalhou,
    refetch: recarregarTodos,
  } = useDeals({}, { enabled: precisaDeTodos });
  // Lista: paginada no servidor. Só roda na lista (antes, fora dela, repetia a
  // consulta dos "todos" com a mesma chave).
  const {
    data: listDealsResult = { data: [], count: 0 },
    isFetching: listFetching,
    isLoading: listaCarregando,
    isError: listaFalhou,
    refetch: recarregarLista,
  } = useDeals(
    {
      page: listPage,
      pageSize: DEFAULT_PAGE_SIZE,
      // A lista paginada filtra NO SERVIDOR -- antes ela ignorava os filtros, que
      // só valiam no quadro, e com os chips agora sempre à vista isso seria um
      // filtro anunciado que não filtra. Campo a campo, sem espalhar: renomear
      // uma chave de DealFilters precisa dar erro de tipo aqui.
      ownerId: filters.ownerId,
      minValue: filters.minValue,
      maxValue: filters.maxValue,
      closeDateFrom: filters.closeDateFrom,
      closeDateTo: filters.closeDateTo,
    },
    { enabled: viewMode === "list" },
  );

  /**
   * O PostgREST corta em 1000 linhas sem avisar. A consulta já pede
   * `count: "exact"`, então count > data.length É o sinal de truncamento --
   * sem ele o quadro mostraria um funil menor do que o real e ninguém saberia.
   */
  const truncado = precisaDeTodos && allDealsResult.count > allDealsResult.data.length;

  const listTotalPages = Math.ceil((listDealsResult.count) / DEFAULT_PAGE_SIZE);

  const { mutateAsync: createDeal } = useCreateDeal();
  const { mutateAsync: updateDeal } = useUpdateDeal();
  const { mutateAsync: updateStage } = useUpdateDealStage();
  const { mutateAsync: updateStatus } = useUpdateDealStatus();
  const { mutateAsync: batchUpdate } = useBatchUpdateDeals();
  const { mutateAsync: savePipelineStages, isPending: savingPipeline } = useSavePipelineStages();

  // Junção do dono, feita no cliente porque `deals.owner_id` aponta para
  // `auth.users` e não para `profiles` -- sem FK entre as duas, o PostgREST não
  // consegue embutir o perfil.
  //
  // Índice em vez de `.find()` por negócio: varria a lista de membros inteira
  // para cada negócio, duas vezes (lista e kanban).
  const porDono = useMemo(() => indexarPorId(members), [members]);
  const allDeals = useMemo(
    () => allDealsResult.data.map((d) => ({ ...d, owner: (d.owner_id && porDono.get(d.owner_id)) ?? null })),
    [allDealsResult.data, porDono]
  );
  const listDeals = useMemo(
    () => listDealsResult.data.map((d) => ({ ...d, owner: (d.owner_id && porDono.get(d.owner_id)) ?? null })),
    [listDealsResult.data, porDono]
  );
  // Painel da pessoa. O contato vem do embed do próprio negócio, então abrir o
  // painel não custa consulta nenhuma.
  const [contatoNoPainel, setContatoNoPainel] = useState<ContactRow | null>(null);

  /**
   * Estável, porque desce até o card de cada negócio.
   *
   * Era `onDealClick={(d) => navigate(...)}` -- identidade nova a cada render
   * do pai. Com o dnd-kit, arrastar um card faz o quadro renderizar
   * continuamente, e um callback instável obriga TODOS os cards a renderizar
   * junto. `React.memo` no card não adiantaria nada enquanto esta prop mudasse:
   * ele compararia, veria diferente, e renderizaria igual -- pagando a
   * comparação sem pular nada.
   */
  const abrirPagina = useCallback(
    (d: DealWithRelations) => navigate(`/deals/${d.id}`),
    [navigate],
  );

  /**
   * No quadro, o clique abre o PAINEL ao lado (desktop) e guarda o negócio na
   * URL -- voltar da página do negócio reabre o mesmo painel. Sem largura para
   * o painel, segue para a página, como sempre foi.
   *
   * Continua estável durante o arraste: `setSearchParams` só troca de
   * identidade quando a URL muda, e arrastar não mexe na URL.
   */
  const abrirNegocio = useCallback((d: DealWithRelations) => {
    if (!cabePainel()) { navigate(`/deals/${d.id}`); return; }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("negocio", d.id);
      return next;
    }, { replace: true });
  }, [navigate, setSearchParams]);
  const fecharPainel = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("negocio");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  /** Nota, Ligar e Tarefa do painel: o formulário de atividade mora na página. */
  const registrarNoNegocio = useCallback(
    (d: DealWithRelations, tipo: TipoParaRegistrar) => navigate(`/deals/${d.id}?registrar=${tipo}`),
    [navigate],
  );

  /**
   * O NEGÓCIO PARA O QUAL ESCREVER, e não um booleano de "modal aberto".
   *
   * Guardar o negócio inteiro é o que permite passar destinatário, contato E
   * negócio para o compositor de uma vez -- e é o que faz o e-mail enviado
   * virar histórico DAQUELE negócio em vez de mensagem solta.
   *
   * `useCallback` porque o card do quadro é `memo`: uma arrow inline aqui teria
   * identidade nova a cada render e faria os 861 cards renderizarem de novo a
   * cada movimento do arraste.
   */
  const [negocioParaEmail, setNegocioParaEmail] = useState<DealWithRelations | null>(null);
  const escreverEmail = useCallback((d: DealWithRelations) => setNegocioParaEmail(d), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState<Partial<Deal>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [, setPresetStageId] = useState<string | null>(null);
  /** Marcado: salvar também cria a pessoa. Ver `handleSave`. */
  const [criarContato, setCriarContato] = useState(false);

  // Loss reason modal
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossDealId, setLossDealId] = useState<string | null>(null);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossNote, setLossNote] = useState("");
  // Só as ativas: oferecer um motivo desativado deixaria a org reintroduzi-lo
  // em silêncio. Ver src/hooks/queries/useLossReasons.ts.
  const { data: lossReasons, isLoading: lossReasonsLoading, isError: lossReasonsIsError } = useLossReasons(true);

  // Batch selection
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

  // Pipeline customization
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [editingStages, setEditingStages] = useState<EditingStage[]>([]);

  // O funil ativo vem da URL (`?funil=`), e cai no padrão quando ausente ou
  // inválido. Era um useState preenchido por efeito: nascia "" e só depois
  // virava o padrão, e trocar de funil não sobrevivia a voltar do negócio.
  const funilDaUrl = searchParams.get("funil");
  const selectedPipeline =
    pipelines.find((p) => p.id === funilDaUrl)?.id
    ?? (pipelines.find((p) => p.is_default) || pipelines[0])?.id
    ?? "";
  const setSelectedPipeline = useCallback((id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("funil", id);
      // O painel é de um negócio do funil anterior.
      next.delete("negocio");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Realtime subscription — invalidate cache on remote changes
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("deals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `org_id=eq.${orgId}` }, () => {
        qc.invalidateQueries({ queryKey: dealsKeys.all(orgId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, qc]);

  // useMemo porque este array é dependência do useEffect abaixo. Sem ele, um
  // array novo a cada render fazia o efeito reavaliar em todo render.
  const pipelineStages = useMemo(
    () => allStages.filter((s) => s.pipeline_id === selectedPipeline),
    [allStages, selectedPipeline],
  );

  // A tela distingue três situações que antes eram uma só.
  //
  // `selectedPipeline` nasce "" e só é preenchido por um useEffect depois de
  // usePipelines resolver, então `pipelineStages` é [] no primeiro render --
  // e o DealsKanban lê [] como "organização sem funil". Resultado: toda entrada
  // em /deals piscava "Nenhum funil configurado", e se a consulta falhasse a
  // mensagem ficava permanente, mandando o usuário configurar algo que já existe.
  const funilCarregando = stagesLoading || pipelinesLoading;
  const funilFalhou = stagesError || pipelinesError;
  const semFunil = !funilCarregando && !funilFalhou && pipelines.length === 0;

  // Open "new deal" sheet from URL param
  const shouldOpenNew = searchParams.get("action") === "new";
  useEffect(() => {
    if (shouldOpenNew && pipelineStages.length > 0) {
      openNew();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        return next;
      }, { replace: true });
    }
  }, [shouldOpenNew, pipelineStages]);

  const openPipelineEditor = () => {
    // Cópia antes de ordenar: `.sort()` é IN PLACE, e `pipelineStages` é o
    // resultado de um useMemo -- é o mesmo array que alimenta as colunas do
    // kanban. Ordenar aqui reordenava a memoização por efeito colateral, de
    // dentro de um manipulador de clique.
    const current = [...pipelineStages]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, name: s.name, color: s.color || COR_PADRAO_DE_ETAPA, win_probability: Number(s.win_probability) || 0, order: s.order }));
    setEditingStages(current.length > 0 ? current : [{ name: "", color: COR_PADRAO_DE_ETAPA, win_probability: 50, order: 0 }]);
    setPipelineDialogOpen(true);
  };

  const handleSavePipeline = async () => {
    if (!orgId || !selectedPipeline) return;
    const currentStageIds = pipelineStages.map((s) => s.id);
    await savePipelineStages({ pipelineId: selectedPipeline, currentStageIds, editingStages });
    setPipelineDialogOpen(false);
    toast({ title: "Funil atualizado!" });
  };

  // Apply client-side filters to all deals (Kanban/Forecast)
  const passaNosFiltros = (d: DealWithRelations) => {
    if (filters.ownerId && d.owner_id !== filters.ownerId) return false;
    if (filters.minValue && (Number(d.value) || 0) < filters.minValue) return false;
    if (filters.maxValue && (Number(d.value) || 0) > filters.maxValue) return false;
    if (filters.closeDateFrom && d.close_date && d.close_date < filters.closeDateFrom) return false;
    if (filters.closeDateTo && d.close_date && d.close_date > filters.closeDateTo) return false;
    return true;
  };
  // Um Set montado uma vez, e não `pipelineStages.map(...)` DENTRO do filtro --
  // aquilo refazia a lista de etapas para cada negócio.
  //
  // Ganhos e perdidos também passaram a ser DO FUNIL: com as pílulas de funil
  // à vista, "Ganhos" do funil de Renovações mostrando as vendas do outro
  // funil contradiz o número da pílula. O negócio encerrado guarda a etapa em
  // que estava, e é por ela que se sabe o funil. Sem etapa, segue aparecendo
  // em qualquer funil, como antes.
  const etapasDoFunil = new Set(pipelineStages.map((s) => s.id));
  const filteredAllDeals = allDeals.filter(
    (d) => passaNosFiltros(d) && (!d.stage_id || etapasDoFunil.has(d.stage_id)),
  );

  // Abertos por funil, para as pílulas. Mesmos filtros, sem o de funil.
  const funilDaEtapa = new Map(allStages.map((s) => [s.id, s.pipeline_id]));
  const abertosPorFunil = new Map<string, number>();
  if (precisaDeTodos && !todosCarregando) {
    for (const d of allDeals) {
      if (d.status !== "open" || !d.stage_id || !passaNosFiltros(d)) continue;
      const funil = funilDaEtapa.get(d.stage_id);
      if (funil) abertosPorFunil.set(funil, (abertosPorFunil.get(funil) ?? 0) + 1);
    }
  }

  // Arraste e trilha do painel passam por aqui. Com o toast: antes uma falha
  // ao mover virava rejeição de promessa sem dono, e o card voltava sozinho
  // para a coluna antiga sem dizer por quê.
  const handleDragEnd = async (dealId: string, newStageId: string) => {
    try {
      await updateStage({ id: dealId, stageId: newStageId });
    } catch (e: unknown) {
      toast({ title: "Erro ao mover negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  /**
   * Abre a gaveta em modo EDIÇÃO.
   *
   * O estado `editing` e o modo de edição da gaveta já existiam -- inclusive o
   * título "Editar Negócio" e o `handleSave` que faz update em vez de insert --
   * e NADA os acionava. Estava construído pela metade: dava para editar e não
   * havia por onde.
   *
   * `useCallback` pelo mesmo motivo de `abrirNegocio`: a prop desce até o card de
   * cada negócio, e arrastar faz o quadro renderizar continuamente. Uma
   * identidade nova a cada render obrigaria todos os cards a renderizar junto, e
   * o `memo` do card só pagaria a comparação sem pular nada.
   */
  const abrirEdicao = useCallback((d: DealWithRelations) => {
    setEditing(d);
    setCriarContato(false);
    setPresetStageId(null);
    setForm({
      title: d.title,
      value: d.value,
      currency: d.currency,
      stage_id: d.stage_id,
      status: d.status,
      probability: d.probability,
      contact_id: d.contact_id,
      company_id: d.company_id,
      owner_id: d.owner_id,
      close_date: d.close_date,
    });
    setSheetOpen(true);
  }, []);

  const openNew = (stageId?: string) => {
    setEditing(null);
    setCriarContato(false);
    setPresetStageId(stageId || null);
    setForm({
      title: "", value: 0, currency: "BRL",
      stage_id: stageId || pipelineStages[0]?.id,
      status: "open", probability: 0,
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !form.title) return;
    try {
    if (editing) {
      await updateDeal({
        id: editing.id,
        deal: {
          title: form.title, value: Number(form.value) || 0, currency: form.currency,
          stage_id: form.stage_id, probability: Number(form.probability) || 0,
          close_date: form.close_date, contact_id: form.contact_id || null,
          company_id: form.company_id || null, owner_id: form.owner_id || null,
        },
      });
    } else {
      /*
       * CRIAR A PESSOA JUNTO, sem acabar com dois negócios.
       *
       * A armadilha: o gatilho `contato_entra_no_funil` cria um negócio A CADA
       * contato inserido (migração 20260826170000). Criar o contato e depois
       * inserir o negócio do formulário produziria DOIS -- o do gatilho, na
       * etapa de entrada, e o nosso. A pessoa marcaria uma caixinha e ganharia
       * uma ficha duplicada no quadro.
       *
       * Então: cria o contato, deixa o gatilho fazer o negócio, e ATUALIZA esse
       * negócio com o que o formulário pediu. Um contato, um negócio.
       */
      let contactId = form.contact_id || null;
      let negocioDoGatilho: string | null = null;

      if (criarContato && !contactId) {
        const bruto = form.title!.trim().replace(/\s+/g, " ");
        // Primeiro termo é o nome; o resto é sobrenome. "Dr José Paraná" vira
        // "Dr" + "José Paraná", que não é ideal -- mas inventar regra para
        // título ("Dr", "Dra", "Prof") erraria em nome que legitimamente começa
        // assim, e o campo é editável em Contatos.
        const [primeiro, ...resto] = bruto.split(" ");
        const novo = await contactsApi.create({
          org_id: orgId,
          first_name: primeiro,
          last_name: resto.join(" ") || null,
          // `lifecycle_stage`, NUNCA `status`: o gatilho sync_contact_lifecycle
          // deixa o status legado mandar no INSERT, e escrever `status` faria a
          // pessoa nascer "qualificada" sem ninguém ter qualificado. Está no
          // CLAUDE.md.
          lifecycle_stage: "lead",
          owner_id: form.owner_id || user?.id || null,
        });
        contactId = novo.id;

        // O negócio que o gatilho acabou de criar para esta pessoa.
        const { data: doGatilho } = await supabase
          .from("deals")
          .select("id")
          .eq("contact_id", novo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        negocioDoGatilho = (doGatilho?.id as string | undefined) ?? null;
      }

      if (negocioDoGatilho) {
        // Aproveita o do gatilho em vez de criar um segundo.
        await updateDeal({
          id: negocioDoGatilho,
          deal: {
            title: form.title, value: Number(form.value) || 0, currency: form.currency || "BRL",
            stage_id: form.stage_id, probability: Number(form.probability) || 0,
            close_date: form.close_date, contact_id: contactId,
            company_id: form.company_id || null, owner_id: form.owner_id || user?.id || null,
          },
        });
      } else {
        await createDeal({
          org_id: orgId, title: form.title!, value: Number(form.value) || 0,
          currency: form.currency || "BRL", stage_id: form.stage_id,
          probability: Number(form.probability) || 0, close_date: form.close_date,
          status: "open", owner_id: form.owner_id || user?.id,
          contact_id: contactId, company_id: form.company_id || null,
        });
      }

      // A pessoa nova precisa aparecer no select e na tela de Contatos.
      if (criarContato) qc.invalidateQueries({ queryKey: ["contacts"] });
    }
    setSheetOpen(false);
    setCriarContato(false);
    toast({
      title: editing ? "Negócio atualizado" : "Negócio criado",
      description: !editing && criarContato ? "O contato foi criado junto." : undefined,
    });
    } catch (e: unknown) {
      toast({ title: "Erro ao salvar negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const markAsWon = async (dealId: string) => {
    try {
      await updateStatus({ id: dealId, status: "won" });
      toast({ title: "Negócio marcado como ganho! 🎉" });
    } catch (e: unknown) {
      toast({ title: "Erro ao atualizar negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const openLossModal = (dealId: string) => {
    setLossDealId(dealId);
    setLossReasonId("");
    setLossNote("");
    setLossModalOpen(true);
  };

  const confirmLoss = async () => {
    if (!lossDealId) return;
    try {
      // `loss_reason_id` carrega a categoria, `loss_reason` só a nota -- sem
      // concatenar. Ver dealsApi.updateStatus.
      await updateStatus({ id: lossDealId, status: "lost", lossReasonId, lossReasonNote: lossNote || null });
      setLossModalOpen(false);
      toast({ title: "Negócio marcado como perdido" });
    } catch (e: unknown) {
      toast({ title: "Erro ao atualizar negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const handleBatchAction = async (action: "won" | "lost" | "delete") => {
    const ids = Array.from(selectedDeals);
    try {
      await batchUpdate({ ids, action });
      setSelectedDeals(new Set());
      const messages = { won: "ganhos", lost: "perdidos", delete: "excluídos" };
      toast({ title: `${ids.length} negócios ${messages[action]}` });
    } catch (e: unknown) {
      toast({ title: "Erro na ação em lote", description: mensagemErro(e), variant: "destructive" });
    }
  };

  if (!orgId) return <SemOrganizacao />;

  const openDeals = filteredAllDeals.filter((d) => d.status === "open");
  const wonDeals  = filteredAllDeals.filter((d) => d.status === "won");
  const lostDeals = filteredAllDeals.filter((d) => d.status === "lost");
  const totalCount = viewMode === "list" ? listDealsResult.count : filteredAllDeals.length;

  // Os indicadores contam o que o quadro MOSTRA em colunas: aberto sem etapa
  // não aparece em coluna nenhuma, e somá-lo faria "Em aberto" discordar da
  // soma das colunas e da pílula do funil.
  const agora = Date.now();
  const resumo = resumirFunil({
    abertos: openDeals.filter((d) => d.stage_id && etapasDoFunil.has(d.stage_id)),
    ganhos: wonDeals,
    perdidos: lostDeals,
    etapas: pipelineStages,
    agora,
  });
  // Os chips de sinal estreitam o QUADRO e a previsão, não os indicadores: a
  // faixa continua dizendo o tamanho do funil enquanto se olha só os atrasados.
  const abertosVisiveis = filtrarPorSinal(openDeals, sinais, agora);

  const negocioAbertoId = searchParams.get("negocio");
  const negocioAberto = viewMode === "kanban" && negocioAbertoId
    ? allDeals.find((d) => d.id === negocioAbertoId) ?? null
    : null;
  // As etapas do funil DO NEGÓCIO aberto -- um ganho sem etapa, ou um negócio
  // aberto por link, pode não ser do funil ativo.
  const funilDoAberto = negocioAberto?.stage_id ? funilDaEtapa.get(negocioAberto.stage_id) : undefined;
  const etapasDoAberto = funilDoAberto ? allStages.filter((s) => s.pipeline_id === funilDoAberto) : pipelineStages;
  const quadroPronto = !funilCarregando && !funilFalhou && !semFunil && !todosFalhou && !todosCarregando;

  return (
    <PageShell
      /* Só no kanban: a coluna é que rola, e para isso o quadro precisa de
         altura definida. Na lista e na previsão a página rolar é o certo. */
      preencherAltura={viewMode === "kanban"}
      title="Negócios"
      contagem={{ valor: totalCount, unidade: "negócio no funil", plural: "negócios no funil" }}
      meta={
        listFetching && viewMode === "list" ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            atualizando
          </span>
        ) : undefined
      }
      actions={
        <>
          {isAdmin && (
            <Button variant="outline" size="icon" onClick={openPipelineEditor} aria-label="Personalizar funil" title="Personalizar etapas do funil">
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => openNew()} className="gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Negócio</span>
          </Button>
        </>
      }
      /*
        A LINHA DOS FUNIS, com a equipe e a troca de visão à direita.

        Os funis saíram do select do cabeçalho e viraram pílulas com contagem.
        "+ Funil" só para admin: criar funil existe em Configurações → Funis e
        etapas, que é aba de admin -- oferecer a quem não pode seria uma porta
        fechada.
      */
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pipelines.length > 0 ? (
            <SeletorDeFunil
              funis={pipelines}
              valor={selectedPipeline}
              onChange={setSelectedPipeline}
              contagens={precisaDeTodos && !todosCarregando && !todosFalhou ? abertosPorFunil : undefined}
              linkNovoFunil={isAdmin ? "/settings?aba=pipelines" : undefined}
            />
          ) : <span />}
          <div className="flex flex-wrap items-center gap-2">
            <TimeDoFunil membros={members} />
            {/* Era um grupo de pílulas escrito à mão, o quarto do projeto, com
                medidas próprias e sem `aria-pressed` -- nenhuma das quatro cópias
                anunciava a seleção para leitor de tela. */}
            <SegmentedControl<ViewMode>
              rotuloGrupo="Visualização"
              valor={viewMode}
              onChange={setViewMode}
              opcoes={[
                { valor: "kanban", rotulo: "Kanban", icone: Kanban },
                { valor: "list", rotulo: "Lista", icone: List },
                { valor: "forecast", rotulo: "Previsão", icone: TrendingUp },
              ]}
            />
          </div>
        </div>
      }
    >
      {/* Um respiro só entre faixa, chips e quadro. A casca em modo de altura
          cheia não põe espaço entre os filhos. */}
      <div className={viewMode === "kanban" ? "flex min-h-0 min-w-0 flex-1 flex-col gap-4" : "min-w-0 space-y-4"}>

      {/* Os indicadores precisam do funil inteiro carregado: na lista, que é
          paginada, eles mediriam só a página. Na previsão também não: ela tem a
          própria faixa (comprometido/provável), e duas faixas empilhadas
          disputariam a mesma atenção. */}
      {viewMode === "kanban" && quadroPronto && (
        <FaixaDoFunil
          resumo={resumo}
          onVerParados={() => setSinais({ ...sinais, paradosHa: 14 })}
        />
      )}

      {!semFunil && (
        <ChipsDoFunil
          filtros={filters}
          onFiltros={setFilters}
          membros={members}
          sinais={precisaDeTodos ? sinais : undefined}
          onSinais={precisaDeTodos ? setSinais : undefined}
          onAbrirFiltros={() => setShowFilters(!showFilters)}
        />
      )}

      {showFilters && (
        <DealsFilters filters={filters} onFiltersChange={setFilters} members={members} />
      )}

      {/* Falha de consulta de negócios não pode parecer funil vazio. */}
      {precisaDeTodos && todosFalhou && (
        <ErrorState
          titulo="Não foi possível carregar os negócios"
          descricao="A consulta falhou. Nenhum negócio foi alterado."
          onTentarNovamente={() => recarregarTodos()}
        />
      )}
      {precisaDeTodos && todosCarregando && !funilCarregando && <LoadingState linhas={6} />}

      {truncado && !todosFalhou && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          Exibindo {allDealsResult.data.length} de {allDealsResult.count} negócios — refine os filtros
        </p>
      )}

      {/* Carregando, falhou e "não existe" pedem respostas diferentes. */}
      {viewMode === "kanban" && funilCarregando && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {viewMode === "kanban" && funilFalhou && (
        <div className="rounded-lg border border-dashed border-destructive/40 py-16 text-center">
          <p className="font-medium">Não foi possível carregar o funil</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus negócios continuam salvos. Recarregue a página para tentar de novo.
          </p>
        </div>
      )}

      {viewMode === "kanban" && semFunil && (
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">Nenhum funil configurado</p>
          <p className="text-sm text-muted-foreground">
            Vá em Configurações → Funis e etapas para criar
          </p>
        </div>
      )}

      {/*
        A BARRA DE SELEÇÃO EM LOTE, também no quadro.

        Ela morava só dentro de DealsList, então a caixa que o card do kanban
        ganhou marcaria negócios sem nada acontecer -- e uma caixa que marca e
        não leva a ação nenhuma é exatamente o controle morto que o card evita
        no resto. Mesma seleção, mesmas ações, mesmo componente das outras telas.
      */}
      {viewMode === "kanban" && selectedDeals.size > 0 && (
        <BarraDeSelecao
          quantidade={selectedDeals.size}
          substantivo="negócio"
          substantivoPlural="negócios"
          onLimpar={() => setSelectedDeals(new Set())}
        >
          <Button size="sm" variant="outline" onClick={() => handleBatchAction("won")}>
            <Trophy className="mr-1 h-3.5 w-3.5 text-success" />Ganhos
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBatchAction("lost")}>
            <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" />Perdidos
          </Button>
          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={() => handleBatchAction("delete")}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
            </Button>
          )}
        </BarraDeSelecao>
      )}

      {viewMode === "kanban" && quadroPronto && (
        // Quadro e painel lado a lado. O painel NÃO envolve o quadro: nenhum
        // wrapper de kanban ganha transform/filter (CLAUDE.md), e o painel é
        // irmão, não ancestral.
        <div className="flex min-h-0 min-w-0 flex-1 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <DealsKanban
              deals={abertosVisiveis}
              wonDeals={wonDeals}
              lostDeals={lostDeals}
              stages={pipelineStages}
              onDragEnd={handleDragEnd}
              onDealClick={abrirNegocio}
              onOpenPage={abrirPagina}
              openDealId={negocioAberto?.id ?? null}
              onContactClick={setContatoNoPainel}
              onAddDeal={openNew}
              onEditDeal={abrirEdicao}
              onMarkWon={markAsWon}
              onMarkLost={openLossModal}
              onComposeEmail={escreverEmail}
              selectedDeals={selectedDeals}
              onSelectionChange={setSelectedDeals}
            />
          </div>
          {negocioAberto && (
            <div className="hidden min-h-0 w-[360px] shrink-0 lg:flex">
              <PainelDoNegocio
                deal={negocioAberto}
                etapas={etapasDoAberto}
                onFechar={fecharPainel}
                onGanho={markAsWon}
                onPerdido={openLossModal}
                onMudarEtapa={handleDragEnd}
                onEditar={abrirEdicao}
                onEscreverEmail={escreverEmail}
                onRegistrar={registrarNoNegocio}
              />
            </div>
          )}
        </div>
      )}

      {viewMode === "list" && listaFalhou && (
        <ErrorState
          titulo="Não foi possível carregar os negócios"
          descricao="A consulta falhou. Nenhum negócio foi alterado."
          onTentarNovamente={() => recarregarLista()}
        />
      )}
      {viewMode === "list" && listaCarregando && <LoadingState linhas={8} />}

      {viewMode === "list" && !listaFalhou && !listaCarregando && (
        <>
          <DealsList
            deals={listDeals}
            stages={allStages}
            selectedDeals={selectedDeals}
            onSelectionChange={setSelectedDeals}
            onDealClick={abrirPagina}
            onBatchAction={handleBatchAction}
            canDelete={isAdmin}
          />
          {listTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Página {listPage + 1} de {listTotalPages} · {listDealsResult.count} negócios
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={listPage === 0} onClick={() => setListPage(listPage - 1)} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={listPage >= listTotalPages - 1} onClick={() => setListPage(listPage + 1)} aria-label="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === "forecast" && !todosFalhou && !todosCarregando && (
        <DealsForecast deals={abertosVisiveis} stages={pipelineStages} />
      )}
      </div>

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar Negócio" : "Novo Negócio"}</SheetTitle>
            <SheetDescription>{editing ? "Atualize os dados do negócio" : "Preencha os dados do novo negócio"}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do negócio" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={form.currency || "BRL"} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={form.stage_id || ""} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <SeletorDeContato
                contatos={contacts}
                valor={form.contact_id || "none"}
                aoMudar={(v) => setForm({ ...form, contact_id: v === "none" ? null : v })}
                permitirNenhum
                placeholder="Selecionar contato"
              />

              {/*
                Só aparece quando FAZ SENTIDO: negócio novo, com título escrito e
                sem contato escolhido. Caixinha permanente sob o select seria
                ruído nos outros três casos, e marcada por engano num negócio que
                já tem pessoa criaria uma duplicada.
              */}
              {!editing && !form.contact_id && !!form.title?.trim() && (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                  <Checkbox
                    checked={criarContato}
                    onCheckedChange={(v) => setCriarContato(v === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">
                      Criar contato “{form.title.trim()}”
                    </span>
                    <span className="mt-0.5 block text-label leading-relaxed text-muted-foreground">
                      Opcional. A pessoa entra em Contatos como lead, já ligada a
                      este negócio.
                    </span>
                  </span>
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Escolher o responsável deixou de ser de admin quando o CRM
                passou a ser da organização: o campo diz de quem é o negócio, e
                quem monta o negócio é quem sabe. */}
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.owner_id || "none"} onValueChange={(v) => setForm({ ...form, owner_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability ?? ""} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input type="date" value={form.close_date || ""} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar Negócio"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Loss Reason Modal */}
      <Dialog open={lossModalOpen} onOpenChange={setLossModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Perda</DialogTitle>
            <DialogDescription>Por que este negócio foi perdido?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              {lossReasonsLoading ? (
                <p className="text-xs text-muted-foreground">Carregando motivos...</p>
              ) : lossReasonsIsError ? (
                <p className="text-xs text-destructive">Não foi possível carregar os motivos cadastrados.</p>
              ) : !lossReasons?.length ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum motivo cadastrado para esta organização. Cadastre em Configurações → Funis e Etapas.
                </p>
              ) : (
                <Select value={lossReasonId} onValueChange={setLossReasonId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {lossReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={lossNote} onChange={(e) => setLossNote(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss} disabled={!lossReasonId}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Customization Dialog */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personalizar funil</DialogTitle>
            <DialogDescription>Edite as etapas do seu funil de vendas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* A linha é compartilhada com Configurações. Eram dois editores
                e nenhum completo: aqui não dava para reordenar, lá não dava
                para renomear nem recolorir. */}
            {editingStages.map((stage, idx) => (
              <LinhaDeEtapa
                key={idx}
                etapa={stage}
                indice={idx}
                total={editingStages.length}
                onChange={(mudanca) =>
                  setEditingStages(editingStages.map((s, i) => (i === idx ? { ...s, ...mudanca } : s)))
                }
                onRemover={
                  editingStages.length > 1
                    ? () => setEditingStages(editingStages.filter((_, i) => i !== idx))
                    : undefined
                }
                onMover={(direcao) => {
                  const destino = direcao === "cima" ? idx - 1 : idx + 1;
                  if (destino < 0 || destino >= editingStages.length) return;
                  const arr = [...editingStages];
                  [arr[idx], arr[destino]] = [arr[destino], arr[idx]];
                  // `order` acompanha a posição: é o campo que o banco lê, e a
                  // etapa de entrada do funil é identificada pelo MENOR order.
                  setEditingStages(arr.map((s, i) => ({ ...s, order: i })));
                }}
              />
            ))}
            <Button variant="outline" size="sm"
              onClick={() => setEditingStages([...editingStages, { name: "", color: COR_PADRAO_DE_ETAPA, win_probability: 50, order: editingStages.length }])}>
              <Plus className="mr-1 h-3.5 w-3.5" />Adicionar etapa
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePipeline} disabled={savingPipeline || editingStages.some((s) => !s.name.trim())}>
              {savingPipeline && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Painel da pessoa, sem sair do quadro.
          `onUpdate` invalida negócios TAMBÉM: editar a pessoa muda o subtítulo
          dos cards, e o drawer escreve direto no supabase, fora do react-query --
          sem isto o card continuaria mostrando o nome antigo. */}
      <ContactDrawer
        contact={contatoNoPainel}
        onClose={() => setContatoNoPainel(null)}
        onUpdate={() => {
          qc.invalidateQueries({ queryKey: ["contacts"] });
          qc.invalidateQueries({ queryKey: ["deals"] });
        }}
        companies={companies}
      />

      {/* O COMPOSITOR DO CRM, aberto pelo envelope do card.
          Já vem endereçado e amarrado ao contato e ao negócio, então o envio
          entra no histórico -- que é o que a linha de interação do card lê. */}
      <EmailComposeModal
        open={!!negocioParaEmail}
        onOpenChange={(aberto) => { if (!aberto) setNegocioParaEmail(null); }}
        defaultTo={negocioParaEmail?.contact?.email || ""}
        defaultContactId={negocioParaEmail?.contact_id || undefined}
        defaultDealId={negocioParaEmail?.id}
        onSent={() => {
          setNegocioParaEmail(null);
          // O card mostra a última interação: sem invalidar, o e-mail enviado
          // não apareceria até a próxima recarga.
          qc.invalidateQueries({ queryKey: ["deals"] });
          qc.invalidateQueries({ queryKey: ["activities"] });
        }}
      />
    </PageShell>
  );
}
