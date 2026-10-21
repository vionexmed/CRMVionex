/**
 * Atividades e comunicação no Visual 01: o que o redesenho não pode perder.
 * Leitura de arquivo, sem comentários (ver CLAUDE.md: teste de varredura que
 * lê comentário reprova a explicação da armadilha).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const sem = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const ler = (p: string) => sem(readFileSync(p, "utf8"));

const ATIV = ler("src/pages/Activities.tsx");
// As três telas de canal viraram Atendimento (main): os contratos do V1 seguem
// valendo na tela única.
const CONV = ler("src/pages/Atendimento.tsx");
const INBOX = ler("src/pages/Inbox.tsx");
const SINO = ler("src/components/crm/NotificationBell.tsx");
const PALETA = ler("src/components/CommandPalette.tsx");

describe("Atividades", () => {
  it("o período vira abas de visão e os nove filtros seguem lá", () => {
    expect(ATIV).toContain("<VisoesDaLista<DateFilter>");
    expect(ATIV).toContain('tom: key === "overdue"');
  });
  it("mantém seleção em lote e conclusão separadas", () => {
    expect(ATIV).toContain("Selecionar atividade");
    expect(ATIV).toContain("Marcar como concluída");
    for (const a of ["Concluir", "Adiar 1 dia", "Adiar 1 semana"]) expect(ATIV).toContain(a);
  });
  it("atraso é dito em dias e pintado com token", () => {
    expect(ATIV).toContain("textoDeAtraso(a.due_date)");
    expect(ATIV).toContain("text-destructive");
  });
});

describe("Conversas", () => {
  it("preserva ?thread= e ?q=", () => {
    expect(CONV).toContain('parametros.get("thread")');
    expect(CONV).toContain('parametros.get("q")');
  });
  it("bolhas: saída em primary, entrada em card com borda", () => {
    expect(CONV).toContain('"bg-primary text-primary-foreground"');
    expect(CONV).toContain('"border border-border bg-card text-foreground"');
  });
  it("sem Avatar do shadcn: iniciais do V1", () => {
    expect(CONV).not.toContain("AvatarFallback");
    expect(CONV).toContain("<Iniciais");
  });
});

describe("E-mail, sino e busca", () => {
  it("nada de âmbar fixo nem cor derivada de hash na caixa de e-mail", () => {
    expect(INBOX).not.toMatch(/amber-\d/);
    expect(INBOX).not.toContain("senderColor");
  });
  it("sino: ponto de não lido na cor de destaque", () => {
    expect(SINO).toContain("bg-primary");
    expect(SINO).toContain("Não lido");
  });
  it("paleta mantém os nomes acessíveis e agrupa com rótulo em caixa-alta", () => {
    expect(PALETA).toContain("Busca global");
    expect(PALETA).toContain("Resultados da busca");
    expect(PALETA).toContain("uppercase");
  });
});
