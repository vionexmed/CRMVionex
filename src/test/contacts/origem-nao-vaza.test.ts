import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * A origem é texto livre (o nome que a pessoa deu à importação) e podia ser
 * mais larga que a coluna: "APROXIMA MED 2026" passava por cima da pontuação.
 * O selo tem de truncar dentro da própria célula.
 */
describe("o selo de origem não vaza da coluna", () => {
  const src = semComentarios(readFileSync("src/components/clientes/CelulasDeCliente.tsx", "utf8"));
  const trecho = src.slice(src.indexOf("export function OrigemSelo"), src.indexOf("export function UltimoContato"));

  it("limita a largura ao espaço da coluna", () => {
    expect(trecho).toContain("max-w-full");
    expect(trecho).toContain("min-w-0");
  });

  it("corta o texto com reticências em vez de quebrar o layout", () => {
    expect(trecho).toContain("truncate");
    expect(trecho).not.toContain("whitespace-nowrap");
  });

  it("mantém o nome completo acessível ao passar o mouse", () => {
    expect(trecho).toContain("title={o.label}");
  });
});
