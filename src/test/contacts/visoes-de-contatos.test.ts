/**
 * "Último contato" e "Sem resposta há 3+ dias" dependem de uma visão no banco.
 * O que quebra aqui quebra em silêncio (a lista continua carregando), então os
 * testes leem os arquivos e conferem os invariantes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ler = (c: string) => readFileSync(c, "utf8");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const migracao = ler("supabase/migrations/20261021130000_visoes_de_contatos.sql");
const api = semComentarios(ler("src/lib/api/contacts.ts"));
const tela = semComentarios(ler("src/pages/Contacts.tsx"));

describe("migração das visões de contatos", () => {
  it("a visão roda com a RLS de quem consulta", () => {
    // Sem security_invoker ela rodaria como o dono e vazaria outra organização.
    expect(migracao).toMatch(/with \(security_invoker = true\)/);
  });
  it("une atividade concluída, mensagem e e-mail enviado", () => {
    expect(migracao).toMatch(/a\.completed_at is not null/);
    expect(migracao).toMatch(/whatsapp_messages/);
    expect(migracao).toMatch(/e\.status = 'sent'/);
  });
  it("é aditiva: não apaga nem altera tabela", () => {
    expect(migracao).not.toMatch(/drop table|alter table|delete from/i);
  });
});

describe("a API degrada sem a visão", () => {
  it("cai para a tabela quando a relação não existe", () => {
    expect(api).toMatch(/42P01/);
    expect(api).toMatch(/PGRST205/);
  });
  it("'sem resposta' nunca devolve a base inteira quando a visão falta", () => {
    expect(api).toMatch(/if \(params\.semResposta\) return \{ data: \[\], count: 0 \}/);
    expect(api).toMatch(/if \(precisaDaVisao && visaoIndisponivel\) return \[\]/);
  });
  it("clientes e descartados não esperam retorno", () => {
    expect(api).toMatch(/"in", "\(customer,disqualified\)"/);
  });
});

describe("a tela", () => {
  it("guarda visões e colunas por organização no navegador", () => {
    const prefs = ler("src/components/clientes/preferenciasDeContatos.ts");
    expect(prefs).toMatch(/vx:contatos:visoes:\$\{orgId\}/);
    expect(prefs).toMatch(/vx:contatos:colunas-escondidas:\$\{orgId\}/);
  });
  it("não escreve `status`: a coluna legada faz o trigger qualificar sozinho", () => {
    expect(tela).not.toMatch(/status: ["']prospect["']/);
  });
  it("estágio é lista (vários estágios), e a URL carrega a lista", () => {
    expect(tela).toMatch(/lifecycleStages\?: string\[\]/);
    expect(tela).toMatch(/set\("estagio", patch\.lifecycleStages\.join\(","\)\)/);
  });
});
