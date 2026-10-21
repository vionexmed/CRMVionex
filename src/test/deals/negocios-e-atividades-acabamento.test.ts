/**
 * Invariantes do acabamento de Negócios, Detalhe do negócio e Atividades.
 *
 * Tudo aqui quebra em silêncio (filtro que não filtra, erro que vira
 * "[object Object]", consulta que baixa o funil à toa), então o teste lê o
 * fonte, sem comentários, e confere a forma.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ler = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const deals = ler("src/pages/Deals.tsx");
const detalhe = ler("src/pages/DealDetail.tsx");
const atividades = ler("src/pages/Activities.tsx");

describe("Negócios", () => {
  it("mostra erro e carregamento com os primitivos", () => {
    expect(deals).toContain("<ErrorState");
    expect(deals).toContain("<LoadingState");
  });
  it("só baixa todos os negócios fora da lista", () => {
    expect(deals).toMatch(/precisaDeTodos\s*=\s*viewMode\s*!==\s*"list"/);
    expect(deals).toMatch(/enabled:\s*precisaDeTodos/);
  });
  it("avisa quando o quadro é truncado", () => {
    expect(deals).toMatch(/count\s*>\s*allDealsResult\.data\.length/);
    expect(deals).toContain("refine os filtros");
  });
  it("visão e filtros vivem na URL, com replace", () => {
    expect(deals).not.toMatch(/useState<DealFilters>/);
    expect(deals).not.toMatch(/useState<ViewMode>/);
    expect(deals).toMatch(/replace:\s*true/);
    expect(deals).toContain('"visao"');
  });
});

describe("Detalhe do negócio", () => {
  it("registra atividade com 'Quando' mapeado para due_date e trata erro", () => {
    expect(detalhe).toContain("datetime-local");
    expect(detalhe).toMatch(/due_date:/);
    expect(detalhe).toMatch(/onError:[^\n]*mensagemErro/);
  });
  it("conclui e exclui atividade da linha do tempo sem window.confirm", () => {
    expect(detalhe).toContain("useUpdateActivity");
    expect(detalhe).toContain("useDeleteActivities");
    expect(detalhe).not.toContain("window.confirm");
    expect(detalhe).not.toMatch(/instanceof Error/);
  });
});

describe("Atividades", () => {
  it("não lê err.message cru", () => {
    expect(atividades).not.toMatch(/err\.message/);
    expect(atividades).not.toMatch(/instanceof Error/);
  });
  it("tem ações em lote na barra de seleção", () => {
    expect(atividades).toContain("<BarraDeSelecao");
    for (const r of ["Concluir", "Adiar 1 dia", "Adiar 1 semana"]) expect(atividades).toContain(r);
  });
});
