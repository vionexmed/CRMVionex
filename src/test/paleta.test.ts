import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lerTokens } from "@/components/settings/tokens";

/**
 * A paleta é um sistema, não um punhado de hex. Este teste trava o que a faz
 * funcionar: degraus distintos entre os neutros, AA em cada par texto/fundo,
 * estado legível como texto, categorias de gráfico separáveis e pastéis legíveis,
 * nos dois temas. Quem mudar um valor sem refazer a conta reprova aqui.
 */
const { claro, escuro } = lerTokens(readFileSync("src/index.css", "utf8"));

function rgb(valor: string): [number, number, number] {
  const m = valor.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`não é HSL: ${valor}`);
  const h = Number(m[1]), s = Number(m[2]) / 100, l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (v: string) => { const [r, g, b] = rgb(v).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const razao = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
function oklab(v: string): [number, number, number] {
  const [r, g, b] = rgb(v).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a: string, b: string) => Math.hypot(...oklab(a).map((x, i) => (x - oklab(b)[i]) * 100) as [number, number, number]);
/** Resolve `var(--x)` para o valor do tema. */
const valor = (t: Record<string, string>, nome: string): string => {
  const v = t[nome];
  const m = v?.match(/^var\((--[\w-]+)\)$/);
  return m ? valor(t, m[1]) : v;
};

describe.each([["claro", claro], ["escuro", escuro]] as const)("paleta, tema %s", (_nome, t) => {
  const v = (n: string) => valor(t, n);

  it("neutros: seis degraus distintos entre si, e o texto principal não é preto", () => {
    const degraus = ["--background", "--surface-2", "--secondary", "--muted", "--border", "--input"].map(v);
    expect(new Set(degraus).size).toBe(degraus.length);
    for (let i = 1; i < degraus.length; i++) expect(dE(degraus[i - 1], degraus[i]), `${i}`).toBeGreaterThan(0.9);
    expect(v("--background")).not.toBe(v("--muted"));
    expect(v("--foreground")).not.toMatch(/ 0%$/);
    expect(v("--foreground")).not.toBe("0 0% 0%");
  });

  it("texto principal e secundário passam em AA sobre toda superfície", () => {
    for (const s of ["--background", "--card", "--muted", "--secondary", "--surface-2", "--popover"]) {
      expect(razao(v("--foreground"), v(s)), `foreground/${s}`).toBeGreaterThanOrEqual(7);
      expect(razao(v("--muted-foreground"), v(s)), `muted-foreground/${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("marca: botão, foco, texto de marca e texto sobre o suave", () => {
    expect(razao(v("--primary"), v("--primary-foreground"))).toBeGreaterThanOrEqual(4.5);
    for (const s of ["--background", "--card", "--muted"]) {
      expect(razao(v("--primary"), v(s)), `primary/${s}`).toBeGreaterThanOrEqual(4.5);
      expect(razao(v("--ring"), v(s)), `ring/${s}`).toBeGreaterThanOrEqual(3);
    }
    expect(razao(v("--accent-foreground"), v("--accent"))).toBeGreaterThanOrEqual(4.5);
    expect(razao(v("--accent-foreground"), v("--card"))).toBeGreaterThanOrEqual(4.5);
    expect(t["--primary-hover"]).toContain("color-mix");
    expect(t["--primary-active"]).toContain("color-mix");
  });

  it.each(["success", "warning", "destructive", "info"])("estado %s: texto em AA, foreground legível, preenchimento visível", (e) => {
    expect(razao(v(`--${e}`), v(`--${e}-soft`)), "texto/suave").toBeGreaterThanOrEqual(4.5);
    expect(razao(v(`--${e}`), v("--card")), "texto/cartão").toBeGreaterThanOrEqual(4.5);
    expect(razao(v(`--${e}`), v("--background")), "texto/página").toBeGreaterThanOrEqual(4.5);
    expect(razao(v(`--${e}-foreground`), v(`--${e}`)), "foreground/cheio").toBeGreaterThanOrEqual(4.5);
    expect(razao(v(`--${e}-fill`), v("--card")), "preenchimento/cartão").toBeGreaterThanOrEqual(3);
    expect(v(`--${e}-border`)).not.toBe(v(`--${e}-soft`));
  });

  it("neutro de estado e lateral passam em AA", () => {
    expect(razao(v("--neutral"), v("--neutral-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(razao(v("--sidebar-muted"), v("--sidebar-background"))).toBeGreaterThanOrEqual(4.5);
    expect(razao(v("--sidebar-foreground"), v("--sidebar-background"))).toBeGreaterThanOrEqual(7);
  });

  it("gráfico: oito categorias, chart-1 é a marca, todas separáveis mesmo sem matiz", () => {
    const c = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--chart-${i}`));
    expect(t["--chart-1"]).toBe("var(--primary)");
    expect(c[0]).toBe(v("--primary"));
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) expect(dE(c[i], c[j]), `chart-${i + 1} × chart-${j + 1}`).toBeGreaterThan(7);
    // Luminosidade varia: o espaço entre a mais clara e a mais escura é largo.
    const L = c.map((x) => oklab(x)[0]);
    expect(Math.max(...L) - Math.min(...L)).toBeGreaterThan(0.25);
    for (let i = 1; i < c.length; i++) expect(razao(c[i], v("--card")), `chart-${i + 1}/cartão`).toBeGreaterThan(1.5);
  });

  it("pastéis: oito matizes, texto em AA forte sobre o fundo de cada um", () => {
    const fundos = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--pastel-${i}`));
    expect(new Set(fundos).size).toBe(8);
    for (let i = 1; i <= 8; i++) expect(razao(v(`--pastel-${i}-fg`), v(`--pastel-${i}`)), `pastel-${i}`).toBeGreaterThanOrEqual(7);
  });

  it("escala do funil: da marca ao verde, em passos de OKLCH", () => {
    expect(t["--stage-1"]).toBe("hsl(var(--primary))");
    for (const [i, p] of [[2, 80], [3, 60], [4, 40], [5, 20]]) {
      expect(t[`--stage-${i}`]).toBe(`color-mix(in oklch, hsl(var(--primary)) ${p}%, var(--stage-end))`);
    }
    expect(t["--stage-6"]).toBe("var(--stage-end)");
    expect(t["--stage-end"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
