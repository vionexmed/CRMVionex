import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LogoUploadField } from "@/components/crm/LogoUploadField";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { produtosApi, type Produto } from "@/lib/api/produtos";
import {
  useCriarProduto, useAtualizarProduto, useExcluirProduto,
} from "@/hooks/queries/useProdutos";
import { pluralizar } from "@/lib/formato";

const VAZIO = {
  nome: "", descricao: "", foto_url: "", preco: "", unidade: "un", sku: "", ativo: true,
  categoria: "", tipo: "", rotulo_clientes: "",
};

/** "" = não classificado: a tela deduz da unidade (ver `tipoDoProduto`). */
const TIPOS = [
  { valor: "", rotulo: "Automático (pela unidade)" },
  { valor: "recorrente", rotulo: "Recorrente" },
  { valor: "unico", rotulo: "Único" },
  { valor: "adicional", rotulo: "Adicional" },
];

/**
 * Cadastro de produto.
 *
 * A FOTO usa `LogoUploadField`, que já sobe para o Storage e devolve URL
 * pública -- com bucket próprio (`produtos`), para a política de acesso do
 * catálogo não se misturar com a dos logos de e-mail.
 *
 * O PREÇO é `string` no estado, não `number`. Com número, digitar "12," some o
 * caractere no meio da digitação e o campo briga com quem escreve centavos; a
 * conversão acontece uma vez, ao salvar.
 */
export function FormularioDeProduto({
  aberto,
  produto,
  categorias = [],
  aoFechar,
}: {
  /** Categorias já usadas, sugeridas ao digitar. */
  categorias?: string[];
  aberto: boolean;
  /** `null` cria; um produto edita. */
  produto: Produto | null;
  aoFechar: () => void;
}) {
  const { toast } = useToast();
  const criar = useCriarProduto();
  const atualizar = useAtualizarProduto();
  const excluir = useExcluirProduto();

  const [form, setForm] = useState(VAZIO);
  const [vinculos, setVinculos] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const editando = !!produto;

  useEffect(() => {
    if (!aberto) return;
    setConfirmando(false);
    setVinculos(null);
    setForm(
      produto
        ? {
            nome: produto.nome,
            descricao: produto.descricao ?? "",
            foto_url: produto.foto_url ?? "",
            preco: String(produto.preco ?? ""),
            unidade: produto.unidade,
            sku: produto.sku ?? "",
            ativo: produto.ativo,
            // Colunas da migração 20261021140000: ausentes até ela ser aplicada.
            categoria: produto.categoria ?? "",
            tipo: produto.tipo_cobranca ?? "",
            rotulo_clientes: produto.rotulo_clientes ?? "",
          }
        : VAZIO,
    );
  }, [aberto, produto]);

  const salvar = async () => {
    const preco = Number(String(form.preco).replace(",", "."));
    if (!form.nome.trim()) {
      toast({ title: "Dê um nome ao produto", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(preco) || preco < 0) {
      toast({ title: "Preço inválido", description: "Use número, como 1200 ou 1200,50.", variant: "destructive" });
      return;
    }

    const patch = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      foto_url: form.foto_url || null,
      preco,
      unidade: form.unidade.trim() || "un",
      // SKU vazio vira null e não "": o índice único é parcial
      // (`WHERE sku IS NOT NULL`), então dois produtos sem código não
      // conflitam. Com string vazia, o segundo seria recusado.
      sku: form.sku.trim() || null,
      ativo: form.ativo,
      // Só vão quando preenchidas (ou ao limpar um que existia): antes da
      // migração a coluna não existe, e mandá-la vazia faria TODO salvamento
      // falhar com 42703.
      ...(form.categoria.trim() || produto?.categoria ? { categoria: form.categoria.trim() || null } : {}),
      ...(form.tipo || produto?.tipo_cobranca ? { tipo_cobranca: form.tipo || null } : {}),
      ...(form.rotulo_clientes.trim() || produto?.rotulo_clientes
        ? { rotulo_clientes: form.rotulo_clientes.trim() || null } : {}),
    };

    try {
      if (produto) await atualizar.mutateAsync({ id: produto.id, patch });
      else await criar.mutateAsync(patch);
      toast({ title: produto ? "Produto atualizado" : "Produto cadastrado" });
      aoFechar();
    } catch (e: unknown) {
      toast({ title: "Não foi possível salvar", description: mensagemErro(e), variant: "destructive" });
    }
  };

  /**
   * Conta os vínculos ANTES de apagar, e nomeia o que acontece.
   *
   * Mesmo padrão da exclusão de contato e de negócio. Aqui o orçamento não vai
   * embora -- o item guarda nome e preço próprios, e `produto_id` é
   * `ON DELETE SET NULL` -- mas o vínculo com o catálogo some, e quem apaga
   * merece saber quantos orçamentos param de apontar para cá.
   */
  const pedirConfirmacao = async () => {
    if (!produto) return;
    try {
      setVinculos(await produtosApi.contarVinculos(produto.id));
      setConfirmando(true);
    } catch (e: unknown) {
      toast({ title: "Não foi possível conferir os vínculos", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const apagar = async () => {
    if (!produto) return;
    try {
      await excluir.mutateAsync(produto.id);
      toast({ title: "Produto excluído" });
      aoFechar();
    } catch (e: unknown) {
      toast({ title: "Não foi possível excluir", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const salvando = criar.isPending || atualizar.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {editando ? "Editar produto" : "Novo produto"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            O preço aqui é o de hoje. Orçamento já criado guarda o preço que foi ofertado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Foto</Label>
            <LogoUploadField
              value={form.foto_url}
              onChange={(url) => setForm((f) => ({ ...f, foto_url: url }))}
              bucket="produtos"
              rotulo="foto"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Implante unitário"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="O que está incluído"
              className="min-h-[64px] text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Preço</Label>
              <Input
                value={form.preco}
                onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                placeholder="1200,00"
                inputMode="decimal"
                className="h-8 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade</Label>
              <Input
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="un"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="opcional"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                placeholder="Planos, Serviços…"
                list="categorias-de-produto"
                className="h-8 text-xs"
              />
              <datalist id="categorias-de-produto">
                {categorias.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de cobrança</Label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                aria-label="Tipo de cobrança"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Como chamar quem compra</Label>
            <Input
              value={form.rotulo_clientes}
              onChange={(e) => setForm((f) => ({ ...f, rotulo_clientes: e.target.value }))}
              placeholder="clientes (ou redes, unidades…)"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Disponível para orçamento</p>
              <p className="text-label text-muted-foreground">
                Desativado, ele sai do construtor mas continua no catálogo e no histórico.
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              aria-label="Disponível para orçamento"
            />
          </div>

          {confirmando && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-destructive">Excluir “{produto?.nome}”?</p>
              <p className="mt-1 text-muted-foreground">
                {vinculos === 0
                  ? "Nenhum orçamento cita este produto."
                  : `${vinculos} ${pluralizar(vinculos ?? 0, "item")} de orçamento ${
                      (vinculos ?? 0) === 1 ? "aponta" : "apontam"
                    } para ele. ${
                      (vinculos ?? 0) === 1 ? "Esse item continua" : "Esses itens continuam"
                    } no orçamento com o nome e o preço que foram ofertados — só o vínculo com o catálogo se perde.`}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-label" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" className="h-8 text-label"
                  disabled={excluir.isPending} onClick={apagar}>
                  {excluir.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Excluir mesmo assim
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editando && !confirmando ? (
            <Button variant="ghost" size="sm" className="h-8 text-label text-destructive hover:text-destructive"
              onClick={pedirConfirmacao}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
            </Button>
          ) : <span />}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-label" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-label" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
