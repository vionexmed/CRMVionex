import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/layout/EstadoDaLista";
import { formatarData } from "@/lib/formato";
import { Users as UsersIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useContactFromSearch } from "@/hooks/queries/useGlobalSearch";
import { useQueryClient } from "@tanstack/react-query";
import {
  useContacts, useAllContacts, useLastActivities, useDeleteContacts, useCidadesDeContato,
  useUpdateContactsLifecycle, useUpdateContactOwner, contactsKeys,
} from "@/hooks/queries/useContacts";
import { contactsApi } from "@/lib/api/contacts";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanies } from "@/hooks/queries/useCompanies";
import { useMembers } from "@/hooks/queries/useMembers";
import { PAGE_SIZE, type ContactRow } from "@/lib/api/contacts";
import {
  ORIGIN_OPTIONS, PAISES,
  LIFECYCLE_LABELS, type LifecycleStage,
} from "@/lib/contact-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChipAdicionarFiltro, ChipDeFiltro, Iniciais, LinhaDeFiltros, VisoesDaLista, type Visao,
} from "@/components/layout/ListaV1";
import {
  CabecalhoOrdenavel, CaixaDeSelecao, EstagioSelo, OrigemSelo, Pontuacao, ProximaAtividade,
  ResponsavelCelula, UltimoContato,
} from "@/components/clientes/CelulasDeCliente";
import {
  BOTAO_DA_LINHA, ChipDeResponsavel, MenuDeColunas, MenuDeOrdenacao, NovaVisaoDialog,
  SeletorDeEstagios, textoDosEstagios,
} from "@/components/clientes/FiltrosDeContatos";
import { useColunasVisiveis, useVisoesSalvas, type FiltrosSalvos } from "@/components/clientes/preferenciasDeContatos";
import { useProximasAtividades } from "@/components/clientes/useProximasAtividades";
import { useContagensDeContatos } from "@/components/clientes/useContagensDeContatos";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Upload, Trash2, X, Loader2,
} from "lucide-react";
import { ContactsKanbanByOwner } from "@/components/crm/ContactsKanbanByOwner";
import { useToast } from "@/hooks/use-toast";
import { ContactDrawer } from "@/components/crm/ContactDrawer";
import { ContactCreateModal } from "@/components/crm/ContactCreateModal";
import { CSVImportModal } from "@/components/crm/CSVImportModal";
import { useDebounce } from "@/hooks/useDebounce";
import { mensagemErro } from "@/lib/erro-supabase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";
import { useOrdenacao } from "@/components/layout/SortHeader";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import { exportarCSV } from "@/lib/csv";
import { PREFIXO_ORIGEM_EXATA } from "@/lib/api/contacts";
import { useOrigensDeContato } from "@/hooks/queries/useOrigensDeContato";
import { invalidarPainel } from "@/lib/invalidar-painel";
import { formatarEmail, formatarTelefone, nomeDoContato } from "@/lib/contato-formato";
import { BarraDeFiltros, BarraDeSelecao } from "@/components/layout/BarraDeAcoes";
import { Paginacao } from "@/components/layout/Paginacao";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

/** Larguras (px) da tabela, medidas na referência; com `table-fixed` elas valem de verdade. */
const LARGURA = { check: 38, nome: 240, estagio: 113, empresa: 195, origem: 113, pontuacao: 91, responsavel: 95, ultimoContato: 118, proximaAtividade: 190 } as const;
type SortKey = "name" | "email" | "status" | "created_at" | "title" | "lifecycle_stage" | "lead_score" | "last_contact";
type ViewMode = "table" | "cards" | "owner";


interface ContactFilters {
  /**
   * Ciclo de vida, não `status`.
   *
   * Era `status` e ia para a API por `...filters`. Espalhamento não dispara a
   * checagem de propriedade excedente do TypeScript, então uma chave renomeada
   * de um lado só some em silêncio do outro -- o filtro pararia de filtrar e
   * nada acusaria.
   */
  lifecycleStages?: string[];
  /** "Sem resposta há 3+ dias" -- vai para a API pelo espalhamento, com o mesmo nome. */
  semResposta?: boolean;
  ownerId?: string;
  companyId?: string;
  country?: string;
  /** Mesmo nome que em `ContactListParams`: vai para a API pelo espalhamento. */
  city?: string;
  origin?: string;
  createdFrom?: string;
  createdTo?: string;
}

/**
 * Selo de ciclo de vida.
 *
 * Substitui o selo por `status`, que mostrava quatro valores ("Lead",
 * "Prospect", "Cliente", "Churned") para seis estágios reais -- lead e
 * "contatado" apareciam iguais, e "em negociação" aparecia como "Prospect".
 *
 * Mesma marcação de Leads.tsx de propósito: a mesma pessoa era descrita em dois
 * vocabulários dependendo da tela em que você a olhasse.
 */
function LifecycleBadge({ stage }: { stage: LifecycleStage | null }) {
  return <EstagioSelo stage={stage} />;
}

/** Selo da origem do contato (de onde veio). */
function OriginBadge({ metadata }: { metadata: unknown }) {
  return <OrigemSelo metadata={metadata} />;
}

export default function Contacts() {
  const { orgId } = useOrg();
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [novaVisaoAberta, setNovaVisaoAberta] = useState(false);
  const { sortKey, sortDir, toggleSort } = useOrdenacao<SortKey>("last_contact");
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ContactFilters>({});
  /** Exclusão aguardando confirmação, com o que será apagado junto. */
  const [exclusao, setExclusao] = useState<{ ids: string[]; negocios: number; atividades: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const recordId = searchParams.get("id");
  const detail = useContactFromSearch(recordId);
  const drawerContact = !detail.isError && detail.data?.org_id === orgId && detail.data?.id === recordId ? detail.data : null;
  const setDrawerContact = (record: Contact | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (record) next.set("id", record.id);
      else next.delete("id");
      return next;
    });
  };

  /**
   * As origens que EXISTEM na base, para o filtro deixar de ser lista fixa.
   *
   * Eram quatro buckets cravados. Desde que a importação grava o nome escolhido
   * ("NEXMED 2026", "APROXIMA MED"), o selo da lista mostrava um valor que o
   * filtro não oferecia -- dava para ver a origem e não dava para filtrar por
   * ela, o pior dos dois mundos.
   *
   * A mesma consulta alimenta o seletor de origem da ficha e do cadastro. Em
   * cache: abrir uma ficha não pede a lista de novo, e as duas telas nunca
   * oferecem listas diferentes.
   */
  const { data: origensReais = [] } = useOrigensDeContato();

  // Debounce search to avoid a query on every keystroke
  const debouncedSearch = useDebounce(search, 300);
  const debouncedFilters = useDebounce(filters, 300);

  /**
   * As cidades oferecidas seguem o ciclo de vida escolhido: em /leads, só as
   * cidades dos leads. Uma cidade já escolhida que não esteja na lista (o
   * estágio mudou, ou a consulta falhou) continua como opção, senão o seletor
   * ficaria em branco com o filtro ainda ativo.
   */
  const { data: cidades = [] } = useCidadesDeContato(filters.lifecycleStages?.length === 1 ? filters.lifecycleStages[0] : undefined);
  const cidadeForaDaLista = !!filters.city && !cidades.some((c) => c.cidade === filters.city);


  // Reset to page 0 when filters/search/sort change
  useEffect(() => { setPage(0); }, [debouncedSearch, debouncedFilters, sortKey, sortDir]);

  // Seleção não pode sobreviver a mudança de página/filtro/busca —
  // senão ações em lote atingem linhas que o usuário não está mais vendo
  useEffect(() => { setSelectedContacts(new Set()); }, [page, debouncedSearch, filters]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /**
   * `?estagio=lead` — é para cá que /leads redireciona.
   *
   * A tela de Leads era uma FILA DE TRIAGEM e foi removida; o que ela mostrava
   * é esta lista com o filtro aplicado. O parâmetro é consumido e o painel de
   * filtros abre, senão a pessoa vê uma lista curta sem entender por quê -- uma
   * lista filtrada em silêncio lê-se como base vazia.
   *
   * Diferente do `action=new`, o parâmetro NÃO é apagado da URL: apagá-lo faria
   * um F5 perder o filtro, e o link salvo deixaria de significar o que dizia.
   */
  useEffect(() => {
    // `?estagio=lead` ou, com vários, `?estagio=lead,qualified`.
    const estagios = (searchParams.get("estagio") ?? "").split(",").filter((e) => e in LIFECYCLE_LABELS);
    if (estagios.length === 0) return;
    setFilters((f) => (f.lifecycleStages?.join(",") === estagios.join(",") ? f : { ...f, lifecycleStages: estagios }));
  }, [searchParams]);

  // Server-side query — all filtering, sorting and pagination on Postgres
  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    sortKey,
    sortDir,
    ...debouncedFilters,
  };
  const {
    data: result,
    isFetching,
    isLoading,
    isError,
    refetch,
  } = useContacts(queryParams);
  const contacts = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  /** Sem nenhuma pontuação na página a coluna seria uma fileira de traços. */
  const temPontuacao = contacts.some((c) => c.lead_score != null);
  // Hook ANTES do retorno antecipado de `!orgId`: hook depois dele quebra a ordem de render.
  const { data: proximas } = useProximasAtividades(orgId, contacts.map((c) => c.id));


  // Kanban por vendedor precisa de TODOS os contatos, não só a página atual
  const { data: allContactsForKanban = [] } = useAllContacts(
    { search: debouncedSearch || undefined, ...debouncedFilters },
    viewMode === "owner"
  );

  // Supporting data (small datasets, cached separately)
  const { data: companies = [] } = useCompanies();
  /**
   * Empresa por id, em vez de `.find()` dentro do `.map()` das linhas.
   *
   * Com 50 linhas e 200 empresas, aquilo era 10 mil comparações por render --
   * e refazia tudo a cada tecla digitada na busca. O mapa é O(1) por linha e
   * só é reconstruído quando a lista de empresas muda.
   */
  const empresaPorId = useMemo(
    () => new Map(companies.map((co) => [co.id, co])),
    [companies],
  );
  const { data: members = [] } = useMembers();
  const { data: lastActivityMap = new Map() } = useLastActivities();

  // Mutations
  const { mutateAsync: deleteMany } = useDeleteContacts();
  const { mutateAsync: updateLifecycle } = useUpdateContactsLifecycle();
  const { mutateAsync: updateOwner } = useUpdateContactOwner();

  // Realtime — invalidate all contact queries on remote changes
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("contacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `org_id=eq.${orgId}` }, () => {
        qc.invalidateQueries({ queryKey: contactsKeys.all(orgId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, qc]);

  const invalidate = () => {
    if (!orgId) return;
    qc.invalidateQueries({ queryKey: contactsKeys.all(orgId) });
    // O PAINEL também. Importar 93 contatos não mexia em "Leads recebidos",
    // porque as consultas dele vivem em chaves outras -- e o número velho na
    // tela fazia parecer que a importação não funcionou.
    invalidarPainel(qc, orgId);
  };

  const { data: contagens } = useContagensDeContatos(orgId, user?.id);

  /**
   * Único caminho para mudar filtro. Além do estado, mantém `?estagio=` em
   * sincronia: o efeito acima reaplica o parâmetro a cada mudança de URL (abrir
   * a ficha mexe em `?id=`), então um filtro de estágio removido só no estado
   * voltaria sozinho.
   */
  const aplicarFiltros = (patch: Partial<ContactFilters>) => {
    setFilters((f) => {
      const novo = { ...f, ...patch };
      // Lista vazia e `false` são "sem filtro": deixá-los no objeto acenderia o
      // botão "Limpar" e a mensagem "nenhum resultado para os filtros".
      if (!novo.lifecycleStages?.length) delete novo.lifecycleStages;
      if (!novo.semResposta) delete novo.semResposta;
      return novo;
    });
    if ("lifecycleStages" in patch) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (patch.lifecycleStages?.length) next.set("estagio", patch.lifecycleStages.join(","));
        else next.delete("estagio");
        return next;
      }, { replace: true });
    }
  };

  const { visoes: visoesSalvas, salvar: salvarVisao, remover: removerVisao } = useVisoesSalvas(orgId);
  const { visivel, alternar: alternarColuna } = useColunasVisiveis(orgId);

  const filtrosDaVisao = (f: FiltrosSalvos) => JSON.stringify(Object.entries(f).filter(([, v]) => v && !(Array.isArray(v) && !v.length)).sort());
  /**
   * A aba ativa é deduzida dos filtros, não guardada à parte -- estado
   * paralelo faria a aba dizer "Todos" com a lista filtrada por outra coisa.
   * "Todos" é o que sobra: estágio extra e responsável não tiram a aba (a
   * referência a mantém acesa com o chip de estágio ligado).
   */
  const visaoAtiva = (() => {
    const { lifecycleStages: e, ownerId: o, semResposta: sem, ...resto } = filters;
    const salva = visoesSalvas.find((v) => filtrosDaVisao(v.filtros) === filtrosDaVisao(filters as FiltrosSalvos) && !sem);
    if (salva) return `salva:${salva.id}`;
    if (sem && !o && !e) return "semresposta";
    if (e?.length === 1 && e[0] === "lead" && !o && !sem && !Object.values(resto).some(Boolean)) return "leads";
    if (!e && o && o === user?.id && !sem && !Object.values(resto).some(Boolean)) return "meus";
    return "todos";
  })();
  const escolherVisao = (v: string) => {
    const limpo: Partial<ContactFilters> = { lifecycleStages: undefined, ownerId: undefined, semResposta: undefined };
    if (v === "todos") aplicarFiltros(limpo);
    else if (v === "leads") aplicarFiltros({ ...limpo, lifecycleStages: ["lead"] });
    else if (v === "meus") aplicarFiltros({ ...limpo, ownerId: user?.id });
    else if (v === "semresposta") aplicarFiltros({ ...limpo, semResposta: true });
    else if (v.startsWith("salva:")) {
      const salva = visoesSalvas.find((x) => `salva:${x.id}` === v);
      if (salva) aplicarFiltros({
        ...limpo, companyId: undefined, origin: undefined, country: undefined, city: undefined,
        createdFrom: undefined, createdTo: undefined, ...salva.filtros,
      });
    }
  };

  const handleOwnerChange = async (contactId: string, newOwnerId: string | null) => {
    try {
      await updateOwner({ id: contactId, ownerId: newOwnerId });
      toast({ title: newOwnerId ? "Responsável atribuído" : "Responsável removido" });
    } catch (e: unknown) {
      toast({ title: "Erro ao atribuir responsável", description: mensagemErro(e), variant: "destructive" });
    }
  };


  const allSelected = contacts.length > 0 && contacts.every((c) => selectedContacts.has(c.id));
  const algumaSelecionada = selectedContacts.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelectedContacts(new Set());
    else setSelectedContacts(new Set(contacts.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContacts(next);
  };

  /**
   * Passo 1: descobrir o que está vinculado antes de tentar apagar.
   *
   * Antes ia direto no DELETE, e o Postgres recusava com violação de chave
   * estrangeira -- `deals.contact_id` e `activities.contact_id` não têm
   * ON DELETE. Pior: o `catch` mostrava "[object Object]", porque o erro do
   * PostgREST é um objeto simples e não passa no `e instanceof Error`. O
   * usuário via que falhou e nada sobre o motivo, com a informação disponível
   * no campo `message`.
   */
  const pedirExclusao = async () => {
    const ids = Array.from(selectedContacts);
    if (ids.length === 0) return;
    try {
      const vinculos = await contactsApi.contarVinculos(ids);
      if (vinculos.negocios === 0 && vinculos.atividades === 0) {
        await executarExclusao(ids, false);
        return;
      }
      // Só pergunta quando há o que perder. Confirmação para exclusão sem
      // consequência é ruído, e ruído treina as pessoas a clicar sem ler.
      setExclusao({ ids, ...vinculos });
    } catch (e: unknown) {
      toast({ title: "Erro ao verificar vínculos", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const executarExclusao = async (ids: string[], comVinculos: boolean) => {
    try {
      await deleteMany({ ids, comVinculos });
      setSelectedContacts(new Set());
      setExclusao(null);
      toast({ title: `${ids.length} contato${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}` });
    } catch (e: unknown) {
      toast({ title: "Erro ao excluir contatos", description: mensagemErro(e), variant: "destructive" });
    }
  };

  /**
   * Move os selecionados no ciclo de vida.
   *
   * Escrevia `status` (coluna legada) e deixava o trigger derivar o ciclo de
   * vida. Com quatro valores para seis estágios, a derivação perde informação:
   * "prospect" virava sempre 'qualified', então aplicar "Prospect" a alguém em
   * negociação o REBAIXAVA sem aviso.
   */
  const batchChangeLifecycle = async (stage: LifecycleStage) => {
    const ids = Array.from(selectedContacts);
    try {
      await updateLifecycle({ ids, stage });
      setSelectedContacts(new Set());
      toast({ title: `${ids.length} contatos movidos para ${LIFECYCLE_LABELS[stage]}` });
    } catch (e: unknown) {
      toast({ title: "Erro ao mover contatos", description: mensagemErro(e), variant: "destructive" });
    }
  };

  // Escapa célula CSV: aspas duplicadas + prefixo contra injeção de fórmula (Excel)

  const [exporting, setExporting] = useState(false);
  const exportCSV = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      // Exporta TODOS os contatos com os filtros atuais, não só a página visível
      const allContacts = await contactsApi.listAll(orgId, {
        search: debouncedSearch || undefined, sortKey, sortDir, ...filters,
      });
      const rows = allContacts.map((c) => {
        const comp = empresaPorId.get((c as Record<string, unknown>).company_id as string);
        return {
          Nome: c.first_name, Sobrenome: c.last_name || "", Email: c.email || "",
          // O CSV leva o dado CRU, não o formatado: exportação existe para
          // reimportar e para cruzar com outro sistema, e máscara atrapalha as duas.
          Telefone: c.phone || "", Cargo: c.title || "", Empresa: comp?.name || "", "Ciclo de vida": LIFECYCLE_LABELS[c.lifecycle_stage ?? "lead"],
        };
      });
      exportarCSV(rows, "contatos");
      toast({ title: `${rows.length} contatos exportados` });
    } catch (e: unknown) {
      toast({ title: "Erro ao exportar", description: mensagemErro(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (!orgId) return <SemOrganizacao />;

  const limparEstagio = () => aplicarFiltros({ lifecycleStages: undefined });
  const nomeDoMembro = (id?: string) => {
    const m = members.find((x) => x.id === id);
    return m?.name || m?.email || "—";
  };
  const rotuloDaOrigem = (o: string) => {
    if (o.startsWith(PREFIXO_ORIGEM_EXATA)) return o.slice(PREFIXO_ORIGEM_EXATA.length);
    return ORIGIN_OPTIONS.find((x) => x.value === o)?.label ?? o;
  };
  const periodo = [filters.createdFrom, filters.createdTo].some(Boolean)
    ? `${filters.createdFrom ? formatarData(filters.createdFrom) : "…"} – ${filters.createdTo ? formatarData(filters.createdTo) : "…"}`
    : null;
  const algumFiltro = Object.values(filters).some(Boolean);

  const visoes: Visao<string>[] = [
    { valor: "todos", rotulo: "Todos", contagem: contagens?.todos },
    { valor: "leads", rotulo: "Leads novos", contagem: contagens?.leads },
    { valor: "meus", rotulo: "Meus contatos", contagem: contagens?.meus },
    { valor: "semresposta", rotulo: "Sem resposta há 3+ dias", contagem: contagens?.semResposta ?? undefined, tom: "alerta" },
    ...visoesSalvas.map((v) => ({ valor: `salva:${v.id}`, rotulo: v.nome })),
  ];
  const resumoDoFiltro = [
    filters.lifecycleStages?.length ? `Estágio: ${textoDosEstagios(filters.lifecycleStages)}` : null,
    filters.ownerId ? `Responsável: ${nomeDoMembro(filters.ownerId)}` : null,
    filters.companyId ? `Empresa: ${empresaPorId.get(filters.companyId)?.name ?? "—"}` : null,
    filters.origin ? `Origem: ${rotuloDaOrigem(filters.origin)}` : null,
    filters.country ? `País: ${filters.country}` : null,
    filters.city ? `Cidade: ${filters.city.trim()}` : null,
    periodo ? `Período: ${periodo}` : null,
  ].filter(Boolean).join(" · ");
  const colunasDaTabela = (["estagio", "empresa", "origem", "pontuacao", "responsavel", "ultimoContato", "proximaAtividade"] as const)
    .filter((id) => visivel(id) && (id !== "pontuacao" || temPontuacao));

  const largurasDaTabela = {
    total: LARGURA.check + LARGURA.nome + colunasDaTabela.reduce((soma, id) => soma + LARGURA[id], 0),
  };

  return (
    <PageShell
      title="Contatos"
      contagem={{ valor: totalCount, unidade: "contato" }}
      actions={
        <Button variant="outline" onClick={() => setCsvOpen(true)} className="relative -top-[7px] -my-[3px] hidden h-[41px] bg-card px-3 shadow-sm sm:flex">
          <Upload className="mr-1 h-3.5 w-3.5" />Importar CSV
        </Button>
      }
    >
      {recordId && detail.isPending && <p role="status" className="text-sm text-muted-foreground">Abrindo contato…</p>}
      {recordId && (detail.isError || (detail.isSuccess && !drawerContact)) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{detail.isError ? "Não foi possível abrir contato" : "Contato indisponível"}</p>
            <p className="text-xs text-muted-foreground">{detail.isError ? mensagemErro(detail.error) : "O registro foi removido ou você não tem acesso nesta organização."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>Tentar novamente</Button>
          <Button variant="ghost" size="sm" onClick={() => setDrawerContact(null)}>Voltar à lista</Button>
        </div>
      )}

      {/* As visões SÃO filtros: cada aba escreve em `filters` (e em ?estagio=),
          e a aba ativa é deduzida dele. Estado paralelo faria a aba dizer
          "Todos" com um chip de estágio ligado ao lado. */}
      <VisoesDaLista
        className="!mt-[17px]"
        visoes={visoes}
        valor={visaoAtiva}
        onChange={escolherVisao}
        extra={
          <button
            type="button"
            onClick={() => setNovaVisaoAberta(true)}
            className="vx-control inline-flex h-8 items-center whitespace-nowrap rounded px-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            + Nova visão
          </button>
        }
      />
      {visaoAtiva.startsWith("salva:") && (
        <p className="sr-only">Visão salva ativa. <button type="button" onClick={() => removerVisao(visaoAtiva.slice(6))}>Excluir visão</button></p>
      )}

      <LinhaDeFiltros
        direita={
          <>
            <MenuDeOrdenacao<SortKey>
              valor={sortKey}
              onChange={(k) => { if (k !== sortKey) toggleSort(k); }}
              opcoes={[
                ["last_contact", "Último contato"],
                ["name", "Nome"],
                ["email", "E-mail"],
                ["lifecycle_stage", "Estágio"],
                ["lead_score", "Pontuação"],
                ["title", "Especialidade"],
                ["status", "Situação"],
                ["created_at", "Criado em"],
              ]}
            />
            <MenuDeColunas<ViewMode>
              visivel={visivel}
              onAlternar={alternarColuna}
              visualizacao={viewMode}
              onVisualizacao={setViewMode}
              visualizacoes={[["table", "Tabela"], ["cards", "Cartões"], ["owner", "Vendedor"]]}
            />
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting} className={BOTAO_DA_LINHA}>
                {exporting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Exportar
              </Button>
            )}
          </>
        }
      >
        {filters.lifecycleStages && (
          <ChipDeFiltro ativo className="bg-primary/15 text-primary" onClick={() => setShowFilters(true)} onRemover={limparEstagio} rotuloRemover="Remover filtro de estágio">
            Estágio: {textoDosEstagios(filters.lifecycleStages)}
          </ChipDeFiltro>
        )}
        {filters.semResposta && (
          <ChipDeFiltro ativo className="bg-primary/15 text-primary" onRemover={() => aplicarFiltros({ semResposta: undefined })} rotuloRemover="Remover filtro de sem resposta">
            Sem resposta há 3+ dias
          </ChipDeFiltro>
        )}
        <ChipDeResponsavel membros={members} valor={filters.ownerId} onChange={(id) => aplicarFiltros({ ownerId: id })} />
        {filters.companyId && (
          <ChipDeFiltro ativo onRemover={() => aplicarFiltros({ companyId: undefined })} rotuloRemover="Remover filtro de empresa">
            Empresa: {empresaPorId.get(filters.companyId)?.name ?? "—"}
          </ChipDeFiltro>
        )}
        {filters.origin && (
          <ChipDeFiltro ativo onRemover={() => aplicarFiltros({ origin: undefined })} rotuloRemover="Remover filtro de origem">
            Origem: {rotuloDaOrigem(filters.origin)}
          </ChipDeFiltro>
        )}
        {([["country", "País"], ["city", "Cidade"]] as const).map(([key, label]) => filters[key] && (
          <ChipDeFiltro key={key} ativo onRemover={() => aplicarFiltros({ [key]: undefined })} rotuloRemover={`Remover filtro de ${label.toLowerCase()}`}>
            {label}: {filters[key]?.trim()}
          </ChipDeFiltro>
        ))}
        {periodo && (
          <ChipDeFiltro ativo onRemover={() => aplicarFiltros({ createdFrom: undefined, createdTo: undefined })} rotuloRemover="Remover filtro de período">
            Período: {periodo}
          </ChipDeFiltro>
        )}
        <ChipAdicionarFiltro onClick={() => setShowFilters(!showFilters)} className="border-border px-2.5 font-normal [&_svg]:h-3 [&_svg]:w-3" />
      </LinhaDeFiltros>

      {/* O painel completo: o chip "+ Filtro" abre isto. Os chips acima só
          mostram o que está ligado; para ligar algo novo, é aqui. */}
      {showFilters && (
        <BarraDeFiltros>
          <div className="space-y-1">
            <Label className="text-xs">Busca</Label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input aria-label="Buscar contatos" placeholder="Nome ou e-mail…" className="h-8 w-48 pl-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
              {isFetching && <Loader2 className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          {/* Os seis estágios, na ordem do avanço, e VÁRIOS de uma vez. O seletor
              antigo era por `status` (coluna legada, quatro opções) e depois por
              um estágio só; "Lead, Qualificado e Oportunidade" juntos -- a fila
              de quem ainda não é cliente -- não tinha como ser pedida. */}
          <div className="space-y-1">
            <Label className="text-xs">Estágio</Label>
            <SeletorDeEstagios valor={filters.lifecycleStages ?? []} onChange={(v) => aplicarFiltros({ lifecycleStages: v })} />
          </div>
          {/* Filtrar por responsável é o que devolve a carteira de cada um
              depois que a base passou a ser da organização inteira. */}
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Select value={filters.ownerId || "all"} onValueChange={(v) => aplicarFiltros({ ownerId: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Empresa</Label>
            <Select value={filters.companyId || "all"} onValueChange={(v) => aplicarFiltros({ companyId: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <Select value={filters.origin || "all"} onValueChange={(v) => aplicarFiltros({ origin: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ORIGIN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                {/* As origens de verdade, depois dos grupos.
                    Os quatro de cima agrupam por padrão de texto; estas são
                    valores literais, e por isso levam prefixo -- uma planilha
                    chamada "manual" cairia no bucket errado sem ele.
                    A contagem ao lado responde "vale filtrar por esta?" antes
                    do clique. */}
                {origensReais.length > 0 && (
                  <div className="my-1 border-t border-border" role="presentation" />
                )}
                {origensReais.map((o) => (
                  <SelectItem key={o.origem} value={`${PREFIXO_ORIGEM_EXATA}${o.origem}`}>
                    {o.origem} ({o.contatos})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-country" className="text-xs">País</Label>
            <Select value={filters.country || "all"} onValueChange={(v) => aplicarFiltros({ country: v === "all" ? undefined : v })}>
              <SelectTrigger id="contact-country" className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os países</SelectItem>
                {PAISES.map((pais) => <SelectItem key={pais} value={pais}>{pais}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* A cidade é escolhida entre as que existem na base, com contagem --
              e a contagem bate com o filtro, que compara a cidade inteira. */}
          <div className="space-y-1">
            <Label htmlFor="filtro-cidade" className="text-xs">Cidade</Label>
            <Select value={filters.city || "all"} onValueChange={(v) => aplicarFiltros({ city: v === "all" ? undefined : v })}>
              <SelectTrigger id="filtro-cidade" className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cidadeForaDaLista && <SelectItem value={filters.city!}>{filters.city!.trim()}</SelectItem>}
                {cidades.map((c) => (
                  <SelectItem key={c.cidade} value={c.cidade}>
                    {c.cidade.trim()} ({c.contatos})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Criado de</Label>
            <Input type="date" className="w-36 h-8 text-xs" value={filters.createdFrom ?? ""} onChange={(e) => aplicarFiltros({ createdFrom: e.target.value || undefined })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">até</Label>
            <Input type="date" className="w-36 h-8 text-xs" value={filters.createdTo ?? ""} onChange={(e) => aplicarFiltros({ createdTo: e.target.value || undefined })} />
          </div>
          {algumFiltro && (
            <Button variant="ghost" size="sm" className="h-8 self-end text-xs" onClick={() => aplicarFiltros({ lifecycleStages: undefined, semResposta: undefined, ownerId: undefined, companyId: undefined, origin: undefined, country: undefined, city: undefined, createdFrom: undefined, createdTo: undefined })}>
              <X className="mr-1 h-3 w-3" />Limpar filtros
            </Button>
          )}
        </BarraDeFiltros>
      )}


      {selectedContacts.size > 0 && (
        <BarraDeSelecao
          quantidade={selectedContacts.size}
          substantivo="contato"
          substantivoPlural="contatos"
          onLimpar={() => setSelectedContacts(new Set())}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Mudar estágio</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {/* "Novo lead" fica por último e nomeado pelo efeito: é o único
                  item que ANDA PARA TRÁS no ciclo de vida, e devolve a pessoa
                  para a fila de qualificação. Estava misturado aos outros como
                  "Lead", indistinguível de um avanço. */}
              <DropdownMenuItem onClick={() => batchChangeLifecycle("contacted")}>Contatado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => batchChangeLifecycle("qualified")}>Qualificado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => batchChangeLifecycle("opportunity")}>Em negociação</DropdownMenuItem>
              <DropdownMenuItem onClick={() => batchChangeLifecycle("customer")}>Cliente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => batchChangeLifecycle("disqualified")}>Descartado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => batchChangeLifecycle("lead")}>
                Devolver para a fila de leads
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={pedirExclusao}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
            </Button>
          )}
        </BarraDeSelecao>
      )}

      {viewMode === "table" && (
        <div className="vx-table">
          <div className="overflow-x-auto">
          <Table className="table-fixed text-xs" style={{ width: largurasDaTabela.total, minWidth: "100%" }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: LARGURA.check, height: 41, paddingLeft: 4, paddingRight: 0 }}>
                  <CaixaDeSelecao
                    rotulo="Selecionar todos"
                    estado={allSelected ? true : algumaSelecionada ? "parcial" : false}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead style={{ width: LARGURA.nome }}><CabecalhoOrdenavel rotulo="Nome" ativo={sortKey === "name"} direcao={sortDir} onClick={() => toggleSort("name")} /></TableHead>
                {colunasDaTabela.includes("estagio") && <TableHead style={{ width: LARGURA.estagio }}><CabecalhoOrdenavel rotulo="Estágio" ativo={sortKey === "lifecycle_stage"} direcao={sortDir} onClick={() => toggleSort("lifecycle_stage")} /></TableHead>}
                {colunasDaTabela.includes("empresa") && <TableHead style={{ width: LARGURA.empresa }}>Empresa</TableHead>}
                {colunasDaTabela.includes("origem") && <TableHead style={{ width: LARGURA.origem }}>Origem</TableHead>}
                {colunasDaTabela.includes("pontuacao") && <TableHead style={{ width: LARGURA.pontuacao }}><CabecalhoOrdenavel rotulo="Pontuação" ativo={sortKey === "lead_score"} direcao={sortDir} onClick={() => toggleSort("lead_score")} /></TableHead>}
                {colunasDaTabela.includes("responsavel") && <TableHead style={{ width: LARGURA.responsavel }}>Responsável</TableHead>}
                {colunasDaTabela.includes("ultimoContato") && <TableHead style={{ width: LARGURA.ultimoContato }}><CabecalhoOrdenavel rotulo="Último contato" ativo={sortKey === "last_contact"} direcao={sortDir} onClick={() => toggleSort("last_contact")} /></TableHead>}
                {colunasDaTabela.includes("proximaAtividade") && <TableHead style={{ width: LARGURA.proximaAtividade }}>Próxima atividade</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: ContactRow) => {
                const comp = empresaPorId.get((c as Record<string, unknown>).company_id as string);
                const meta = (c as Record<string, unknown>).metadata as Record<string, string> | null;
                const nomeEmpresa = comp?.name || meta?.empresa_manual || "";
                const marcado = selectedContacts.has(c.id);
                // Sem a visão no banco `ultimo_contato` não vem; a última atividade
                // registrada é o melhor substituto até a migração subir.
                const ultimo = c.ultimo_contato !== undefined
                  ? (c.ultimo_contato ? new Date(c.ultimo_contato) : null)
                  : (lastActivityMap.get(c.id) ?? null);
                return (
                <TableRow key={c.id} data-state={marcado ? "selected" : undefined} className={cn("cursor-pointer", marcado && "bg-primary/10")} style={{ "--row-h": "52.5px" } as React.CSSProperties} onClick={() => setDrawerContact(c)}>
                  <TableCell style={{ paddingLeft: 4, paddingRight: 0 }} onClick={(e) => e.stopPropagation()}>
                    <CaixaDeSelecao rotulo={`Selecionar ${c.first_name}`} estado={marcado} onChange={() => toggleOne(c.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Iniciais nome={nomeDoContato(c.first_name, c.last_name)} />
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{nomeDoContato(c.first_name, c.last_name)}</span>
                        {/* O e-mail, ou o telefone quando não há e-mail: a
                            referência mostra uma linha só, e é o que permitiu
                            as colunas de e-mail e telefone saírem. */}
                        <span className="block truncate text-xs tabular-nums text-muted-foreground">
                          {c.email ? formatarEmail(c.email) : c.phone ? formatarTelefone(c.phone) : "—"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  {colunasDaTabela.includes("estagio") && <TableCell><LifecycleBadge stage={c.lifecycle_stage} /></TableCell>}
                  {colunasDaTabela.includes("empresa") && (
                    <TableCell>
                      {nomeEmpresa ? (
                        <div className="flex items-center gap-2">
                          <Iniciais nome={nomeEmpresa} forma="empresa" tamanho="sm" className="h-[26px] w-[26px]" />
                          <span className="truncate">{nomeEmpresa}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {colunasDaTabela.includes("origem") && (
                    <TableCell><OriginBadge metadata={(c as Record<string, unknown>).metadata} /></TableCell>
                  )}
                  {colunasDaTabela.includes("pontuacao") && (
                    <TableCell><Pontuacao valor={c.lead_score} /></TableCell>
                  )}
                  {colunasDaTabela.includes("responsavel") && (
                    <TableCell  onClick={(e) => e.stopPropagation()}>
                      <ResponsavelCelula
                        ownerId={c.owner_id}
                        membros={members}
                        onChange={(novo) => handleOwnerChange(c.id, novo)}
                        rotuloDe={`Responsável por ${nomeDoContato(c.first_name, c.last_name)}`}
                      />
                    </TableCell>
                  )}
                  {colunasDaTabela.includes("ultimoContato") && (
                    <TableCell><UltimoContato data={ultimo} /></TableCell>
                  )}
                  {colunasDaTabela.includes("proximaAtividade") && (
                    <TableCell><ProximaAtividade info={proximas?.get(c.id)} /></TableCell>
                  )}
                </TableRow>
                );
              })}
              {contacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    {/* Carregando, falhou e vazio pediam a MESMA frase antes.
                        Falha de consulta virava "nenhum contato encontrado" --
                        afirmação que a tela não tinha como sustentar. */}
                    {isLoading ? (
                      <LoadingState linhas={5} className="p-3" />
                    ) : isError ? (
                      <ErrorState onTentarNovamente={() => refetch()} className="m-3" />
                    ) : (
                      <EmptyState
                        icone={UsersIcon}
                        titulo="Nenhum contato encontrado"
                        descricao={
                          debouncedSearch || algumFiltro
                            ? "Nenhum resultado para a busca e os filtros atuais."
                            : "Cadastre o primeiro contato ou importe uma planilha."
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {viewMode === "cards" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {contacts.map((c) => (
            <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => setDrawerContact(c)}>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Iniciais nome={nomeDoContato(c.first_name, c.last_name)} tamanho="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{nomeDoContato(c.first_name, c.last_name)}</p>
                    {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                  </div>
                </div>
                {c.email && <p className="text-xs text-muted-foreground truncate">{formatarEmail(c.email)}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <LifecycleBadge stage={c.lifecycle_stage} />
                  <OriginBadge metadata={(c as Record<string, unknown>).metadata} />
                </div>
              </CardContent>
            </Card>
          ))}
          {contacts.length === 0 && (
            <div className="col-span-full">
              {isLoading ? (
                <LoadingState linhas={4} />
              ) : isError ? (
                <ErrorState onTentarNovamente={() => refetch()} />
              ) : (
                <EmptyState
                  icone={UsersIcon}
                  titulo="Nenhum contato encontrado"
                  descricao={
                    debouncedSearch || algumFiltro
                      ? "Nenhum resultado para a busca e os filtros atuais."
                      : "Cadastre o primeiro contato ou importe uma planilha."
                  }
                />
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === "owner" && (
        <ContactsKanbanByOwner
          contacts={allContactsForKanban}
          companies={companies}
          members={members}
          onContactClick={(c) => setDrawerContact(c)}
          onOwnerChange={handleOwnerChange}
        />
      )}

      {viewMode !== "owner" && (
        <Paginacao
          pagina={page}
          totalPaginas={totalPages}
          total={totalCount}
          unidade="contato"
          onMudar={setPage}
        />
      )}

      {/* Confirmação nomeando o que será apagado.
          Sem transação no PostgREST: os filhos são apagados antes do contato, e
          se o último passo falhar sobra um contato sem negócios. Por isso a
          contagem aparece aqui, e não um "tem certeza?" genérico. */}
      <Dialog open={!!exclusao} onOpenChange={(o) => !o && setExclusao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir {exclusao?.ids.length} contato{(exclusao?.ids.length ?? 0) !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Isto vai apagar também:</p>
                <ul className="list-disc pl-5">
                  {!!exclusao?.negocios && (
                    <li>
                      {exclusao.negocios} negócio{exclusao.negocios !== 1 ? "s" : ""} — valor e
                      histórico de etapas incluídos
                    </li>
                  )}
                  {!!exclusao?.atividades && (
                    <li>
                      {exclusao.atividades} atividade{exclusao.atividades !== 1 ? "s" : ""} —
                      ligações, reuniões e notas registradas
                    </li>
                  )}
                </ul>
                <p className="text-muted-foreground">
                  E-mails e mensagens de WhatsApp são preservados, apenas deixam de estar
                  vinculados. Nada disso pode ser desfeito.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusao(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => exclusao && executarExclusao(exclusao.ids, true)}
            >
              Excluir tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NovaVisaoDialog
        aberto={novaVisaoAberta}
        onFechar={() => setNovaVisaoAberta(false)}
        resumo={resumoDoFiltro || "Nenhum filtro ligado: ligue algum antes de salvar a visão."}
        onSalvar={(nome) => {
          if (!algumFiltro) return;
          const { semResposta: _sem, ...guardar } = filters;
          salvarVisao(nome, guardar);
          setNovaVisaoAberta(false);
        }}
      />

      <ContactDrawer
        key={`${user?.id}:${orgId}:${recordId}`}
        contact={drawerContact}
        onClose={() => setDrawerContact(null)}
        onUpdate={invalidate}
        companies={companies}
      />

      <ContactCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
        companies={companies}
      />

      <CSVImportModal
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onImported={invalidate}
        entityType="contacts"
      />
    </PageShell>
  );
}