import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hslParaHex, lerTokens } from "@/components/settings/tokens";

const sem = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Configurações: Perfil e Design system", () => {
  it("lê os tokens do CSS, claro e escuro", () => {
    const { claro, escuro } = lerTokens(readFileSync("src/index.css", "utf8"));
    expect(hslParaHex(claro["--primary"])).toBe("#2E5AEA");
    expect(escuro["--background"]).not.toBe(claro["--background"]);
  });

  it("Perfil vale para todo papel; abas de empresa só para admin", () => {
    const s = sem("src/pages/Settings.tsx");
    expect(s).toMatch(/ABAS_PESSOAIS = \["profile", "notifications", "appearance", "design-system"\]/);
    expect(s).not.toMatch(/ABAS_PESSOAIS[^;]*"(general|billing)"/);
    expect(s).toContain('"profile", validas');
  });

  it("Geral não repete o perfil pessoal", () => {
    expect(sem("src/components/settings/GeneralTab.tsx")).not.toContain("saveProfile");
  });

  it("a miniatura de direção usa ACCENT_COLORS em hsl(), não hex", () => {
    const d = sem("src/components/settings/DesignSystemTab.tsx");
    expect(d).toContain("ACCENT_COLORS[d.value].light");
    expect(d).toContain("setAccentColor(d.value)");
  });

  it("a fonte é de verdade: localStorage, --font-ui e Inter sob demanda", () => {
    const t = sem("src/contexts/ThemeContext.tsx");
    expect(t).toContain('"fc-font"');
    expect(t).toContain('setProperty("--font-ui"');
    expect(t).toContain("fonts.googleapis.com");
  });
});
