/**
 * Resumo da lista de orçamentos e o estado de visão na URL.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resumirOrcamentos, ordenarOrcamentos, LIMITE_DA_LISTA } from "@/lib/orcamento-resumo";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";

let n = 0;
function orc(p: Partial<OrcamentoComRelacoes> & { total?: number }): OrcamentoComRelacoes {
  n++;
  return {
    id: String(n), numero: n, status: "rascunho", moeda: "BRL", desconto: 0,
    valido_ate: null, decidido_em: null, created_at: `2026-01-${String(10 + (n % 15))}T00:00:00Z`,
    updated_at: "2026-01-01T00:00:00Z",
    itens: [{ preco_unit: p.total ?? 100, quantidade: 1, desconto: 0 }],
    ...p,
  } as unknown as OrcamentoComRelacoes;
}

describe("resumirOrcamentos", () => {
  const agora = new Date("2026-05-15T12:00:00");

  it("conta em aberto, aprovado do mês pela decisão e taxa", () => {
    const r = resumirOrcamentos([
      orc({ status: "enviado", total: 200 }),
      orc({ status: "rascunho", total: 999 }),
      orc({ status: "aprovado", total: 300, decidido_em: "2026-05-02T10:00:00" }),
      orc({ status: "aprovado", total: 50, decidido_em: "2026-04-28T10:00:00" }),
      orc({ status: "recusado", total: 10 }),
    ], agora);
    expect(r.emAberto).toEqual({ quantidade: 1, valor: { BRL: 200 } });
    expect(r.aprovadoNoMes).toEqual({ quantidade: 1, valor: { BRL: 300 } });
    expect(r.decididos).toBe(3);
    expect(r.taxaDeAprovacao).toBeCloseTo(2 / 3);
  });

  it("sem decididos não inventa 0%", () => {
    expect(resumirOrcamentos([orc({ status: "enviado" })], agora).taxaDeAprovacao).toBeNull();
  });

  it("avisa quando a lista pode ter sido cortada", () => {
    const cheia = Array.from({ length: LIMITE_DA_LISTA }, () => orc({}));
    expect(resumirOrcamentos(cheia, agora).possivelmenteCortado).toBe(true);
    expect(resumirOrcamentos(cheia.slice(1), agora).possivelmenteCortado).toBe(false);
  });
});

describe("ordenarOrcamentos", () => {
  it("por valor, maior primeiro", () => {
    const l = [orc({ total: 10 }), orc({ total: 500 }), orc({ total: 50 })];
    expect(ordenarOrcamentos(l, "valor").map((o) => o.itens![0].preco_unit)).toEqual([500, 50, 10]);
  });
});

describe("telas guardam a visão na URL", () => {
  const limpo = (f: string) => readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("Orçamentos: a aba de situação mora na URL (busca e ordem saíram da tela, como na referência)", () => {
    const s = limpo("src/pages/Orcamentos.tsx");
    expect(s).toContain("useSearchParams");
    expect(s).toContain('"situacao"');
    expect(s).not.toMatch(/useState\(""\)/);
  });

  it("Atendimento: ?thread= e ?q=, com replace", () => {
    const s = limpo("src/pages/Atendimento.tsx");
    expect(s).toContain('parametros.get("thread")');
    expect(s).toContain('parametros.get("q")');
    expect(s).toContain("replace: true");
  });
});
