/**
 * Como um valor de métrica do painel vira texto: "37%", "11 min", "1h 20min".
 *
 * Fora de StatCard.tsx porque o cartão "Atendimento agora" escreve o mesmo
 * tempo de resposta -- e duas formatações para o mesmo número divergem no
 * primeiro ajuste ("90 min" num lugar, "1h 30min" no outro).
 */
import { formatarNumero } from "@/lib/formato";

export type StatFormat = "number" | "percent" | "duration";

export function formatValue(value: number, format: StatFormat): string {
  if (format === "percent") return `${value}%`;
  if (format === "duration") {
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return formatarNumero(value);
}

/**
 * Variação contra o período anterior. null quando não há base de comparação.
 *
 * TAXA COMPARA EM PONTOS, não em porcentagem. De 40% para 37% a resposta caiu
 * 3 pontos; dizer "caiu 7,5%" é aritmeticamente certo e lido errado por todo
 * mundo -- a pessoa soma os 7,5 aos 37 e conclui que antes era 44,5%.
 */
export function variation(
  value: number | null,
  previous: number | null | undefined,
  format: StatFormat,
): { valor: number; unidade: "%" | "p.p." } | null {
  if (value === null || previous === null || previous === undefined) return null;
  if (format === "percent") return { valor: Math.round(value - previous), unidade: "p.p." };
  if (previous === 0) return value === 0 ? { valor: 0, unidade: "%" } : null;
  return { valor: Math.round(((value - previous) / previous) * 100), unidade: "%" };
}
