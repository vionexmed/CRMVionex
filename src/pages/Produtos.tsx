import { useMemo, useState } from "react";
import { Plus, Package, Upload } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { FaixaDeIndicadores, Indicador } from "@/components/layout/ListaV1";
import { LoadingState, ErrorState, EmptyState } from "@/components/layout/EstadoDaLista";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/hooks/useOrg";
import { useProdutos, useMetricasDeProdutos } from "@/hooks/queries/useProdutos";
import { CartaoDeProduto } from "@/components/produtos/CartaoDeProduto";
import { AbasDeCategoria } from "@/components/produtos/AbasDeCategoria";
import { FormularioDeProduto } from "@/components/produtos/FormularioDeProduto";
import { ImportarProdutosModal } from "@/components/produtos/ImportarProdutosModal";
import type { Produto } from "@/lib/api/produtos";
import { formatarMoedaInteira, pluralizar } from "@/lib/formato";
import {
  categoriaDoProduto, categoriasDoCatalogo, chaveDaCategoria, mesCurto, mesLongo, tomDaCategoria,
} from "@/lib/produtos-catalogo";

const TODOS = "__todos";

export default function Produtos() {
  const { orgId } = useOrg();
  const { data: lista = [], isLoading, isError, refetch } = useProdutos();
  // Ordem do catálogo (cadastro mais antigo primeiro), não alfabética: planos
  // vêm antes do que se vende em volta deles, e o desativado fica por último
  // porque foi o último a sair de linha.
  const produtos = useMemo(
    () => [...lista].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    [lista],
  );
  const { data: metricas } = useMetricasDeProdutos();

  const [aba, setAba] = useState(TODOS);
  /** `null` = fechado. Um produto = editando aquele. `"novo"` = criando. */
  const [emEdicao, setEmEdicao] = useState<Produto | "novo" | null>(null);
  const [importando, setImportando] = useState(false);

  const agora = new Date();
  const mes = mesCurto(agora);

  const categorias = useMemo(() => categoriasDoCatalogo(produtos), [produtos]);
  const abas = useMemo(
    () => [
      { chave: TODOS, rotulo: "Todos", contagem: produtos.length },
      ...categorias.map((c) => ({
        ...c,
        contagem: produtos.filter((p) => chaveDaCategoria(categoriaDoProduto(p)) === c.chave).length,
      })),
    ],
    [categorias, produtos],
  );
  // Sem a aba escolhida (categoria esvaziou ao reclassificar) volta para Todos.
  const abaAtual = abas.some((a) => a.chave === aba) ? aba : TODOS;

  const visiveis = useMemo(
    () => abaAtual === TODOS ? produtos : produtos.filter((p) => chaveDaCategoria(categoriaDoProduto(p)) === abaAtual),
    [produtos, abaAtual],
  );

  const porProduto = useMemo(
    () => new Map((metricas?.por_produto ?? []).map((m) => [m.produto_id, m])),
    [metricas],
  );

  const ativos = produtos.filter((p) => p.ativo).length;
  const inativos = produtos.length - ativos;
  const mais = metricas?.mais_vendido ?? null;

  if (!orgId) return <SemOrganizacao />;

  return (
    <PageShell
      title="Produtos"
      actions={
        <>
          <Button variant="outline" onClick={() => setImportando(true)}>
            <Upload className="mr-1.5 h-4 w-4" />Importar
          </Button>
          <Button onClick={() => setEmEdicao("novo")}>
            <Plus className="mr-1.5 h-4 w-4" />Novo produto
          </Button>
        </>
      }
    >
      {!isLoading && !isError && produtos.length > 0 && (
        <FaixaDeIndicadores>
          <Indicador rotulo="Produtos ativos" valor={ativos} apoio={`${inativos} ${pluralizar(inativos, "inativo")}`} />
          <Indicador
            rotulo="Receita recorrente"
            tom="sucesso"
            valor={metricas ? formatarMoedaInteira(metricas.receita_recorrente) : "—"}
            apoio="por mês"
          />
          <Indicador
            rotulo="Mais vendido"
            valor={mais?.nome ?? "—"}
            apoio={mais ? `${mais.clientes} ${pluralizar(mais.clientes, "cliente")} · ${mais.vendas_mes} em ${mesLongo(agora)}` : "sem vendas aprovadas"}
          />
          <Indicador
            rotulo="Ticket médio"
            valor={metricas?.ticket_medio != null ? formatarMoedaInteira(metricas.ticket_medio) : "—"}
            apoio="por negócio ganho"
          />
        </FaixaDeIndicadores>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState descricao="" onTentarNovamente={() => refetch()} />
      ) : produtos.length === 0 ? (
        <EmptyState
          icone={Package}
          titulo="Nenhum produto cadastrado"
          descricao="Cadastre o que você vende para montar orçamento a partir do catálogo."
          acao={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />Importar planilha
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEmEdicao("novo")}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Cadastrar produto
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          <AbasDeCategoria abas={abas} valor={abaAtual} onChange={setAba} />
          {/* Quatro colunas só em tela larga: o cartão tem texto de duas linhas e rodapé. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visiveis.map((p) => {
              const cat = categoriaDoProduto(p);
              const indice = categorias.findIndex((c) => c.chave === chaveDaCategoria(cat));
              return (
                <CartaoDeProduto
                  key={p.id}
                  produto={p}
                  categoria={cat}
                  tom={tomDaCategoria(indice)}
                  maisVendido={!!mais && mais.produto_id === p.id}
                  metricas={porProduto.get(p.id)}
                  mes={mes}
                  aoClicar={setEmEdicao}
                />
              );
            })}
            <button
              type="button"
              onClick={() => setEmEdicao("novo")}
              className="flex min-h-32 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />Novo produto
            </button>
          </div>
        </div>
      )}

      <FormularioDeProduto
        aberto={emEdicao !== null}
        produto={emEdicao === "novo" ? null : emEdicao}
        categorias={categorias.filter((c) => c.rotulo !== "Sem categoria").map((c) => c.rotulo)}
        aoFechar={() => setEmEdicao(null)}
      />
      <ImportarProdutosModal aberto={importando} aoFechar={() => setImportando(false)} existentes={produtos} />
    </PageShell>
  );
}
