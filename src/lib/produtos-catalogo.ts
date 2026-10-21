import type { Produto } from "@/lib/api/produtos";
import type { Tom } from "@/components/layout/ListaV1";

/**
 * Regras de apresentação do catálogo, fora do componente para serem testáveis.
 */

export type TipoCobranca = "recorrente" | "unico" | "adicional";

export const ROTULO_DO_TIPO: Record<TipoCobranca, string> = {
  recorrente: "Recorrente",
  unico: "Único",
  adicional: "Adicional",
};

/** Unidades que significam "cobrado a cada período". */
const UNIDADE_RECORRENTE = /^(m[eê]s|mensal|ano|anual|semestre|trimestre|semana)\b/i;

/**
 * O tipo do produto.
 *
 * Coluna nula é "ninguém classificou" (produto anterior à migração): cai no
 * que o cadastro já dizia -- a unidade. "mês" é recorrente, o resto é único.
 * `adicional` nunca é inferido: só quem cadastrou sabe que é módulo de plano.
 * `tipo_cobranca` pode nem existir na linha (migração não aplicada), por isso
 * o acesso tolera `undefined`.
 */
export function tipoDoProduto(p: Pick<Produto, "unidade"> & { tipo_cobranca?: string | null }): TipoCobranca {
  const t = p.tipo_cobranca;
  if (t === "recorrente" || t === "unico" || t === "adicional") return t;
  return UNIDADE_RECORRENTE.test((p.unidade ?? "").trim()) ? "recorrente" : "unico";
}

export const SEM_CATEGORIA = "__sem_categoria";

/** Categoria da linha; `undefined` (coluna ausente) e texto vazio viram "sem". */
export function categoriaDoProduto(p: { categoria?: string | null }): string {
  return (p.categoria ?? "").trim() || SEM_CATEGORIA;
}

/**
 * As abas, na ordem em que a categoria aparece no catálogo (do cadastro mais
 * antigo ao mais novo). Alfabética esconderia a lógica de quem monta o catálogo:
 * planos primeiro, depois o que se vende em volta deles.
 *
 * A comparação é por texto sem acento e minúsculo -- "Implantação" e
 * "implantacao" são a mesma aba --, mantendo a grafia da primeira ocorrência.
 */
export function categoriasDoCatalogo(produtos: Pick<Produto, "created_at" | "categoria">[]) {
  const ordenados = [...produtos].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const mapa = new Map<string, { chave: string; rotulo: string }>();
  for (const p of ordenados) {
    const cat = categoriaDoProduto(p);
    const chave = chaveDaCategoria(cat);
    if (!mapa.has(chave)) mapa.set(chave, { chave, rotulo: cat === SEM_CATEGORIA ? "Sem categoria" : cat });
  }
  return [...mapa.values()];
}

export function chaveDaCategoria(categoria: string): string {
  return categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Cor do ponto do selo: uma por categoria, em rodízio, na ordem das abas. */
const TONS: Tom[] = ["marca", "sucesso", "atencao", "neutro", "info"];
export function tomDaCategoria(indice: number): Tom {
  return TONS[((indice % TONS.length) + TONS.length) % TONS.length];
}

/** "out" para outubro: mês curto, sem o ponto que o Intl põe ("out."). */
export function mesCurto(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", "");
}
export function mesLongo(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(d);
}

/**
 * A linha de baixo do cartão.
 *
 * Recorrente e adicional contam CLIENTES (quem paga todo mês); único conta só
 * VENDAS, porque "clientes" de uma implantação é o mesmo número de vendas e
 * repeti-lo seria ruído. Venda zero some da linha de quem tem clientes, e vira
 * "Sem vendas em out" para o único, que senão ficaria com a linha vazia.
 */
export function resumoDeVendas(
  p: { rotulo_clientes?: string | null },
  tipo: TipoCobranca,
  m: { clientes: number; vendas_mes: number } | undefined,
  mes: string,
): string {
  const clientes = m?.clientes ?? 0;
  const vendas = m?.vendas_mes ?? 0;
  const rotulo = (p.rotulo_clientes ?? "").trim();
  const nomeClientes = rotulo ? (clientes === 1 ? rotulo.replace(/s$/, "") : rotulo) : clientes === 1 ? "cliente" : "clientes";
  const vendasTexto = `${vendas} ${vendas === 1 ? "venda" : "vendas"} em ${mes}`;
  if (tipo === "unico") return vendas > 0 ? vendasTexto : `Sem vendas em ${mes}`;
  const partes = [`${clientes} ${nomeClientes}`];
  if (vendas > 0) partes.push(vendasTexto);
  return partes.join(" · ");
}

/** Ao lado do preço: "/mês", "/mês por unidade", mas "único" sem barra. */
export function unidadeDoPreco(unidade: string | null | undefined): string {
  const u = (unidade ?? "").trim();
  if (!u) return "";
  return /^[uú]nic[oa]$/i.test(u) ? "único" : `/${u}`;
}
