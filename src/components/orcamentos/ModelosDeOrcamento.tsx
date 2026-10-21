import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { formatarMoeda, pluralizar } from "@/lib/formato";
import { useProdutos } from "@/hooks/queries/useProdutos";
import {
  useExcluirModelo, useOrcamentoModelos, useSalvarModelo,
} from "@/hooks/queries/useOrcamentoModelos";
import type { OrcamentoModelo } from "@/lib/api/orcamento-modelos";
import { itemDeProduto } from "@/lib/api/orcamentos";
import { totaisDoOrcamento } from "@/lib/orcamento-calculo";
import type { ItemDeModelo } from "@/lib/orcamento-modelos";

/** Valores com que o formulário abre: de um modelo existente ou de um orçamento. */
export type ModeloInicial = {
  id?: string;
  nome: string;
  titulo: string | null;
  itens: ItemDeModelo[];
  validade_dias: number | null;
  desconto: number;
  condicoes: string | null;
  observacoes: string | null;
};

/** Número digitado: aceita vírgula; vazio vale zero sem forçar "0" na tela. */
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

type Linha = { produto_id: string | null; nome: string; descricao: string | null; unidade: string; preco: string; qtd: string; desc: string };

const paraLinha = (i: ItemDeModelo): Linha => ({
  produto_id: i.produto_id, nome: i.nome, descricao: i.descricao, unidade: i.unidade,
  preco: String(i.preco_unit), qtd: String(i.quantidade), desc: i.desconto ? String(i.desconto) : "",
});

/**
 * Cria ou edita um modelo. Serve também ao "Salvar como modelo": a tela abre
 * este mesmo formulário já preenchido com o orçamento, só sem nome.
 */
export function FormularioDeModelo({
  inicial, aoFechar, aoSalvar,
}: {
  /** `null` fecha. */
  inicial: ModeloInicial | null;
  aoFechar: () => void;
  aoSalvar?: (m: OrcamentoModelo) => void;
}) {
  const { toast } = useToast();
  const salvar = useSalvarModelo();
  const { data: produtos = [] } = useProdutos(true);
  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [validade, setValidade] = useState("");
  const [desconto, setDesconto] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    if (!inicial) return;
    setNome(inicial.nome);
    setTitulo(inicial.titulo ?? "");
    setValidade(inicial.validade_dias ? String(inicial.validade_dias) : "");
    setDesconto(inicial.desconto ? String(inicial.desconto) : "");
    setCondicoes(inicial.condicoes ?? "");
    setObservacoes(inicial.observacoes ?? "");
    setLinhas(inicial.itens.map(paraLinha));
  }, [inicial]);

  const mudar = (i: number, patch: Partial<Linha>) =>
    setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const totais = useMemo(
    () => totaisDoOrcamento(
      linhas.map((l) => ({ preco_unit: num(l.preco), quantidade: num(l.qtd), desconto: num(l.desc) })),
      num(desconto),
    ),
    [linhas, desconto],
  );

  const gravar = async () => {
    if (!nome.trim()) {
      toast({ title: "Dê um nome ao modelo", variant: "destructive" });
      return;
    }
    if (linhas.some((l) => !l.nome.trim())) {
      toast({ title: "Há item sem nome", variant: "destructive" });
      return;
    }
    const dias = Math.round(num(validade));
    try {
      const m = await salvar.mutateAsync({
        id: inicial?.id,
        dados: {
          nome: nome.trim(),
          titulo: titulo.trim() || null,
          itens: linhas.map((l) => ({
            produto_id: l.produto_id, nome: l.nome.trim(), descricao: l.descricao,
            unidade: l.unidade.trim() || "un", preco_unit: num(l.preco),
            quantidade: num(l.qtd) || 1, desconto: num(l.desc),
          })),
          validade_dias: dias >= 1 && dias <= 365 ? dias : null,
          desconto: totais.desconto,
          condicoes: condicoes.trim() || null,
          observacoes: observacoes.trim() || null,
        },
      });
      toast({ title: inicial?.id ? "Modelo atualizado" : "Modelo salvo", description: m.nome });
      aoSalvar?.(m);
      aoFechar();
    } catch (e: unknown) {
      toast({ title: "Não foi possível salvar o modelo", description: mensagemErro(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!inicial} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="vx-titulo-painel">{inicial?.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription className="text-xs">
            Os preços são copiados: mudar o catálogo depois não altera o modelo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="modelo-nome">Nome do modelo</Label>
              <Input id="modelo-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Plano Pro + implantação" className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="modelo-titulo">Título do orçamento</Label>
              <Input id="modelo-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Opcional" className="text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Itens</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"><Search className="mr-1 h-3.5 w-3.5" />Do catálogo</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar produto…" className="h-9 text-xs" />
                      <CommandList>
                        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Nada encontrado.</CommandEmpty>
                        <CommandGroup>
                          {produtos.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.nome} ${p.sku ?? ""} ${p.id}`}
                              onSelect={() => {
                                const n = itemDeProduto(p);
                                setLinhas((l) => [...l, paraLinha({ ...n, descricao: n.descricao ?? null })]);
                              }}
                              className="gap-2 text-xs"
                            >
                              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{formatarMoeda(Number(p.preco), p.moeda)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm"
                  onClick={() => setLinhas((l) => [...l, { produto_id: null, nome: "", descricao: null, unidade: "un", preco: "", qtd: "1", desc: "" }])}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Item livre
                </Button>
              </div>
            </div>

            {linhas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                Nenhum item ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((l, i) => (
                  <li key={i} className="rounded-lg border border-border p-2">
                    <div className="flex items-center gap-2">
                      <Input value={l.nome} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Nome do item" aria-label={`Nome do item ${i + 1}`} className="text-xs" />
                      <Button variant="ghost" size="icon" aria-label={`Remover ${l.nome || `item ${i + 1}`}`}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Input value={l.qtd} onChange={(e) => mudar(i, { qtd: e.target.value })} inputMode="decimal" aria-label={`Quantidade do item ${i + 1}`} placeholder="Qtd" className="text-xs tabular-nums" />
                      <Input value={l.unidade} onChange={(e) => mudar(i, { unidade: e.target.value })} aria-label={`Unidade do item ${i + 1}`} placeholder="un" className="text-xs" />
                      <Input value={l.preco} onChange={(e) => mudar(i, { preco: e.target.value })} inputMode="decimal" aria-label={`Preço unitário do item ${i + 1}`} placeholder="Unitário" className="text-xs tabular-nums" />
                      <Input value={l.desc} onChange={(e) => mudar(i, { desc: e.target.value })} inputMode="decimal" aria-label={`Desconto do item ${i + 1}`} placeholder="Desconto" className="text-xs tabular-nums" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="modelo-validade">Validade (dias)</Label>
              <Input id="modelo-validade" value={validade} onChange={(e) => setValidade(e.target.value)} inputMode="numeric" placeholder="30" className="text-xs tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="modelo-desconto">Desconto geral</Label>
              <Input id="modelo-desconto" value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0" className="text-xs tabular-nums" />
            </div>
            <div className="flex flex-col justify-end text-right">
              <span className="text-xs text-muted-foreground">Total do modelo</span>
              <span className="text-lg font-bold tabular-nums">{formatarMoeda(totais.total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="modelo-condicoes">Condições (o cliente lê)</Label>
            <Textarea id="modelo-condicoes" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} placeholder="Implantação em 2 parcelas · plano cobrado mensalmente" className="min-h-[56px] text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="modelo-obs">Observações internas</Label>
            <Textarea id="modelo-obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Só o time vê" className="min-h-[56px] text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={aoFechar} disabled={salvar.isPending}>Cancelar</Button>
          <Button size="sm" onClick={gravar} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {inicial?.id ? "Salvar" : "Salvar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A lista de modelos: usar, editar, excluir, criar. */
export function ModelosDeOrcamento({
  aberto, aoFechar, aoUsar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Abre o construtor de orçamento já com este modelo. */
  aoUsar: (m: OrcamentoModelo) => void;
}) {
  const { toast } = useToast();
  const { data: modelos = [], isLoading, isError } = useOrcamentoModelos();
  const excluir = useExcluirModelo();
  const [editando, setEditando] = useState<ModeloInicial | null>(null);
  const [apagando, setApagando] = useState<OrcamentoModelo | null>(null);

  const novo: ModeloInicial = {
    nome: "", titulo: null, itens: [], validade_dias: 30, desconto: 0, condicoes: null, observacoes: null,
  };

  const apagar = async () => {
    if (!apagando) return;
    try {
      await excluir.mutateAsync(apagando.id);
      toast({ title: "Modelo excluído", description: "Os orçamentos já criados com ele não mudam." });
      setApagando(null);
    } catch (e: unknown) {
      toast({ title: "Não foi possível excluir", description: mensagemErro(e), variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="vx-titulo-painel">Modelos de orçamento</DialogTitle>
            <DialogDescription className="text-xs">
              Propostas prontas para reaproveitar. Ao usar, o orçamento nasce preenchido e continua editável.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="py-6 text-center text-xs text-destructive">Não foi possível carregar os modelos.</p>
          ) : modelos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <FileText aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">Nenhum modelo ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie um aqui, ou use “Salvar como modelo” em um orçamento pronto.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {modelos.map((m) => {
                const total = totaisDoOrcamento(
                  m.itens.map((i) => ({ preco_unit: i.preco_unit, quantidade: i.quantidade, desconto: i.desconto })),
                  Number(m.desconto) || 0,
                ).total;
                return (
                  <li key={m.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.itens.length} {pluralizar(m.itens.length, "item", "itens")} · {formatarMoeda(total)}
                        {m.validade_dias ? ` · ${m.validade_dias} dias` : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => { aoFechar(); aoUsar(m); }}>Usar</Button>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${m.nome}`}
                      onClick={() => setEditando({ ...m })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${m.nome}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setApagando(m)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditando(novo)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Novo modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FormularioDeModelo inicial={editando} aoFechar={() => setEditando(null)} />

      <Dialog open={!!apagando} onOpenChange={(o) => !o && setApagando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="vx-titulo-painel">Excluir “{apagando?.nome}”?</DialogTitle>
            <DialogDescription className="text-xs">
              Os orçamentos já criados a partir dele continuam como estão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApagando(null)} disabled={excluir.isPending}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={apagar} disabled={excluir.isPending}>
              {excluir.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
