/**
 * O painel do Visual 01: o que a tela nova afirma tem de vir de onde ela diz.
 *
 * A tela ganhou rótulos de período ("1–21 out", "vs. setembro"), variação em
 * pontos para taxa, a linha tracejada do período anterior, "maior perda" no
 * funil e um cartão de pendências. Cada um desses é um número ou um texto que
 * alguém lê e em que confia -- e cada um quebra EM SILÊNCIO se a fonte mudar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { rotulosDoPeriodo, dataDoDia, diaComSemana } from "@/components/dashboard/periodo-do-painel";
import { maiorPerda } from "@/components/dashboard/funil";
import { variation } from "@/components/dashboard/formato-da-metrica";
import { CHART_COLORS } from "@/components/reports/types";

// `getSdrRanges` mora no hook, que importa o cliente -- e o cliente exige
// `localStorage`, que o ambiente de teste não tem.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");
const ler = (f: string) => semComentarios(readFileSync(f, "utf8"));

describe("o rótulo do período é o mesmo intervalo da consulta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("este mês vai do dia 1 até hoje e compara com o mês anterior", () => {
    const r = rotulosDoPeriodo("this_month");
    expect(r.intervalo).toBe("1–21 out");
    expect(r.intervaloPorExtenso).toBe("1 a 21 de outubro");
    expect(r.comparacao).toBe("setembro");
    expect(r.legendaAtual).toBe("Outubro");
    expect(r.legendaAnterior).toBe("Setembro");
    expect(r.diasNoPeriodo).toBe(31);
    expect(r.diasDecorridos).toBe(21);
    expect(r.emAndamento).toBe(true);
  });

  it("período fechado não está em andamento -- e aí não há projeção", () => {
    const r = rotulosDoPeriodo("last_month");
    expect(r.intervalo).toBe("1–30 set");
    expect(r.comparacao).toBe("agosto");
    expect(r.emAndamento).toBe(false);
  });

  it("todo o período não tem com o que comparar", () => {
    const r = rotulosDoPeriodo("all");
    expect(r.comparacao).toBeNull();
    expect(r.legendaAnterior).toBeNull();
  });

  /** `new Date("2026-10-07")` é meia-noite UTC: no Brasil vira dia 6. */
  it("o dia da série é lido como data local", () => {
    expect(dataDoDia("2026-10-07").getDate()).toBe(7);
    expect(diaComSemana(dataDoDia("2026-10-07"))).toBe("qua, 7 out");
  });
});

describe("taxa varia em pontos, contagem em porcentagem", () => {
  /** De 40% para 37% a resposta caiu 3 pontos -- não 7,5%. */
  it("percentual compara por diferença", () => {
    expect(variation(37, 40, "percent")).toEqual({ valor: -3, unidade: "p.p." });
  });

  it("contagem compara por razão", () => {
    expect(variation(144, 107, "number")).toEqual({ valor: 35, unidade: "%" });
  });

  it("sem base não inventa variação", () => {
    expect(variation(10, 0, "number")).toBeNull();
    expect(variation(null, 10, "number")).toBeNull();
  });
});

describe("a maior perda do funil é relativa", () => {
  it("aponta a etapa que perde a maior PROPORÇÃO", () => {
    const p = maiorPerda([
      { etapa: "Lead", ordem: 1, total: 100 },
      { etapa: "Abordado", ordem: 2, total: 40 },   // perde 60%
      { etapa: "Respondeu", ordem: 3, total: 4 },   // perde 90%
    ]);
    expect(p).toEqual({ de: "Abordado", para: "Respondeu", perda: 90 });
  });

  it("funil sem queda não tem destaque", () => {
    expect(maiorPerda([{ etapa: "Lead", ordem: 1, total: 0 }])).toBeNull();
  });
});

describe("as pendências seguem o critério da tela de destino", () => {
  const SRC = ler("src/components/dashboard/usePendencias.ts");

  /** O mesmo `overdue` de Activities.tsx: não concluída e com prazo vencido. */
  it("atividade atrasada é sem conclusão e com prazo no passado", () => {
    expect(SRC).toMatch(/\.is\("completed_at", null\)/);
    expect(SRC).toMatch(/\.lt\("due_date"/);
  });

  /** A contagem vem do cabeçalho; a divisão por tipo, só se nada foi cortado. */
  it("o total não depende do corte de 1000 linhas", () => {
    expect(SRC).toContain('count: "exact"');
    expect(SRC).toMatch(/linhas\.length < total\) return \{ total, porTipo: null \}/);
  });

  it("negócio parado vem da função que o resumo do Slack já usa", () => {
    expect(SRC).toContain('rpc("deals_parados"');
  });

  /** O mesmo "vence em breve" de Orçamentos: enviado, dentro de DIAS_DE_AVISO. */
  it("proposta vencendo usa o aviso de Orçamentos", () => {
    expect(SRC).toContain('.eq("status", "enviado")');
    expect(SRC).toContain("DIAS_DE_AVISO");
  });

  /** Fora do prefixo, mutação nenhuma invalidaria estas contagens. */
  it("as chaves ficam sob um prefixo que invalidarPainel alcança", () => {
    expect(SRC).toMatch(/\["sdr-metrics", orgId, "pendencias"/);
    expect(ler("src/components/dashboard/useSerieAnterior.ts")).toMatch(/queryKey: \["sdr-charts"/);
  });
});

describe("o gráfico diário conta o que o card conta", () => {
  const PAINEL = ler("src/pages/Dashboard.tsx");

  /**
   * `respostas` na série são MENSAGENS recebidas; a taxa do card é leads que
   * responderam sobre os abordados. Desenhar uma sob a outra seria o painel se
   * contradizendo -- o defeito que o CLAUDE.md registra em "Métricas do painel".
   */
  it("só leads e abordagens têm série diária", () => {
    const i = PAINEL.indexOf("const SERIE_DA_METRICA");
    const bloco = PAINEL.slice(i, PAINEL.indexOf("};", i));
    expect(bloco).toContain('coluna: "leads"');
    expect(bloco).toContain('coluna: "abordagens"');
    expect(bloco).not.toContain("respostas");
    expect(bloco).not.toContain("taxaResposta");
  });

  /** O banco devolve o mês inteiro, com zero nos dias que ainda não vieram. */
  it("dia futuro não entra no gráfico", () => {
    expect(PAINEL).toMatch(/\.filter\(\(p\) => p\.dia\.slice\(0, 10\) <= hoje\)/);
  });

  it("a comparação vem da mesma função SQL da linha cheia", () => {
    expect(ler("src/components/dashboard/useSerieAnterior.ts")).toContain('rpc("sdr_series"');
  });
});

describe("as cores do painel seguem o tema", () => {
  /**
   * Eram oito HSL cravados: ignoravam a cor de destaque e não tinham variante
   * escura. Agora toda série vem de token.
   */
  it("a paleta de série é só token", () => {
    for (const cor of CHART_COLORS) expect(cor).toMatch(/^hsl\(var\(--[a-z0-9-]+\)\)$/);
    expect(CHART_COLORS.join(" ")).not.toContain("--destructive");
  });

  it("o gráfico diário não crava cor", () => {
    const src = ler("src/components/dashboard/GraficoEvolucao.tsx");
    expect(src).toContain("hsl(var(--primary))");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(src).not.toMatch(/--vx-/);
  });
});
