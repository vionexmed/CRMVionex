// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A casca lê as contagens da lateral pelo react-query, como no App.
const comConsultas = (ui: React.ReactElement) =>
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
type Response = { data: unknown; error: unknown };
const transport = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: Session | null) => void),
  getSession: vi.fn(), signOut: vi.fn(), profile: vi.fn(), role: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: async (): Promise<Response> => ({ data: null, error: null }),
  auth: {
    getSession: transport.getSession, signOut: transport.signOut,
    onAuthStateChange: (listener: typeof transport.listener) => {
      transport.listener = listener;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
  from: (table: string) => {
    let id = "";
    const query = {
      select: () => query,
      eq: (field: string, value: string) => { if (field === "id" || field === "user_id") id = value; return query; },
      is: () => query, lte: () => query, gt: () => query, order: () => query, limit: () => query,
      then: (resolve: (response: Response) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      maybeSingle: () => table === "profiles" ? transport.profile(id) : transport.role(id),
    };
    return query;
  },
} }));
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
const session = (id: string) => ({ user: { id }, access_token: id } as Session);
const profile = (id: string) => ({ id, org_id: `org-${id}` });
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const emit = (value: Session | null, event = value ? "SIGNED_IN" : "SIGNED_OUT") => act(() => transport.listener!(event, value));

function DraftRoute() {
  const [draft, setDraft] = useState("");
  const [continued, setContinued] = useState(false);
  const { refreshProfile } = useAuth();
  return <>
    <input aria-label="Rascunho" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <button onClick={async () => { await refreshProfile(); setContinued(true); }}>Atualizar perfil</button>
    {continued && <p>Etapa concluída</p>}
  </>;
}
function mountDraftRoute() {
  render(comConsultas(<MemoryRouter initialEntries={["/contacts"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider><Routes><Route element={<AppLayout />}><Route path="/contacts" element={<DraftRoute />} /></Route></Routes></AuthProvider>
  </MemoryRouter>));
}

beforeEach(() => {
  vi.resetAllMocks();
  transport.getSession.mockResolvedValue({ data: { session: null } });
  transport.signOut.mockResolvedValue({ error: null });
  transport.role.mockResolvedValue({ data: { role: "member" }, error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("perfil e sessão confiáveis", () => {
  it.each(["TOKEN_REFRESHED", "SIGNED_IN"])("%s do mesmo usuário preserva o formulário montado e seu rascunho", async (event) => {
    transport.getSession.mockResolvedValue({ data: { session: session("ana") } });
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    mountDraftRoute();
    const input = await screen.findByRole("textbox", { name: "Rascunho" });
    fireEvent.change(input, { target: { value: "Proposta em preparação" } });
    const pending = deferred<Response>();
    transport.profile.mockReturnValue(pending.promise);
    emit(session("ana"), event);
    expect(input).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho" })).toBe(input);
    expect(input).toHaveValue("Proposta em preparação");
    await waitFor(() => expect(transport.profile).toHaveBeenCalledTimes(2));
    await act(async () => pending.resolve({ data: profile("ana"), error: null }));
    expect(screen.getByRole("textbox", { name: "Rascunho" })).toBe(input);
    expect(input).toHaveValue("Proposta em preparação");
  });

  it("refreshProfile preserva a instância para continuar o fluxo depois do await", async () => {
    transport.getSession.mockResolvedValue({ data: { session: session("ana") } });
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    mountDraftRoute();
    const input = await screen.findByRole("textbox", { name: "Rascunho" });
    fireEvent.change(input, { target: { value: "Cadastro em preparação" } });
    const pending = deferred<Response>();
    transport.profile.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar perfil" }));
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Cadastro em preparação");
    await act(async () => pending.resolve({ data: profile("ana"), error: null }));
    expect(screen.getByRole("textbox", { name: "Rascunho" })).toBe(input);
    expect(screen.getByText("Etapa concluída")).toBeInTheDocument();
  });

  it("getSession iniciado antes de signOut não restaura a sessão encerrada", async () => {
    const initial = deferred<{ data: { session: Session | null } }>();
    transport.getSession.mockReturnValue(initial.promise);
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => result.current.signOut());
    await act(async () => initial.resolve({ data: { session: session("ana") } }));
    expect(result.current.user).toBeNull();
    expect(result.current.profileStatus).toBe("idle");
  });

  it("perfil ausente depois dos retries recebe estado missing, distinto de falha da consulta", async () => {
    vi.useFakeTimers();
    transport.profile.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await Promise.resolve(); });
    emit(session("ana"));
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(result.current.profileStatus).toBe("missing");
    expect(result.current.profileError).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("a tela de erro recebe foco e permite repetir a carga sem recarregar a página", async () => {
    transport.profile.mockResolvedValue({ data: null, error: { message: "Consulta indisponível" } });
    render(comConsultas(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><AppLayout /></AuthProvider></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    emit(session("ana"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Consulta indisponível");
    expect(alert).toHaveFocus();
    const pending = deferred<Response>();
    transport.profile.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("mantém loading quando um usuário entra após a sessão deslogada", async () => {
    const pending = deferred<Response>();
    transport.profile.mockReturnValue(pending.promise);
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    expect(result.current.loading).toBe(true);
    expect(result.current.profileStatus).toBe("loading");
    await act(async () => pending.resolve({ data: profile("ana"), error: null }));
    await waitFor(() => expect(result.current.profileStatus).toBe("ready"));
    expect(result.current.profile?.id).toBe("ana");
    expect(result.current.loading).toBe(false);
  });

  it("uma carga antiga não substitui o perfil e o papel da identidade vigente", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    transport.profile.mockImplementation((id: string) => id === "ana" ? first.promise : second.promise);
    transport.role.mockImplementation((id: string) => Promise.resolve({ data: { role: id === "ana" ? "owner" : "member" }, error: null }));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    await waitFor(() => expect(transport.profile).toHaveBeenCalledWith("ana"));
    emit(session("bia"));
    await act(async () => second.resolve({ data: profile("bia"), error: null }));
    await waitFor(() => expect(result.current.profile?.id).toBe("bia"));
    await act(async () => first.resolve({ data: profile("ana"), error: null }));
    expect(result.current.user?.id).toBe("bia");
    expect(result.current.profile?.id).toBe("bia");
    expect(result.current.isAdmin).toBe(false);
  });

  it("logout invalida o perfil que ainda está carregando", async () => {
    const pending = deferred<Response>();
    transport.profile.mockReturnValue(pending.promise);
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    await waitFor(() => expect(transport.profile).toHaveBeenCalled());
    emit(null);
    await act(async () => pending.resolve({ data: profile("ana"), error: null }));
    expect(result.current.profile).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.profileStatus).toBe("idle");
  });

  it("getSession atrasado não desfaz um evento de login mais recente", async () => {
    const initial = deferred<{ data: { session: Session | null } }>();
    transport.getSession.mockReturnValue(initial.promise);
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    const { result } = renderHook(useAuth, { wrapper });
    emit(session("ana"));
    await waitFor(() => expect(result.current.profile?.id).toBe("ana"));
    await act(async () => initial.resolve({ data: { session: null } }));
    expect(result.current.user?.id).toBe("ana");
    expect(result.current.profile?.id).toBe("ana");
  });

  it("expõe erro de consulta legível e permite tentar carregar novamente", async () => {
    transport.profile.mockResolvedValue({ data: null, error: { message: "Conexão indisponível" } });
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    await waitFor(() => expect(result.current.profileStatus).toBe("error"), { timeout: 5000 });
    expect(result.current.profileError).toContain("Conexão indisponível");
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    await act(async () => result.current.refreshProfile());
    expect(result.current.profileStatus).toBe("ready");
    expect(result.current.profileError).toBeNull();
  });

  it("falha no papel não apresenta permissões como se a consulta tivesse sucesso", async () => {
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    transport.role.mockResolvedValue({ data: null, error: { message: "Permissões indisponíveis" } });
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    await waitFor(() => expect(result.current.profileStatus).toBe("error"));
    expect(result.current.profileError).toContain("Permissões indisponíveis");
    expect(result.current.isAdmin).toBe(false);
  });

  it("refresh concorrente só aceita o resultado da última solicitação", async () => {
    transport.profile.mockResolvedValue({ data: profile("ana"), error: null });
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    emit(session("ana"));
    await waitFor(() => expect(result.current.profile?.id).toBe("ana"));
    const old = deferred<Response>();
    transport.profile.mockReturnValueOnce(old.promise).mockResolvedValue({ data: { ...profile("ana"), org_id: "org-nova" }, error: null });
    let oldRefresh!: Promise<void>;
    act(() => { oldRefresh = result.current.refreshProfile(); });
    await waitFor(() => expect(transport.profile).toHaveBeenCalledTimes(2));
    await act(async () => result.current.refreshProfile());
    await act(async () => { old.resolve({ data: profile("ana"), error: null }); await oldRefresh; });
    expect(result.current.profile?.org_id).toBe("org-nova");
  });
});
