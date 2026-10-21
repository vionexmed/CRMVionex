/**
 * Indicadores do V1 em Orçamentos: enviados do mês, aceitos sobre enviados e
 * "expiram em breve" -- todos calculados da lista carregada, sem número novo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { resumirOrcamentos, diasParaVencer, codigoDoOrcamento } from "@/lib/orcamento-resumo";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";

let n = 0;
function orc(p: Record<string, unknown>): OrcamentoComRelacoes {
  n++;
  return {
    id: String(n), numero: n, status: "enviado", moeda: "BRL", desconto: 0,
    valido_ate: null, enviado_em: null, decidido_em: null,
    created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    itens: [{ preco_unit: 100, quantidade: 1, desconto: 0 }],
    ...p,
  } as unknown as OrcamentoComRelacoes;
}

describe("indicadores da faixa", () => {
  const agora = new Date("2026-05-15T12:00:00");

  it("enviados do mês contam por enviado_em; rascunho não entra", () => {
    const r = resumirOrcamentos([
      orc({ enviado_em: "2026-05-03T10:00:00" }),
      orc({ enviado_em: "2026-04-30T10:00:00" }),
      orc({ status: "rascunho" }),
      orc({ status: "aprovado", enviado_em: "2026-05-02T10:00:00", decidido_em: "2026-05-04T10:00:00" }),
    ], agora);
    expect(r.enviadosNoMes.quantidade).toBe(2);
    expect(r.aceitosSobreEnviados).toBeCloseTo(1 / 2);
  });

  it("a taxa é por coorte e nunca passa de 100%", () => {
    // Aprovado em maio, mas ENVIADO em abril: fica fora do numerador de maio.
    const r = resumirOrcamentos([
      orc({ enviado_em: "2026-05-03T10:00:00" }),
      orc({ status: "aprovado", enviado_em: "2026-04-20T10:00:00", decidido_em: "2026-05-02T10:00:00" }),
      orc({ status: "aprovado", enviado_em: "2026-04-21T10:00:00", decidido_em: "2026-05-03T10:00:00" }),
    ], agora);
    expect(r.aceitosSobreEnviados).toBe(0);
    expect(r.aprovadoNoMes.quantidade).toBe(2);
  });

  it("sem enviado no mês não inventa porcentagem", () => {
    expect(resumirOrcamentos([orc({ status: "rascunho" })], agora).aceitosSobreEnviados).toBeNull();
  });

  afterEach(() => vi.useRealTimers());

  it("expiram amanhã: só enviados ainda válidos que vencem hoje ou amanhã", () => {
    // `estadoDoOrcamento` olha o relógio real: sem congelá-lo, tudo estaria vencido.
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    const r = resumirOrcamentos([
      orc({ valido_ate: "2026-05-15" }),
      orc({ valido_ate: "2026-05-16" }),
      orc({ valido_ate: "2026-05-17" }),
      orc({ valido_ate: "2026-05-14" }),
      orc({ status: "aprovado", valido_ate: "2026-05-16" }),
    ], agora);
    expect(r.expiramEmBreve.quantidade).toBe(2);
  });
});

describe("prazo e código", () => {
  it("dias para vencer", () => {
    const agora = new Date("2026-05-15T20:00:00");
    expect(diasParaVencer("2026-05-15", agora)).toBe(0);
    expect(diasParaVencer("2026-05-16", agora)).toBe(1);
    expect(diasParaVencer(null, agora)).toBeNull();
  });
  it("código com quatro dígitos", () => {
    expect(codigoDoOrcamento(142)).toBe("ORC-0142");
  });
});
