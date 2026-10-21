import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────
// We build a fluent chain that ends in a resolved promise for the final call.
function makeChain(resolved: { data: unknown; count?: number; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(resolved);
  const self = () => chain;
  ["select", "eq", "neq", "order", "gte", "lte", "or", "range", "in", "single", "maybeSingle"].forEach(
    (m) => { chain[m] = m === "single" || m === "maybeSingle" ? terminal : self; }
  );
  chain["insert"] = self;
  chain["update"] = self;
  chain["delete"] = self;
  // make the chain itself thenable so await chain works
  chain["then"] = terminal().then.bind(terminal());
  return chain;
}

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// Import AFTER mock is registered
const { contactsApi } = await import("@/lib/api/contacts");

// ─────────────────────────────────────────────────────────────────────────────

describe("contactsApi.list()", () => {
  beforeEach(() => { mockFrom.mockReset(); });

  it("throws when Supabase returns an error", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: "DB error" } })
    );
    await expect(contactsApi.list("org-1")).rejects.toThrow("DB error");
  });

  it("returns empty array when there is no data", async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], count: 0, error: null }));
    const result = await contactsApi.list("org-1");
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("calls the correct table", async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], count: 0, error: null }));
    await contactsApi.list("org-1");
    // A lista lê a visão `contacts` + `ultimo_contato`; `contacts` é o recuo
    // para quando a migração ainda não subiu (ver visoes-de-contatos.test.ts).
    expect(mockFrom).toHaveBeenCalledWith("contatos_com_ultimo_contato");
  });

  it("applies page/pageSize via range", async () => {
    const chain = makeChain({ data: [], count: 0, error: null });
    const rangeSpy = vi.fn().mockReturnValue(chain);
    (chain as Record<string, unknown>)["range"] = rangeSpy;
    mockFrom.mockReturnValue(chain);

    await contactsApi.list("org-1", { page: 2, pageSize: 10 });
    expect(rangeSpy).toHaveBeenCalledWith(20, 29); // page 2, size 10 → rows 20-29
  });
});

describe("contactsApi.deleteMany()", () => {
  beforeEach(() => { mockFrom.mockReset(); });

  it("throws when Supabase returns an error", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: "delete failed" } })
    );
    await expect(contactsApi.deleteMany(["id-1"])).rejects.toThrow("delete failed");
  });

  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    await expect(contactsApi.deleteMany(["id-1", "id-2"])).resolves.toBeUndefined();
  });
});

describe("contactsApi.updateOwner()", () => {
  beforeEach(() => { mockFrom.mockReset(); });

  it("resolves when owner is set to null", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    await expect(contactsApi.updateOwner("contact-1", null)).resolves.toBeUndefined();
  });

  it("resolves when owner is a valid id", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    await expect(contactsApi.updateOwner("contact-1", "user-99")).resolves.toBeUndefined();
  });
});
