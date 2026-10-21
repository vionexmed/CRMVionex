import type { EtapaFunil } from "@/hooks/useSdrCharts";

/**
 * Onde o funil mais perde: a maior queda RELATIVA entre etapas vizinhas.
 * Relativa, não absoluta -- perder 60 de 100 no topo é menos grave que perder
 * 9 de 10 no fundo, e é a proporção que diz onde mexer.
 */
export function maiorPerda(dados: EtapaFunil[]): { de: string; para: string; perda: number } | null {
  let pior: { de: string; para: string; perda: number } | null = null;
  for (let i = 1; i < dados.length; i++) {
    const antes = dados[i - 1].total;
    if (antes <= 0) continue;
    const perda = Math.round((1 - dados[i].total / antes) * 100);
    if (perda > 0 && (!pior || perda > pior.perda)) {
      pior = { de: dados[i - 1].etapa, para: dados[i].etapa, perda };
    }
  }
  return pior;
}
