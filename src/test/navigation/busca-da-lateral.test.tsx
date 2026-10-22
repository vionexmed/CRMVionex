// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { searchEntities, type EntitySearch } from "@/lib/api/global-search";
import { trechoEmDestaque } from "@/components/layout/BuscaDaLateral";

const auth = vi.hoisted(() => ({ isAdmin: true, user: { id: "u1" }, profile: { name: "Lucas", email: "l@example.test", org_id: "org-a" }, signOut: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/crm/NotificationBell", () => ({ NotificationBell: (): null => null }));
vi.mock("@/components/layout/useContagensDaLateral", () => ({
  useAtrasadasDaLateral: () => ({ data: 0 }), useNaoLidasDaLateral: () => ({ data: 0 }), useOrganizacaoDaLateral: () => ({ data: { nome: "Vionex" } }),
}));
vi.mock("@/lib/api/global-search", async (original) => ({ ...(await original<typeof import("@/lib/api/global-search")>()), searchEntities: vi.fn() }));

const resultado = (parcial: Partial<EntitySearch> = {}): EntitySearch => ({
  contacts: [{ id: "c1", kind: "contact", title: "Maria Souza", subtitle: "maria@example.test", href: "/contacts?id=c1" }],
  companies: [{ id: "e1", kind: "company", title: "Clínica Mar Azul", subtitle: "marazul.test", href: "/companies?id=e1" }],
  deals: [{ id: "d1", kind: "deal", title: "Implantação Marília", subtitle: "R$ 8.000", href: "/deals/d1" }],
  ...parcial,
});
function Rota() { const l = useLocation(); return <output aria-label="Destino">{l.pathname}{l.search}</output>; }
function montar(inicial = "/dashboard") {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[inicial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider><SidebarProvider><AppSidebar /><Rota /></SidebarProvider></TooltipProvider>
    </MemoryRouter>
  </QueryClientProvider>);
}
const abrir = () => { fireEvent.click(screen.getByRole("button", { name: /Buscar no CRM/ })); return screen.getByRole("combobox", { name: "Buscar no CRM" }); };
const digitar = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

beforeEach(() => { localStorage.clear(); auth.isAdmin = true; vi.mocked(searchEntities).mockReset().mockResolvedValue(resultado()); });
afterEach(() => cleanup());

describe("busca dentro da lateral", () => {
  it("vazia, mostra Recentes (com limpar) e Ir para, e troca a lista de navegação", () => {
    localStorage.setItem("vionex-search:u1:org-a", JSON.stringify(["Ana"]));
    localStorage.setItem("vionex-search-registros:u1:org-a", JSON.stringify([{ id: "c9", kind: "contact", title: "Paula Reis", href: "/contacts?id=c9" }]));
    montar();
    abrir();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    const lista = screen.getByRole("listbox", { name: "Resultados da busca" });
    expect(within(within(lista).getByRole("group", { name: "Recentes" })).getAllByRole("option").map((o) => o.textContent)).toEqual(["PRPaula ReisContato", "AnaBusca"]);
    expect(within(within(lista).getByRole("group", { name: "Ir para" })).getByRole("option", { name: /Pipeline/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Limpar recentes" }));
    expect(screen.queryByRole("group", { name: "Recentes" })).toBeNull();
    expect(localStorage.getItem("vionex-search:u1:org-a")).toBeNull();
  });

  it("digitar agrupa por tipo, destaca o trecho e anuncia a quantidade", async () => {
    montar();
    digitar(abrir(), "mar");
    await screen.findByRole("option", { name: /Souza/ });
    expect(vi.mocked(searchEntities)).toHaveBeenCalledWith("org-a", "mar", expect.anything());
    for (const g of ["Páginas", "Contatos", "Empresas", "Negócios"]) expect(screen.getByRole("group", { name: g })).toBeVisible();
    const maria = screen.getByRole("option", { name: /Souza/ });
    expect(within(maria).getByText("Mar", { selector: "strong" })).toBeVisible();
    expect(maria.textContent).toContain("maria@example.test");
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(/^\d+ resultados$/));
  });

  it("↑/↓ movem o realce (aria-activedescendant) e Enter abre o registro", async () => {
    montar();
    const campo = abrir();
    digitar(campo, "mar");
    await screen.findByRole("option", { name: /Souza/ });
    const opcoes = screen.getAllByRole("option");
    expect(campo).toHaveAttribute("aria-activedescendant", opcoes[0].id);
    fireEvent.keyDown(campo, { key: "ArrowDown" });
    expect(campo).toHaveAttribute("aria-activedescendant", opcoes[1].id);
    expect(opcoes[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(campo, { key: "ArrowUp" }); fireEvent.keyDown(campo, { key: "ArrowUp" });
    expect(campo).toHaveAttribute("aria-activedescendant", opcoes[opcoes.length - 1].id);
    fireEvent.click(screen.getByRole("option", { name: /Souza/ }));
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/contacts?id=c1");
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeVisible());
    // O registro e o termo viram "Recentes", por organização.
    expect(JSON.parse(localStorage.getItem("vionex-search-registros:u1:org-a")!)[0]).toMatchObject({ id: "c1", href: "/contacts?id=c1" });
    expect(JSON.parse(localStorage.getItem("vionex-search:u1:org-a")!)).toEqual(["mar"]);
  });

  it("erro de uma categoria não derruba as outras", async () => {
    vi.mocked(searchEntities).mockResolvedValue(resultado({ companies: [], errors: { companies: "falhou" } }));
    montar();
    digitar(abrir(), "mar");
    await screen.findByText(/Não foi possível buscar empresas/);
    expect(within(screen.getByRole("group", { name: "Empresas" })).getByText(/Não foi possível buscar empresas/)).toBeVisible();
    expect(screen.getByRole("group", { name: "Negócios" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  it("sem resultado, diz o termo e sugere o que tentar; com 5 por grupo oferece Ver todos", async () => {
    vi.mocked(searchEntities).mockResolvedValue(resultado({ contacts: [], companies: [], deals: [] }));
    montar();
    digitar(abrir(), "zzzz");
    expect(await screen.findByText("Nenhum resultado para “zzzz”")).toBeVisible();
    expect(screen.getByText(/Confira a grafia/)).toBeVisible();
    const cinco = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, kind: "contact" as const, title: `Mara ${i}`, href: `/contacts?id=c${i}` }));
    vi.mocked(searchEntities).mockResolvedValue(resultado({ contacts: cinco, companies: [], deals: [] }));
    digitar(screen.getByRole("combobox"), "mara");
    fireEvent.click(await screen.findByRole("option", { name: /Ver todos em contatos/ }));
    expect(screen.getByLabelText("Destino")).toHaveTextContent("/contacts");
  });

  it("Esc limpa o termo e, com o campo vazio, fecha devolvendo o foco a Buscar", async () => {
    montar();
    const campo = abrir();
    digitar(campo, "ma");
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(campo).toHaveValue("");
    fireEvent.keyDown(campo, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeVisible());
    expect(screen.getByRole("button", { name: /Buscar no CRM/ })).toHaveFocus();
  });

  it('"/" abre a busca quando nenhum campo tem foco', () => {
    montar();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("combobox", { name: "Buscar no CRM" })).toHaveFocus();
  });

  it("o destaque ignora acento e caixa", () => {
    const { container } = render(<p>{trechoEmDestaque("Clínica Marília", "clinica")}</p>);
    expect(container.querySelector("strong")!.textContent).toBe("Clínica");
  });
});
