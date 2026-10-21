import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trophy, XCircle, Trash2, AlertTriangle } from "lucide-react";
import type { DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { SortHeader, useOrdenacao } from "@/components/layout/SortHeader";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { SeloDeNegocio } from "@/components/crm/SeloDeNegocio";
import { BarraDeSelecao } from "@/components/layout/BarraDeAcoes";
import { Iniciais } from "@/components/layout/ListaV1";
import { corDaEtapa, etapasEmOrdem } from "@/components/negocios/sinais";
import { cn } from "@/lib/utils";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];


type SortKey = "title" | "value" | "close_date" | "probability" | "status" | "created_at";

interface DealsListProps {
  deals: DealWithRelations[];
  stages: Stage[];
  selectedDeals: Set<string>;
  onSelectionChange: (s: Set<string>) => void;
  onDealClick: (d: DealWithRelations) => void;
  onBatchAction: (action: "won" | "lost" | "delete") => void;
  /** Exclusão em lote é restrita a admin/owner */
  canDelete?: boolean;
}

export function DealsList({
  deals, stages, selectedDeals, onSelectionChange, onDealClick, onBatchAction,
  canDelete = true,
}: DealsListProps) {
  const { sortKey, sortDir, toggleSort } = useOrdenacao<SortKey>("created_at");


  const sorted = [...deals].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title": cmp = (a.title || "").localeCompare(b.title || ""); break;
      case "value": cmp = (Number(a.value) || 0) - (Number(b.value) || 0); break;
      case "probability": cmp = (Number(a.probability) || 0) - (Number(b.probability) || 0); break;
      case "close_date": cmp = (a.close_date || "").localeCompare(b.close_date || ""); break;
      case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
      case "created_at": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const allSelected = sorted.length > 0 && sorted.every((d) => selectedDeals.has(d.id));
  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(sorted.map((d) => d.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedDeals);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  /**
   * Nome e cor de cada etapa, indexados uma vez. A cor é a da POSIÇÃO no funil
   * dela (a mesma do ponto do quadro), e por isso a ordem é contada dentro do
   * funil de cada etapa, não na lista misturada de todos os funis.
   */
  const etapaPorId = useMemo(() => {
    const porFunil = new Map<string, Stage[]>();
    for (const e of stages) porFunil.set(e.pipeline_id, [...(porFunil.get(e.pipeline_id) ?? []), e]);
    const mapa = new Map<string, { nome: string; classe: string }>();
    for (const lista of porFunil.values()) {
      const ordenadas = etapasEmOrdem(lista);
      ordenadas.forEach((e, i) => mapa.set(e.id, { nome: e.name, classe: corDaEtapa(i, ordenadas.length) }));
    }
    return mapa;
  }, [stages]);

  return (
    <div className="space-y-3">
      {selectedDeals.size > 0 && (
        <BarraDeSelecao
          quantidade={selectedDeals.size}
          substantivo="negócio"
          substantivoPlural="negócios"
          onLimpar={() => onSelectionChange(new Set())}
        >
          <Button size="sm" variant="outline" onClick={() => onBatchAction("won")}>
            <Trophy className="mr-1 h-3.5 w-3.5 text-success" />Ganhos
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBatchAction("lost")}>
            <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" />Perdidos
          </Button>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => onBatchAction("delete")}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
            </Button>
          )}
        </BarraDeSelecao>
      )}

      <div className="vx-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
              </TableHead>
              <TableHead><SortHeader rotulo="Título" campo="title" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader rotulo="Valor" campo="value" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="hidden md:table-cell">Etapa</TableHead>
              <TableHead className="hidden lg:table-cell"><SortHeader rotulo="Probabilidade" campo="probability" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortHeader rotulo="Fechamento" campo="close_date" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader rotulo="Status" campo="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="hidden lg:table-cell">Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((deal) => {
              const daysUntilClose = deal.close_date
                ? Math.ceil((new Date(deal.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const isUrgent = daysUntilClose !== null && daysUntilClose < 7 && daysUntilClose >= 0;

              return (
                <TableRow key={deal.id} className="cursor-pointer" onClick={() => onDealClick(deal)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedDeals.has(deal.id)} onCheckedChange={() => toggleOne(deal.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Iniciais
                        nome={deal.company?.name || deal.title}
                        forma={deal.company ? "empresa" : "pessoa"}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{deal.title}</p>
                        {deal.company && <p className="truncate text-xs text-muted-foreground">{deal.company.name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  {/* Valor em cor de texto, não de marca: numa coluna inteira
                      de valores, a cor de destaque competia com o título. */}
                  <TableCell className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                    {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      const etapa = deal.stage_id ? etapaPorId.get(deal.stage_id) : undefined;
                      return etapa ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", etapa.classe)} />
                          {etapa.nome}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>;
                    })()}
                  </TableCell>
                  <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                    {(deal.probability ?? 0) > 0 ? `${deal.probability}%` : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {deal.close_date ? (
                      <div className={`flex items-center gap-1 text-xs ${isUrgent ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                        {isUrgent && <AlertTriangle className="h-3 w-3" />}
                        {formatarData(deal.close_date)}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {/* Esta lista pintava "Aberto" de teal; as outras três
                        telas deixavam neutro. Aberto é o estado PADRÃO --
                        destacá-lo compete com "Ganho" e "Perdido", que são os
                        que merecem cor. */}
                    <SeloDeNegocio status={deal.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {/* O dono vem resolvido por useMembers() em Deals.tsx: não
                        existe FK de deals para profiles. */}
                    {deal.owner ? (
                      <div className="flex items-center gap-2">
                        <Iniciais nome={deal.owner.name} tamanho="sm" destaque />
                        <span className="truncate text-xs text-foreground">{deal.owner.name}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhum negócio encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
