/**
 * Ordenação, intervalo e busca do Pipeline -- os chips "Ordenação" e
 * "Intervalo" e o campo "Pesquisar…" da barra. Moram na URL como os filtros
 * (voltar do negócio não pode desligá-los), e valem igual no quadro, na
 * previsão e na lista paginada (lá, no servidor: ver `dealsApi.list`).
 */

import type { DealFilters } from "@/components/crm/DealsFilters";
import type { FiltroDeSinal } from "@/components/negocios/sinais";

export type OrdemDoFunil = "recentes" | "valor" | "atualizacao";
export type IntervaloDoFunil = "mes" | "trimestre" | "ano" | "tudo";

export const OPCOES_DE_ORDEM: { valor: OrdemDoFunil; rotulo: string }[] = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "valor", rotulo: "Maior valor" },
  { valor: "atualizacao", rotulo: "Última atualização" },
];

export const OPCOES_DE_INTERVALO: { valor: IntervaloDoFunil; rotulo: string }[] = [
  { valor: "mes", rotulo: "Último mês" },
  { valor: "trimestre", rotulo: "Último trimestre" },
  { valor: "ano", rotulo: "Último ano" },
  { valor: "tudo", rotulo: "Todo o período" },
];

const MESES: Record<IntervaloDoFunil, number | null> = { mes: 1, trimestre: 3, ano: 12, tudo: null };

/**
 * O padrão é "Todo o período", e não "Último ano": um negócio aberto há mais de
 * um ano sumiria do quadro sem ninguém ter pedido -- o tipo de corte silencioso
 * que faz o funil parecer menor do que é.
 */
export function ordemDaUrl(v: string | null): OrdemDoFunil {
  return OPCOES_DE_ORDEM.some((o) => o.valor === v) ? (v as OrdemDoFunil) : "recentes";
}
export function intervaloDaUrl(v: string | null): IntervaloDoFunil {
  return OPCOES_DE_INTERVALO.some((o) => o.valor === v) ? (v as IntervaloDoFunil) : "tudo";
}

/**
 * Início do intervalo como DATA local ("2026-07-22"), ou undefined para todo o
 * período. Data e não instante: o valor entra na chave da consulta da lista, e
 * um instante mudaria a cada render e refaria a consulta sem parar.
 */
export function inicioDoIntervalo(intervalo: IntervaloDoFunil, agora = new Date()): string | undefined {
  const meses = MESES[intervalo];
  if (meses === null) return undefined;
  const d = new Date(agora.getFullYear(), agora.getMonth() - meses, agora.getDate());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type NegocioOrdenavel = {
  created_at: string | null;
  updated_at?: string | null;
  value: number | null;
};

const instante = (s: string | null | undefined) => (s ? new Date(s).getTime() || 0 : 0);

/** Criado a partir do início do intervalo (inclusive). Sem data de criação: fica. */
export function dentroDoIntervalo(d: { created_at: string | null }, inicio: string | undefined): boolean {
  if (!inicio || !d.created_at) return true;
  return instante(d.created_at) >= new Date(`${inicio}T00:00:00`).getTime();
}

/** Cópia ordenada -- nunca ordena o array de fora (ele vem de useMemo). */
export function ordenarNegocios<T extends NegocioOrdenavel>(lista: readonly T[], ordem: OrdemDoFunil): T[] {
  const copia = [...lista];
  if (ordem === "valor") return copia.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  if (ordem === "atualizacao") {
    return copia.sort((a, b) => instante(b.updated_at ?? b.created_at) - instante(a.updated_at ?? a.created_at));
  }
  return copia.sort((a, b) => instante(b.created_at) - instante(a.created_at));
}

/** Sem acento e em minúsculas, para "clinica" achar "Clínica". */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type NegocioBuscavel = {
  title: string;
  contact?: { first_name: string | null; last_name: string | null } | null;
  company?: { name: string | null } | null;
};

/** A busca da barra: título, nome da pessoa ou da empresa. Termo vazio passa tudo. */
export function casaComBusca(d: NegocioBuscavel, termoNormalizado: string): boolean {
  if (!termoNormalizado) return true;
  const pessoa = d.contact ? `${d.contact.first_name ?? ""} ${d.contact.last_name ?? ""}` : "";
  return normalizarBusca(`${d.title} ${pessoa} ${d.company?.name ?? ""}`).includes(termoNormalizado);
}

/** Quantos filtros estreitam o quadro agora: o número ao lado de "Filtros". */
export function contarFiltrosAtivos(filtros: DealFilters, sinais?: FiltroDeSinal): number {
  let n = 0;
  if (filtros.ownerId) n++;
  if (filtros.minValue !== undefined) n++;
  if (filtros.maxValue !== undefined) n++;
  if (filtros.closeDateFrom) n++;
  if (filtros.closeDateTo) n++;
  if (sinais?.quentes) n++;
  if (sinais?.atrasada) n++;
  if (sinais && sinais.paradosHa !== null) n++;
  return n;
}
