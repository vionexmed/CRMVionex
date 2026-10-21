/**
 * A barra de abas.
 *
 * Havia dez barras no projeto e **seis tratamentos diferentes**:
 *
 *     nua                         Painel, Equipe, Segurança
 *     w-full                      ContactDrawer, CompanyDrawer
 *     mx-3 mt-2                   AtRiskPanel
 *     flex-wrap                   Integrações
 *     flex-wrap h-auto gap-1      Configurações
 *     grid w-full grid-cols-N     Relatórios, Login
 *
 * Só as duas últimas ocupavam a largura da tela; nas outras as abas ficavam
 * espremidas num canto, pequenas. Um mesmo controle com seis aparências.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivosTsx(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosTsx(caminho, saida);
    else if (nome.endsWith(".tsx")) saida.push(caminho);
  }
  return saida;
}

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("todas as abas usam a mesma barra", () => {
  /**
   * `<TabsList>` cru é o que permitia as seis aparências. Quem precisa de abas
   * monta `PageTabs`, que decide largura, colunas e tamanho de alvo.
   */
  it("ninguém monta TabsList à mão", () => {
    const infratores = arquivosTsx("src")
      .filter((f) => !f.endsWith("PageTabs.tsx") && !f.endsWith("ui/tabs.tsx"))
      .filter((f) => semComentarios(readFileSync(f, "utf8")).includes("<TabsList"));
    expect(infratores, infratores.join("\n")).toEqual([]);
  });

  const COM_ABAS = [
    "src/pages/Dashboard.tsx",
    "src/pages/Reports.tsx",
    "src/pages/Settings.tsx",
    "src/pages/Integrations.tsx",
    "src/pages/Team.tsx",
    "src/pages/SecuritySettings.tsx",
    "src/components/crm/ContactDrawer.tsx",
    "src/components/crm/CompanyDrawer.tsx",
    "src/components/crm/AtRiskPanel.tsx",
  ];

  it.each(COM_ABAS)("%s monta PageTabs", (arquivo) => {
    const src = semComentarios(readFileSync(arquivo, "utf8"));
    expect(src).toContain('from "@/components/layout/PageTabs"');
    expect(src).toContain("<PageTabs");
  });
});

describe("a barra concentra a composição das abas", () => {
  // A grade contada foi substituída por abas de largura natural e rolagem local.
  // Layout e alvos são verificados no navegador, sem reproduzir CSS no teste.
  it("nenhuma tela escreve grid-cols na barra de abas", () => {
    for (const arquivo of arquivosTsx("src").filter((f) => !f.endsWith("PageTabs.tsx"))) {
      const conteudo = semComentarios(readFileSync(arquivo, "utf8"));
      const i = conteudo.indexOf("<PageTabs");
      if (i < 0) continue;
      expect(conteudo.slice(i, i + 200), arquivo).not.toMatch(/grid-cols-\d/);
    }
  });
});

describe("as abas estão em português", () => {
  /**
   * A barra de Relatórios tinha "Forecast" e "Custom" ao lado de "Vendas" e
   * "Contatos"; a de Segurança tinha "Audit Log"; a tela de entrada -- a
   * primeira coisa que alguém vê no produto -- tinha "Magic Link".
   */
  it.each([
    ["src/pages/Reports.tsx", ["Forecast", "Custom"]],
    ["src/pages/SecuritySettings.tsx", ["Audit Log"]],
  ])("%s", (arquivo, termos) => {
    const src = semComentarios(readFileSync(arquivo, "utf8"));
    const i = src.indexOf("<PageTabs");
    const bloco = src.slice(i, src.indexOf("/>", i));
    for (const t of termos) expect(bloco, `"${t}" ainda na barra`).not.toContain(t);
  });
});
