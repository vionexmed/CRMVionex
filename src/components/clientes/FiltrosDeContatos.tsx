import { useState, type ReactNode } from "react";
import { ChevronDown, Columns3, Loader2, Menu, Upload } from "lucide-react";
import { BotaoDeIcone } from "@/components/padrao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChipDeFiltro } from "@/components/layout/ListaV1";
import { LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/contact-options";
import { rotuloDoEstagio } from "@/components/clientes/CelulasDeCliente";
import { COLUNAS_ESCONDIVEIS, type ColunaId } from "@/components/clientes/preferenciasDeContatos";

/** Botão branco com contorno da linha de filtros: "Colunas", "Exportar", "Ordenar". */
export const BOTAO_DA_LINHA = "h-8 rounded-md border-border bg-card px-[13px] text-xs font-semibold text-foreground shadow-sm";

/** "Estágio: Lead, Qualificado, Oportunidade", na ordem do avanço e não na da seleção. */
export function textoDosEstagios(estagios: string[]): string {
  const ordem = Object.keys(LIFECYCLE_LABELS);
  return [...estagios].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).map(rotuloDoEstagio).join(", ");
}

/** Seleção de vários estágios, como botões que ligam e desligam. */
export function SeletorDeEstagios({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label="Estágios" className="flex flex-wrap gap-1.5">
      {(Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map((e) => {
        const ligado = valor.includes(e);
        return (
          <button
            key={e}
            type="button"
            aria-pressed={ligado}
            onClick={() => onChange(ligado ? valor.filter((x) => x !== e) : [...valor, e])}
            className={cn(
              "vx-control h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ligado ? "border-transparent bg-primary/15 text-primary" : "border-border bg-card text-foreground hover:bg-surface-2",
            )}
          >
            {rotuloDoEstagio(e)}
          </button>
        );
      })}
    </div>
  );
}

type Membro = { id: string; name: string | null; email: string | null };

/** "Responsável: todos" -- sempre à vista; escolhido, vira chip ativo removível. */
export function ChipDeResponsavel({ membros, valor, onChange }: {
  membros: Membro[];
  valor: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const escolhido = membros.find((m) => m.id === valor);
  const nome = escolhido ? (escolhido.name || escolhido.email) : "todos";
  const corpo = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Responsável: {nome}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onChange(undefined)}>Todos</DropdownMenuItem>
        {membros.map((m) => <DropdownMenuItem key={m.id} onClick={() => onChange(m.id)}>{m.name || m.email}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  if (valor) {
    return (
      <ChipDeFiltro ativo className="bg-primary/15 text-primary" onRemover={() => onChange(undefined)} rotuloRemover="Remover filtro de responsável">
        {corpo}
      </ChipDeFiltro>
    );
  }
  return <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground">{corpo}</span>;
}

/** "Ordenar: último contato ⌄". */
export function MenuDeOrdenacao<K extends string>({ valor, opcoes, onChange }: {
  valor: K;
  opcoes: [K, string][];
  onChange: (v: K) => void;
}) {
  const atual = opcoes.find(([k]) => k === valor)?.[1] ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Ordenar por" className={cn(BOTAO_DA_LINHA, "[&_svg]:size-3")}>
          Ordenar: {atual.toLowerCase()}
          <ChevronDown aria-hidden="true" className="ml-1.5 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={valor} onValueChange={(v) => onChange(v as K)}>
          {opcoes.map(([k, rotulo]) => <DropdownMenuRadioItem key={k} value={k}>{rotulo}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Colunas": quais colunas aparecem (guardado no navegador) e, no mesmo menu,
 * a forma de ver a base -- Tabela, Cartões ou Vendedor. O seletor de visão saiu
 * do cabeçalho para a referência ficar só com "Importar CSV" ali.
 */
export function MenuDeColunas<V extends string>({ visivel, onAlternar, visualizacao, visualizacoes, onVisualizacao }: {
  visivel: (id: ColunaId) => boolean;
  onAlternar: (id: ColunaId) => void;
  visualizacao: V;
  visualizacoes: [V, string][];
  onVisualizacao: (v: V) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={BOTAO_DA_LINHA}>
          <Columns3 aria-hidden="true" className="mr-1.5 hidden h-3.5 w-3.5 max-sm:inline" />Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Visualização</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={visualizacao} onValueChange={(v) => onVisualizacao(v as V)}>
          {visualizacoes.map(([k, rotulo]) => <DropdownMenuRadioItem key={k} value={k}>{rotulo}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        {COLUNAS_ESCONDIVEIS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={visivel(c.id)}
            // Mantém o menu aberto: ligar três colunas não deve pedir três aberturas.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onAlternar(c.id)}
          >
            {c.rotulo}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "+ Nova visão": guarda o filtro atual com um nome. */
export function NovaVisaoDialog({ aberto, onFechar, onSalvar, resumo }: {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (nome: string) => void;
  /** O que será guardado, em palavras: "Estágio: Lead · Responsável: Ana". */
  resumo: ReactNode;
}) {
  const [nome, setNome] = useState("");
  const salvar = () => { if (nome.trim()) { onSalvar(nome); setNome(""); } };
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) { setNome(""); onFechar(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova visão</DialogTitle>
          <DialogDescription>Guarda os filtros de agora como uma aba de Contatos, neste navegador.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome-da-visao">Nome da visão</Label>
            <Input id="nome-da-visao" autoFocus value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Oportunidades da Ana" />
          </div>
          <p className="text-xs text-muted-foreground">{resumo}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" disabled={!nome.trim()}>Salvar visão</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Menu "…" (hambúrguer) da barra de ferramentas: importar, exportar, forma de
 * ver a base, ordenação e colunas visíveis. Reúne o que antes eram três botões.
 */
export function MenuDaLista<V extends string, K extends string>({
  visivel, onAlternar, visualizacao, visualizacoes, onVisualizacao,
  ordenacao, opcoesDeOrdenacao, onOrdenar, onImportar, onExportar, exportando,
}: {
  visivel: (id: ColunaId) => boolean;
  onAlternar: (id: ColunaId) => void;
  visualizacao: V;
  visualizacoes: [V, string][];
  onVisualizacao: (v: V) => void;
  ordenacao: K;
  opcoesDeOrdenacao: [K, string][];
  onOrdenar: (k: K) => void;
  onImportar: () => void;
  /** Só para administradores: sem a função o item some. */
  onExportar?: () => void;
  exportando?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BotaoDeIcone aria-label="Mais opções da lista" icone={<Menu aria-hidden="true" />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
        <DropdownMenuItem onSelect={onImportar}><Upload aria-hidden="true" className="mr-2 h-4 w-4" />Importar CSV</DropdownMenuItem>
        {onExportar && (
          <DropdownMenuItem onSelect={onExportar} disabled={exportando}>
            {exportando && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}Exportar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Visualização</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={visualizacao} onValueChange={(v) => onVisualizacao(v as V)}>
          {visualizacoes.map(([k, rotulo]) => <DropdownMenuRadioItem key={k} value={k}>{rotulo}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={ordenacao} onValueChange={(v) => onOrdenar(v as K)}>
          {opcoesDeOrdenacao.map(([k, rotulo]) => <DropdownMenuRadioItem key={k} value={k}>{rotulo}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        {COLUNAS_ESCONDIVEIS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={visivel(c.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onAlternar(c.id)}
          >
            {c.rotulo}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
