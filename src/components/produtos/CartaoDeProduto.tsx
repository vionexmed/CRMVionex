import { Box, CalendarDays, Link2, Package, Repeat, Puzzle, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SeloComPonto, type Tom } from "@/components/layout/ListaV1";
import { useAtualizarProduto } from "@/hooks/queries/useProdutos";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { cn } from "@/lib/utils";
import { formatarMoeda, formatarMoedaInteira } from "@/lib/formato";
import type { Produto } from "@/lib/api/produtos";
import {
  ROTULO_DO_TIPO, chaveDaCategoria, unidadeDoPreco, resumoDeVendas, tipoDoProduto, type TipoCobranca,
} from "@/lib/produtos-catalogo";

/**
 * O ícone acompanha a CATEGORIA (planos repetem, implantação é caixa, serviço
 * é agenda, integração é elo); categoria desconhecida cai no tipo de cobrança.
 */
function iconeDoProduto(categoria: string, tipo: TipoCobranca): LucideIcon {
  const c = chaveDaCategoria(categoria);
  if (c.startsWith("plano")) return Repeat;
  if (c.startsWith("implanta")) return Box;
  if (c.startsWith("servico")) return CalendarDays;
  if (c.startsWith("integra")) return Link2;
  return tipo === "recorrente" ? Repeat : tipo === "adicional" ? Puzzle : Package;
}

/**
 * Um produto do catálogo, no formato do Visual 01: ícone da categoria,
 * interruptor de ativo, nome e descrição, preço grande com a unidade ao lado e,
 * embaixo da linha, o selo do tipo de cobrança com o resumo de vendas.
 *
 * O interruptor é o caminho curto para ativar/desativar; o clique nele não pode
 * abrir a edição, por isso para a propagação. Produto inativo continua visível
 * (é o único jeito de reativar), só esmaecido.
 *
 * `foto_url`, quando existe, substitui o ícone.
 */
export function CartaoDeProduto({
  produto, categoria, tom, maisVendido, metricas, mes, aoClicar, className,
}: {
  produto: Produto;
  /** Nome da categoria, para escolher o ícone. */
  categoria: string;
  /** Cor do ponto do selo. */
  tom: Tom;
  maisVendido?: boolean;
  metricas?: { clientes: number; vendas_mes: number };
  /** Mês curto ("out") do texto de vendas. */
  mes: string;
  aoClicar?: (p: Produto) => void;
  className?: string;
}) {
  const inativo = !produto.ativo;
  const atualizar = useAtualizarProduto();
  const { toast } = useToast();
  const tipo = tipoDoProduto(produto);
  const Icone = iconeDoProduto(categoria, tipo);

  const alternar = (ativo: boolean) =>
    atualizar.mutate(
      { id: produto.id, patch: { ativo } },
      {
        onError: (e) =>
          toast({ title: "Não foi possível alterar o produto", description: mensagemErro(e), variant: "destructive" }),
      },
    );

  return (
    <Card
      onClick={aoClicar ? () => aoClicar(produto) : undefined}
      className={cn(
        "flex flex-col px-5 py-4 transition-colors",
        aoClicar && "cursor-pointer hover:border-primary/40",
        inativo && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {produto.foto_url ? (
          <img src={produto.foto_url} alt="" loading="lazy" className="h-8 w-8 rounded-md border border-border object-cover" />
        ) : (
          <Icone aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        )}
        <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-3">
          {maisVendido && <span className="text-xs font-semibold text-warning">Mais vendido</span>}
          <Switch
            checked={produto.ativo}
            onCheckedChange={alternar}
            disabled={atualizar.isPending}
            aria-label={produto.ativo ? `Desativar ${produto.nome}` : `Ativar ${produto.nome}`}
          />
        </span>
      </div>

      <p className="mt-3 text-base font-semibold tracking-tight">{produto.nome}</p>
      {produto.descricao && (
        <p className="vx-subtitulo mt-0.5 line-clamp-2 leading-relaxed">{produto.descricao}</p>
      )}
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums tracking-tight">
          {Number.isInteger(Number(produto.preco)) ? formatarMoedaInteira(Number(produto.preco), produto.moeda) : formatarMoeda(Number(produto.preco), produto.moeda)}
        </span>
        <span className="text-xs text-muted-foreground">{unidadeDoPreco(produto.unidade)}</span>
      </p>

      <div className="mt-3 flex items-start justify-between gap-3 border-t border-border pt-3">
        <SeloComPonto tom={tom} variante="pilula" className="shrink-0">{ROTULO_DO_TIPO[tipo]}</SeloComPonto>
        <span className="min-w-0 text-right text-xs leading-relaxed text-muted-foreground">
          {resumoDeVendas(produto, tipo, metricas, mes)}
        </span>
      </div>
    </Card>
  );
}
