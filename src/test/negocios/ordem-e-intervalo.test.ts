/**
 * Os chips "Ordenação" e "Intervalo" e a busca do Pipeline.
 *
 * Eles valem nas três visões: no quadro e na previsão filtram no cliente, e na
 * lista paginada viajam até o servidor -- um chip que filtra o quadro e não a
 * lista seria um filtro anunciado que não filtra.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  casaComBusca, dentroDoIntervalo, inicioDoIntervalo, intervaloDaUrl, normalizarBusca, ordemDaUrl, ordenarNegocios,
} from "@/components/negocios/ordem-e-intervalo";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const n = (id: string, created_at: string, value: number, updated_at?: string) => ({ id, created_at, value, updated_at });

describe("ordenação", () => {
  const lista = [
    n("a", "2026-01-01T10:00:00Z", 500, "2026-10-01T10:00:00Z"),
    n("b", "2026-09-01T10:00:00Z", 100, "2026-09-02T10:00:00Z"),
    n("c", "2026-05-01T10:00:00Z", 900, null as unknown as string),
  ];

  it("mais recentes, maior valor e última atualização", () => {
    expect(ordenarNegocios(lista, "recentes").map((d) => d.id)).toEqual(["b", "c", "a"]);
    expect(ordenarNegocios(lista, "valor").map((d) => d.id)).toEqual(["c", "a", "b"]);
    // Sem `updated_at`, vale a criação.
    expect(ordenarNegocios(lista, "atualizacao").map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("não reordena o array de fora", () => {
    const antes = lista.map((d) => d.id);
    ordenarNegocios(lista, "valor");
    expect(lista.map((d) => d.id)).toEqual(antes);
  });

  it("valor desconhecido na URL cai no padrão", () => {
    expect(ordemDaUrl("xyz")).toBe("recentes");
    expect(ordemDaUrl("valor")).toBe("valor");
  });
});

describe("intervalo", () => {
  const agora = new Date(2026, 9, 11, 10, 30);

  it("data local do início, estável no dia (entra na chave da consulta)", () => {
    expect(inicioDoIntervalo("mes", agora)).toBe("2026-09-11");
    expect(inicioDoIntervalo("trimestre", agora)).toBe("2026-07-11");
    expect(inicioDoIntervalo("ano", agora)).toBe("2025-10-11");
    expect(inicioDoIntervalo("tudo", agora)).toBeUndefined();
  });

  it("o padrão é todo o período: nenhum negócio antigo some sem pedido", () => {
    expect(intervaloDaUrl(null)).toBe("tudo");
  });

  it("filtra pela criação; sem data, fica", () => {
    expect(dentroDoIntervalo({ created_at: "2026-09-20T12:00:00Z" }, "2026-09-11")).toBe(true);
    expect(dentroDoIntervalo({ created_at: "2026-08-20T12:00:00Z" }, "2026-09-11")).toBe(false);
    expect(dentroDoIntervalo({ created_at: null }, "2026-09-11")).toBe(true);
    expect(dentroDoIntervalo({ created_at: "2020-01-01T00:00:00Z" }, undefined)).toBe(true);
  });
});

describe("busca", () => {
  const d = {
    title: "Hospital São Lucas",
    contact: { first_name: "Henrique", last_name: "Prado" },
    company: { name: "Rede Saúde" },
  };
  it("título, pessoa e empresa, sem acento", () => {
    expect(casaComBusca(d, normalizarBusca("sao lucas"))).toBe(true);
    expect(casaComBusca(d, normalizarBusca("prado"))).toBe(true);
    expect(casaComBusca(d, normalizarBusca("saude"))).toBe(true);
    expect(casaComBusca(d, normalizarBusca("vitalis"))).toBe(false);
    expect(casaComBusca(d, "")).toBe(true);
  });
});

describe("a lista paginada recebe ordenação, intervalo e busca", () => {
  const deals = semComentarios(readFileSync("src/pages/Deals.tsx", "utf8"));
  const api = semComentarios(readFileSync("src/lib/api/deals.ts", "utf8"));

  it("a página passa os três para a consulta da lista", () => {
    expect(deals).toContain("criadoDesde: inicio,");
    expect(deals).toContain("busca: busca || undefined,");
    expect(deals).toMatch(/\n\s+ordem,\n/);
  });

  it("o quadro aplica intervalo e busca no mesmo filtro dos outros", () => {
    expect(deals).toContain("if (!dentroDoIntervalo(d, inicio)) return false;");
    expect(deals).toContain("return casaComBusca(d, termo);");
    expect(deals).toContain("ordenarNegocios(filtrarPorSinal(openDeals, sinais, agora), ordem)");
  });

  it("a API filtra e ordena no servidor, com desempate estável", () => {
    expect(api).toContain('query.gte("created_at", criadoDesde)');
    expect(api).toContain('query.ilike("title"');
    expect(api).toContain('query.order("id", { ascending: true })');
  });
});

describe("as zonas Ganho/Perdido seguem montadas fora do arraste", () => {
  const kanban = semComentarios(readFileSync("src/components/crm/DealsKanban.tsx", "utf8"));
  it("escondidas por visibilidade, nunca desmontadas nem com display none", () => {
    expect(kanban).toContain('!visivel && "invisible"');
    expect(kanban).toMatch(/<WonLostDropZone id="won-drop"[^>]*visivel=\{arrastando\}/);
    expect(kanban).toMatch(/<WonLostDropZone id="lost-drop"[^>]*visivel=\{arrastando\}/);
  });
});
