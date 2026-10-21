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

/**
 * Quem não passou, dito com as palavras da etapa: "63% dos abordados não
 * respondem" lê numa olhada; "63% entre Abordado e Respondeu" obriga a
 * montar a frase. As etapas são as fixas de `sdr_funnel`; nome desconhecido
 * cai na forma neutra em vez de produzir português quebrado.
 */
const QUEM: Record<string, string> = {
  Lead: "dos leads", Abordado: "dos abordados", Respondeu: "dos que responderam",
  "Reunião": "dos que tiveram reunião", Oportunidade: "das oportunidades",
};
const NAO_FIZERAM: Record<string, string> = {
  Abordado: "não são abordados", Respondeu: "não respondem", "Reunião": "não chegam à reunião",
  Oportunidade: "não viram oportunidade", Cliente: "não viram cliente",
};

export function fraseDaPerda(p: { de: string; para: string; perda: number }): string {
  const quem = QUEM[p.de];
  const nao = NAO_FIZERAM[p.para];
  return quem && nao ? `${p.perda}% ${quem} ${nao}` : `${p.perda}% entre ${p.de} e ${p.para}`;
}
