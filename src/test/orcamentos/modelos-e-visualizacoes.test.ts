/**
 * Modelos de orçamento e o resumo de visualizações: a conversão que vira
 * número na tela do cliente, e o texto "Visualizado 3 vezes · a última ontem".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { itensDoModelo, validadeEmDias, diasDeValidade } from "@/lib/orcamento-modelos";
import { resumoDeVisualizacoes, quandoFoiVisto, dataCurtaSemPonto } from "@/lib/orcamento-resumo";

describe("itens do modelo", () => {
  it("lê com segurança: descarta o que não tem nome e normaliza números", () => {
    const r = itensDoModelo([
      { nome: " Plano Pro ", preco_unit: "890", quantidade: 12, unidade: "mês" },
      { nome: "", preco_unit: 1 },
      null,
      { nome: "Livre", preco_unit: -5, quantidade: 0 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nome: "Plano Pro", preco_unit: 890, quantidade: 12, unidade: "mês", desconto: 0 });
    expect(r[1]).toMatchObject({ preco_unit: 0, quantidade: 1, unidade: "un" });
    expect(itensDoModelo("lixo")).toEqual([]);
  });

  it("validade em dias usa o calendário local e volta para dias", () => {
    const hoje = new Date(2026, 9, 11, 23, 30);
    expect(validadeEmDias(30, hoje)).toBe("2026-11-10");
    expect(validadeEmDias(null, hoje)).toBe("");
    expect(diasDeValidade("2026-11-10", hoje)).toBe(30);
    expect(diasDeValidade("2026-10-01", hoje)).toBeNull();
  });
});

describe("visualizações", () => {
  const agora = new Date(2026, 9, 11, 10, 30);
  it("formata hoje, ontem e data", () => {
    expect(quandoFoiVisto(new Date(2026, 9, 10, 18, 40).toISOString(), agora)).toBe("ontem, 18:40");
    expect(quandoFoiVisto(new Date(2026, 9, 11, 9, 5).toISOString(), agora)).toBe("hoje, 09:05");
    expect(quandoFoiVisto(new Date(2026, 9, 7, 10, 12).toISOString(), agora)).toBe("7 out, 10:12");
  });
  it("resumo com contador e última abertura", () => {
    expect(resumoDeVisualizacoes({ visualizacoes: 3, ultima_visualizacao_em: new Date(2026, 9, 10, 18, 40).toISOString() }, agora))
      .toBe("Visualizado 3 vezes · a última ontem, 18:40");
  });
  it("sem a coluna nova não inventa número; nunca aberto devolve null", () => {
    expect(resumoDeVisualizacoes({ visto_em: new Date(2026, 9, 10, 18, 40).toISOString() }, agora)).toBe("Visualizado · ontem, 18:40");
    expect(resumoDeVisualizacoes({ visualizacoes: 0, visto_em: null }, agora)).toBeNull();
  });
  it("data curta sem ponto", () => {
    expect(dataCurtaSemPonto("2026-10-30")).toBe("30 out");
  });
});

describe("migrações de modelos", () => {
  const dir = "supabase/migrations";
  const sql = (f: string) => readFileSync(`${dir}/${f}`, "utf8").replace(/--.*$/gm, "");
  it("a tabela é por organização, com RLS, e as colunas são aditivas", () => {
    const s = sql("20261021150000_modelos_de_orcamento.sql");
    expect(s).toMatch(/CREATE TABLE IF NOT EXISTS public\.orcamento_modelos/);
    expect(s).toMatch(/org_id\s+uuid NOT NULL REFERENCES public\.organizations/);
    expect(s).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(s).toMatch(/user_belongs_to_org\(auth\.uid\(\), org_id\)/);
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS ultima_visualizacao_em/);
    expect(s).not.toMatch(/DROP (TABLE|COLUMN)/i);
  });
  it("a função grava a última abertura e continua só para service role", () => {
    const s = sql("20261021150100_ultima_visualizacao.sql");
    expect(s).toMatch(/CREATE OR REPLACE FUNCTION public\.registrar_visualizacao_orcamento/);
    expect(s).toMatch(/ultima_visualizacao_em = now\(\)/);
    expect(s).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(readdirSync(dir)).toContain("20261021150100_ultima_visualizacao.sql");
  });
  it("a página pública nunca devolve a observação interna", () => {
    const f = readFileSync("supabase/functions/orcamento-publico/index.ts", "utf8");
    const publico = f.slice(f.indexOf("const publico = {"), f.indexOf("// ── Ver ──"));
    expect(publico).not.toMatch(/observacoes/);
    expect(publico).toMatch(/condicoes/);
  });
});
