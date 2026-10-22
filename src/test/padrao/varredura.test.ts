import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PASTA = join(__dirname, "../../components/padrao");

/** Remove comentários: o comentário que explica a proibição não pode reprovar. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const arquivos = readdirSync(PASTA).filter((f) => /\.(tsx?|css)$/.test(f));

describe("src/components/padrao: só tokens e nada que quebre o dnd-kit", () => {
  it("tem arquivos para varrer", () => {
    expect(arquivos.length).toBeGreaterThan(5);
  });

  for (const f of arquivos) {
    const codigo = semComentarios(readFileSync(join(PASTA, f), "utf8"));

    it(`${f}: sem hex`, () => {
      expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
    it(`${f}: sem tamanho de fonte arbitrário`, () => {
      expect(codigo).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
    });
    it(`${f}: sem transform/scale/rotate/filter/backdrop`, () => {
      expect(codigo).not.toMatch(/\b(transform|filter|backdrop)\b/);
      expect(codigo).not.toMatch(/(^|[\s"'`:])-?(scale|rotate|translate|backdrop|blur)-/);
    });
  }
});
