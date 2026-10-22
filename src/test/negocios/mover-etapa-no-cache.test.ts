import { describe, it, expect } from "vitest";
import { aplicarEtapaNoCache } from "@/hooks/queries/useDeals";

/**
 * Arrastar um negócio estourava "undefined is not an object (evaluating
 * 'u.data.map')": a atualização otimista assumia que TODA consulta sob `deals`
 * tinha o formato `{ data: [...] }`, e o seletor leve guarda um array puro.
 */
describe("aplicarEtapaNoCache", () => {
  const lista = { data: [{ id: "a", stage_id: "s1" }, { id: "b", stage_id: "s1" }], count: 2 };

  it("troca a etapa só do negócio movido, numa lista { data, count }", () => {
    const r = aplicarEtapaNoCache(lista, "a", "s2");
    expect(r.data).toEqual([{ id: "a", stage_id: "s2" }, { id: "b", stage_id: "s1" }]);
    expect(r.count).toBe(2);
  });

  it("não muta a lista original", () => {
    aplicarEtapaNoCache(lista, "a", "s2");
    expect(lista.data[0].stage_id).toBe("s1");
  });

  it.each([
    ["array puro (seletor leve)", [{ id: "a" }]],
    ["objeto sem data", { total: 3 }],
    ["data que não é lista", { data: "x" }],
    ["undefined", undefined],
    ["null", null],
    ["número", 7],
  ])("deixa intacto o que não é lista de negócios: %s", (_nome, valor) => {
    expect(() => aplicarEtapaNoCache(valor as never, "a", "s2")).not.toThrow();
    expect(aplicarEtapaNoCache(valor as never, "a", "s2")).toBe(valor);
  });

  it("ignora itens nulos dentro da lista em vez de estourar", () => {
    const r = aplicarEtapaNoCache({ data: [null, { id: "a", stage_id: "s1" }] }, "a", "s2");
    expect(r.data[1]).toEqual({ id: "a", stage_id: "s2" });
  });
});
