// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
const transport = vi.hoisted(() => ({ insert: vi.fn(), updateStage: vi.fn() }));
vi.mock("@/hooks/useOrg", () => ({ useOrg: () => ({ orgId: "org-test" }) }));
vi.mock("@/lib/api/deals", () => ({ dealsApi: { updateStage: transport.updateStage } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const query = {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      then: (resolve: (response: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
      insert: transport.insert,
    };
    return query;
  },
} }));
import { ContactDrawer } from "@/components/crm/ContactDrawer";
import { useUpdateDealStage, dealsKeys } from "@/hooks/queries/useDeals";
import { useToast } from "@/hooks/use-toast";
import { OfflineDetector } from "@/components/OfflineDetector";

// Observe real notifications, but omit notifications already present before this test.
function Notifications() {
  const { toasts } = useToast();
  const initial = useRef(new Set(toasts.map((t) => t.id)));
  return <aside>{toasts.filter((t) => !initial.current.has(t.id)).map((t) => <div key={t.id}>{t.title}{t.description}</div>)}</aside>;
}
const contact = {
  id: "contact-1", org_id: "org-test", first_name: "Ana", last_name: "Silva",
  lifecycle_stage: "lead", metadata: null, created_at: "2026-10-01T00:00:00Z",
} as Database["public"]["Tables"]["contacts"]["Row"];
function setupDrawer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><ContactDrawer contact={contact} companies={[]} onClose={() => {}} onUpdate={() => {}} /><Notifications /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Atividades/ }), { button: 0, ctrlKey: false });
  fireEvent.change(screen.getByPlaceholderText("Título"), { target: { value: "Ligar amanhã" } });
  fireEvent.change(screen.getByPlaceholderText("Descrição..."), { target: { value: "Revisar proposta" } });
}
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => cleanup());

describe("salvamento confirmado", () => {
  it("INSERT com erro preserva rascunho e mostra erro sem sucesso", async () => {
    transport.insert.mockResolvedValue({ data: null, error: { message: "Não foi possível salvar" } });
    setupDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(screen.getByPlaceholderText("Título")).toHaveValue("Ligar amanhã"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar"));
    expect(screen.getByPlaceholderText("Descrição...")).toHaveValue("Revisar proposta");
    expect(screen.queryByText("Atividade adicionada")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Título")).toHaveFocus();
  });

  it("bloqueia submit repetido enquanto salva e só limpa após confirmação", async () => {
    const pending = deferred<{ data: null; error: null }>();
    transport.insert.mockReturnValue(pending.promise);
    setupDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const submit = screen.getByRole("button", { name: /Adicionando/ });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(transport.insert).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("Título")).toHaveValue("Ligar amanhã");
    await act(async () => pending.resolve({ data: null, error: null }));
    await waitFor(() => expect(screen.getByPlaceholderText("Título")).toHaveValue(""));
    expect(screen.getByPlaceholderText("Descrição...")).toHaveValue("");
    expect(screen.getByText("Atividade adicionada")).toBeInTheDocument();
  });

  it("uma falha de transporte permite reenviar o rascunho", async () => {
    transport.insert.mockRejectedValueOnce(new Error("Conexão interrompida")).mockResolvedValue({ data: null, error: null });
    setupDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Conexão interrompida"));
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(screen.getByPlaceholderText("Título")).toHaveValue(""));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("etapa otimista faz rollback e explica a falha em vez de sumir em silêncio", async () => {
    const pending = deferred<never>();
    transport.updateStage.mockReturnValue(pending.promise);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const key = dealsKeys.list("org-test", {});
    qc.setQueryData(key, { data: [{ id: "deal-1", stage_id: "stage-original" }], count: 1 });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}<Notifications /></QueryClientProvider>;
    const { result } = renderHook(useUpdateDealStage, { wrapper });
    act(() => result.current.mutate({ id: "deal-1", stageId: "stage-nova" }));
    await waitFor(() => expect(qc.getQueryData<{ data: { stage_id: string }[] }>(key)?.data[0].stage_id).toBe("stage-nova"));
    await act(async () => pending.reject({ message: "Etapa recusada" }));
    await waitFor(() => expect(qc.getQueryData<{ data: { stage_id: string }[] }>(key)?.data[0].stage_id).toBe("stage-original"));
    expect(await screen.findByText(/Etapa recusada/)).toHaveTextContent(/anterior/);
  });

  it("offline informa que o salvamento depende da conexão, sem prometer sincronização", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<OfflineDetector />);
    expect(screen.getByRole("alert")).toHaveTextContent(/conexão/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/serão sincronizadas/i);
    fireEvent(window, new Event("online"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
});
