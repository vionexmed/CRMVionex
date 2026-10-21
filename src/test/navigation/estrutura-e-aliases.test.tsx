// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as navigation from "@/components/layout/navegacao";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const auth = vi.hoisted(() => ({ isAdmin: false, user: { id: "pessoa" }, loading: false, profileStatus: "ready", profileError: null as string | null, refreshProfile: vi.fn(), profile: { name: "Pessoa", email: "pessoa@example.test" }, signOut: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/crm/AtRiskPanel", () => ({ AtRiskPanel: (): null => null }));

afterEach(() => { cleanup(); auth.isAdmin = false; vi.restoreAllMocks(); localStorage.clear(); });

// Removing a section, admitting admin modules, or comparing only entry paths
// would fail these contracts, independently of the visual implementation.
describe("catálogo da navegação aprovada", () => {
  it("oferece os seis destinos na ordem de trabalho", () => {
    expect(navigation.getVisibleNavigation(false).map((section) => section.label)).toEqual([
      "Painel", "Atividades", "Clientes", "Negócios", "Comunicação", "Análise",
    ]);
  });

  it("oculta módulos administrativos de membros sem perder os públicos", () => {
    const member = navigation.getVisibleNavigation(false).flatMap((section) => section.items);
    const admin = navigation.getVisibleNavigation(true).flatMap((section) => section.items);
    expect(member.some((item) => item.adminOnly)).toBe(false);
    expect(admin.filter((item) => item.adminOnly).map((item) => item.path)).toEqual(expect.arrayContaining([
      "/marketing/visao-geral",
    ]));
  });

  it.each([
    ["/deals/registro-id", "negocios"], ["/produtos", "negocios"], ["/orcamentos", "negocios"],
    ["/companies", "clientes"], ["/leads", "clientes"], ["/tasks", "atividades"],
    ["/conversations", "comunicacao"], ["/instagram", "comunicacao"], ["/inbox", "comunicacao"],
    ["/comunicacao/instagram", "comunicacao"],
    ["/marketing/visao-geral", "analise"],
  ])("%s seleciona %s ao abrir um link direto", (path, section) => {
    expect(navigation.getActiveSection(path)).toBe(section);
  });

  it("não confunde prefixos parecidos, conta e rotas desconhecidas", () => {
    expect(navigation.getActiveSection("/deals-old")).toBeNull();
    expect(navigation.getActiveSection("/settings/email")).toBeNull();
    expect(navigation.getActiveSection("/unknown")).toBeNull();
  });

  it.each([false, true])("mobile alcança todos os módulos permitidos (admin=%s)", (isAdmin) => {
    const accessible = new Set([
      ...navigation.ABAS_CELULAR.map((item) => item.url),
      ...navigation.gruposDoMenuMais(isAdmin).flatMap((group) => group.items.map((item) => item.url)),
    ]);
    for (const section of navigation.getVisibleNavigation(isAdmin)) {
      for (const item of section.items) expect(accessible.has(item.path), item.path).toBe(true);
    }
    expect(navigation.ABAS_CELULAR.map((item) => item.title)).toEqual(["Painel", "Clientes", "Negócios", "Comunicação"]);
    expect(navigation.gruposDoMenuMais(isAdmin).flatMap((group) => group.items).some((item) => item.adminOnly && !isAdmin)).toBe(false);
  });
});

function sidebar(path: string, defaultOpen = true) {
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <TooltipProvider><SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
    </SidebarProvider></TooltipProvider>
  </MemoryRouter>);
}

/** Os links de ÁREA, sem os módulos que abrem abaixo da área ativa. */
const linksDeArea = (nav: HTMLElement) =>
  within(nav).getAllByRole("link").filter((link) => !link.closest('[aria-label^="Módulos de"]'));

describe("sidebar primária e acionador compartilhado", () => {
  it("mostra só seis áreas e abre os módulos da área ativa abaixo dela", () => {
    sidebar("/produtos");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(linksDeArea(nav)).toHaveLength(6);
    expect(within(nav).getByRole("link", { name: "Negócios" })).toHaveAttribute("aria-current", "true");
    const modulos = screen.getByRole("list", { name: "Módulos de Negócios" });
    expect(within(modulos).getByRole("link", { name: "Produtos" })).toHaveAttribute("aria-current", "page");
    // Só a área ativa abre: Comunicação não expõe os canais aqui.
    expect(within(nav).queryByRole("link", { name: "Instagram" })).toBeNull();
  });

  it("a busca mora na barra superior e abre a busca compartilhada", () => {
    const open = vi.fn();
    render(<MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SidebarProvider><AppHeader onOpenSearch={open} /></SidebarProvider></MemoryRouter>);
    fireEvent.click(screen.getAllByRole("button", { name: /Buscar no CRM/ })[0]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("mantém nomes acessíveis e seleção quando recolhida", () => {
    sidebar("/instagram", false);
    expect(screen.getByRole("link", { name: "Comunicação" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("list", { name: /Módulos de/ })).toBeNull();
  });
});

vi.mock("@/components/crm/NotificationBell", () => ({ NotificationBell: (): null => null }));

import { AppHeader } from "@/components/layout/AppHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";

function CurrentRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="route">{location.pathname}{location.search}{location.hash}</output><button onClick={() => navigate(-1)}>Voltar</button><button onClick={() => navigate(1)}>Avançar</button></>;
}

describe("breadcrumbs e navegação interna", () => {
  it("identifica área e módulo ao abrir Instagram diretamente", () => {
    render(<MemoryRouter initialEntries={["/instagram"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SidebarProvider><AppHeader onOpenSearch={vi.fn()} /></SidebarProvider></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Comunicação");
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Instagram");
  });

  it("mobile mantém Clientes ativo dentro de Empresas", () => {
    render(<MemoryRouter initialEntries={["/companies"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  });

  it("Comunicação oferece canais e troca seleção sem mesclar o conteúdo", async () => {
    const { CommunicationLayout } = await vi.importActual<typeof import("@/components/layout/CommunicationLayout")>("@/components/layout/CommunicationLayout");
    render(<MemoryRouter initialEntries={["/comunicacao/whatsapp"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route element={<CommunicationLayout />}>
      <Route path="/comunicacao/whatsapp" element={<p>Mensagens WhatsApp</p>} />
      <Route path="/comunicacao/instagram" element={<p>Mensagens Instagram</p>} />
    </Route></Routes></MemoryRouter>);
    const nav = screen.getByRole("navigation", { name: "Módulos de Comunicação" });
    expect(within(nav).getAllByRole("link")).toHaveLength(3);
    fireEvent.click(within(nav).getByRole("link", { name: "Instagram" }));
    expect(screen.getByText("Mensagens Instagram")).toBeVisible();
    expect(screen.queryByText("Mensagens WhatsApp")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Instagram" })).toHaveAttribute("aria-current", "page");
  });
});

describe("aliases de Comunicação", () => {
  it.each([
    ["/conversations", "/comunicacao/whatsapp"], ["/instagram", "/comunicacao/instagram"], ["/inbox", "/comunicacao/email"],
  ])("%s preserva query e hash ao ir para %s", async (alias, target) => {
    const { LegacyChannelRedirect } = await vi.importActual<typeof import("@/components/layout/CommunicationLayout")>("@/components/layout/CommunicationLayout");
    render(<MemoryRouter initialEntries={[`${alias}?id=registro&folder=sent#mensagem`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
      <Route path={alias} element={<LegacyChannelRedirect to={target} />} /><Route path={target} element={<CurrentRoute />} />
    </Routes></MemoryRouter>);
    expect(screen.getByTestId("route")).toHaveTextContent(`${target}?id=registro&folder=sent#mensagem`);
  });

  it("Voltar não reabre o alias e Avançar retorna ao canal canônico", async () => {
    const { LegacyChannelRedirect } = await vi.importActual<typeof import("@/components/layout/CommunicationLayout")>("@/components/layout/CommunicationLayout");
    render(<MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
      <Route path="/dashboard" element={<><Link to="/inbox?q=teste">Abrir caixa</Link><CurrentRoute /></>} />
      <Route path="/inbox" element={<LegacyChannelRedirect to="/comunicacao/email" />} />
      <Route path="/comunicacao/email" element={<CurrentRoute />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Abrir caixa" }));
    expect(screen.getByTestId("route")).toHaveTextContent("/comunicacao/email?q=teste");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByTestId("route")).toHaveTextContent("/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByTestId("route")).toHaveTextContent("/comunicacao/email?q=teste");
  });
});


vi.mock("@/components/CommandPalette", () => ({ CommandPalette: ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => <div role="dialog" aria-label="Busca compartilhada"><button onClick={() => onOpenChange(false)}>Fechar busca</button></div> }));
import { AppLayout } from "@/components/layout/AppLayout";
import { useSidebar } from "@/components/ui/sidebar";
function SidebarPreference() { const { open } = useSidebar(); return <output data-testid="sidebar-preference">{String(open)}</output>; }
function appShell() {
  render(<MemoryRouter initialEntries={["/contacts"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TooltipProvider><Routes><Route element={<AppLayout />}><Route path="/contacts" element={<SidebarPreference />} /></Route></Routes></TooltipProvider></MemoryRouter>);
}

describe("casca, preferência e busca compartilhada", () => {
  it("restaura a preferência e salva alternância sem depender de storage", () => {
    localStorage.setItem("vx-sidebar-open", "0");
    appShell();
    expect(screen.getByTestId("sidebar-preference")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "Alternar navegação lateral" }));
    expect(screen.getByTestId("sidebar-preference")).toHaveTextContent("true");
    expect(localStorage.getItem("vx-sidebar-open")).toBe("1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage indisponível"); });
    fireEvent.click(screen.getByRole("button", { name: "Alternar navegação lateral" }));
    expect(screen.getByTestId("sidebar-preference")).toHaveTextContent("false");
  });

  it("leitura de preferência bloqueada não impede acessar módulos", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage indisponível"); });
    appShell();
    // Com a lateral aberta, os módulos ficam nela, abaixo da área ativa.
    expect(screen.getByRole("list", { name: "Módulos de Clientes" })).toBeVisible();
  });

  it("sidebar, header mobile e Ctrl+K compartilham a paleta", async () => {
    appShell();
    for (const opener of screen.getAllByRole("button", { name: /Buscar no CRM/ })) {
      fireEvent.click(opener);
      await waitFor(() => expect(screen.getByRole("dialog", { name: "Busca compartilhada" })).toBeVisible());
      fireEvent.click(screen.getByRole("button", { name: "Fechar busca" }));
    }
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Busca compartilhada" })).toBeVisible());
  });
});


// These placeholders isolate real routing/guards from backend reads and sends.
// Removing a registered alias or the RequireAdmin boundary fails these tests.
vi.mock("@/pages/Conversations", () => ({ default: ({ canal }: { canal: string }) => <p>Conteúdo do canal {canal}</p> }));
vi.mock("@/pages/Inbox", () => ({ default: () => <p>Conteúdo do e-mail</p> }));
vi.mock("@/pages/MyEmail", () => ({ default: () => <p>Conexão pessoal do Gmail</p> }));
vi.mock("@/pages/Dashboard", () => ({ default: () => <p>Painel autorizado</p> }));
vi.mock("@/components/onboarding/OnboardingModal", () => ({ OnboardingModal: (): null => null }));
import App from "@/App";

describe("rotas registradas no App", () => {
  it.each([
    ["/conversations", "/comunicacao/whatsapp", "Conteúdo do canal whatsapp"],
    ["/instagram", "/comunicacao/instagram", "Conteúdo do canal instagram"],
    ["/inbox", "/comunicacao/email", "Conteúdo do e-mail"],
  ])("%s abre o canal correto no shell sem perder o link salvo", async (alias, target, content) => {
    window.history.replaceState({}, "", `${alias}?thread=123#mensagem`);
    render(<App />);
    expect(await screen.findByText(content)).toBeVisible();
    expect(window.location.pathname).toBe(target);
    expect(window.location.search).toBe("?thread=123");
    expect(window.location.hash).toBe("#mensagem");
    expect(screen.getByRole("navigation", { name: "Módulos de Comunicação" })).toBeVisible();
  });

  it("mantém a rota pessoal usada pelo retorno OAuth", async () => {
    window.history.replaceState({}, "", "/settings/email?gmail=conectado&conta=pessoa%40example.test");
    render(<App />);
    expect(await screen.findByText("Conexão pessoal do Gmail")).toBeVisible();
    expect(window.location.pathname).toBe("/settings/email");
    expect(window.location.search).toContain("gmail=conectado");
  });
});
