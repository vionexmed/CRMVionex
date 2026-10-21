import { useEffect, useState, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Building2 as Building2Icon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { useCompanyFromSearch } from "@/hooks/queries/useGlobalSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ChipAdicionarFiltro, ChipDeFiltro, Iniciais, LinhaDeFiltros } from "@/components/layout/ListaV1";
import { ResponsavelCelula } from "@/components/clientes/CelulasDeCliente";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, LayoutGrid, List, Upload, Download,
  Trash2, X,
} from "lucide-react";
import { mensagemErro } from "@/lib/erro-supabase";
import { useToast } from "@/hooks/use-toast";
import { CompanyDrawer } from "@/components/crm/CompanyDrawer";
import { CompanyCreateModal } from "@/components/crm/CompanyCreateModal";
import { CSVImportModal } from "@/components/crm/CSVImportModal";
import { Paginacao } from "@/components/layout/Paginacao";
import type { Database } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanies, useDeleteCompany, companiesKeys } from "@/hooks/queries/useCompanies";
import { useMembers } from "@/hooks/queries/useMembers";
import { SortHeader, useOrdenacao } from "@/components/layout/SortHeader";
import { LoadingState, ErrorState, EmptyState } from "@/components/layout/EstadoDaLista";
import { formatarData, formatarMoedaInteira } from "@/lib/formato";
import { SegmentedControl } from "@/components/layout/SegmentedControl";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import { exportarCSV } from "@/lib/csv";
import { BarraDeFiltros, BarraDeSelecao } from "@/components/layout/BarraDeAcoes";

type Company = Database["public"]["Tables"]["companies"]["Row"];

type SortKey = "name" | "domain" | "industry" | "size" | "revenue" | "created_at";
type ViewMode = "table" | "cards";
const PAGE_SIZE = 50;

interface CompanyFilters {
  industry?: string;
  size?: string;
  ownerId?: string;
}

export default function Companies() {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // `isLoading` e `isError` existiam e eram DESCARTADOS: a página
  // desestruturava só `data`. Enquanto a consulta rodava, a tabela mostrava
  // "Nenhuma empresa encontrada" -- e mostrava o mesmo se a consulta falhasse.
  // Três situações, uma resposta só, e a errada nas duas primeiras.
  const { data: companies = [], isLoading: carregando, isError: falhou, refetch } = useCompanies();
  const { data: members = [] } = useMembers();
  const deleteCompany = useDeleteCompany();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const { sortKey, sortDir, toggleSort } = useOrdenacao<SortKey>("created_at");
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CompanyFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const recordId = searchParams.get("id");
  const detail = useCompanyFromSearch(recordId);
  const drawerCompany = !detail.isError && detail.data?.org_id === orgId && detail.data?.id === recordId ? detail.data : null;
  const setDrawerCompany = (record: Company | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (record) next.set("id", record.id);
      else next.delete("id");
      return next;
    });
  };


  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Realtime subscription — invalidate React Query cache on remote changes
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`companies:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `org_id=eq.${orgId}` }, () => {
        qc.invalidateQueries({ queryKey: companiesKeys.all(orgId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, qc]);

  const invalidate = () => {
    if (orgId) qc.invalidateQueries({ queryKey: companiesKeys.all(orgId) });
  };

  // Get unique industries for filter
  const industries = useMemo(() => {
    return [...new Set(companies.map((c) => c.industry).filter(Boolean))] as string[];
  }, [companies]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const s = `${c.name} ${c.domain} ${c.industry}`.toLowerCase();
      if (search && !s.includes(search.toLowerCase())) return false;
      if (filters.industry && c.industry !== filters.industry) return false;
      if (filters.size && c.size !== filters.size) return false;
      if (filters.ownerId && c.owner_id !== filters.ownerId) return false;
      return true;
    });
  }, [companies, search, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "domain": cmp = (a.domain || "").localeCompare(b.domain || ""); break;
        case "industry": cmp = (a.industry || "").localeCompare(b.industry || ""); break;
        case "size": cmp = (a.size || "").localeCompare(b.size || ""); break;
        case "revenue": cmp = (Number(a.revenue) || 0) - (Number(b.revenue) || 0); break;
        case "created_at": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);


  const allSelected = paginated.length > 0 && paginated.every((c) => selectedCompanies.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelectedCompanies(new Set());
    else setSelectedCompanies(new Set(paginated.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedCompanies);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCompanies(next);
  };

  const batchDelete = async () => {
    const ids = Array.from(selectedCompanies);
    await Promise.all(ids.map((id) => deleteCompany.mutateAsync(id)));
    setSelectedCompanies(new Set());
    toast({ title: `${ids.length} empresas excluídas` });
  };

  const exportCSV = () => {
    const rows = sorted.map((c) => ({
      Nome: c.name, Domínio: c.domain || "", Indústria: c.industry || "",
      Tamanho: c.size || "", Receita: c.revenue || "", Website: c.website || "",
    }));
    // Escrevia sem BOM e sem escapar aspas: o Excel abria com acento quebrado
    // ("Indústria" virava "IndÃºstria"), e uma empresa chamada
    // `Silva "Móveis" Ltda` deslocava todas as colunas da linha.
    exportarCSV(rows, "empresas");
    toast({ title: `${rows.length} empresas exportadas` });
  };


  if (!orgId) return <SemOrganizacao />;

  return (
    <PageShell
      title="Empresas"
      contagem={{ valor: filtered.length, unidade: "empresa" }}
      actions={
        <>
          <SegmentedControl<ViewMode>
            rotuloGrupo="Visualização"
            valor={viewMode}
            onChange={setViewMode}
            opcoes={[
              { valor: "table", rotulo: "Tabela", icone: List },
              { valor: "cards", rotulo: "Cartões", icone: LayoutGrid },
            ]}
          />
          <Button variant="outline" onClick={() => setCsvOpen(true)} aria-label="Importar CSV" className="hidden sm:flex">
            <Upload className="mr-1.5 h-3.5 w-3.5" />Importar CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)} aria-label="Criar nova empresa">
            <Plus className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">Nova empresa</span><span className="sm:hidden">Nova</span>
          </Button>
        </>
      }
    >
      {recordId && detail.isPending && <p role="status" className="text-sm text-muted-foreground">Abrindo empresa…</p>}
      {recordId && (detail.isError || (detail.isSuccess && !drawerCompany)) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{detail.isError ? "Não foi possível abrir empresa" : "Empresa indisponível"}</p>
            <p className="text-xs text-muted-foreground">{detail.isError ? mensagemErro(detail.error) : "O registro foi removido ou você não tem acesso nesta organização."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>Tentar novamente</Button>
          <Button variant="ghost" size="sm" onClick={() => setDrawerCompany(null)}>Voltar à lista</Button>
        </div>
      )}



      <LinhaDeFiltros
        direita={
          <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Exportar CSV">
            <Download className="mr-1.5 h-3.5 w-3.5" />Exportar
          </Button>
        }
      >
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar empresas" placeholder="Buscar empresas…" className="h-8 w-56 pl-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filters.industry && (
          <ChipDeFiltro ativo onRemover={() => setFilters({ ...filters, industry: undefined })} rotuloRemover="Remover filtro de indústria">
            Indústria: {filters.industry}
          </ChipDeFiltro>
        )}
        {filters.size && (
          <ChipDeFiltro ativo onRemover={() => setFilters({ ...filters, size: undefined })} rotuloRemover="Remover filtro de tamanho">
            Tamanho: {filters.size}
          </ChipDeFiltro>
        )}
        {filters.ownerId && (
          <ChipDeFiltro ativo onRemover={() => setFilters({ ...filters, ownerId: undefined })} rotuloRemover="Remover filtro de responsável">
            Responsável: {members.find((m) => m.id === filters.ownerId)?.name || members.find((m) => m.id === filters.ownerId)?.email || "—"}
          </ChipDeFiltro>
        )}
        <ChipAdicionarFiltro onClick={() => setShowFilters(!showFilters)} />
      </LinhaDeFiltros>

      {showFilters && (
        <BarraDeFiltros>
          <div className="space-y-1">
            <Label className="text-xs">Indústria</Label>
            <Select value={filters.industry || "all"} onValueChange={(v) => setFilters({ ...filters, industry: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tamanho</Label>
            <Select value={filters.size || "all"} onValueChange={(v) => setFilters({ ...filters, size: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="201-500">201-500</SelectItem>
                <SelectItem value="500+">500+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Select value={filters.ownerId || "all"} onValueChange={(v) => setFilters({ ...filters, ownerId: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {Object.values(filters).some(Boolean) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters({})}>
              <X className="mr-1 h-3 w-3" />Limpar
            </Button>
          )}
        </BarraDeFiltros>
      )}

      {selectedCompanies.size > 0 && (
        <BarraDeSelecao
          quantidade={selectedCompanies.size}
          substantivo="empresa"
          substantivoPlural="empresas"
          onLimpar={() => setSelectedCompanies(new Set())}
        >
          <Button size="sm" variant="destructive" onClick={batchDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
          </Button>
        </BarraDeSelecao>
      )}

      {carregando && <LoadingState linhas={8} />}

      {!carregando && falhou && (
        <ErrorState
          descricao="A lista de empresas não pôde ser carregada. Nenhum dado foi alterado."
          onTentarNovamente={() => refetch()}
        />
      )}

      {!carregando && !falhou && filtered.length === 0 && (
        <EmptyState
          icone={Building2Icon}
          titulo={search ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
          descricao={
            search
              ? "Nenhuma empresa corresponde ao que você buscou."
              : "Cadastre a primeira empresa ou importe uma planilha."
          }
          acao={
            !search && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova empresa
              </Button>
            )
          }
        />
      )}

      {!carregando && !falhou && filtered.length > 0 && viewMode === "table" && (
        <div className="vx-table">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todas" /></TableHead>
                <TableHead><SortHeader rotulo="Empresa" campo="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="hidden sm:table-cell"><SortHeader rotulo="Domínio" campo="domain" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="hidden md:table-cell"><SortHeader rotulo="Indústria" campo="industry" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="hidden lg:table-cell"><SortHeader rotulo="Tamanho" campo="size" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="hidden lg:table-cell"><SortHeader rotulo="Receita" campo="revenue" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="hidden md:table-cell w-[140px]">Responsável</TableHead>
                <TableHead className="hidden md:table-cell"><SortHeader rotulo="Criado em" campo="created_at" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c) => (
                <TableRow key={c.id} className={`cursor-pointer ${selectedCompanies.has(c.id) ? "bg-accent/40" : ""}`} onClick={() => setDrawerCompany(c)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedCompanies.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Iniciais nome={c.name} forma="empresa" />
                      <span className="font-semibold">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">{c.domain}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{c.industry}</TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{c.size}</TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{formatarMoedaInteira(Number(c.revenue))}</TableCell>
                  <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                    <ResponsavelCelula ownerId={c.owner_id} membros={members} rotuloDe={`Responsável por ${c.name}`} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                    {c.created_at ? formatarData(c.created_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {!carregando && !falhou && filtered.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {paginated.map((c) => (
            <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => setDrawerCompany(c)}>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <Iniciais nome={c.name} forma="empresa" tamanho="lg" />
                  <div className="overflow-hidden">
                    <p className="font-semibold truncate">{c.name}</p>
                    {c.industry && <p className="text-xs text-muted-foreground truncate">{c.industry}</p>}
                  </div>
                </div>
                {c.domain && <p className="text-xs text-muted-foreground">{c.domain}</p>}
                {c.revenue && <p className="text-sm font-semibold text-primary">{formatarMoedaInteira(Number(c.revenue))}</p>}
              </CardContent>
            </Card>
          ))}
          {paginated.length === 0 && <div className="col-span-full py-10 text-center text-muted-foreground">Nenhuma empresa encontrada</div>}
        </div>
      )}

      <Paginacao
        pagina={page}
        totalPaginas={totalPages}
        total={sorted.length}
        unidade="empresa"
        onMudar={setPage}
      />

      <CompanyDrawer key={`${user?.id}:${orgId}:${recordId}`} company={drawerCompany} onClose={() => setDrawerCompany(null)} onUpdate={invalidate} />
      <CompanyCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <CSVImportModal open={csvOpen} onOpenChange={setCsvOpen} onImported={invalidate} entityType="companies" />
    </PageShell>
  );
}
