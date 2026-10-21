// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ReactNode, useState } from "react";
import { MemoryRouter, useLocation, useNavigate, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/CommandPalette";
import type { Database } from "@/integrations/supabase/types";
import { useGlobalSearch } from "@/hooks/queries/useGlobalSearch";
import { searchEntities } from "@/lib/api/global-search";
import { contactsApi } from "@/lib/api/contacts";
import { companiesApi } from "@/lib/api/companies";
import Contacts from "@/pages/Contacts";
import Companies from "@/pages/Companies";
import { TooltipProvider } from "@/components/ui/tooltip";

const state = vi.hoisted(() => ({
  user: { id: "user-a" }, profile: { org_id: "org-a" }, isAdmin: false,
  fetch: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://search-test.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => state.fetch(input, init) },
  });
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: Object.assign(client, { channel: () => channel, removeChannel: async () => "ok" }) };
});

class ResizeObserverForTest { observe() {} unobserve() {} disconnect() {} }
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function Host() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return <>
    <button onClick={() => setOpen(true)}>Abrir busca</button>
    {open && <CommandPalette open={open} onOpenChange={setOpen} />}
    <output aria-label="Destino">{location.pathname}{location.search}</output>
  </>;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = <QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/dashboard"]}><Host /></MemoryRouter></QueryClientProvider>;
  return { ...render(tree), client, tree };
}
async function openSearch() {
  const trigger = screen.getByRole("button", { name: "Abrir busca" });
  trigger.focus();
  fireEvent.click(trigger);
  return await screen.findByRole("combobox");
}

beforeEach(() => {
  state.user = { id: "user-a" }; state.profile = { org_id: "org-a" }; state.isAdmin = false;
  state.fetch.mockReset().mockImplementation(async () => response([]));
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", ResizeObserverForTest);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("busca global com componentes reais e transporte controlado", () => {
  it("usa catálogo sem duplicação e oculta destinos administrativos de membros", async () => {
    mount(); await openSearch();
    expect(screen.queryByRole("option", { name: /Marketing/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "Atividades" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /Painel|Visão geral/ }));
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/dashboard");
  });

  it("admin encontra os destinos autorizados e o teclado restaura foco ao fechar", async () => {
    state.isAdmin = true; mount(); const input = await openSearch();
    expect(screen.getByRole("option", { name: /Marketing/ })).toBeInTheDocument();
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Abrir busca" })).toHaveFocus();
  });

  it("busca após 300ms e abre o ID do resultado sem refiltrar texto no cmdk", async () => {
    state.fetch.mockImplementation(async (input) => response(new URL(String(input)).pathname.endsWith("contacts")
      ? [{ id: "contact-outside", first_name: "Maria", last_name: "Souza", email: "localizada@empresa.test" }] : []));
    mount(); const input = await openSearch();
    fireEvent.change(input, { target: { value: "zz" } });
    expect(state.fetch).not.toHaveBeenCalled();
    const option = await screen.findByRole("option", { name: /Maria Souza/ });
    fireEvent.click(option);
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/contacts?id=contact-outside");
    expect(JSON.parse(localStorage.getItem("vionex-search:user-a:org-a")!)).toEqual(["zz"]);
  });

  it("uma categoria falha sem apagar resultados válidos", async () => {
    state.fetch.mockImplementation(async (input) => {
      const table = new URL(String(input)).pathname.split("/").pop();
      return table === "contacts" ? response({ message: "Falha de contatos", code: "XX000" }, 400)
        : response(table === "companies" ? [{ id: "co-1", name: "Empresa Alfa", domain: "alfa.test" }] : []);
    });
    mount(); fireEvent.change(await openSearch(), { target: { value: "Alfa" } });
    expect(await screen.findByRole("option", { name: /Empresa Alfa/ })).toBeInTheDocument();
    expect(screen.getByText(/Falha de contatos/)).toBeInTheDocument();
  });

  it("B rápida permanece quando A lenta responde depois; termo curto remove resultados", async () => {
    const pending: Array<{ url: URL; resolve: (value: Response) => void }> = [];
    state.fetch.mockImplementation((input) => new Promise((resolve) => pending.push({ url: new URL(String(input)), resolve })));
    mount(); const input = await openSearch();
    fireEvent.change(input, { target: { value: "Ana" } });
    await waitFor(() => expect(pending).toHaveLength(3));
    fireEvent.change(input, { target: { value: "Bia" } });
    await waitFor(() => expect(pending).toHaveLength(6));
    await act(async () => pending.slice(3).forEach(({ url, resolve }) => resolve(response(url.pathname.endsWith("contacts") ? [{ id: "b", first_name: "Bia", last_name: "Atual" }] : []))));
    expect(await screen.findByRole("option", { name: /Bia Atual/ })).toBeInTheDocument();
    await act(async () => pending.slice(0, 3).forEach(({ url, resolve }) => resolve(response(url.pathname.endsWith("contacts") ? [{ id: "a", first_name: "Ana", last_name: "Antiga" }] : []))));
    expect(screen.queryByRole("option", { name: /Ana Antiga/ })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "B" } });
    expect(screen.queryByRole("option", { name: /Bia Atual/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Digite pelo menos 2/)).toBeInTheDocument();
  });

  it("storage indisponível não interrompe abertura ou navegação", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount(); fireEvent.change(await openSearch(), { target: { value: "Empresa" } });
    fireEvent.click(screen.getByRole("option", { name: "Empresas" }));
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/companies");
  });

  it("valida histórico, limita cinco termos e não mostra termos de outra identidade", async () => {
    localStorage.setItem("vionex-search:user-a:org-a", JSON.stringify(["Ana", "Bia", "Caio", "Dora", "Eva", "Fábio", null, 2]));
    const view = mount(); await openSearch();
    expect(screen.getByRole("option", { name: "Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Fábio" })).not.toBeInTheDocument();
    state.user = { id: "user-b" }; view.rerender(view.tree);
    // Force a consumer render as an auth provider would after changing identity.
    fireEvent.change(screen.getByRole("combobox"), { target: { value: " " } });
    expect(screen.queryByRole("option", { name: "Ana" })).not.toBeInTheDocument();
  });
});


function LocationOutput() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/contacts?id=c-new")}>Trocar registro</button><output aria-label="Rota atual">{location.pathname}{location.search}</output></>;
}
function mountPage(route: string, page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TooltipProvider>
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}>
      <Routes><Route path="*" element={page} /></Routes><LocationOutput />
    </MemoryRouter>
  </TooltipProvider></QueryClientProvider>);
}

const contact: Database["public"]["Tables"]["contacts"]["Row"] = { disqualified_at: null, instagram_igsid: null, instagram_username: null, lead_score: null, lifecycle_changed_at: "2026-01-01T00:00:00Z", qualified_at: null, qualified_by: null, id: "c-outside", org_id: "org-a", first_name: "Registro", last_name: "Distante", email: "distante@example.test", phone: null, title: null, company_id: null, owner_id: null, avatar_url: null, linkedin_url: null, lifecycle_stage: "lead", status: "lead", created_at: "2026-01-01T00:00:00Z", updated_at: null, metadata: {}, descadastrado_em: null, descadastrado_motivo: null, equipamento_atual: null, interesse_educacao: null, pacientes_mes_max: null, pacientes_mes_min: null, potencial_aluguel: null, potencial_compra: null, usa_ondas_choque: null };
const company: Database["public"]["Tables"]["companies"]["Row"] = { id: "co-outside", org_id: "org-a", name: "Empresa Distante", domain: null, industry: null, size: null, revenue: null, website: null, linkedin_url: null, owner_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: null };

describe("contrato de transporte e abertura direta", () => {
  it("pontuação vira texto literal dentro de filtros PostgREST delimitados", async () => {
    const term = 'Acme, (100%_*) "A" \\ B';
    const requests: URL[] = [];
    state.fetch.mockImplementation(async (input) => {
      const url = new URL(String(input)); requests.push(url);
      const filter = url.searchParams.get("or")!;
      // Decodifica as strings delimitadas para exercer o padrão emitido, sem copiar o escape da produção.
      const literals = [...filter.matchAll(/(?:first_name|last_name|email|name|domain|title)\.imatch\.("(?:\\.|[^"\\])*")/g)];
      expect(literals.length).toBeGreaterThan(0);
      for (const match of literals) {
        const pattern = new RegExp(JSON.parse(match[1]), "i");
        expect(pattern.test(term)).toBe(true);
        expect(pattern.test('Acme, (100ZZZ) "A" X B')).toBe(false);
        expect(pattern.test('Acme OR qualquer registro')).toBe(false);
      }
      return response([]);
    });
    const result = await searchEntities("org-a", term);
    expect(result.errors).toBeUndefined();
    expect(requests).toHaveLength(3);
    for (const url of requests) {
      expect(url.searchParams.get("org_id")).toBe("eq.org-a");
      expect(url.searchParams.get("limit")).toBe("5");
    }
  });

  it("ID direto sempre consulta a organização e distingue ausência de falha", async () => {
    const seen: URL[] = [];
    state.fetch.mockImplementation(async (input) => { seen.push(new URL(String(input))); return response([]); });
    expect(await contactsApi.getById("org-a", "c-forbidden")).toBeNull();
    expect(await companiesApi.getById("org-b", "co-forbidden")).toBeNull();
    expect(seen.map((url) => [url.searchParams.get("org_id"), url.searchParams.get("id")])).toEqual([
      ["eq.org-a", "eq.c-forbidden"], ["eq.org-b", "eq.co-forbidden"],
    ]);
    state.fetch.mockImplementation(async () => response({ message: "Sem conexão", code: "XX000" }, 400));
    await expect(contactsApi.getById("org-a", "c-failure")).rejects.toMatchObject({ message: "Sem conexão" });
  });

  it("contato fora da página atual abre por ID e fechar preserva filtro na URL", async () => {
    state.fetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return response(url.pathname.endsWith("contacts") && url.searchParams.get("id") === "eq.c-outside" ? [contact] : []);
    });
    mountPage("/contacts?id=c-outside&estagio=lead", <Contacts />);
    expect(await screen.findByRole("heading", { name: "Registro Distante" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.getByLabelText("Rota atual")).toHaveTextContent("/contacts?estagio=lead"));
  });

  it("empresa fora da lista abre por ID", async () => {
    state.fetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return response(url.pathname.endsWith("companies") && url.searchParams.get("id") === "eq.co-outside" ? [company] : []);
    });
    mountPage("/companies?id=co-outside", <Companies />);
    expect(await screen.findByRole("heading", { name: "Empresa Distante" })).toBeInTheDocument();
  });

  it("ID inacessível apresenta recuperação e não abre outro contato da lista", async () => {
    state.fetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return response(url.pathname.endsWith("contacts") && !url.searchParams.has("id") ? [contact] : []);
    });
    mountPage("/contacts?id=forbidden", <Contacts />);
    expect(await screen.findByText(/Contato indisponível/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    expect(screen.getByLabelText("Rota atual")).toHaveTextContent("/contacts");
    expect(screen.getByLabelText("Rota atual")).not.toHaveTextContent("id=");
  });
});


let hookClient: QueryClient;
function HookProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={hookClient}>{children}</QueryClientProvider>;
}

describe("identidade, cancelamento e teclado", () => {
  it("setas alteram seleção e Enter abre a página selecionada", async () => {
    mount(); const input = await openSearch();
    await waitFor(() => expect(screen.getByRole("option", { name: "Painel" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Atividades" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/activities");
  });

  it("histórico malformado é ignorado e limpeza remove apenas a chave atual", async () => {
    localStorage.setItem("vionex-search:user-a:org-a", JSON.stringify({ corrupt: true }));
    const view = mount(); await openSearch();
    expect(screen.queryByRole("button", { name: "Limpar histórico" })).not.toBeInTheDocument();
    view.unmount();
    localStorage.setItem("vionex-search:user-a:org-a", JSON.stringify(["Ana"]));
    localStorage.setItem("vionex-search:user-a:org-b", JSON.stringify(["Segredo B"]));
    mount(); await openSearch();
    fireEvent.click(screen.getByRole("button", { name: "Limpar histórico" }));
    expect(screen.queryByRole("option", { name: "Ana" })).not.toBeInTheDocument();
    expect(localStorage.getItem("vionex-search:user-a:org-a")).toBeNull();
    expect(JSON.parse(localStorage.getItem("vionex-search:user-a:org-b")!)).toEqual(["Segredo B"]);
  });

  it("cache e resultados são isolados por usuário e organização", async () => {
    hookClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state.fetch.mockImplementation(async (input) => response(new URL(String(input)).pathname.endsWith("contacts")
      ? [{ id: state.user.id, first_name: state.user.id, last_name: state.profile.org_id }] : []));
    const view = renderHook(() => useGlobalSearch("Ana"), { wrapper: HookProvider });
    await waitFor(() => expect(view.result.current.data?.contacts[0]?.title).toBe("user-a org-a"));
    state.user = { id: "user-b" }; view.rerender();
    expect(view.result.current.data).toBeUndefined();
    await waitFor(() => expect(view.result.current.data?.contacts[0]?.title).toBe("user-b org-a"));
    state.profile = { org_id: "org-b" }; view.rerender();
    expect(view.result.current.data).toBeUndefined();
    await waitFor(() => expect(view.result.current.data?.contacts[0]?.title).toBe("user-b org-b"));
    hookClient.clear();
  });

  it("cancelamento chega às três consultas e não vira erro de categoria", async () => {
    const signals: AbortSignal[] = [];
    const pending: Array<(value: Response) => void> = [];
    state.fetch.mockImplementation((_input, init) => {
      signals.push(init!.signal!);
      return new Promise((resolve) => pending.push(resolve));
    });
    const controller = new AbortController();
    const request = searchEntities("org-a", "Ana", controller.signal);
    await waitFor(() => expect(pending).toHaveLength(3));
    controller.abort();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    pending.forEach((resolve) => resolve(response([])));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("troca rápida de ID não abre ficha de uma resposta anterior", async () => {
    let resolveOld: ((value: Response) => void) | undefined;
    state.fetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("id") === "eq.c-old") return new Promise((resolve) => { resolveOld = resolve; });
      return response(url.searchParams.get("id") === "eq.c-new" ? [{ ...contact, id: "c-new", first_name: "Atual" }] : []);
    });
    mountPage("/contacts?id=c-old", <Contacts />);
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Trocar registro" }));
    expect(await screen.findByRole("heading", { name: "Atual Distante" })).toBeInTheDocument();
    await act(async () => resolveOld!(response([{ ...contact, id: "c-old", first_name: "Antigo" }])));
    expect(screen.queryByRole("heading", { name: "Antigo Distante" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atual Distante" })).toBeInTheDocument();
  });
});
