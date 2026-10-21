/**
 * O que o painel do Visual 01 passou a afirmar com dado real: fila de leads,
 * meta de resposta, movimento por hora, projeção, frase da maior perda e a
 * comparação escolhível. Cada um quebra EM SILÊNCIO se a fonte mudar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { agruparPorHora, lerMetaResposta } from "@/components/dashboard/useAtendimento";
import { projetar } from "@/components/dashboard/periodo-do-painel";
import { fraseDaPerda, maiorPerda } from "@/components/dashboard/funil";
import { rangeDeComparacao } from "@/hooks/useSdrMetrics";
import { comparacoesDoPeriodo, rotulosDoPeriodo } from "@/components/dashboard/periodo-do-painel";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");

describe("a fila de leads segue o critério de aguardando_humano", () => {
  const SRC = semComentarios(readFileSync("src/components/dashboard/useAtendimento.ts", "utf8"));

  /** Os mesmos três NOT EXISTS de sdr_metrics; senão a lista e o número divergem. */
  it("lead ou contatado, sem atividade, e-mail enviado ou WhatsApp enviado", () => {
    expect(SRC).toContain('.in("lifecycle_stage", ["lead", "contacted"])');
    expect(SRC).toContain('from("activities").select("contact_id")');
    expect(SRC).toMatch(/from\("emails"\)[^\n]*eq\("direction", "outbound"\)/);
    expect(SRC).toMatch(/from\("whatsapp_messages"\)[^\n]*eq\("direction", "outbound"\)/);
  });

  it("mais antigos primeiro: é deles o 'espera há'", () => {
    expect(SRC).toContain('.order("created_at", { ascending: true })');
  });

  /** Fora do prefixo, invalidarPainel não alcançaria estas consultas. */
  it("as chaves moram sob sdr-metrics", () => {
    expect(SRC).toMatch(/\["sdr-metrics", orgId, "atendimento"/);
  });
});

describe("meta de resposta", () => {
  it("só inteiro positivo conta; o resto é 'sem meta'", () => {
    expect(lerMetaResposta({ meta_resposta_min: 15 })).toBe(15);
    expect(lerMetaResposta({ meta_resposta_min: "15" })).toBeNull();
    expect(lerMetaResposta({ meta_resposta_min: 0 })).toBeNull();
    expect(lerMetaResposta({})).toBeNull();
    expect(lerMetaResposta(null)).toBeNull();
  });
});

describe("movimento por hora", () => {
  const as = (h: number) => new Date(2026, 9, 7, h, 10).toISOString();

  it("mostra o expediente mesmo sem mensagem nas pontas", () => {
    const r = agruparPorHora([as(11), as(11)]);
    expect(r[0].hora).toBe(8);
    expect(r[r.length - 1].hora).toBe(15);
    expect(r.find((x) => x.hora === 11)?.total).toBe(2);
  });

  it("alarga para hora com movimento de verdade, não para mensagem solta", () => {
    const pico = Array.from({ length: 10 }, () => as(11));
    expect(agruparPorHora([...pico, as(3)])[0].hora).toBe(8);
    expect(agruparPorHora([...pico, as(19), as(19), as(19)]).at(-1)!.hora).toBe(19);
  });
});

describe("projeção usa a média que a tela mostra", () => {
  it("média 13 em 31 dias é ≈ 400, não 406", () => {
    expect(projetar(144 / 11, 31)).toBe(400);
    expect(projetar(2.4, 7)).toBe(14);
  });
});

describe("a maior perda dita em português", () => {
  it("63% dos abordados não respondem", () => {
    const p = maiorPerda([
      { etapa: "Lead", ordem: 1, total: 144 },
      { etapa: "Abordado", ordem: 2, total: 121 },
      { etapa: "Respondeu", ordem: 3, total: 45 },
    ])!;
    expect(fraseDaPerda(p)).toBe("63% dos abordados não respondem");
  });

  it("etapa desconhecida cai na forma neutra", () => {
    expect(fraseDaPerda({ de: "X", para: "Y", perda: 10 })).toBe("10% entre X e Y");
  });
});

describe("a comparação escolhida é a que a consulta usa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 10, 30));
  });
  afterEach(() => vi.useRealTimers());

  it("ano anterior: o mesmo mês, um ano antes", () => {
    const r = rangeDeComparacao("this_month", "ano_anterior")!;
    expect(r.start).toEqual(new Date(2025, 9, 1));
    expect(r.end).toEqual(new Date(2025, 10, 1));
    expect(rotulosDoPeriodo("this_month", new Date(), "ano_anterior").comparacao).toBe("outubro de 2025");
  });

  it("sem comparação não busca nada e não rotula nada", () => {
    expect(rangeDeComparacao("this_month", "nenhuma")).toBeNull();
    expect(rotulosDoPeriodo("this_month", new Date(), "nenhuma").comparacao).toBeNull();
  });

  it("'este ano' contra o ano anterior já é o período anterior", () => {
    expect(comparacoesDoPeriodo("this_year")).not.toContain("ano_anterior");
    expect(comparacoesDoPeriodo("all")).toEqual(["nenhuma"]);
  });
});
