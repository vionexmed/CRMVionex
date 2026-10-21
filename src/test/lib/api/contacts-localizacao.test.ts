import { beforeEach, describe, expect, it, vi } from "vitest";

const { requests, transport } = vi.hoisted(() => ({
  requests: [] as string[],
  transport: vi.fn(async (input: RequestInfo | URL) => {
    requests.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
  }),
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { supabase: createClient("https://crm.test", "test-public-key", {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) };
});
const { contactsApi } = await import("@/lib/api/contacts");

describe("localização dos contatos na consulta ao servidor", () => {
  beforeEach(() => { requests.length = 0; });

  it("combina país e cidade com organização, origem e paginação", async () => {
    await contactsApi.list("org-a", { country: "Brasil", city: "Campinas", origin: "src:Evento", page: 1, pageSize: 25 });
    const query = new URL(requests[0]).searchParams;
    expect(query.get("metadata->>pais")).toBe("ilike.Brasil");
    expect(query.get("metadata->>cidade")).toBe("ilike.Campinas");
    expect(query.get("org_id")).toBe("eq.org-a");
    expect(query.get("metadata->>source")).toBe("eq.Evento");
    expect(query.get("offset")).toBe("25");
  });

  it("a exportação usa os mesmos filtros de localização", async () => {
    await contactsApi.listAll("org-a", { city: "  São Paulo  " });
    expect(new URL(requests[0]).searchParams.get("metadata->>cidade")).toBe("ilike.São Paulo");
  });

  it("não envia filtros vazios", async () => {
    await contactsApi.list("org-a", { country: "", city: "   " });
    const query = new URL(requests[0]).searchParams;
    expect(query.has("metadata->>pais")).toBe(false);
    expect(query.has("metadata->>cidade")).toBe(false);
  });
});
