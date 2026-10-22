import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (p: string) => readFileSync(p, "utf8");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("documento de orçamento: o que nunca sai", () => {
  const funcao = semComentarios(ler("supabase/functions/orcamento-publico/index.ts"));
  const documento = semComentarios(ler("src/components/orcamentos/DocumentoDeOrcamento.tsx"));

  it("a edge function não seleciona observações nem contato de terceiros", () => {
    expect(funcao).not.toMatch(/observacoes/);
    // contacts: só nome/tratamento/empresa, nunca e-mail ou telefone
    expect(funcao).toMatch(/from\("contacts"\)\.select\("first_name, last_name, title, company_id"\)/);
    expect(funcao).not.toMatch(/\bphone\b|\bemail\b:\s*pessoa/);
  });
  it("expõe só as chaves conhecidas de settings.empresa", () => {
    expect(funcao).toMatch(/\["razao_social", "cnpj", "endereco", "telefone", "email", "site"\]/);
  });
  it("o documento nem tem campo para observação interna e só mostra o prefixo do token", () => {
    expect(documento).not.toMatch(/observacoes/);
    expect(documento).toMatch(/token\.slice\(0, 8\)/);
    expect(documento).toMatch(/sem valor fiscal/);
  });
});
