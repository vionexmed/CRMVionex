// @vitest-environment jsdom
/**
 * A casca do Visual 01: selos da lateral, bloco da organização e barra
 * superior. O que se protege aqui quebra em SILÊNCIO -- um selo que mostra "0"
 * para sempre porque a coluna não existe, ou um ícone de ajuda que não abre
 * nada -- e não aparece em captura de tela.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type Resposta = { data?: unknown; count?: number | null; error: unknown };
const banco = vi.hoisted(() => ({
  respostas: {} as Record<string, { data?: unknown; count?: number | null; error: unknown }>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "lt", "in", "order"]) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve(banco.respostas[tabela] ?? { data: null, error: null });
    q.then = (ok: (r: Resposta) => unknown) => Promise.resolve(banco.respostas[tabela] ?? { data: [], count: 0, error: null }).then(ok);
    return q;
  },
} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: true, profile: { name: "Lucas Sapuppo", email: "lucas@example.test", org_id: "org" }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useOrg", () => ({ useOrg: () => ({ orgId: "org" }) }));
vi.mock("@/components/crm/NotificationBell", () => ({ NotificationBell: (): null => null }));

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

afterEach(() => { cleanup(); banco.respostas = {}; });

function lateral() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/contacts"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider><SidebarProvider><AppSidebar /></SidebarProvider></TooltipProvider>
    </MemoryRouter>
  </QueryClientProvider>);
}

describe("selos da lateral", () => {
  it("mostra atrasadas e não lidas com nome acessível", async () => {
    banco.respostas = {
      activities: { count: 5, error: null },
      whatsapp_messages: { count: 12, error: null },
      organizations: { data: { name: "Vionex", plan: "pro", settings: { segment: "Clínicas" } }, error: null },
    };
    lateral();
    await waitFor(() => expect(screen.getByRole("link", { name: "Atividades" })).toHaveAccessibleDescription("5 atrasadas"));
    await waitFor(() => expect(screen.getByRole("link", { name: "Atendimento" })).toHaveAccessibleDescription("12 não lidas"));
    // O topo da lateral é o LOGO ORIGINAL da Vionex (símbolo + "vionex"), não
    // um quadrado com inicial nem o nome escrito à mão.
    expect(screen.getByRole("img", { name: "Vionex" })).toBeVisible();
  });

  /** Configurações fica fixa no canto inferior, abre o menu da conta e marca quando está aberta. */
  it("a engrenagem do rodapé abre o menu da conta; a logo não abre menu", async () => {
    lateral();
    expect(screen.queryByRole("button", { name: "Conta e configurações" })).toBeNull();
    expect(screen.getByRole("img", { name: "Vionex" }).closest("a")).toHaveAttribute("href", "/dashboard");
    const engrenagem = screen.getByRole("button", { name: "Configurações" });
    expect(engrenagem.closest("[data-sidebar=\"footer\"]")).not.toBeNull();
    expect(engrenagem).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.keyDown(engrenagem, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("lucas@example.test")).toBeVisible();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Configurações", "Equipe", "Meu e-mail", "Integrações", "Segurança", "Recolher menu lateral", "Sair",
    ]);
  });

  /**
   * `whatsapp_messages.lida_em` nasce numa migração que pode não estar
   * aplicada: o PostgREST responde 42703. O selo SOME -- um "0" diria que não
   * há nada por ler, o que é mentira.
   */
  it("coluna ausente apaga o selo em vez de mostrar zero", async () => {
    banco.respostas = {
      activities: { count: 3, error: null },
      whatsapp_messages: { count: null, error: { code: "42703", message: "column whatsapp_messages.lida_em does not exist" } },
    };
    lateral();
    await waitFor(() => expect(screen.getByRole("link", { name: "Atividades" })).toHaveAccessibleDescription("3 atrasadas"));
    const comunicacao = screen.getByRole("link", { name: "Atendimento" });
    expect(comunicacao).not.toHaveAttribute("aria-describedby");
    expect(within(comunicacao).queryByText("0")).toBeNull();
  });

  it("zero não desenha selo", async () => {
    banco.respostas = { activities: { count: 0, error: null }, whatsapp_messages: { count: 0, error: null } };
    lateral();
    await waitFor(() => expect(screen.getByRole("link", { name: "Atividades" })).toBeVisible());
    expect(screen.getByRole("link", { name: "Atividades" })).not.toHaveAttribute("aria-describedby");
  });

  it("o menu da conta mora na engrenagem do rodapé e não há Financeiro", () => {
    lateral();
    expect(screen.getByRole("button", { name: "Configurações" })).toBeVisible();
    // Financeiro aparece nas capturas, mas o módulo não existe: item sem tela
    // seria uma porta para lugar nenhum.
    expect(screen.queryByRole("link", { name: /Financeiro/ })).toBeNull();
  });
});

/**
 * O padrão da plataforma não tem barra superior no desktop: o que morava nela
 * foi para a lateral (Buscar no topo da lista; Notificações e Ajuda no rodapé)
 * e o "+ Novo" global saiu -- cada tela tem a sua ação primária.
 */
describe("o que era da barra superior", () => {
  it("ajuda leva a um lugar de verdade, no rodapé da lateral", () => {
    lateral();
    const ajuda = screen.getByRole("link", { name: /Ajuda/ });
    expect(ajuda).toHaveAttribute("href", expect.stringMatching(/^mailto:suporte@/));
    expect(ajuda.closest("[data-sidebar=\"footer\"]")).not.toBeNull();
  });

  it("Buscar abre a busca DENTRO da lateral, no topo", () => {
    lateral();
    fireEvent.click(screen.getByRole("button", { name: /Buscar no CRM/ }));
    expect(screen.getByRole("combobox", { name: "Buscar no CRM" })).toBeVisible();
    expect(screen.getByRole("listbox", { name: "Resultados da busca" })).toBeVisible();
  });

  it("o selo de notificações carrega o total no nome acessível", () => {
    const sino = readFileSync("src/components/crm/NotificationBell.tsx", "utf8");
    expect(sino).toMatch(/naoLidas > 0 \? `Notificações: /);
    expect(sino).toContain("aria-label={rotuloAcessivel}");
    expect(sino).toContain("bg-alerta");
    // Mora no rodapé da lateral.
    const lat = readFileSync("src/components/layout/AppSidebar.tsx", "utf8");
    expect(lat.slice(lat.indexOf("<SidebarFooter"))).toContain("<NotificationBell");
  });

  it("no desktop não há barra superior nem \"+ Novo\" global", () => {
    const casca = readFileSync("src/components/layout/AppLayout.tsx", "utf8");
    expect(casca).toContain("{isMobile && <AppHeader");
    const barra = readFileSync("src/components/layout/AppHeader.tsx", "utf8");
    expect(barra).not.toContain("Criar novo registro");
    expect(barra).toContain("md:hidden");
  });

  it("a barra do celular tem o botão de menu e o nome da tela", () => {
    render(<MemoryRouter initialEntries={["/contacts"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SidebarProvider><AppHeader onOpenSearch={vi.fn()} /></SidebarProvider></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Alternar navegação lateral" })).toBeVisible();
    expect(screen.getByRole("banner")).toHaveTextContent("Contatos");
  });
});
