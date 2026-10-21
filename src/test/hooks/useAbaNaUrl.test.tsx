// @vitest-environment jsdom
/**
 * A aba ativa na URL.
 *
 * Antes, `Tabs defaultValue` fazia F5 voltar à primeira aba e impedia linkar uma
 * aba. Os testes cobrem o hook (valor desconhecido, replace, padrão fora da URL)
 * e conferem que as duas páginas realmente o usam.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAbaNaUrl, resolverAba } from "@/hooks/useAbaNaUrl";

const ABAS = ["a", "b", "c"] as const;

function montar(inicial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[inicial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ aba: useAbaNaUrl("aba", "a", ABAS), local: useLocation() }),
    { wrapper },
  );
}

describe("resolverAba", () => {
  it("aceita só valores conhecidos", () => {
    expect(resolverAba("b", ABAS, "a")).toBe("b");
    expect(resolverAba("zzz", ABAS, "a")).toBe("a");
    expect(resolverAba(null, ABAS, "a")).toBe("a");
  });
});

describe("useAbaNaUrl", () => {
  it("lê a aba da URL e ignora valor desconhecido", () => {
    expect(montar("/x?aba=c").result.current.aba[0]).toBe("c");
    expect(montar("/x?aba=lixo").result.current.aba[0]).toBe("a");
  });

  it("escreve na URL, preserva outros parâmetros e não grava o padrão", () => {
    const { result } = montar("/x?foo=1");
    act(() => result.current.aba[1]("b"));
    expect(result.current.local.search).toContain("aba=b");
    expect(result.current.local.search).toContain("foo=1");
    act(() => result.current.aba[1]("a"));
    expect(result.current.local.search).toBe("?foo=1");
  });
});

describe("páginas usam o hook", () => {
  it.each(["Settings", "Integrations"])("%s não usa mais defaultValue", (nome) => {
    const src = readFileSync(`src/pages/${nome}.tsx`, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).toContain("useAbaNaUrl(");
    expect(src).not.toMatch(/<Tabs defaultValue/);
  });
});
