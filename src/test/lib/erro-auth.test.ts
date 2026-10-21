import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mensagemErroAuth } from "@/lib/erro-auth";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("erros de acesso em português, com o que fazer", () => {
  it.each([
    ["Invalid login credentials", "E-mail ou senha incorretos"],
    ["Email not confirmed", "ainda não foi confirmado"],
    ["User already registered", "Já existe uma conta"],
    ["Password should be at least 6 characters.", "pelo menos 6 caracteres"],
    ["For security purposes, you can only request this after 42 seconds.", "Aguarde 42 segundos"],
    ["Email rate limit exceeded", "Muitas tentativas"],
    ["Failed to fetch", "Sem conexão"],
  ])("%s", (original, esperado) => {
    expect(mensagemErroAuth({ message: original })).toContain(esperado);
  });

  it("mensagem desconhecida passa adiante, sem virar [object Object]", () => {
    expect(mensagemErroAuth({ message: "Algo novo" })).toBe("Algo novo");
    expect(mensagemErroAuth({ message: "x" })).not.toContain("[object Object]");
  });
});

describe("as telas de acesso não mostram o erro cru", () => {
  /**
   * `error.message` do Auth chega em inglês ("Invalid login credentials") e era
   * mostrado direto, na primeira tela do produto.
   */
  it.each(["src/pages/Login.tsx", "src/pages/ResetPassword.tsx"])("%s traduz o erro", (arquivo) => {
    const src = semComentarios(readFileSync(arquivo, "utf8"));
    expect(src).toContain("mensagemErroAuth(");
    expect(src).not.toMatch(/description: error\.message/);
  });

  it.each(["src/pages/Login.tsx", "src/pages/ResetPassword.tsx", "src/pages/AcceptInvite.tsx"])(
    "%s usa a casca de acesso",
    (arquivo) => {
      expect(semComentarios(readFileSync(arquivo, "utf8"))).toContain("<AuthShell>");
    },
  );

  it("o painel da marca lê os tokens da lateral, sem hex", () => {
    const src = semComentarios(readFileSync("src/components/auth/AuthShell.tsx", "utf8"));
    expect(src).toContain("bg-sidebar");
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
