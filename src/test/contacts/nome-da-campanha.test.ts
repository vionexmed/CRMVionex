import { describe, it, expect } from "vitest";
import { nomeDaCampanha } from "@/lib/contact-options";

/**
 * A coluna Origem mostra o NOME DA CAMPANHA, não o canal. A campanha pode vir
 * do `utm_campaign` (landing page, anúncio) ou do nome dado à importação.
 */
describe("nomeDaCampanha", () => {
  it("prefere o utm_campaign, mesmo quando a origem é genérica", () => {
    expect(nomeDaCampanha({ source: "landing", utm_campaign: "Lançamento Ortopedia 2026" })).toBe("Lançamento Ortopedia 2026");
  });

  it("usa o nome livre da origem quando não há utm_campaign (planilha, evento)", () => {
    expect(nomeDaCampanha({ source: "APROXIMA MED 2026" })).toBe("APROXIMA MED 2026");
  });

  it("sem campanha, cai no rótulo genérico, nunca num canal inventado", () => {
    expect(nomeDaCampanha({ source: "csv_import" })).toBe("Importação");
    expect(nomeDaCampanha(null)).toBe("Manual");
    expect(nomeDaCampanha({})).toBe("Manual");
  });

  it("ignora utm_campaign vazio ou só com espaços", () => {
    expect(nomeDaCampanha({ source: "NEXMED 2026", utm_campaign: "   " })).toBe("NEXMED 2026");
  });
});
