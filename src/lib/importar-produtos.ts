import { chaveDeCabecalho } from "@/lib/csv";
import type { TipoCobranca } from "@/lib/produtos-catalogo";

/**
 * Importação de produtos por planilha: leitura dos cabeçalhos, conversão do
 * preço e plano (o que entra, o que já existe, o que está inválido).
 * Puro e sem rede, para o teste cobrir o que quebra em silêncio.
 */

export type CampoDeProduto = "nome" | "descricao" | "preco" | "categoria" | "unidade" | "sku" | "tipo";

export const CAMPOS_DE_PRODUTO: { chave: CampoDeProduto; rotulo: string; apelidos: string[] }[] = [
  { chave: "nome", rotulo: "Nome", apelidos: ["nome", "produto", "nomedoproduto", "titulo", "name"] },
  { chave: "descricao", rotulo: "Descrição", apelidos: ["descricao", "descricaodoproduto", "detalhes", "description"] },
  { chave: "preco", rotulo: "Preço", apelidos: ["preco", "valor", "precounitario", "valorunitario", "price"] },
  { chave: "categoria", rotulo: "Categoria", apelidos: ["categoria", "grupo", "linha", "category"] },
  { chave: "unidade", rotulo: "Unidade", apelidos: ["unidade", "periodo", "unit"] },
  { chave: "sku", rotulo: "Código", apelidos: ["codigo", "sku", "cod", "referencia"] },
  { chave: "tipo", rotulo: "Tipo de cobrança", apelidos: ["tipo", "tipodecobranca", "cobranca", "recorrencia"] },
];

/** Para cada coluna da planilha, o campo que ela alimenta (ou nada). Cada campo é usado uma vez. */
export function mapearColunasDeProduto(cabecalho: string[]): (CampoDeProduto | null)[] {
  const usados = new Set<CampoDeProduto>();
  return cabecalho.map((h) => {
    const chave = chaveDeCabecalho(h);
    const campo = CAMPOS_DE_PRODUTO.find((c) => !usados.has(c.chave) && c.apelidos.includes(chave));
    if (!campo) return null;
    usados.add(campo.chave);
    return campo.chave;
  });
}

/**
 * "R$ 1.200,50" → 1200.5; "1200.50" → 1200.5; "1.200" → 1200; "490" → 490.
 * Vazio ou ilegível → `null` (a linha vira inválida, em vez de gravar preço zero).
 *
 * Ponto sozinho é MILHAR quando seguido de exatamente três dígitos ("1.200");
 * senão é decimal ("12.5"). Com os dois, o último símbolo é o decimal.
 */
export function lerPreco(bruto: string | null | undefined): number | null {
  let t = String(bruto ?? "").replace(/R\$|\s/gi, "");
  if (!t || !/^-?[\d.,]+$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula >= 0) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (ponto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** O que a planilha pode dizer no tipo: os três valores e os rótulos da tela. */
export function lerTipo(bruto: string | null | undefined): TipoCobranca | null {
  const t = chaveDeCabecalho(String(bruto ?? ""));
  if (["recorrente", "mensal", "assinatura"].includes(t)) return "recorrente";
  if (["unico", "avulso", "pontual"].includes(t)) return "unico";
  if (t === "adicional" || t === "addon") return "adicional";
  return null;
}

export type LinhaDeProduto = {
  nome: string;
  descricao: string | null;
  preco: number;
  categoria: string | null;
  unidade: string | null;
  sku: string | null;
  tipo_cobranca: TipoCobranca | null;
};

export type SituacaoDaLinha = "novo" | "existe" | "repetido" | "invalido";

export type LinhaPlanejada = {
  /** Linha da planilha, contando o cabeçalho como 1 (o que a pessoa vê no Excel). */
  linha: number;
  situacao: SituacaoDaLinha;
  motivo?: string;
  produto?: LinhaDeProduto;
  nomeBruto: string;
};

const chaveNome = (n: string) => chaveDeCabecalho(n);

/**
 * Decide o destino de cada linha.
 *
 * `existe`: já há produto com o mesmo nome (ou o mesmo código) no catálogo --
 * não duplica nem sobrescreve o preço de hoje, que orçamento novo usa.
 * `repetido`: a mesma planilha traz o nome duas vezes; vale a primeira.
 * `invalido`: sem nome ou com preço ilegível.
 */
export function planejarProdutos(
  linhas: string[][],
  mapa: (CampoDeProduto | null)[],
  existentes: { nome: string; sku?: string | null }[],
): LinhaPlanejada[] {
  const nomes = new Set(existentes.map((e) => chaveNome(e.nome)));
  const codigos = new Set(existentes.map((e) => (e.sku ?? "").trim().toLowerCase()).filter(Boolean));
  const vistos = new Set<string>();
  const valorDe = (row: string[], campo: CampoDeProduto) => {
    const i = mapa.indexOf(campo);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const saida: LinhaPlanejada[] = [];
  linhas.forEach((row, i) => {
    if (row.every((c) => !String(c ?? "").trim())) return; // linha em branco no fim
    const linha = i + 2;
    const nome = valorDe(row, "nome");
    if (!nome) { saida.push({ linha, situacao: "invalido", motivo: "Sem nome", nomeBruto: "" }); return; }
    const precoBruto = valorDe(row, "preco");
    const preco = precoBruto ? lerPreco(precoBruto) : 0; // preço em branco = 0, ilegível = erro
    if (preco === null) { saida.push({ linha, situacao: "invalido", motivo: `Preço ilegível: ${precoBruto}`, nomeBruto: nome }); return; }

    const sku = valorDe(row, "sku") || null;
    const produto: LinhaDeProduto = {
      nome,
      descricao: valorDe(row, "descricao") || null,
      preco,
      categoria: valorDe(row, "categoria") || null,
      unidade: valorDe(row, "unidade") || null,
      sku,
      tipo_cobranca: lerTipo(valorDe(row, "tipo")),
    };
    const k = chaveNome(nome);
    const cod = (sku ?? "").toLowerCase();
    if (nomes.has(k) || (cod && codigos.has(cod))) {
      saida.push({ linha, situacao: "existe", motivo: "Já está no catálogo", produto, nomeBruto: nome });
    } else if (vistos.has(k) || (cod && vistos.has(`sku:${cod}`))) {
      saida.push({ linha, situacao: "repetido", motivo: "Repetido na planilha", produto, nomeBruto: nome });
    } else {
      vistos.add(k);
      if (cod) vistos.add(`sku:${cod}`);
      saida.push({ linha, situacao: "novo", produto, nomeBruto: nome });
    }
  });
  return saida;
}
