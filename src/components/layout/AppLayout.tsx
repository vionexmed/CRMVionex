import { useState, useEffect, useRef, useCallback, lazy, Suspense, type CSSProperties } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { EVENTO_ABRIR_BUSCA } from "./useBuscaDaLateral";
import { AppHeader } from "./AppHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { AreaNavigation } from "./CommunicationLayout";
import { getActiveSection } from "./navegacao";
import { cn } from "@/lib/utils";
/**
 * Os três pesam no PRIMEIRO acesso e quase nunca são usados nele.
 *
 * Montados estaticamente aqui, entravam no pacote inicial mesmo na tela de
 * login -- e traziam junto o que cada um importa:
 *
 *   CommandPalette   cmdk, 44 KB   abre só no ⌘K
 *   OnboardingModal  canvas-confetti, 11 KB   roda uma vez na vida da conta
 *
 * `lazy` adia o download até a primeira renderização de verdade. O
 * CommandPalette e o OnboardingModal só renderizam quando abertos, então nem
 * baixam antes disso.
 */
const CommandPalette = lazy(() =>
  import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const OnboardingModal = lazy(() =>
  import("@/components/onboarding/OnboardingModal").then((m) => ({ default: m.OnboardingModal })),
);
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  // Com a lateral visível (desktop), a busca abre DENTRO dela; no celular, onde
  // a lateral é uma gaveta fechada, segue o diálogo compartilhado.
  const onOpenSearch = useCallback(() => {
    if (isMobile) setSearchOpen(true); else window.dispatchEvent(new Event(EVENTO_ABRIR_BUSCA));
  }, [isMobile]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem("vx-sidebar-open") !== "0"; }
    catch { return true; }
  });
  const onSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try { localStorage.setItem("vx-sidebar-open", open ? "1" : "0"); }
    catch { /* A preferência não é requisito para navegar. */ }
  }, []);
  const { pathname } = useLocation();
  const activeSection = getActiveSection(pathname);
  const communication = activeSection === "comunicacao";
  const { user, profile, loading, isAdmin, profileStatus, profileError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const profileErrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (profileStatus === "error" || profileStatus === "missing") profileErrorRef.current?.focus();
  }, [profileStatus]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.isComposing) {
        e.preventDefault();
        onOpenSearch();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenSearch]);

  if (loading || (!profile && profileStatus === "loading")) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  // Perfil ausente significa que o trigger que cria o perfil falhou. Antes o
  // app "consertava" inserindo um perfil sem organização, o que jogava a pessoa
  // no wizard de empresa. Melhor parar e mostrar o que houve.
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div ref={profileErrorRef} tabIndex={-1} role="alert" className="max-w-sm space-y-2 text-center outline-none">
          <p className="font-heading text-base font-semibold">Não foi possível carregar seu perfil</p>
          <p className="text-sm text-muted-foreground">
            {profileStatus === "missing"
              ? "Seu perfil ainda não foi encontrado. Tente novamente. Se o problema continuar, peça a um administrador para conferir seu cadastro ou convite."
              : profileError || "A consulta do perfil falhou. Tente novamente para continuar."}
          </p>
          <Button onClick={() => void refreshProfile()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange} style={{ "--sidebar-width": "226px", "--sidebar-width-icon": "57px" } as CSSProperties}>
      {/*
        A CASCA É FIXA; quem rola é o CONTEÚDO.

        Era `min-h-screen`: a página inteira crescia com o conteúdo e rolava por
        baixo de tudo -- lateral e cabeçalho subiam junto. Pior no kanban, onde a
        coluna também rola: dois contêineres de rolagem aninhados, e a roda do
        mouse escolhia um deles conforme a posição do cursor. É o "a página
        inteira sobe" que você viu.

        `h-screen` + `overflow-hidden` na casca prende o quadro; `overflow-y-auto`
        no `<main>` faz a rolagem acontecer DENTRO da área de conteúdo, com a
        lateral e o cabeçalho parados. `min-h-0` no meio não é decorativo: filho
        de flex nasce com `min-height: auto`, e sem isso o `<main>` cresce com o
        conteúdo em vez de rolar -- a correção não vale nada sem ele.
      */}
      <div className="flex h-dvh w-full overflow-hidden">
        <AppSidebar />
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          {/* Sem barra superior no desktop (padrão da plataforma): o cabeçalho
              de cada tela vive no conteúdo. No celular fica a barra compacta
              com o botão de menu. */}
          {isMobile && <AppHeader onOpenSearch={onOpenSearch} />}
          {/* A lateral lista TODAS as páginas (recolhida, em ícones). A faixa de
              abas só serve no celular, onde ela vive escondida na gaveta. */}
          {activeSection && !communication && isMobile && <AreaNavigation sectionId={activeSection} />}
          <main className={cn("vx-page min-h-0 min-w-0 flex-1 overflow-y-auto bg-background", communication ? "p-0" : "p-4 md:px-8 md:py-7", "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8")}>
            <Outlet />
          </main>
        </div>
      </div>
      {isMobile && <MobileBottomNav />}
      {/* Sem `fallback` visível: são sobreposições, e um esqueleto piscando no
          canto da tela seria pior que o atraso de alguns milissegundos. */}
      <Suspense fallback={null}>
        {/* Só monta depois de aberto -- assim o cmdk nem é baixado antes do
            primeiro ⌘K. */}
        {searchOpen && <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />}
        {/* Configuração de empresa é do dono. Funcionário herda e nunca configura. */}
        {isAdmin && <OnboardingModal />}
      </Suspense>
    </SidebarProvider>
  );
}
