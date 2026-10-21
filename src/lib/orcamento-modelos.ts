/**
 * Modelos de orçamento, sem banco.
 *
 * Puro de propósito (mesma razão de `orcamento-calculo.ts`): a conversão
 * modelo ⇄ itens e a data de validade são o que vira número na tela do cliente,
 * e precisam poder ser exercitadas com valor de verdade.
 */

/** O item como o modelo o guarda: cópia do que foi ofertado, nunca referência. */
export type ItemDeModelo = {
  produto_id: string | null;
  nome: string;
  descricao: string | null;
  unidade: string;
  preco_unit: number;
  quantidade: number;
  desconto: number;
};

const numeroOu = (v: unknown, padrao: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};

/**
 * Lê o json de `orcamento_modelos.itens` sem confiar nele: a coluna é `jsonb`
 * livre, e uma linha malformada (editada à mão no painel) não pode derrubar a
 * tela de orçamento. O que não tem nome é descartado.
 */
export function itensDoModelo(bruto: unknown): ItemDeModelo[] {
  if (!Array.isArray(bruto)) return [];
  const itens: ItemDeModelo[] = [];
  for (const x of bruto) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const nome = typeof r.nome === "string" ? r.nome.trim() : "";
    if (!nome) continue;
    itens.push({
      produto_id: typeof r.produto_id === "string" ? r.produto_id : null,
      nome,
      descricao: typeof r.descricao === "string" && r.descricao ? r.descricao : null,
      unidade: typeof r.unidade === "string" && r.unidade.trim() ? r.unidade.trim() : "un",
      preco_unit: Math.max(0, numeroOu(r.preco_unit, 0)),
      quantidade: Math.max(0, numeroOu(r.quantidade, 1)) || 1,
      desconto: Math.max(0, numeroOu(r.desconto, 0)),
    });
  }
  return itens;
}

/** "AAAA-MM-DD" daqui a `dias` dias, no calendário LOCAL (não em UTC). */
export function validadeEmDias(dias: number | null | undefined, hoje: Date = new Date()): string {
  if (!dias || dias < 1) return "";
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + Math.round(dias));
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/**
 * Dias entre hoje e a validade do orçamento, para "Salvar como modelo" guardar
 * a mesma folga. null quando não há data ou já passou (sem folga a copiar).
 */
export function diasDeValidade(validoAte: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!validoAte) return null;
  const alvo = new Date(`${validoAte}T00:00:00`);
  if (isNaN(alvo.getTime())) return null;
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
  return dias >= 1 ? dias : null;
}
