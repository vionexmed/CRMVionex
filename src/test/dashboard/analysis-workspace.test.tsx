// @vitest-environment jsdom
import { render, renderHook, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Users } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatCard } from "@/components/dashboard/StatCard";
import { GraficoPessoas } from "@/components/dashboard/SdrCharts";
import { useMarketingData } from "@/hooks/useMarketingData";

const transport = vi.hoisted(() => ({ failures: {} as Record<string, { code?: string; message: string }>, calls: 0 }));
vi.mock("@/hooks/useOrg", () => ({ useOrg: () => ({ orgId: "org-test" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "limit"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => {
    transport.calls++;
    return Promise.resolve({ data: [], count: 0, error: transport.failures[table] ?? null }).then(resolve);
  };
  return query;
} } }));
afterEach(cleanup);
beforeEach(() => { transport.failures = {}; transport.calls = 0; });

function MetricFixture({ value, noSource = false, onOpen }: { value: number | null; noSource?: boolean; onOpen?: () => void }) {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TooltipProvider><StatCard label="Leads recebidos" value={value} noSource={noSource} icon={Users} onCardClick={onOpen} /></TooltipProvider></MemoryRouter>;
}

describe("indicadores preservam o significado e a operação", () => {
  it("distingue zero, ausência de dados e ausência de fonte", () => {
    const view = render(<MetricFixture value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    view.rerender(<MetricFixture value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("sem dados no período")).toBeInTheDocument();
    view.rerender(<MetricFixture value={null} noSource />);
    expect(screen.getByText("sem fonte de dado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver Leads recebidos" })).not.toBeInTheDocument();
  });
  it("abre o detalhe pelo teclado sem reanimar o número ao atualizar", () => {
    const onOpen = vi.fn();
    const view = render(<MetricFixture value={42} onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Ver Leads recebidos" }), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
    view.rerender(<MetricFixture value={43} onOpen={onOpen} />);
    expect(screen.getByText("43")).toBeInTheDocument();
  });
  it("mostra contagens por pessoa em tabela e vazio explícito", () => {
    const view = render(<GraficoPessoas dados={[{ pessoa: "Ana Silva", leads: 8, abordagens: 12, reunioes: 2, vendas: 1 }]} />);
    expect(screen.getByRole("table")).toHaveTextContent("Ana Silva81221".replace("1221", "1221"));
    expect(screen.getByRole("cell", { name: "12" })).toBeInTheDocument();
    view.rerender(<GraficoPessoas dados={[]} />);
    expect(screen.getByText("Nenhuma atividade registrada por pessoa neste período.")).toBeInTheDocument();
  });
});

describe("marketing distingue falha de fonte ausente e permite tentar novamente", () => {
  it("expõe falha obrigatória sem apresentar um zero como dado válido; refetch recupera", async () => {
    transport.failures.meta_insights = { message: "Consulta indisponível" };
    const { result } = renderHook(() => useMarketingData("30d"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Consulta indisponível");
    transport.failures = {};
    result.current.refetch();
    await waitFor(() => expect(result.current.error).toBeNull());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(transport.calls).toBeGreaterThanOrEqual(16);
  });
  it("tabela Google ausente permanece não integrado, erro de permissão permanece falha", async () => {
    transport.failures.google_ads_campaigns = { code: "42P01", message: "relation missing" };
    const { result } = renderHook(() => useMarketingData("30d"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.google.source).toBe("nao-integrado");
    transport.failures.google_ads_campaigns = { code: "42501", message: "Permissão negada" };
    result.current.refetch();
    await waitFor(() => expect(result.current.error).toBe("Permissão negada"));
  });
});
