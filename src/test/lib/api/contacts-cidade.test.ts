import { beforeEach, describe, expect, it, vi } from "vitest";

const { requests, resposta, transport } = vi.hoisted(() => {
  const requests: string[] = [];
  const resposta = { corpo: "[]" };
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    requests.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return new Response(resposta.corpo, { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
  });
  return { requests, resposta, transport };
});
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { supabase: createClient("https://crm.test", "test-public-key", {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) };
});
const { contactsApi, agruparCidades } = await import("@/lib/api/contacts");

describe("filtro de cidade dos contatos", () => {
  beforeEach(() => { requests.length = 0; resposta.corpo = "[]"; });

  it("compara a cidade inteira, sem diferenciar maiúsculas, junto com o estágio", async () => {
    await contactsApi.list("org-a", { lifecycleStage: "lead", city: "Campinas", page: 0, pageSize: 25 });
    const query = new URL(requests[0]).searchParams;
    expect(query.get("metadata->>cidade")).toBe("ilike.Campinas");
    expect(query.get("lifecycle_stage")).toBe("eq.lead");
    expect(query.get("org_id")).toBe("eq.org-a");
  });

  it("escapa curingas do próprio valor", async () => {
    await contactsApi.list("org-a", { city: "100%_Rio" });
    expect(new URL(requests[0]).searchParams.get("metadata->>cidade")).toBe("ilike.100\\%\\_Rio");
  });

  it("a exportação usa o mesmo filtro", async () => {
    await contactsApi.listAll("org-a", { city: "São Paulo" });
    expect(new URL(requests[0]).searchParams.get("metadata->>cidade")).toBe("ilike.São Paulo");
  });

  it("sem cidade escolhida, não filtra", async () => {
    await contactsApi.list("org-a", {});
    expect(new URL(requests[0]).searchParams.has("metadata->>cidade")).toBe(false);
  });

  it("lista as cidades dos leads lendo só a cidade", async () => {
    resposta.corpo = JSON.stringify([{ cidade: "Campinas" }, { cidade: "campinas" }, { cidade: "Santos" }]);
    const cidades = await contactsApi.listarCidades("org-a", "lead");
    const query = new URL(requests[0]).searchParams;
    expect(query.get("select")).toBe("cidade:metadata->>cidade");
    expect(query.get("lifecycle_stage")).toBe("eq.lead");
    expect(query.get("metadata->>cidade")).toBe("not.is.null");
    expect(cidades).toEqual([{ cidade: "Campinas", contatos: 2 }, { cidade: "Santos", contatos: 1 }]);
  });
});

describe("agruparCidades", () => {
  it("junta grafias que só diferem em maiúsculas, com a mais usada como valor", () => {
    expect(agruparCidades(["sorocaba", "Sorocaba", "Sorocaba"])).toEqual([{ cidade: "Sorocaba", contatos: 3 }]);
  });

  it("não junta acento diferente, porque o filtro também não junta", () => {
    expect(agruparCidades(["São Paulo", "Sao Paulo"])).toHaveLength(2);
  });

  it("ignora vazios e ordena em ordem alfabética", () => {
    expect(agruparCidades([null, "", "  ", "Uberlândia", "Araraquara", undefined]).map((c) => c.cidade))
      .toEqual(["Araraquara", "Uberlândia"]);
  });
});
