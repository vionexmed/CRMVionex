import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SeloComPonto } from "@/components/layout/ListaV1";
import { useAtualizarProduto } from "@/hooks/queries/useProdutos";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { cn } from "@/lib/utils";
import { formatarMoeda } from "@/lib/formato";
import type { Produto } from "@/lib/api/produtos";

/**
 * Um produto do catálogo, no formato do V1: miniatura, interruptor de ativo,
 * nome e descrição, preço grande com a unidade ao lado e o rodapé com a
 * situação.
 *
 * O INTERRUPTOR é o caminho curto para ativar/desativar -- a referência o põe
 * no cartão, e o formulário continua tendo o mesmo campo. O clique nele não
 * pode abrir a edição, por isso para a propagação.
 *
 * A miniatura aproveita `foto_url` quando existe; antes a foto era o cartão
 * inteiro, mas a maior parte do catálogo (planos, serviços) não tem foto, e um
 * quadrado cinza com ícone ocupava a altura toda sem dizer nada.
 *
 * Não há categoria nem contagem de vendas no banco: o rodapé mostra só o que
 * existe (SKU e situação).
 */
export function CartaoDeProduto({
  produto,
  aoClicar,
  className,
}: {
  produto: Produto;
  aoClicar?: (p: Produto) => void;
  className?: string;
}) {
  const inativo = !produto.ativo;
  const atualizar = useAtualizarProduto();
  const { toast } = useToast();

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
        "flex flex-col p-4 transition-colors",
        aoClicar && "cursor-pointer hover:border-primary/40",
        // Desativado continua visível — é o único jeito de reativar. Mas
        // esmaecido, para não competir com o que está à venda.
        inativo && "bg-surface-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-muted-foreground">
          {produto.foto_url ? (
            <img src={produto.foto_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Package aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
        {/* O alvo do Switch já tem a altura do controle; o wrapper só barra o clique. */}
        <span onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Switch
            checked={produto.ativo}
            onCheckedChange={alternar}
            disabled={atualizar.isPending}
            aria-label={produto.ativo ? `Desativar ${produto.nome}` : `Ativar ${produto.nome}`}
          />
        </span>
      </div>

      <div className={cn("mt-3 flex flex-1 flex-col", inativo && "opacity-70")}>
        <p className="vx-titulo-secao truncate">{produto.nome}</p>
        {/* `min-h` segura a altura: sem ele, descrição curta deixa o cartão mais
            baixo que o vizinho e o preço sai em alturas diferentes na grade. */}
        <p className="vx-subtitulo mt-0.5 line-clamp-2 min-h-8 leading-relaxed">
          {produto.descricao || "Sem descrição"}
        </p>
        <p className="mt-3 flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums tracking-tight">
            {formatarMoeda(Number(produto.preco), produto.moeda)}
          </span>
          <span className="text-xs text-muted-foreground">/{produto.unidade}</span>
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <SeloComPonto tom={inativo ? "neutro" : "sucesso"}>{inativo ? "Inativo" : "Ativo"}</SeloComPonto>
        {produto.sku && (
          <span className="truncate font-mono text-xs text-muted-foreground">{produto.sku}</span>
        )}
      </div>
    </Card>
  );
}
